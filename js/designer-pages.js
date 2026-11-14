function renderBookDesigner() {
  renderSinglePageDesigner();
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
    '<div class="page reader-page"><button class="back-link" data-action="return-editor">← Voltar à edição</button><h1>O teu livro</h1><div id="flipbook" tabindex="0" role="region" aria-label="Pré-visualização do livro"></div><nav class="page-controls" aria-label="Folhear livro"><button type="button" class="reader-arrow" id="flip-prev" aria-label="Páginas anteriores"></button><button type="button" class="reader-arrow" id="flip-next" aria-label="Abrir livro"></button></nav><div class="review-actions"><button class="button secondary" data-action="return-editor">Voltar à edição</button><button class="button" data-action="publish">' +
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
    document.querySelector('#flip-prev').disabled = position < 0;
    document.querySelector('#flip-next').disabled = position >= 0 && position + 2 >= pages.length;
    document.querySelector('#flip-next').setAttribute('aria-label', position < 0 ? 'Abrir livro' : 'Páginas seguintes');
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

// As páginas provenientes de memórias aceites são apenas de leitura.
function renderDesigner() {
  document.querySelectorAll('[data-memory-disabled]').forEach(node => {
    node.disabled = node.dataset.memoryDisabled === 'true';
    delete node.dataset.memoryDisabled;
  });
  renderBookDesigner();
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
  const hint = document.querySelector('#live-preview .design-hint');
  if (hint) hint.textContent = 'Memória aceite — apenas leitura.';
};
