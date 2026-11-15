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

function baseDesignMarkup(design, editable = false) {
  return '<div class="design-sheet page-pattern-' + pagePattern(design.pattern) +
    '" style="background-color:' + designColor(design.background) + '" ' + (editable ? 'id="design-sheet"' :
      '') + '>' + design.elements.map(item => {
      const selected = editable && item.id === designSelection;
      return '<div class="design-element ' + (selected ? 'selected' : '') + '" ' + (editable ?
          'tabindex="0" role="button" aria-label="' + e(['text', 'photo', 'audio'].includes(item.type) ?
            item.text : PoyObjects.findShape(item.shape)?.label || (item.type === 'ellipse' ? 'Elipse' : 'Retângulo')) + '" data-design-id="' + e(item
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
    format: 'plain',
    pattern: 'none',
    patternColor: '#ffffff'
  };
  const value = { ...defaults, ...editorCache.spine };
  openModal('<h2 id="modal-title">Editar lombada</h2><form id="spine-form">' +
    '<div class="spine-editor"><div class="spine-settings">' +
    '<label class="field">Texto da lombada (opcional)<input name="title" maxlength="100" value="' + e(value.title) + '"></label>' +
    '<label class="field">Cor da lombada<input name="background" type="color" value="' + designColor(value.background) + '"></label>' +
    '<label class="field">Cor das letras<input name="color" type="color" value="' + designColor(value.color) + '"></label>' +
    '<label class="field">Formato da lombada<select name="format">' + PoyObjects.spineFormats.map(([id,label]) => '<option value="' + id + '">' + label + '</option>').join('') + '</select></label>' +
    '<div class="spine-format-options" role="group" aria-label="Formatos de lombada">' + PoyObjects.spineFormats.map(([id,label]) => '<button type="button" data-spine-format="' + id + '" aria-label="' + label + '"><i class="spine-format-sample" style="' + PoyObjects.spineArt(id,'#f7eed5') + '"></i><small>' + label + '</small></button>').join('') + '</div>' +
    '<label class="field">Padrão da lombada<select name="pattern">' + pagePatterns.map(([key, label]) =>
      '<option value="' + key + '">' + label + '</option>').join('') + '</select></label>' +
    '<label class="field">Cor do padrão<input name="patternColor" type="color" value="' + designColor(value.patternColor) + '"></label>' +
    '<label class="field">Tamanho das letras<input name="fontSize" type="number" min="14" max="48" value="' + designNumber(value.fontSize, 14, 48) + '"></label>' +
    '<label class="field">Sentido do texto<select name="direction"><option value="down">De cima para baixo</option>' +
    '<option value="up">De baixo para cima</option></select></label></div>' +
    '<div class="spine-preview" aria-label="Pré-visualização da lombada"><i class="spine-art" aria-hidden="true"></i><span></span></div></div>' +
    '<div class="spine-actions"><button class="button" type="submit">Guardar lombada</button>' +
    '<button class="button secondary" type="button" id="cancel-spine">Cancelar</button></div></form>');
  const form = document.querySelector('#spine-form');
  form.elements.direction.value = value.direction === 'up' ? 'up' : 'down';
  form.elements.format.value = PoyObjects.spineFormat(value.format);
  form.elements.pattern.value = pagePattern(value.pattern);
  const read = () => ({
    title: form.elements.title.value.trim(),
    format: PoyObjects.spineFormat(form.elements.format.value),
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
    node.querySelector('.spine-art').style.cssText = PoyObjects.spineArt(spine.format, spine.patternColor);
    form.querySelectorAll('[data-spine-format]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.spineFormat === spine.format));
      button.querySelector('i').style.cssText = PoyObjects.spineArt(button.dataset.spineFormat, spine.patternColor) + 'background-color:' + spine.background;
    });
    node.style.setProperty('--spine-pattern-color', spine.patternColor);
    node.style.color = spine.color;
    node.querySelector('span').textContent = spine.title;
    node.querySelector('span').style.fontSize = spine.fontSize + 'px';
    node.querySelector('span').style.transform = spine.direction === 'up' ? 'rotate(180deg)' : '';
  };
  form.oninput = preview;
  form.querySelectorAll('[data-spine-format]').forEach(button => button.onclick = () => {
    form.elements.format.value = button.dataset.spineFormat;
    preview();
  });
  form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
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

// As memórias recebidas são integradas como páginas com autoria e origem preservadas.
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

function setupBaseDesigner(book) {
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
    '<div class="design-tools"><h2>Adicionar</h2><button type="button" data-design-add="text">T Texto</button><button type="button" data-design-add="rectangle">□ Retângulo</button><button type="button" data-design-add="ellipse">○ Elipse</button>' +
    PoyObjects.shapes.map(shape => '<button type="button" data-design-add="rectangle" data-shape="' + shape.id + '"><span class="shape-menu-preview" aria-hidden="true">' + PoyObjects.svg({shape:shape.id,color:'#697658'}) + '</span>' + e(shape.label) + '</button>').join('') + '<h2>Histórico</h2><button type="button" id="design-undo">Desfazer</button><button type="button" id="design-redo">Refazer</button><h2>Camadas</h2><div id="design-layers"></div></div>'
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
      shape: button.dataset.shape || '',
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
      text: '',
      placeholder: 'Escreva aqui'
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

function renderSinglePageDesigner() {
  const target = document.querySelector('#live-preview');
  if (!target || !editorCache?.design) return;
  document.querySelectorAll('[data-design-section]').forEach(button => button.setAttribute('aria-pressed',
    String(button.dataset.designSection === editorCache.designMode)));
  const cover = editorCache.designMode === 'cover';
  document.querySelector('.design-background label').textContent = cover ? 'Cor da capa' :
    'Cor da p\u00e1gina';
  target.innerHTML = designMarkup(activeDesign(), true);
  const sheet = document.querySelector('#design-sheet');
  sheet.querySelectorAll('[data-design-id]').forEach(node => {
    const item = activeDesign().elements.find(element => element.id === node.dataset.designId);
    if (!['text', 'postit'].includes(item?.type)) return;
    const prompts = ['Escreva aqui', 'Escreve aqui…', 'Escreva aqui…', 'Uma pequena memória…', 'Une petite pensée…'];
    if (prompts.includes(item.text)) {
      item.placeholder = item.text;
      item.text = '';
      node.textContent = '';
    }
    node.setAttribute('data-placeholder', item.placeholder || (item.type === 'postit' ? 'Escreve aqui…' : 'Escreva aqui'));
    node.contentEditable = item.templateLine || item.type === 'postit' ? 'plaintext-only' : 'false';
    node.ondblclick = event => {
      event.stopPropagation();
      node.contentEditable = 'plaintext-only';
      node.focus();
    };
    node.setAttribute('role', 'textbox');
    node.setAttribute('aria-multiline', 'true');
    node.setAttribute('aria-label', item.type === 'postit' ? 'Texto do post-it' : 'Texto da página');
    node.title = item.templateLine || item.type === 'postit' ? 'Clique para escrever. Alt + arrastar para mover.' :
      'Arraste para mover. Use as pegas para ajustar o tamanho. Duplo clique para escrever.';
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
      node.contentEditable = item.templateLine || item.type === 'postit' ? 'plaintext-only' : 'false';
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
    '">' + e(['text', 'photo', 'audio'].includes(item.type) ? item.text.slice(0, 22) : PoyObjects.findShape(item.shape)?.label || (item.type ===
      'ellipse' ? 'Elipse' : 'Retângulo')) + '</button>').join('') || '<p>Sem elementos</p>';
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
    target.innerHTML = '';
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
