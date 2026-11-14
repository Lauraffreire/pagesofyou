// Geometria comum às pegas: cantos redimensionam; lados recortam sem esticar a imagem.
function photoHandleGeometry(origin, handle, dx, dy, ratio) {
  const angle = (origin.rotation || 0) * Math.PI / 180;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const result = { ...origin };
  let left = 0, top = 0;
  if (handle.length === 2) {
    const sx = handle.includes('w') ? -1 : 1;
    const sy = handle.includes('n') ? -1 : 1;
    // Projeção na diagonal mantém a proporção, mesmo quando o rato se afasta dela.
    const scale = Math.max(24 / Math.min(origin.width, origin.height),
      1 + (sx * localX * origin.width + sy * localY * origin.height) /
      (origin.width ** 2 + origin.height ** 2));
    const limited = Math.min(scale, 600 / origin.width, 840 / origin.height);
    result.width = origin.width * limited;
    result.height = origin.height * limited;
    if (sx < 0) left = origin.width - result.width;
    if (sy < 0) top = origin.height - result.height;
  } else {
    const baseWidth = Math.max(origin.width, origin.height * ratio);
    const imageWidth = baseWidth * (origin.zoom || 100) / 100;
    const imageHeight = imageWidth / ratio;
    const offsetX = (origin.width - imageWidth) * (origin.cropX ?? 50) / 100;
    const offsetY = (origin.height - imageHeight) * (origin.cropY ?? 50) / 100;
    const minWidth = Math.min(origin.width, Math.max(24, imageWidth / 3));
    const minHeight = Math.min(origin.height, Math.max(24, imageHeight / 3));
    if (handle === 'w') left = designNumber(localX, offsetX, origin.width - minWidth);
    if (handle === 'n') top = designNumber(localY, offsetY, origin.height - minHeight);
    result.width = handle === 'w' ? origin.width - left : handle === 'e' ?
      designNumber(origin.width + localX, minWidth, offsetX + imageWidth) : origin.width;
    result.height = handle === 'n' ? origin.height - top : handle === 's' ?
      designNumber(origin.height + localY, minHeight, offsetY + imageHeight) : origin.height;
    result.zoom = imageWidth / Math.max(result.width, result.height * ratio) * 100;
    result.cropX = imageWidth - result.width > .001 ?
      designNumber((left - offsetX) / (imageWidth - result.width) * 100, 0, 100) : 50;
    result.cropY = imageHeight - result.height > .001 ?
      designNumber((top - offsetY) / (imageHeight - result.height) * 100, 0, 100) : 50;
  }
  const centerX = left + (result.width - origin.width) / 2;
  const centerY = top + (result.height - origin.height) / 2;
  result.x = origin.x + centerX * Math.cos(angle) - centerY * Math.sin(angle) -
    (result.width - origin.width) / 2;
  result.y = origin.y + centerX * Math.sin(angle) + centerY * Math.cos(angle) -
    (result.height - origin.height) / 2;
  // Não deixar a moldura ultrapassar os limites da página.
  if (result.x < -.01 || result.y < -.01 || result.x + result.width > 600.01 ||
      result.y + result.height > 840.01) return { ...origin };
  return result;
}

