/* Criação, edição e pré-visualização de livros e contribuições. */
function createBook() {
  main.dataset.section = 'create';
  if (editorCache?.key === 'book/new' && editorCache.bookInfo) return editor('book');
  main.innerHTML = '<div class="page auth-page">' + back('#area') +
    '<section class="auth-card book-start"><h1>Criar livro</h1><form id="book-start-form">' +
    '<div class="field"><label for="creator-name">O teu nome</label><input id="creator-name" name="creatorName" required maxlength="90" autocomplete="name" value="' +
    e(user.name) + '"></div>' +
    '<div class="field"><label for="person-name">Nome da pessoa</label><input id="person-name" name="name" required maxlength="70"></div>' +
    '<div class="field"><label for="person-relationship">A tua relação com a pessoa</label><input id="person-relationship" name="relationship" required maxlength="100" placeholder="Ex.: amiga, filha, companheiro"></div>' +
    '<button class="button" type="submit">Continuar para a criação</button></form></section></div>';
  const form = document.querySelector('#book-start-form');
  form.onsubmit = event => {
    event.preventDefault();
    const info = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    for (const input of form.querySelectorAll('input')) {
      input.setCustomValidity(info[input.name] ? '' : 'Preenche este campo.');
      if (!input.reportValidity()) return;
    }
    editorCache = {
      key: 'book/new',
      values: {
        name: info.name
      },
      bookInfo: info,
      media: ''
    };
    dirty = true;
    editor('book');
    main.focus();
    window.scrollTo(0, 0);
  };
  form.oninput = event => event.target.setCustomValidity('');
}

function editBookInformation() {
  const book = bookById(route().id);
  const info = {
    ...book,
    ...editorCache.bookInfo,
    ...editorCache.values
  };
  openModal('<h2 id="modal-title">Editar informações</h2><form id="book-info-form">' +
    '<div class="field"><label for="info-creator">O teu nome</label><input id="info-creator" name="creatorName" required maxlength="90" value="' +
    e(info.creatorName || user.name) + '"></div>' +
    '<div class="field"><label for="info-name">Nome da pessoa</label><input id="info-name" name="name" required maxlength="70" value="' +
    e(info.name) + '"></div>' +
    '<div class="field"><label for="info-relationship">A tua relação com a pessoa</label><input id="info-relationship" name="relationship" required maxlength="100" value="' +
    e(info.relationship) + '"></div>' +
    '<div class="panel-actions"><button type="button" class="button secondary" data-action="close-modal">Cancelar</button><button class="button" type="submit">Guardar informações</button></div></form>'
    );
  const form = document.querySelector('#book-info-form');
  form.oninput = event => event.target.setCustomValidity('');
  form.onsubmit = event => {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    for (const input of form.querySelectorAll('input')) {
      input.setCustomValidity(values[input.name] ? '' : 'Preenche este campo.');
      if (!input.reportValidity()) return;
    }
    editorCache.bookInfo = values;
    editorCache.values = {
      ...editorCache.values,
      name: values.name
    };
    document.querySelector('#book-form [name="name"]').value = values.name;
    designChanged();
    closeModal();
  };
}

