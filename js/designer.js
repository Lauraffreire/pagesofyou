/* Editor visual local. As coordenadas usam uma página de 600 × 840. */
let designSelectionIds = new Set();
let designSelection = null,
  designUndo = [],
  designRedo = [];
const designColor = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#d9d9d9';
const designNumber = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const pagePatterns = [
  ['none', 'Sem padrão'],
  ['lines', 'Linhas'],
  ['grid', 'Grelha'],
  ['dots', 'Pontos'],
  ['stripes', 'Riscas']
];
const pagePattern = value => pagePatterns.some(([key]) => key === value) ? value : 'none';

function designMarkup(design, editable = false) {
  return '<div class="design-sheet page-pattern-' + pagePattern(design.pattern) +
    '" style="background-color:' + designColor(design.background) + '" ' + (editable ? 'id="design-sheet"' :
      '') + '>' + design.elements.map(item => {
      const selected = editable && item.id === designSelection;
      return '<div class="design-element ' + (selected ? 'selected' : '') + '" ' + (editable ?
          'tabindex="0" role="button" aria-label="' + e(['text', 'photo', 'audio'].includes(item.type) ?
            item.text : item.type === 'ellipse' ? 'Elipse' : 'Retângulo') + '" data-design-id="' + e(item
            .id) + '"' : '') + ' style="left:' + item.x / 6 + '%;top:' + item.y / 8.4 + '%;width:' + item
        .width / 6 + '%;height:' + item.height / 8.4 + '%;transform:rotate(' + item.rotation +
        'deg);background:' + (item.type === 'text' ? 'transparent' : designColor(item.color)) + ';color:' +
        designColor(item.color) + ';border-radius:' + (item.type === 'ellipse' ? '50%' : '0') +
        ';font-size:' + item.fontSize / 6 + 'cqw;font-family:' + ({
          sans: 'Arial',
          serif: 'Georgia',
          mono: 'monospace'
        } [item.font] || 'Arial') + ';text-align:' + (['left', 'center', 'right'].includes(item.align) ?
          item.align : 'left') + ';font-weight:' + (item.bold ? '700' : '400') + '">' + (item.type ===
          'text' ? e(item.text) : '') + '</div>';
    }).join('') + '</div>';
}

function editBookSpine() {
  const defaults = {
    title: editorCache.values?.name || editorCache.bookInfo?.name || 'O meu livro',
    background: designColor(editorCache.values?.color || editorCache.coverDesign?.background),
    color: '#ffffff',
    fontSize: 28,
    direction: 'down',
    pattern: 'none',
    patternColor: '#ffffff'
  };
  const value = { ...defaults, ...editorCache.spine };
  openModal('<h2 id="modal-title">Editar lombada</h2><form id="spine-form">' +
    '<div class="spine-editor"><div class="spine-settings">' +
    '<label class="field">Texto da lombada<input name="title" maxlength="100" required value="' + e(value.title) + '"></label>' +
    '<label class="field">Cor da lombada<input name="background" type="color" value="' + designColor(value.background) + '"></label>' +
    '<label class="field">Cor das letras<input name="color" type="color" value="' + designColor(value.color) + '"></label>' +
    '<label class="field">Padrão da lombada<select name="pattern">' + pagePatterns.map(([key, label]) =>
      '<option value="' + key + '">' + label + '</option>').join('') + '</select></label>' +
    '<label class="field">Cor do padrão<input name="patternColor" type="color" value="' + designColor(value.patternColor) + '"></label>' +
    '<label class="field">Tamanho das letras<input name="fontSize" type="number" min="14" max="48" value="' + designNumber(value.fontSize, 14, 48) + '"></label>' +
    '<label class="field">Sentido do texto<select name="direction"><option value="down">De cima para baixo</option>' +
    '<option value="up">De baixo para cima</option></select></label></div>' +
    '<div class="spine-preview" aria-label="Pré-visualização da lombada"><span></span></div></div>' +
    '<div class="spine-actions"><button class="button" type="submit">Guardar lombada</button>' +
    '<button class="button secondary" type="button" id="cancel-spine">Cancelar</button></div></form>');
  const form = document.querySelector('#spine-form');
  form.elements.direction.value = value.direction === 'up' ? 'up' : 'down';
  form.elements.pattern.value = pagePattern(value.pattern);
  const read = () => ({
    title: form.elements.title.value.trim(),
    background: designColor(form.elements.background.value),
    color: designColor(form.elements.color.value),
    pattern: pagePattern(form.elements.pattern.value),
    patternColor: designColor(form.elements.patternColor.value),
    fontSize: designNumber(form.elements.fontSize.value, 14, 48),
    direction: form.elements.direction.value === 'up' ? 'up' : 'down'
  });
  const preview = () => {
    const spine = read();
    const node = form.querySelector('.spine-preview');
    node.className = 'spine-preview spine-pattern-' + spine.pattern;
    node.style.backgroundColor = spine.background;
    node.style.setProperty('--spine-pattern-color', spine.patternColor);
    node.style.color = spine.color;
    node.querySelector('span').textContent = spine.title;
    node.querySelector('span').style.fontSize = spine.fontSize + 'px';
    node.querySelector('span').style.transform = spine.direction === 'up' ? 'rotate(180deg)' : '';
  };
  form.oninput = preview;
  form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity() || !read().title) return;
    editorCache.spine = read();
    designChanged();
    closeModal();
  };
  form.querySelector('#cancel-spine').onclick = closeModal;
  preview();
}

function activeDesign() {
  return editorCache.designMode === 'cover' ? editorCache.coverDesign : editorCache.pages?.[editorCache
    .pageIndex || 0
  ] || editorCache.design;
}

function replaceActiveDesign(value) {
  if (editorCache.designMode === 'cover') editorCache.coverDesign = value;
  else if (editorCache.pages) {
    editorCache.pages[editorCache.pageIndex || 0] = value;
    editorCache.design = editorCache.pages[0];
  } else editorCache.design = value;
}

function designSnapshot() {
  designUndo.push(JSON.stringify(activeDesign()));
  if (designUndo.length > 60) designUndo.shift();
  designRedo = [];
}

function designChanged() {
  dirty = true;
  const status = document.querySelector('#draft-state');
  if (status) status.textContent = 'Alterações por guardar';
}