function objectHandleGeometry(origin, handle, dx, dy, ratio) {
  let result;
  if (origin.type === 'photo' || handle.length === 2) {
    result = photoHandleGeometry(origin, handle, dx, dy, ratio);
  } else {
    const angle = (origin.rotation || 0) * Math.PI / 180;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    result = { ...origin };
    let left = 0, top = 0;
    if (handle === 'w' || handle === 'e') {
      result.width = Math.max(24, origin.width + (handle === 'w' ? -localX : localX));
      if (handle === 'w') left = origin.width - result.width;
    } else {
      result.height = Math.max(24, origin.height + (handle === 'n' ? -localY : localY));
      if (handle === 'n') top = origin.height - result.height;
    }
    const cx = left + (result.width - origin.width) / 2;
    const cy = top + (result.height - origin.height) / 2;
    result.x = origin.x + cx * Math.cos(angle) - cy * Math.sin(angle) - (result.width - origin.width) / 2;
    result.y = origin.y + cx * Math.sin(angle) + cy * Math.cos(angle) - (result.height - origin.height) / 2;
    if (result.x < 0 || result.y < 0 || result.x + result.width > 600 || result.y + result.height > 840) {
      return { ...origin };
    }
  }
  if (handle.length === 2 && ['text', 'postit'].includes(origin.type)) {
    result.fontSize = designNumber(origin.fontSize * result.width / origin.width, 8, 160);
  }
  return result;
}

// O atalho só atua enquanto o editor existe e nunca apaga um objeto ao escrever.
document.addEventListener('keydown', event => {
  if (!['Delete', 'Backspace'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey ||
      event.isComposing || document.querySelector('dialog[open]') || !designSelection || !document.querySelector('#design-sheet') ||
      event.target.closest('input, textarea, select, audio, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  if (activeDesign().sourceMemoryId) return;
  const elements = activeDesign().elements;
  const selected = new Set(selectedDesignObjects().map(item => item.id));
  if (!selected.size) return;
  event.preventDefault();
  designSnapshot();
  for (let i = elements.length - 1; i >= 0; i--) {
    if (selected.has(elements[i].id)) elements.splice(i, 1);
  }
  designSelection = null;
  designSelectionIds.clear();
  designChanged();
  renderDesigner();
  const sheet = document.querySelector('#design-sheet');
  sheet.tabIndex = -1;
  sheet.focus({ preventScroll: true });
});

function selectedDesignObjects() {
  if (activeDesign().sourceMemoryId) return [];
  const elements = activeDesign().elements;
  if (!designSelection) designSelectionIds.clear();
  else if (!designSelectionIds.has(designSelection)) designSelectionIds = new Set([designSelection]);
  return elements.filter(item => designSelectionIds.has(item.id));
}

function selectionBounds(items) {
  const corners = items.flatMap(item => {
    const angle = (item.rotation || 0) * Math.PI / 180;
    const cx = item.x + item.width / 2, cy = item.y + item.height / 2;
    return [-1, 1].flatMap(sx => [-1, 1].map(sy => ({
      x: cx + sx * item.width / 2 * Math.cos(angle) - sy * item.height / 2 * Math.sin(angle),
      y: cy + sx * item.width / 2 * Math.sin(angle) + sy * item.height / 2 * Math.cos(angle)
    })));
  });
  const x = Math.min(...corners.map(point => point.x));
  const y = Math.min(...corners.map(point => point.y));
  return { x, y, width: Math.max(...corners.map(point => point.x)) - x,
    height: Math.max(...corners.map(point => point.y)) - y };
}

function transformDesignGroup(members, origins, from, to) {
  const scale = to.width / from.width;
  members.forEach((item, index) => {
    const origin = origins[index];
    Object.assign(item, { x: to.x + (origin.x - from.x) * scale,
      y: to.y + (origin.y - from.y) * scale, width: origin.width * scale, height: origin.height * scale });
    if (['text', 'postit'].includes(item.type)) item.fontSize = origin.fontSize * scale;
  });
}

function updateDesignObjectNode(item) {
  const node = Array.from(document.querySelectorAll('#design-sheet [data-design-id]'))
    .find(el => el.dataset.designId === item.id);
  if (!node) return;
  Object.assign(node.style, { left: item.x / 6 + '%', top: item.y / 8.4 + '%',
    width: item.width / 6 + '%', height: item.height / 8.4 + '%',
    transform: 'rotate(' + (item.rotation || 0) + 'deg)' });
  if (['text', 'postit'].includes(item.type)) node.style.fontSize = item.fontSize / 6 + 'cqw';
}

function beginDesignMarquee(event, sheet) {
  event.preventDefault();
  const bounds = sheet.getBoundingClientRect();
  const point = ev => ({ x: designNumber((ev.clientX - bounds.left) * 600 / bounds.width, 0, 600),
    y: designNumber((ev.clientY - bounds.top) * 840 / bounds.height, 0, 840) });
  const start = point(event);
  const originalIds = event.shiftKey ? selectedDesignObjects().map(item => item.id) : [];
  const oldIds = selectedDesignObjects().map(item => item.id);
  const box = document.createElement('div');
  box.className = 'design-marquee';
  box.setAttribute('aria-hidden', 'true');
  sheet.append(box);
  sheet.tabIndex = -1;
  sheet.focus({ preventScroll: true });
  sheet.setPointerCapture(event.pointerId);
  const update = ev => {
    const end = point(ev);
    const rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
    Object.assign(box.style, { left: rect.x / 6 + '%', top: rect.y / 8.4 + '%',
      width: rect.width / 6 + '%', height: rect.height / 8.4 + '%' });
    const ids = new Set(originalIds);
    if (rect.width > 2 && rect.height > 2) activeDesign().elements.forEach(item => {
      const b = selectionBounds([item]);
      if (b.x < rect.x + rect.width && b.x + b.width > rect.x &&
          b.y < rect.y + rect.height && b.y + b.height > rect.y) ids.add(item.id);
    });
    designSelectionIds = ids;
    designSelection = [...ids].at(-1) || null;
    renderPhotoHandles();
  };
  sheet.onpointermove = update;
  const finish = cancelled => {
    sheet.onpointermove = sheet.onpointerup = sheet.onpointercancel = sheet.onlostpointercapture = null;
    if (cancelled) {
      designSelectionIds = new Set(oldIds);
      designSelection = oldIds.at(-1) || null;
    }
    box.remove();
    renderDesigner();
  };
  sheet.onpointerup = ev => { update(ev); finish(false); };
  sheet.onpointercancel = () => finish(true);
  sheet.onlostpointercapture = () => finish(false);
}

function rotatedObjectGeometry(origin, center, degrees) {
  const angle = degrees * Math.PI / 180;
  const dx = origin.x + origin.width / 2 - center.x;
  const dy = origin.y + origin.height / 2 - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle) - origin.width / 2,
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) - origin.height / 2,
    rotation: (((origin.rotation || 0) + degrees + 180) % 360 + 360) % 360 - 180
  };
}

