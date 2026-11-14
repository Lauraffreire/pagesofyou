/* Atelier : pages indépendantes, pinceaux et objets de carnet. */
function designMarkup(design, editable = false) {
  const regular = {
    ...design,
    elements: design.elements.filter(item => item.type !== 'stroke')
  };
  let html = baseDesignMarkup(regular, editable);
  // Les traits gardent leur ordre de calque avec les autres éléments.
  const content = design.elements.map(item => {
    if (item.type !== 'stroke') {
      let node = baseDesignMarkup({
        ...design,
        elements: [item]
      }, editable);
      node = node.slice(node.indexOf('>') + 1, node.lastIndexOf('</div>'));
      if (window.PoyObjects?.find(item.objectStyle) || window.PoyObjects?.findShape(item.shape)) {
        node = node.replace('style="', 'style="' + PoyObjects.style(item));
        if (item.type === 'postit') node = node.replace('></div>', '>' + e(item.text || '') + '</div>');
        return node;
      }
      if (item.type === 'postit') node = node.replace('design-element ',
        'design-element scrapbook-postit ').replace('></div>', '>' + e(item.text || '') + '</div>');
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
      '" ' + (editable ? 'tabindex="0" role="button" aria-label="Traço de desenho" data-design-id="' +
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
function setupDesigner(book) {
  setupBaseDesigner(book);
  const tools = document.querySelector('.design-tools');
  tools.insertAdjacentHTML('afterbegin',
    '<h2>Selecionar e desenhar</h2><div class="atelier-modes"><button type="button" id="atelier-select">↖ Selecionar / mover</button><button type="button" id="atelier-draw">✎ Desenhar</button></div><label>Pincel<select id="atelier-brush"><option value="pen">Caneta</option><option value="pencil">Lápis</option><option value="marker">Marcador translúcido</option><option value="brush">Pincel</option></select></label><label>Cor<input type="color" id="atelier-ink" value="' +
    atelierInk +
    '"></label><label>Espessura<input type="range" id="atelier-size" min="1" max="40" value="' +
    atelierSize + '"></label><h2>Papéis, fitas e clipes</h2>' + '<div class="atelier-objects">' +
    PoyObjects.presets.map(preset => '<button type="button" data-decoration="' + preset.id +
      '" aria-label="Adicionar ' + preset.label + '" title="Adicionar ' + preset.label +
      '"><span class="collage-preview" aria-hidden="true">' + PoyObjects.svg({objectStyle:preset.id,color:preset.color}) +
      '</span><small>' + preset.label + '</small></button>').join('') +
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
    const preset = PoyObjects.find(button.dataset.decoration);
    if (!preset) return;
    const item = {
      id: uid(), type: preset.type, objectStyle: preset.id,
      x: 100, y: 120, width: preset.width, height: preset.height,
      rotation: preset.type === 'tape' ? -6 : 0,
      color: preset.color, fontSize: 22, font: 'serif',
      text: '', placeholder: preset.type === 'postit' ? 'Escreve aqui…' : ''
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