function defaultBookCover(book = {}) {
  return {
    background: /^#[a-f0-9]{6}$/i.test(book.color) ? book.color : '#697658',
    elements: [{
      id: 'cover-title', type: 'text', text: book.name || 'O meu livro',
      x: 55, y: 65, width: 490, height: 180, rotation: 0,
      color: '#ffffff', fontSize: 48, font: 'sans', align: 'left', bold: false
    }]
  };
}

// As composições recebidas como memórias também são páginas editáveis do livro.
function bookContentPages(book) {
  const pages = structuredClone(book.pages?.length ? book.pages : book.design ? [book.design] : []);
  (book.memories || []).forEach((memory, index) => {
    const key = memory.id || 'legacy-memory-' + index;
    const existingIndex = pages.findIndex(page => page.sourceMemoryId === key);
    const design = structuredClone(memory.design || {
      background: '#fffdf6',
      elements: [{ id: 'memory-text-' + index, type: 'text', x: 55, y: 65, width: 490,
        height: 650, rotation: 0, color: '#333333', fontSize: 25, font: 'serif', align: 'left',
        text: [memory.title, memory.text, memory.author].filter(Boolean).join('\n\n') }]
    });
    design.sourceMemoryId = key;
    if (memory.design && memory.author) design.elements.push({
      id: 'memory-credit-' + index, type: 'text', text: 'Partilhada por ' + memory.author,
      x: 55, y: 770, width: 490, height: 50, rotation: 0, color: '#5f6c65', fontSize: 18,
      font: 'sans', align: 'right'
    });
    if (!memory.design && /^data:image\/(png|jpeg|webp|gif);base64,/.test(memory.media || '')) {
      design.elements[0].height = 280;
      design.elements.push({ id: 'memory-photo-' + index, type: 'photo', src: memory.media,
        text: memory.mediaDescription || memory.title || 'Fotografia', x: 55, y: 380,
        width: 490, height: 340, rotation: 0, zoom: 100, cropX: 50, cropY: 50 });
    }
    if (existingIndex >= 0) pages[existingIndex] = design; else pages.push(design);
  });
  return pages;
}

function setupDesigner(book) {
  editorCache.design ||= structuredClone(book?.design || {
    background: '#ffffff',
    elements: []
  });
  const isBook = editorCache.key.startsWith('book/');
  if (isBook) editorCache.spine ||= structuredClone(book?.spine || {});
  if (isBook) editorCache.coverDesign ||= structuredClone(book?.coverDesign || defaultBookCover(
    book || { ...editorCache.bookInfo, ...editorCache.values }));
  if (isBook) {
    if (!editorCache.pages) {
      const memories = editorCache.memories || [];
      memories.forEach(memory => { memory.id ||= uid(); });
      const existingPages = book?.pages?.map(page => {
        const match = /^legacy-memory-(\d+)$/.exec(page.sourceMemoryId || '');
        return match && memories[Number(match[1])] ? { ...page, sourceMemoryId: memories[Number(match[1])].id } : page;
      });
      const pages = book ? bookContentPages({ ...book, pages: existingPages, memories }) : [];
      editorCache.pages = pages.length ? pages : [editorCache.design, { background: '#ffffff', elements: [] }];
    }
    editorCache.design = editorCache.pages[0];
    editorCache.pageIndex ||= 0;
  }
  editorCache.designMode ||= 'design';
  editorCache.designHistories = {};
  designSelection = null;
  designUndo = [];
  designRedo = [];
  const shell = document.querySelector('.editor-page');
  shell.classList.add('visual-editor');
  const sidebar = shell.querySelector('.editor-sidebar');
  sidebar.insertAdjacentHTML('beforeend',
    '<div class="design-tools"><h2>Adicionar</h2><button type="button" data-design-add="text">T Texto</button><button type="button" data-design-add="rectangle">□ Retângulo</button><button type="button" data-design-add="ellipse">○ Elipse</button><h2>Histórico</h2><button type="button" id="design-undo">Desfazer</button><button type="button" id="design-redo">Refazer</button><h2>Camadas</h2><div id="design-layers"></div></div>'
    );
  if (isBook) {
    sidebar.insertAdjacentHTML('afterbegin',
      '<nav class="design-sections" aria-label="Partes do livro"><button type="button" data-design-section="cover">Editar capa</button><button type="button" id="edit-spine">Editar lombada</button><button type="button" data-design-section="design">Editar p\u00e1ginas</button></nav>'
      );
    sidebar.querySelector('#edit-spine').onclick = editBookSpine;
    sidebar.querySelectorAll('[data-design-section]').forEach(button => button.onclick = () => {
      editorCache.designHistories[editorCache.designMode] = {
        undo: designUndo,
        redo: designRedo
      };
      editorCache.designMode = button.dataset.designSection;
      const saved = editorCache.designHistories[editorCache.designMode];
      designUndo = saved?.undo || [];
      designRedo = saved?.redo || [];
      designSelection = null;
      renderDesigner();
    });
  }
  const fields = document.querySelector('#editor-fields');
  fields.insertAdjacentHTML('beforebegin',
    '<div class="design-background"><label for="design-background">Cor da página</label><input id="design-background" type="color" value="' +
    designColor(activeDesign().background) + '"></div><div id="design-inspector"></div>');
  document.querySelectorAll('[data-design-add]').forEach(button => button.onclick = () => {
    designSnapshot();
    const type = button.dataset.designAdd;
    const item = {
      id: uid(),
      type,
      x: 80,
      y: 100,
      width: type === 'text' ? 300 : 180,
      height: type === 'text' ? 90 : 180,
      rotation: 0,
      color: type === 'text' ? '#222222' : '#b7c6bd',
      fontSize: 32,
      font: 'sans',
      align: 'left',
      bold: false,
      text: 'Escreva aqui'
    };
    activeDesign().elements.push(item);
    designSelection = item.id;
    atelierTool = 'select';
    designChanged();
    renderDesigner();
  });
  document.querySelector('#design-background').oninput = event => {
    designSnapshot();
    activeDesign().background = event.target.value;
    designChanged();
    renderDesigner();
  };
  for (const [id, from, to] of [
      ['design-undo', designUndo, designRedo],
      ['design-redo', designRedo, designUndo]
    ]) document.getElementById(id).onclick = () => {
    // As listas são consultadas novamente porque uma alteração limpa o refazer.
    const source = id === 'design-undo' ? designUndo : designRedo,
      destination = id === 'design-undo' ? designRedo : designUndo;
    if (!source.length) return;
    destination.push(JSON.stringify(activeDesign()));
    replaceActiveDesign(JSON.parse(source.pop()));
    designSelection = null;
    designChanged();
    renderDesigner();
  };
  renderDesigner();
}