function editor(kind, id) {
  const book = bookById(id);
  if (kind === 'book' && id && !owns(book) || kind === 'memory' && !accessible(book)) return missing();
  const key = kind + '/' + (id || 'new');
  if (editorCache?.key !== key) editorCache = {
    key,
    sourceRevision: book?._revision || null,
    values: null,
    media: ''
  };
  const form = editorForm(kind, book);
  const cached = editorCache.values;
  if (cached)
    for (const element of form.elements) {
      if (element.name && cached[element.name] !== undefined) {
        if (element.type === 'checkbox') element.checked = Boolean(cached[element.name]);
        else element.value = cached[element.name];
      }
    }
  if (kind === 'book') {
    form.querySelector('[name="visibility"]').value = cached?.visibility || book?.visibility || 'public';
  }
  const shell = document.createElement('div');
  shell.className = 'editor-page';
  shell.innerHTML = '<aside class="editor-sidebar">' + back(kind === 'book' ? '#area' : '#livro/' + e(id),
      kind === 'book' ? 'Voltar à área pessoal' : 'Voltar ao livro') +
    '</aside>' +
    '<section class="editor-canvas"><div class="editor-canvas-head"><span id="draft-state" class="badge">Em edição</span></div>' +
    '<div id="live-preview"></div><div id="editor-extra"></div></section><aside class="editor-properties"><h2>' +
    (kind === 'book' ? 'Personalizar livro' : 'A sua memória') +
    '</h2><div id="editor-fields"></div></aside>';
  shell.querySelector('#editor-fields').append(form);

  main.replaceChildren(shell);
  if (kind === 'book') {
    // As memórias também fazem parte do rascunho, nunca alteram o livro imediatamente.
    editorCache.memories ||= structuredClone(book?.memories || []);
  }
  setupDesigner(kind === 'book' ? book : null);
  if (kind === 'book') {
    shell.querySelector('.editor-canvas-head').insertAdjacentHTML('beforeend',
      '<button type="button" class="button secondary" data-action="save-book-draft">Guardar rascunho</button>'
      );
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'edit-book-information';
    link.textContent = 'Editar informações';
    link.onclick = editBookInformation;
    shell.querySelector('.editor-properties').querySelector('h2').after(link);
  }
  const replacement = form;
  replacement.addEventListener('input', () => {
    editorCache.values = Object.fromEntries(new FormData(replacement));
    dirty = true;
    document.querySelector('#draft-state').textContent = 'Alterações por guardar';
    updateEditorPreview(kind, id);
  });
  replacement.onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(replacement));
    const required = kind === 'book' ? ['name'] : ['author'];
    if (required.some(name => !values[name]?.trim())) return announce(
      'Preencha os campos obrigatórios com texto.');
    if (kind === 'memory' && !editorCache.design.elements.length) return announce(
      'Adicione texto ou formas para compor a mem\u00f3ria.');
    editorCache.values = values;
    draft = kind === 'book' ? {
      kind: 'book',
      id,
      values: {
        visibility: book?.visibility || 'public',
        creatorName: book?.creatorName,
        relationship: book?.relationship,
        ...editorCache.bookInfo,
        ...values,
        design: structuredClone(editorCache.pages?.[0] || editorCache.design),
        pages: bookContentPages({ pages: editorCache.pages, memories: editorCache.memories }),
        coverDesign: structuredClone(editorCache.coverDesign),
        spine: structuredClone(editorCache.spine),
        memories: editorCache.memories
      }
    } : {
      kind: 'memory',
      bookId: id,
      values: {
        ...values,
        title: editorCache.design.elements.find(item => item.type === 'text' && item.text.trim())?.text
          .slice(0, 100) || 'Mem\u00f3ria de ' + values.author,
        text: editorCache.design.elements.filter(item => item.type === 'text').map(item => item.text)
          .join('\n'),
        design: structuredClone(editorCache.design)
      }
    };
    navigate('#previsualizar', true);
  };
  if (cached) dirty = true;
  updateEditorPreview(kind, id);
}

function editorBook() {
  const values = editorCache?.values || {};
  const id = editorCache?.key.split('/')[1];
  const original = bookById(id);
  return {
    ...(original || {}),
    name: 'Uma nova história',
    color: '#697658',
    visibility: 'public',
    ...values,
    memories: editorCache?.memories || []
  };
}

function updateEditorPreview(kind, id) {
  const target = document.querySelector('#live-preview');
  if (!target) return;
  const values = editorCache.values || Object.fromEntries(new FormData(document.querySelector(kind ===
    'book' ? '#book-form' : '#memory-form')));
  if (editorCache.design) {
    renderDesigner();
    return;
  }
  target.innerHTML = kind === 'book' ? reading({
      ...editorBook(),
      ...values
    }, editorCache.memories?.[0], true) :
    reading(bookById(id), {
      ...values,
      media: editorCache.media
    }, true);
}