function positionPhotoHandles(item) {
  const frame = document.querySelector('#photo-handles, #object-handles');
  if (!frame) return;
  Object.assign(frame.style, {
    left: item.x / 6 + '%', top: item.y / 8.4 + '%',
    width: item.width / 6 + '%', height: item.height / 8.4 + '%',
    transform: 'rotate(' + (item.rotation || 0) + 'deg)'
  });
  frame.querySelector('output').textContent = Math.round(item.width) + ' × ' + Math.round(item.height);
}

function renderPhotoHandles() {
  document.querySelector('#photo-handles, #object-handles')?.remove();
  const sheet = document.querySelector('#design-sheet');
  const members = selectedDesignObjects();
  const memberOrigins = members.map(item => ({ ...item }));
  const grouped = members.length > 1;
  const item = grouped ? { ...selectionBounds(members), id: designSelection, type: 'group', rotation: 0 } : members[0];
  if (!sheet) return;
  sheet.querySelectorAll('[data-design-id]').forEach(el => el.classList.toggle('selected', members.some(member => member.id === el.dataset.designId)));
  if (!item) return;
  const groupOrigin = { ...item };
  const node = Array.from(sheet.querySelectorAll('[data-design-id]')).find(el => el.dataset.designId === item.id);
  const image = grouped ? null : node?.querySelector('img');
  if (!node) return;
  const frame = document.createElement('div');
  frame.id = item.type === 'photo' ? 'photo-handles' : 'object-handles';
  frame.setAttribute('role', 'group');
  frame.setAttribute('aria-label', item.type === 'photo' ? 'Tamanho e recorte da fotografia' : 'Tamanho do objeto');
  const labels = { nw: 'superior esquerdo', n: 'superior', ne: 'superior direito',
    e: 'direito', se: 'inferior direito', s: 'inferior', sw: 'inferior esquerdo', w: 'esquerdo' };
  frame.innerHTML = Object.entries(labels).filter(([handle]) => !grouped || handle.length === 2).map(([handle, label]) =>
    '<button type="button" class="photo-handle handle-' + handle + '" data-handle="' + handle +
    '" aria-label="' + (handle.length === 2 ? 'Redimensionar: canto ' : item.type === 'photo' ? 'Recortar: lado ' : 'Redimensionar: lado ') + label +
    '" title="' + (handle.length === 2 || item.type !== 'photo' ? 'Arraste para redimensionar' : 'Arraste para recortar') +
    '. Use as setas para ajustar."></button>').join('') + '<output aria-label="Dimensões"></output>';
  frame.insertAdjacentHTML('beforeend', '<button type="button" class="rotation-handle" aria-label="Rodar objeto" title="Arraste para rodar. Shift: intervalos de 15 graus. Setas: ajustar rotação."><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10a7 7 0 1 0 0 5M19 4v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>');
  sheet.append(frame);
  positionPhotoHandles(item);
  const rotationHandle = frame.querySelector('.rotation-handle');
  const rotateMembers = (origins, center, delta, frameAngle) => {
    members.forEach((member, index) => {
      Object.assign(member, rotatedObjectGeometry(origins[index], center, delta));
      updateDesignObjectNode(member);
    });
    if (grouped) item.rotation = frameAngle + delta;
    positionPhotoHandles(item);
  };
  rotationHandle.onpointerdown = event => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.preventDefault();
    rotationHandle.focus({ preventScroll: true });
    const origins = members.map(member => ({ ...member }));
    const center = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
    const frameAngle = item.rotation || 0;
    const bounds = sheet.getBoundingClientRect();
    const pointerAngle = ev => Math.atan2((ev.clientY - bounds.top) * 840 / bounds.height - center.y,
      (ev.clientX - bounds.left) * 600 / bounds.width - center.x) * 180 / Math.PI;
    let lastAngle = pointerAngle(event), delta = 0, changed = false;
    const previousRedo = designRedo;
    rotationHandle.setPointerCapture(event.pointerId);
    rotationHandle.onpointermove = move => {
      const angle = pointerAngle(move);
      delta += ((angle - lastAngle + 540) % 360) - 180;
      lastAngle = angle;
      if (!changed && Math.abs(delta) < .5) return;
      if (!changed) { designSnapshot(); changed = true; }
      rotateMembers(origins, center, move.shiftKey ? Math.round(delta / 15) * 15 : delta, frameAngle);
    };
    const finish = cancelled => {
      rotationHandle.onpointermove = rotationHandle.onpointerup = rotationHandle.onpointercancel = rotationHandle.onlostpointercapture = null;
      if (!changed) return;
      if (cancelled) {
        members.forEach((member, index) => { Object.assign(member, origins[index]); updateDesignObjectNode(member); });
        if (grouped) item.rotation = frameAngle;
        designUndo.pop(); designRedo = previousRedo;
      } else designChanged();
      renderDesigner();
    };
    rotationHandle.onpointerup = () => finish(false);
    rotationHandle.onpointercancel = () => finish(true);
    rotationHandle.onlostpointercapture = () => finish(false);
  };
  rotationHandle.onkeydown = event => {
    event.stopPropagation();
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const delta = (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 15 : 1);
    designSnapshot();
    rotateMembers(members.map(member => ({ ...member })),
      { x: item.x + item.width / 2, y: item.y + item.height / 2 }, delta, item.rotation || 0);
    designChanged();
  };

  const apply = geometry => {
    Object.assign(item, geometry);
    if (grouped) {
      transformDesignGroup(members, memberOrigins, groupOrigin, geometry);
      members.forEach(updateDesignObjectNode);
      positionPhotoHandles(item);
      return;
    }
    Object.assign(node.style, { left: item.x / 6 + '%', top: item.y / 8.4 + '%',
      width: item.width / 6 + '%', height: item.height / 8.4 + '%',
    transform: 'rotate(' + (item.rotation || 0) + 'deg)' });
    if (item.type === 'text' || item.type === 'postit') node.style.fontSize = item.fontSize / 6 + 'cqw';
    if (image) {
      image.style.objectPosition = (item.cropX ?? 50) + '% ' + (item.cropY ?? 50) + '%';
      image.style.transformOrigin = image.style.objectPosition;
      image.style.transform = 'scale(' + (item.zoom || 100) / 100 + ')';
    }
    positionPhotoHandles(item);
  };
  frame.onpointerdown = event => {
    event.stopPropagation();
    const button = event.target.closest('[data-handle]');
    if (!button || event.button !== 0) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    const origin = { ...item }, bounds = sheet.getBoundingClientRect();
    const ratio = image?.naturalWidth / image?.naturalHeight || item.width / item.height;
    let changed = false;
    const previousRedo = designRedo;
    button.setPointerCapture(event.pointerId);
    button.onpointermove = move => {
      if (Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) < 2 && !changed) return;
      if (!changed) { designSnapshot(); changed = true; }
      apply(objectHandleGeometry(origin, button.dataset.handle,
        (move.clientX - event.clientX) * 600 / bounds.width,
        (move.clientY - event.clientY) * 840 / bounds.height, ratio));
    };
    const finish = cancelled => {
      button.onpointermove = button.onpointerup = button.onpointercancel = button.onlostpointercapture = null;
      if (!changed) return;
      if (cancelled) { apply(origin); designUndo.pop(); designRedo = previousRedo; }
      else designChanged();
      renderDesigner();
    };
    button.onpointerup = () => finish(false);
    button.onpointercancel = () => finish(true);
    button.onlostpointercapture = () => finish(false);
  };
  frame.onkeydown = event => {
    if (event.key === 'Delete' || event.key === 'Backspace') return;
    event.stopPropagation();
    const button = event.target.closest('[data-handle]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    designSnapshot();
    apply(objectHandleGeometry({ ...item }, button.dataset.handle,
      event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
      event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0,
      image?.naturalWidth / image?.naturalHeight || item.width / item.height));
    designChanged();
    document.querySelector('#design-undo').disabled = false;
    document.querySelector('#design-redo').disabled = true;
  };
}

function renderMediaInspector(target, item) {
  if (!['photo', 'audio'].includes(item.type)) return;
  if (item.type === 'audio') {
    target.insertAdjacentHTML('afterbegin',
      '<label>Nome do som<input id="audio-title" maxlength="120" value="' + e(item.text || 'Som') +
      '"></label>');
    target.querySelector('#audio-title').onchange = event => {
      designSnapshot();
      item.text = event.target.value;
      designChanged();
      renderDesigner();
    };
    return;
  }
  target.querySelector('.design-grid').remove();
  target.insertAdjacentHTML('afterbegin', '<section class="photo-controls"><h3>Editar fotografia</h3>' +
    '<p>Cantos: aumentar ou diminuir. Pegas nas bordas: recortar. Arraste a fotografia para mover.</p>' +
    '<button type="button" id="photo-reset">Repor recorte</button></section>');
  target.querySelector('#photo-reset').onclick = () => {
    designSnapshot();
    item.zoom = 100;
    item.cropX = 50;
    item.cropY = 50;
    designChanged();
    renderDesigner();
  };
}