function renderDesigner() {
  const target = document.querySelector('#live-preview');
  if (!target || !editorCache?.design) return;
  document.querySelectorAll('[data-design-section]').forEach(button => button.setAttribute('aria-pressed',
    String(button.dataset.designSection === editorCache.designMode)));
  const cover = editorCache.designMode === 'cover';
  document.querySelector('.design-background label').textContent = cover ? 'Cor da capa' :
    'Cor da p\u00e1gina';
  target.innerHTML = (editorCache.key.startsWith('book/') ? '<h2 class="design-part-title">' + (cover ?
      'Capa do livro' : 'P\u00e1ginas do livro') + '</h2>' : '') + designMarkup(activeDesign(), true) +
    '<p class="design-hint">Selecione um objeto e arraste para mover. Use as pegas para ajustar o tamanho. Shift + clique ou arraste uma caixa para selecionar v\u00e1rios. Delete elimina. Duplo clique no texto para escrever.</p>';
  const sheet = document.querySelector('#design-sheet');
  sheet.querySelectorAll('[data-design-id]').forEach(node => {
    const item = activeDesign().elements.find(element => element.id === node.dataset.designId);
    if (!['text', 'postit'].includes(item?.type)) return;
    node.contentEditable = 'false';
    node.ondblclick = event => {
      event.stopPropagation();
      node.contentEditable = 'plaintext-only';
      node.focus();
    };
    node.setAttribute('role', 'textbox');
    node.setAttribute('aria-multiline', 'true');
    node.setAttribute('aria-label', item.type === 'postit' ? 'Texto do post-it' : 'Texto da página');
    node.title = 'Arraste para mover. Use as pegas para ajustar o tamanho. Duplo clique para escrever.';
    node.onbeforeinput = () => designSnapshot();
    node.oninput = () => {
      item.text = node.innerText;
      designChanged();
      document.querySelector('#design-undo').disabled = !designUndo.length;
      document.querySelector('#design-redo').disabled = !designRedo.length;
      const input = document.querySelector('#design-inspector [data-property="text"]');
      if (input && designSelection === item.id) input.value = item.text;
      renderDesignLayers();
    };
    node.onblur = () => {
      node.contentEditable = 'false';
      if (designSelection === item.id) renderDesignInspector();
    };
  });
  sheet.querySelectorAll('audio').forEach(audio => {
    audio.onpointerdown = event => event.stopPropagation();
    audio.onkeydown = event => event.stopPropagation();
  });
  sheet.onpointerdown = event => {
    if (event.button !== 0) return;
    const node = event.target.closest('[data-design-id]');
    if (!node) {
      beginDesignMarquee(event, sheet);
      return;
    }
    const id = node.dataset.designId;
    const ids = new Set(selectedDesignObjects().map(item => item.id));
    if (event.shiftKey) {
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      designSelectionIds = ids;
      designSelection = [...ids].at(-1) || null;
    } else if (!ids.has(id)) {
      designSelection = id;
      designSelectionIds = new Set([id]);
    }
    renderDesignInspector();
    renderDesignLayers();
    renderPhotoHandles();
    if (!designSelectionIds.has(id)) return;
    if (node.isContentEditable && !event.altKey) return;
    event.preventDefault();
    node.focus({ preventScroll: true });
    const members = selectedDesignObjects();
    const origins = members.map(item => ({ ...item }));
    const group = selectionBounds(origins);
    const bounds = sheet.getBoundingClientRect();
    const startX = event.clientX, startY = event.clientY;
    let moved = false;
    node.setPointerCapture(event.pointerId);
    node.onpointermove = move => {
      if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return;
      if (!moved) {
        designSnapshot();
        moved = true;
      }
      const dx = designNumber((move.clientX - startX) * 600 / bounds.width, -group.x, 600 - group.x - group.width);
      const dy = designNumber((move.clientY - startY) * 840 / bounds.height, -group.y, 840 - group.y - group.height);
      members.forEach((item, index) => {
        item.x = origins[index].x + dx;
        item.y = origins[index].y + dy;
        updateDesignObjectNode(item);
      });
      positionPhotoHandles(members.length > 1 ? selectionBounds(members) : members[0]);
      designChanged();
    };
    node.onpointerup = node.onpointercancel = () => {
      node.onpointermove = null;
      if (moved) renderDesigner();
    };
  };
  sheet.onkeydown = event => {
    const node = event.target.closest('[data-design-id]');
    if (node?.isContentEditable) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        document.querySelector(event.shiftKey ? '#design-redo' : '#design-undo').click();
      }
      return;
    }
    if (node && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      designSelection = node.dataset.designId;
      renderDesigner();
    }
  };
  document.querySelector('#design-background').value = designColor(activeDesign().background);
  document.querySelectorAll('[data-page-pattern]').forEach(button => button.setAttribute('aria-pressed',
    String(button.dataset.pagePattern === pagePattern(activeDesign().pattern))));
  document.querySelector('#design-undo').disabled = !designUndo.length;
  document.querySelector('#design-redo').disabled = !designRedo.length;
  renderDesignInspector();
  renderDesignLayers();
  renderPhotoHandles();
}

function renderDesignLayers() {
  const target = document.querySelector('#design-layers');
  target.innerHTML = activeDesign().elements.slice().reverse().map(item =>
    '<button type="button" data-layer="' + e(item.id) + '" aria-pressed="' + selectedDesignObjects().some(selected => selected.id === item.id) +
    '">' + e(['text', 'photo', 'audio'].includes(item.type) ? item.text.slice(0, 22) : item.type ===
      'ellipse' ? 'Elipse' : 'Retângulo') + '</button>').join('') || '<p>Sem elementos</p>';
  target.querySelectorAll('[data-layer]').forEach(button => button.onclick = event => {
    const ids = new Set(selectedDesignObjects().map(item => item.id));
    if (event.shiftKey) {
      if (ids.has(button.dataset.layer)) ids.delete(button.dataset.layer); else ids.add(button.dataset.layer);
    } else { ids.clear(); ids.add(button.dataset.layer); }
    designSelectionIds = ids;
    designSelection = [...ids].at(-1) || null;
    renderDesigner();
  });
}