function preview() {
  if (!draft) {
    main.innerHTML =
      '<div class="page"><h1>Não há rascunho para pré-visualizar.</h1><p>Volte à área pessoal para continuar.</p><a class="button" href="#area">Área pessoal</a></div>';
    return;
  }
  dirty = true;
  if (draft.kind === 'book' && draft.values.pages) {
    renderBookPreview(draft.values);
    return;
  }
  const isBook = draft.kind === 'book';
  const book = isBook ? draft.values : bookById(draft.bookId);
  page = Math.min(Math.max(page, 0), Math.max((book.memories?.length || 0) - 1, 0));
  main.innerHTML =
    '<div class="page reader-page"><button class="back-link" data-action="return-editor">← Voltar à edição</button>' +
    (isBook && book.coverDesign ? '<section class="book-cover-preview"><h2>Capa do livro</h2>' + designMarkup(
      book.coverDesign) + '</section>' : '') +
    (isBook && book.design ? '<section class="book-pages-preview"><h2>P\u00e1ginas do livro</h2>' +
      designMarkup(book.design) + '</section>' : reading(book, isBook ? book.memories[page] : draft.values,
        true)) +
    (isBook && book.memories.length > 1 ?
      '<div class="page-controls"><button class="button secondary" data-action="preview-prev" ' + (page ===
        0 ? 'disabled' : '') + '>← Anterior</button><span>' + (page + 1) + ' / ' + book.memories.length +
      '</span><button class="button secondary" data-action="preview-next" ' + (page >= book.memories.length -
        1 ? 'disabled' : '') + '>Seguinte →</button></div>' : '') +
    '<div class="review-actions"><button class="button secondary" data-action="return-editor">Voltar à edição</button><button class="button" data-action="publish">' +
    (isBook ? (draft.id ? 'Guardar alterações' : 'Publicar livro') : 'Enviar pedido') +
    '</button></div></div>';
}

function publishDraft() {
  if (!draft) return;
  const isBook = draft.kind === 'book';
  const completionMessage = isBook
    ? (draft.id ? 'Alterações guardadas com sucesso.' : 'Livro publicado com sucesso.') +
      (draft.values.visibility === 'private' ? ' O livro é privado e está acessível apenas na sua conta.' :
        ' O livro é público e está disponível na biblioteca e na instalação.')
    : 'Pedido enviado com sucesso. Aguarda revisão do responsável.';
  confirmDialog(isBook ? (draft.id ? 'Tem a certeza que deseja guardar as alterações?' :
      'Tem a certeza que deseja publicar o livro?') : 'Tem a certeza que deseja enviar o pedido?',
    isBook ? (draft.values.visibility === 'public' ?
      'O livro ficará disponível online e na instalação, para todas as pessoas.' :
      'O livro será guardado online e ficará acessível apenas na sua conta.') :
    'A memória ficará pendente de revisão pelo responsável.', async () => {
      if (!user || !draft) return;
      if (isBook && draft.id && editorCache?.sourceRevision &&
        bookById(draft.id)?._revision !== editorCache.sourceRevision) {
        cloudNotice('O livro foi alterado desde que este rascunho foi criado. Preserve o rascunho e consulte a versão atual antes de editar novamente.');
        return;
      }
      const id = draft.publishId ||= (isBook ? (draft.id || uid()) : uid());
      if (!await transaction(() => {
          if (isBook) {
            state.bookDrafts = (state.bookDrafts || []).filter(item => item.id !== editorCache
              ?.savedDraftId || item.ownerId !== user.id);
            const values = {
              ...draft.values,
              id,
              ownerId: user.id,
              owner: true,
              code: bookById(id)?.code || 'POY-' + id.slice(0, 8).toUpperCase(),
              symbol: '✳'
            };
            const existing = bookById(id);
            if (existing) Object.assign(existing, values);
            else state.books.push(values);
          } else state.pending.push({
            ...draft.values,
            id,
            bookId: draft.bookId,
            senderId: user.id,
            createdAt: new Date().toISOString()
          });
        })) return;
      dirty = false;
      draft = null;
      editorCache = null;
      navigate(isBook ? '#livro/' + id : '#area', true);
      announce(completionMessage);
    }, isBook ? (draft.id ? 'Sim, guardar' : 'Sim, publicar') : 'Sim, enviar',
    'Não, voltar à pré-visualização');
}

function decide(id, accepted) {
  const item = received().find(entry => entry.id === id);
  if (!item) return;
  confirmDialog(accepted ? 'Tem a certeza que deseja aceitar o pedido?' :
    'Tem a certeza que deseja recusar o pedido?',
    accepted ? 'A memória será acrescentada ao livro com a autoria identificada.' :
    'A proposta ficará marcada como recusada. O livro mantém-se igual.', async () => {
      if (!await transaction(() => {
          if (accepted) bookById(item.bookId).memories.push({
            ...item, locked: true
          });
          state.history.push({
            ...item,
            status: accepted ? 'accepted' : 'rejected',
            decidedAt: new Date().toISOString()
          });
          state.pending = state.pending.filter(entry => entry.id !== id);
        })) return;
      navigate('#recebidas', true);
      announce(accepted ? 'Memória aceite e publicada no livro.' :
        'Pedido recusado. O livro não foi alterado.');
    }, accepted ? 'Sim, aceitar' : 'Sim, recusar', 'Não, voltar ao pedido');
}