function renderDesignInspector() {
  const target = document.querySelector('#design-inspector'),
    item = activeDesign().elements.find(el => el.id === designSelection);
  if (selectedDesignObjects().length > 1) {
    target.innerHTML = '<h3>' + selectedDesignObjects().length + ' objetos selecionados</h3><p>Arraste para mover o conjunto. Use os cantos azuis para ajustar o tamanho. Delete elimina a selec\u00e7\u00e3o.</p>';
    return;
  }
  if (!item) {
    target.innerHTML = '<p class="design-hint">Adicione ou selecione um elemento.</p>';
    return;
  }
  const numeric = (key, label, max) => '<label>' + label + '<input data-property="' + key +
    '" type="number" min="' + (key === 'rotation' ? -180 : key === 'width' || key === 'height' || key ===
      'fontSize' ? 1 : 0) + '" max="' + max + '" value="' + item[key] + '"></label>';
  target.innerHTML = '<h3>Elemento selecionado</h3><div class="design-grid">' + numeric('x', 'X', 600) +
    numeric('y', 'Y', 840) + numeric('width', 'Largura', 600) + numeric('height', 'Altura', 840) + numeric(
      'rotation', 'Rotação', 180) + '<label>Cor<input type="color" data-property="color" value="' +
    designColor(item.color) + '"></label></div>' + (['text', 'postit', 'sticker'].includes(item.type) ?
      '<label>Texto<textarea data-property="text" maxlength="3000">' + e(item.text) + '</textarea></label>' +
      numeric('fontSize', 'Tamanho do texto', 160) + '<label>Tipo de letra<select data-property="font">' + [
        ['sans', 'Arial'],
        ['serif', 'Georgia'],
        ['mono', 'Monospace']
      ].map(([value, label]) => '<option value="' + value + '" ' + (item.font === value ? 'selected' : '') +
        '>' + label + '</option>').join('') +
      '</select></label><label>Alinhamento<select data-property="align">' + [
        ['left', 'Esquerda'],
        ['center', 'Centro'],
        ['right', 'Direita']
      ].map(([value, label]) => '<option value="' + value + '" ' + (item.align === value ? 'selected' : '') +
        '>' + label + '</option>').join('') +
      '</select></label><label><input type="checkbox" data-property="bold" ' + (item.bold ? 'checked' : '') +
      '> Negrito</label>' : '') +
    '<div class="design-operations"><button type="button" data-operation="duplicate">Duplicar</button><button type="button" data-operation="front">Trazer para a frente</button><button type="button" data-operation="back">Enviar para trás</button><button type="button" data-operation="delete">Eliminar</button></div>';
  target.querySelectorAll('[data-property]').forEach(input => input.onchange = () => {
    designSnapshot();
    const key = input.dataset.property;
    item[key] = input.type === 'number' ? designNumber(input.value, Number(input.min), Number(input
      .max)) : input.type === 'checkbox' ? input.checked : input.value;
    item.x = Math.min(item.x, 600 - item.width);
    item.y = Math.min(item.y, 840 - item.height);
    designChanged();
    renderDesigner();
  });
  target.querySelectorAll('[data-operation]').forEach(button => button.onclick = () => {
    designSnapshot();
    const elements = activeDesign().elements,
      index = elements.indexOf(item);
    if (button.dataset.operation === 'duplicate') {
      const copy = {
        ...item,
        id: uid(),
        x: Math.min(item.x + 20, 600 - item.width),
        y: Math.min(item.y + 20, 840 - item.height)
      };
      elements.push(copy);
      designSelection = copy.id;
    } else {
      elements.splice(index, 1);
      if (button.dataset.operation === 'front') elements.push(item);
      if (button.dataset.operation === 'back') elements.unshift(item);
      if (button.dataset.operation === 'delete') designSelection = null;
    }
    designChanged();
    renderDesigner();
  });
  renderMediaInspector(target, item);
}

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
    width: item.width / 6 + '%', height: item.height / 8.4 + '%' });
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
  sheet.append(frame);
  positionPhotoHandles(item);
  const apply = geometry => {
    Object.assign(item, geometry);
    if (grouped) {
      transformDesignGroup(members, memberOrigins, groupOrigin, geometry);
      members.forEach(updateDesignObjectNode);
      positionPhotoHandles(item);
      return;
    }
    Object.assign(node.style, { left: item.x / 6 + '%', top: item.y / 8.4 + '%',
      width: item.width / 6 + '%', height: item.height / 8.4 + '%' });
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
/* Atelier : pages indépendantes, pinceaux et objets de carnet. */
const plainDesignMarkup = designMarkup;
designMarkup = function(design, editable = false) {
  const regular = {
    ...design,
    elements: design.elements.filter(item => item.type !== 'stroke')
  };
  let html = plainDesignMarkup(regular, editable);
  // Les traits gardent leur ordre de calque avec les autres éléments.
  const content = design.elements.map(item => {
    if (item.type !== 'stroke') {
      let node = plainDesignMarkup({
        ...design,
        elements: [item]
      }, editable);
      node = node.slice(node.indexOf('>') + 1, node.lastIndexOf('</div>'));
      if (item.type === 'postit') node = node.replace('design-element ',
        'design-element scrapbook-postit ').replace('></div>', '>' + e(item.text ||
        'Une petite pensée…') + '</div>');
      if (item.type === 'sticker' || item.type === 'clip') node = node.replace('></div>',
        '><span class="scrapbook-symbol">' + e(item.type === 'clip' ? '📎' : item.text || '🌸') +
        '</span></div>');
      if (item.type === 'tape') node = node.replace('design-element ',
      'design-element scrapbook-tape ');
      if (item.type === 'text' && item.templateLine) node = node.replace('design-element ',
        'design-element template-line ');
      if (item.type === 'photo' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(item.src || '')) {
        const zoom = designNumber(item.zoom || 100, 100, 300),
          x = designNumber(item.cropX ?? 50, 0, 100),
          y = designNumber(item.cropY ?? 50, 0, 100);
        node = node.replace('design-element ', 'design-element scrapbook-photo ').replace('></div>',
          '><img draggable="false" src="' + e(item.src) + '" alt="' + e(item.text || 'Fotografia') +
          '" style="object-position:' + x + '% ' + y + '%;transform:scale(' + zoom / 100 +
          ');transform-origin:' + x + '% ' + y + '%"></div>');
      }
      if (item.type === 'audio' && /^data:audio\/(mpeg|wav|x-wav|ogg|mp4|aac|webm);base64,/.test(item
          .src || '')) node = node.replace('design-element ', 'design-element scrapbook-audio ')
        .replace('></div>', '><span>' + e(item.text || 'Som') +
          '</span><audio controls preload="metadata" src="' + e(item.src) + '" aria-label="' + e(item
            .text || 'Som') + '"></audio></div>');
      return node;
    }
    return '<div class="design-element ' + (editable && item.id === designSelection ? 'selected' : '') +
      '" ' + (editable ? 'tabindex="0" role="button" aria-label="Tra?o de desenho" data-design-id="' +
        e(item.id) + '"' : '') + ' style="left:' + item.x / 6 + '%;top:' + item.y / 8.4 + '%;width:' +
      item.width / 6 + '%;height:' + item.height / 8.4 + '%;transform:rotate(' + item.rotation +
      'deg)"><svg viewBox="0 0 ' + item.width + ' ' + item.height +
      '" width="100%" height="100%" preserveAspectRatio="none"><path d="' + e(item.path) +
      '" fill="none" stroke="' + designColor(item.color) + '" stroke-width="' + item.strokeWidth +
      '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (item.brush === 'marker' ? '.3' :
        item.brush === 'pencil' ? '.65' : '1') + '"/></svg></div>';
  }).join('');
  return html.slice(0, html.indexOf('>') + 1) + content + '</div>';
};
let atelierTool = 'select',
  atelierBrush = 'pen',
  atelierInk = '#3d4b42',
  atelierSize = 6;
const atelierTemplates = [{
  id: 'love-list',
  title: '10 coisas que gosto em ti',
  lines: 10
}, {
  id: 'memories-list',
  title: '5 mem\u00f3rias boas contigo',
  lines: 5
}];

function insertAtelierTemplate(id) {
  const template = atelierTemplates.find(item => item.id === id);
  if (!template) return;
  designSnapshot();
  const text = (value, x, y, width, height, fontSize, bold = false) => ({
    id: uid(),
    type: 'text',
    text: value,
    x,
    y,
    width,
    height,
    fontSize,
    bold,
    rotation: 0,
    color: '#4d5945',
    font: 'serif',
    align: 'left'
  });
  const title = text(template.title, 55, 65, 490, 110, 34, true);
  const rows = Array.from({
    length: template.lines
  }, (_, index) => ({
    ...text((index + 1) + '. ', 65, 205 + index * 50, 470, 38, 23),
    templateLine: true
  }));
  activeDesign().elements.push(title, ...rows);
  designSelection = rows[0].id;
  atelierTool = 'select';
  designChanged();
  renderDesigner();
  announce('Modelo adicionado. Clique em cada linha para completar.');
}
const originalSetupDesigner = setupDesigner;
setupDesigner = function(book) {
  originalSetupDesigner(book);
  const tools = document.querySelector('.design-tools');
  tools.insertAdjacentHTML('afterbegin',
    '<h2>Selecionar e desenhar</h2><div class="atelier-modes"><button type="button" id="atelier-select">↖ Selecionar / mover</button><button type="button" id="atelier-draw">✎ Desenhar</button></div><label>Pincel<select id="atelier-brush"><option value="pen">Caneta</option><option value="pencil">Lápis</option><option value="marker">Marcador translúcido</option><option value="brush">Pincel</option></select></label><label>Cor<input type="color" id="atelier-ink" value="' +
    atelierInk +
    '"></label><label>Espessura<input type="range" id="atelier-size" min="1" max="40" value="' +
    atelierSize + '"></label><h2>Decorar</h2>' + '<div class="atelier-objects">' + [
      ['postit', 'Post-it'],
      ['sticker', 'Sticker'],
      ['tape', 'Fita'],
      ['clip', 'Clip']
    ].map(([type, label]) => '<button type="button" data-decoration="' + type +
      '" aria-label="Adicionar ' + label + '" title="Adicionar ' + label +
      '"><span class="object-preview object-preview-' + type + '" aria-hidden="true">' + (type ===
        'sticker' ? '&#127800;' : type === 'clip' ? '&#128206;' : '') + '</span></button>').join('') +
    '</div><h2>Padrões</h2><div class="atelier-patterns" role="group" aria-label="Padrão da página">' +
    pagePatterns.map(([key, label]) => '<button type="button" data-page-pattern="' + key +
      '" aria-pressed="false" title="' + label + '"><span class="pattern-preview page-pattern-' + key +
      '" aria-hidden="true"></span><span>' + label + '</span></button>').join('') + '</div>');
  document.querySelector('#atelier-select').onclick = () => {
    atelierTool = 'select';
    renderDesigner();
  };
  document.querySelector('#atelier-draw').onclick = () => {
    atelierTool = 'draw';
    designSelection = null;
    renderDesigner();
  };
  document.querySelector('#atelier-brush').value = atelierBrush;
  document.querySelector('#atelier-brush').onchange = ev => {
    atelierBrush = ev.target.value;
    atelierTool = 'draw';
    renderDesigner();
  };
  document.querySelector('#atelier-ink').oninput = ev => atelierInk = ev.target.value;
  document.querySelector('#atelier-size').oninput = ev => atelierSize = Number(ev.target.value);
  tools.querySelectorAll('[data-decoration]').forEach(button => button.onclick = () => {
    designSnapshot();
    const type = button.dataset.decoration;
    const item = {
      id: uid(),
      type,
      x: 100,
      y: 120,
      width: type === 'clip' ? 65 : 180,
      height: type === 'tape' ? 45 : type === 'clip' ? 110 : 180,
      rotation: type === 'tape' ? -8 : 0,
      color: type === 'postit' ? '#f4df88' : type === 'tape' ? '#d3b4bb' : '#ffffff',
      fontSize: 26,
      font: 'serif',
      text: type === 'sticker' ? '🌸' : type === 'postit' ? 'Uma pequena memória…' : ''
    };
    activeDesign().elements.push(item);
    designSelection = item.id;
    atelierTool = 'select';
    designChanged();
    renderDesigner();
  });
  tools.querySelectorAll('[data-page-pattern]').forEach(button => button.onclick = () => {
    if (pagePattern(activeDesign().pattern) === button.dataset.pagePattern) return;
    designSnapshot();
    activeDesign().pattern = button.dataset.pagePattern;
    designChanged();
    renderDesigner();
  });
  tools.insertAdjacentHTML('beforeend',
    '<h2>Fotos</h2><label class="atelier-upload">Adicionar fotografia<input type="file" id="atelier-photo" accept="image/png,image/jpeg,image/webp,image/gif"></label><p class="design-hint">At\u00e9 2 MB por ficheiro. Selecione uma foto na p\u00e1gina para ajustar o tamanho e recortar.</p>'
    );
  for (const type of ['photo']) document.querySelector('#atelier-' + type).onchange = async event => {
    const input = event.target,
      file = input.files[0];
    if (!file) return;
    const valid = /^image\/(png|jpeg|webp|gif)$/;
    if (file.size > 2 * 1024 * 1024 || !valid.test(file.type)) {
      input.value = '';
      announce('Escolha um formato indicado com, no m\u00e1ximo, 2 MB.');
      return;
    }
    const destination = activeDesign();
    try {
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      let width = 360,
        height = 110;
      if (type === 'photo') {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
        const scale = Math.min(360 / image.naturalWidth, 480 / image.naturalHeight);
        width = Math.round(image.naturalWidth * scale);
        height = Math.round(image.naturalHeight * scale);
      }
      if (activeDesign() !== destination) return announce(
        'Volte \u00e0 p\u00e1gina e adicione novamente o ficheiro.');
      designSnapshot();
      const item = {
        id: uid(),
        type,
        src,
        text: file.name,
        x: 80,
        y: 100,
        width,
        height,
        rotation: 0,
        color: '#ffffff',
        fontSize: 20,
        zoom: 100,
        cropX: 50,
        cropY: 50
      };
      destination.elements.push(item);
      designSelection = item.id;
      atelierTool = 'select';
      designChanged();
      renderDesigner();
      announce('Fotografia adicionada.');
    } catch (error) {
      announce('N\u00e3o foi poss\u00edvel abrir o ficheiro.');
    } finally {
      input.value = '';
    }
  };
  tools.insertAdjacentHTML('beforeend',
    '<h2>Modelos</h2><div class="atelier-templates"><p class="design-hint">Escolha um modelo e complete o texto na página.</p>' +
    atelierTemplates.map(template => '<button type="button" class="atelier-template" data-template="' +
      template.id + '" aria-label="Adicionar modelo: ' + e(template.title) +
      '"><span class="template-preview" aria-hidden="true"><strong>' + e(template.title) + '</strong>' +
      Array.from({
        length: template.lines
      }, (_, index) => '<span>' + (index + 1) + '.</span>').join('') +
      '</span><span class="template-name">' + e(template.title) + '</span><small>' + template.lines +
      ' linhas para completar</small></button>').join('') + '</div>');
  tools.querySelectorAll('[data-template]').forEach(button => button.onclick = () => insertAtelierTemplate(
    button.dataset.template));
  organizeDesignerPanels();
  renderDesigner();
};

function organizeDesignerPanels() {
  const sidebar = document.querySelector('.editor-sidebar'),
    properties = document.querySelector('.editor-properties'),
    tools = document.querySelector('.design-tools');
  sidebar.insertAdjacentHTML('beforeend',
    '<section class="editor-page-navigation"><div class="editor-pages-heading"><button type="button" id="atelier-pages-toggle" aria-expanded="true" aria-controls="atelier-page-list">▾ <span>Páginas</span></button><div id="atelier-page-tools"><button type="button" id="atelier-add" aria-label="Adicionar página" title="Adicionar página">+</button><button type="button" id="atelier-delete" aria-label="Eliminar página selecionada" title="Eliminar página selecionada">−</button></div></div><div id="atelier-page-list"></div></section><section class="editor-layer-navigation"><h2>Camadas</h2></section>'
    );
  document.querySelector('#atelier-pages-toggle').onclick = event => {
    const button = event.currentTarget,
      list = document.querySelector('#atelier-page-list');
    list.hidden = !list.hidden;
    button.setAttribute('aria-expanded', String(!list.hidden));
    button.firstChild.textContent = list.hidden ? '▸ ' : '▾ ';
  };
  const layers = document.querySelector('#design-layers');
  if (layers.previousElementSibling?.tagName === 'H2') layers.previousElementSibling.remove();
  sidebar.querySelector('.editor-layer-navigation').append(layers);
  const undo = document.querySelector('#design-undo'),
    redo = document.querySelector('#design-redo');
  if (undo.previousElementSibling?.tagName === 'H2') undo.previousElementSibling.remove();
  const history = document.createElement('div');
  history.className = 'editor-history-arrows';
  history.setAttribute('role', 'group');
  history.setAttribute('aria-label', 'Desfazer e refazer');
  for (const [button, label, symbol] of [
      [undo, 'Desfazer', '↶'],
      [redo, 'Refazer', '↷']
    ]) {
    button.textContent = symbol;
    button.title = label;
    button.setAttribute('aria-label', label);
    history.append(button);
  }
  document.querySelector('.editor-canvas-head').prepend(history);
  const groups = document.createElement('div');
  groups.className = 'editor-tool-groups';
  let group;
  for (const node of [...tools.children]) {
    if (node.tagName === 'H2') {
      group = document.createElement('details');
      group.className = 'editor-tool-group';
      group.open = node.textContent !== 'Desenhar' && node.textContent !== 'Histórico';
      const summary = document.createElement('summary');
      summary.textContent = node.textContent;
      group.append(summary);
      groups.append(group);
    } else if (group) group.append(node);
  }
  tools.replaceChildren(groups);
  properties.querySelector('h2').after(tools);
}
const singlePageDesigner = renderDesigner;
renderDesigner = function() {
  singlePageDesigner();
  const target = document.querySelector('#live-preview');
  if (!target) return;
  const isBook = Boolean(editorCache.pages),
    cover = editorCache.designMode === 'cover';
  if (isBook && !cover) {
    const index = editorCache.pageIndex || 0,
      start = Math.floor(index / 2) * 2;
    const sheet = target.querySelector('#design-sheet');
    const spread = document.createElement('div');
    spread.className = 'atelier-spread';
    sheet.before(spread);
    for (let i = start; i < start + 2; i++) {
      const slot = document.createElement('section');
      slot.className = 'atelier-page' + (i === index ? ' active' : '');
      if (i === index) slot.append(sheet);
      else if (editorCache.pages[i]) {
        slot.innerHTML = designMarkup(editorCache.pages[i]);
        slot.querySelector('.design-sheet').tabIndex = 0;
        slot.querySelector('.design-sheet').setAttribute('aria-label', 'Editar página ' + (i + 1));
        slot.onclick = () => changeAtelierPage(i);
        slot.onkeydown = ev => {
          if (ev.key === 'Enter') changeAtelierPage(i);
        };
      } else slot.innerHTML = '<div class="atelier-empty">Fim do livro</div>';
      const previous = i === start;
      slot.insertAdjacentHTML('beforeend', '<div class="editor-book-navigation ' + (previous ?
          'book-navigation-back' : 'book-navigation-forward') + '"><button type="button" aria-label="' + (
          previous ? 'Páginas anteriores' : 'Páginas seguintes') + '" ' + ((previous ? start === 0 :
          start + 2 >= editorCache.pages.length) ? 'disabled' : '') + '>' + (previous ? '←' : '→') +
        '</button></div>');
      slot.querySelector('.editor-book-navigation button').onclick = event => {
        event.stopPropagation();
        changeAtelierPage(previous ? start - 2 : start + 2);
      };
      slot.addEventListener('keydown', event => {
        if (event.target.closest('.editor-book-navigation')) event.stopPropagation();
      }, true);
      spread.append(slot);
    }

  }
  document.querySelector('#atelier-select')?.setAttribute('aria-pressed', String(atelierTool === 'select'));
  document.querySelector('#atelier-draw')?.setAttribute('aria-pressed', String(atelierTool === 'draw'));
  const sheet = target.querySelector('#design-sheet');
  if (atelierTool === 'draw') {
    sheet.classList.add('drawing');
    sheet.onpointerdown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const bounds = sheet.getBoundingClientRect();
      const point = ev => [Math.max(0, Math.min(600, (ev.clientX - bounds.left) * 600 / bounds.width)),
        Math.max(0, Math.min(840, (ev.clientY - bounds.top) * 840 / bounds.height))
      ];
      const points = [point(event)];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 600 840');
      svg.classList.add('drawing-overlay');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', atelierInk);
      path.setAttribute('stroke-width', atelierSize * (atelierBrush === 'brush' ? 2 : 1));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('opacity', atelierBrush === 'marker' ? '.3' : atelierBrush === 'pencil' ? '.65' :
        '1');
      svg.append(path);
      sheet.append(svg);
      sheet.setPointerCapture(event.pointerId);
      const update = () => path.setAttribute('d', 'M' + points.map(p => p.join(' ')).join(' L'));
      points.push([points[0][0] + .1, points[0][1] + .1]);
      update();
      sheet.onpointermove = ev => {
        points.push(point(ev));
        update();
      };
      const finish = () => {
        sheet.onpointermove = null;
        sheet.onpointerup = null;
        sheet.onpointercancel = null;
        designSnapshot();
        activeDesign().elements.push({
          id: uid(),
          type: 'stroke',
          x: 0,
          y: 0,
          width: 600,
          height: 840,
          rotation: 0,
          color: atelierInk,
          strokeWidth: atelierSize * (atelierBrush === 'brush' ? 2 : 1),
          brush: atelierBrush,
          path: path.getAttribute('d'),
          fontSize: 32
        });
        designChanged();
        renderDesigner();
      };
      sheet.onpointerup = finish;
      sheet.onpointercancel = finish;
    };
  }
  const pageTools = document.querySelector('#atelier-page-tools');
  if (pageTools) {
    const add = document.querySelector('#atelier-add'),
      remove = document.querySelector('#atelier-delete');
    add.disabled = !isBook || editorCache.pages.length >= 100;
    add.onclick = () => {
      editorCache.designMode = 'design';
      editorCache.pageIndex = editorCache.pages.length;
      resizeAtelierPages(editorCache.pages.length + 1);
    };
    remove.hidden = !isBook || cover;
    remove.disabled = !isBook || editorCache.pages.length <= 1;
    remove.onclick = () => {
      if (remove.disabled || cover) return;
      const index = editorCache.pageIndex || 0;
      confirmDialog('Eliminar esta p\u00e1gina?',
        'O conte\u00fado desta p\u00e1gina ser\u00e1 removido do rascunho.', () => {
          editorCache.pages.splice(index, 1);
          finishPageResize(Math.min(index, editorCache.pages.length - 1));
        });
    };
    const list = document.querySelector('#atelier-page-list');
    list.innerHTML = (editorCache.pages || []).map((_, i) => '<button type="button" data-editor-page="' +
      i + '" aria-pressed="' + (!cover && i === (editorCache.pageIndex || 0)) + '">Página ' + (i + 1) +
      '</button>').join('');
    list.querySelectorAll('[data-editor-page]').forEach(button => button.onclick = () => {
      editorCache.designMode = 'design';
      changeAtelierPage(Number(button.dataset.editorPage));
    });
  }
};

function changeAtelierPage(index) {
  editorCache.pageIndex = index;
  designSelection = null;
  designUndo = [];
  designRedo = [];
  renderDesigner();
}

function finishPageResize(index) {
  editorCache.design = editorCache.pages[0];
  designChanged();
  changeAtelierPage(index);
}

function resizeAtelierPages(count) {
  if (editorCache.pages.slice(count).some(page => page.sourceMemoryId)) {
    announce('As mem\u00f3rias aceites n\u00e3o podem ser removidas.');
    return;
  }
  const apply = () => {
    while (editorCache.pages.length < count) editorCache.pages.push({
      background: '#ffffff',
      elements: []
    });
    editorCache.pages.length = count;
    finishPageResize(Math.min(editorCache.pageIndex, count - 1));
  };
  if (count < editorCache.pages.length) confirmDialog('Reduzir o número de páginas?',
    'As páginas finais e o respetivo conteúdo serão removidos do rascunho.', apply);
  else apply();
}

function renderBookPreview(book, isDraft = true) {
  book = {
    ...book,
    coverDesign: book.coverDesign || defaultBookCover(book)
  };
  main.innerHTML =
    '<div class="page reader-page"><button class="back-link" data-action="return-editor">← Voltar à edição</button><h1>O teu livro</h1><p class="design-hint">Arrasta para a esquerda para abrir e folhear. Arrasta para a direita para voltar.</p><div id="flipbook" tabindex="0" role="region" aria-label="Pré-visualização do livro"></div><div class="page-controls"><button class="button secondary" id="flip-prev">← Anterior</button><span id="flip-status" aria-live="polite"></span><button class="button secondary" id="flip-next">Abrir livro →</button></div><div class="review-actions"><button class="button secondary" data-action="return-editor">Voltar à edição</button><button class="button" data-action="publish">' +
    (draft?.id ? 'Guardar alterações' : 'Publicar livro') + '</button></div></div>';
  if (isDraft) main.querySelector('.review-actions').insertAdjacentHTML('afterbegin',
    '<button type="button" class="button secondary" data-action="save-book-draft">Guardar rascunho</button>'
    );
  if (!isDraft) {
    main.querySelector('[data-action=return-editor]').outerHTML = back('#meus-livros');
    main.querySelector('.review-actions').innerHTML = owns(book) ? '<a class="button" href="#editar/' + e(book
      .id) + '">Editar livro</a>' : '';
    if (owns(book)) main.querySelector('.review-actions').insertAdjacentHTML('afterend',
      '<p class="code-label">Código do livro: ' + e(book.code || '') + '</p>');
  }
  const pages = bookContentPages(book);
  if (!pages.length) pages.push({
    background: '#fffdf6',
    elements: []
  });
  let position = -1;
  const root = document.querySelector('#flipbook');
  const paint = () => {
    root.className = position < 0 ? 'flipbook closed' : 'flipbook open';
    root.innerHTML = position < 0 ? '<div class="flip-cover">' + designMarkup(book.coverDesign) +
      '<span class="flip-cover-title">' + (book.coverDesign.elements.length ? '' : e(book.name)) +
      '</span></div>' : '<div class="atelier-spread">' + [position, position + 1].map(i =>
        '<section class="atelier-page">' + (pages[i] ? designMarkup(pages[i]) :
          '<div class="atelier-empty">Fim</div>') + '<small>' + (pages[i] ? i + 1 : '') +
        '</small></section>').join('') + '</div>';
    document.querySelector('#flip-status').textContent = position < 0 ? 'Capa' : ('Páginas ' + (position +
      1) + (pages[position + 1] ? '–' + (position + 2) : '') + ' de ' + pages.length);
    document.querySelector('#flip-prev').disabled = position < 0;
    document.querySelector('#flip-next').disabled = position >= 0 && position + 2 >= pages.length;
    document.querySelector('#flip-next').textContent = position < 0 ? 'Abrir livro →' : 'Seguinte →';
  };
  const turn = direction => {
    const next = position < 0 ? (direction > 0 ? 0 : -1) : position + direction * 2;
    if (direction < 0 && position === 0) position = -1;
    else if (next >= 0 && next < pages.length) position = next;
    paint();
  };
  document.querySelector('#flip-prev').onclick = () => turn(-1);
  document.querySelector('#flip-next').onclick = () => turn(1);
  root.onkeydown = ev => {
    if (['ArrowLeft', 'ArrowRight'].includes(ev.key)) {
      ev.preventDefault();
      turn(ev.key === 'ArrowRight' ? 1 : -1);
    }
  };
  root.onpointerdown = ev => {
    if (ev.button !== 0) return;
    const start = ev.clientX;
    root.setPointerCapture(ev.pointerId);
    root.onpointermove = move => {
      const delta = move.clientX - start;
      root.style.transform = 'perspective(1400px) rotateY(' + Math.max(-18, Math.min(18, delta / 12)) +
        'deg)';
    };
    root.onpointerup = end => {
      root.onpointermove = null;
      root.style.transform = '';
      if (Math.abs(end.clientX - start) > 45) turn(end.clientX < start ? 1 : -1);
    };
    root.onpointercancel = () => {
      root.onpointermove = null;
      root.style.transform = '';
    };
  };
  paint();
}

// As páginas provenientes de memórias aceites s?o apenas de leitura.
const renderDesignerWithMemoryPages = renderDesigner;
renderDesigner = function() {
  document.querySelectorAll('[data-memory-disabled]').forEach(node => {
    node.disabled = node.dataset.memoryDisabled === 'true';
    delete node.dataset.memoryDisabled;
  });
  renderDesignerWithMemoryPages();
  if (!activeDesign().sourceMemoryId) return;
  designSelection = null;
  designSelectionIds.clear();
  const sheet = document.querySelector('#design-sheet');
  sheet.classList.remove('drawing');
  sheet.classList.add('accepted-memory-page');
  sheet.onpointerdown = event => { if (!event.target.closest('audio')) event.preventDefault(); };
  sheet.onkeydown = null;
  sheet.querySelectorAll('[data-design-id]').forEach(node => {
    node.contentEditable = 'false';
    node.ondblclick = node.onbeforeinput = node.oninput = node.onblur = null;
    node.classList.remove('selected');
    node.removeAttribute('tabindex');
  });
  document.querySelector('#photo-handles, #object-handles')?.remove();
  document.querySelector('#design-inspector').innerHTML = '<p>Memória aceite — apenas leitura. O conteúdo e a autoria não podem ser alterados.</p>';
  document.querySelectorAll('.design-tools button, .design-tools input, .design-tools select, #design-background, #atelier-delete, #design-layers button').forEach(node => {
    node.dataset.memoryDisabled = String(node.disabled);
    node.disabled = true;
  });
  document.querySelector('#live-preview .design-hint').textContent = 'Memória aceite — apenas leitura.';
};
