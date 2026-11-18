/* Rotas, eventos da aplicação e arranque. Carregar depois dos restantes ficheiros. */
function render(focus = true) {
  if (!started) {
    main.innerHTML = '<div class="page"><p role="status">A ligar à biblioteca online…</p></div>';
    return;
  }
  const {
    view,
    id
  } = route();
  const protectedViews = ['area', 'meus-livros', 'recebidas', 'enviadas', 'pedido', 'enviado', 'codigo',
    'criar', 'editar', 'contribuir', 'previsualizar', 'rascunho'
  ];
  main.dataset.section = ({ criar: 'create', 'meus-livros': 'my-books', recebidas: 'received', pedido: 'received', codigo: 'contribute', contribuir: 'contribute' })[view] || '';
  const needsLogin = protectedViews.includes(view) && !user;
  if (needsLogin) loginDestination = location.hash || '#area';
  if (modal.open) {
    modalCancel = null;
    modal.close();
  }
  const views = {
    inicio: home,
    biblioteca: library,
    estante: library,
    livro: () => reader(id),
    area,
    login: () => auth(),
    registar: () => auth(true),
    recuperar: recover,
    'meus-livros': myBooks,
    recebidas: () => proposals(),
    enviadas: () => proposals(true),
    pedido: () => proposalDetail(id),
    enviado: () => proposalDetail(id, true),
    codigo: codeForm,
    criar: createBook,
    editar: () => editor('book', id),
    contribuir: () => editor('memory', id),
    previsualizar: preview,
    rascunho: () => resumeBookDraft(id),
    sobre: about
  };
  (needsLogin ? auth : views[view] || missing)();
  const titles = {
    inicio: 'Início',
    biblioteca: 'Biblioteca',
    area: 'Área pessoal',
    criar: 'Criar livro',
    editar: 'Editar livro',
    contribuir: 'Adicionar memória',
    previsualizar: 'Pré-visualização',
    recebidas: 'Memórias recebidas',
    enviadas: 'Propostas enviadas'
  };
  document.title = (needsLogin ? 'Iniciar sessão' : titles[view] || 'Memórias') + ' — Pages of You';
  activeHash = location.hash || '#inicio';
  if (focus) {
    main.focus();
    window.scrollTo(0, 0);
  }
}

document.addEventListener('click', async event => {
  const link = event.target.closest('a[href^="#"]');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    if (link.getAttribute('href') === '#conteudo') return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
    return;
  }
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const {
    action,
    id
  } = button.dataset;
  if (button.dataset.filter) {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed',
      item === button));
    updateResults();
  }
  if (action === 'close-modal') closeModal();
  if (action === 'retry-cloud') await retryCloud();
  if (action === 'import-local') importLocalBooks();
  if (action === 'backup-local') downloadLegacyBackup();
  if (action === 'save-book-draft') await saveBookDraft();
  if (action === 'delete-book' || action === 'delete-book-draft') deleteSavedBook(id, action === 'delete-book-draft');
  if (action === 'clear-search') {
    query = '';
    filter = 'Todos';
    library();
    document.querySelector('#search').focus();
  }
  if (action === 'logout') confirmDialog('Terminar sessão?',
    'Os livros publicados continuam guardados na sua conta.', async () => {
      authOperation = true;
      try {
        if (dirty && editorCache?.key.startsWith('book/') && !await saveBookDraft()) return;
        PoyCloud.check(await PoyCloud.connection().auth.signOut({ scope: 'local' }));
        await session(null);
        navigate('#inicio', true);
        announce('Sessão terminada.');
      } finally { authOperation = false; }
    }, 'Sim, terminar sessão');
  if (action === 'previous' || action === 'next') {
    page += action === 'next' ? 1 : -1;
    reader(route().id);
    main.focus();
  }
  if (action === 'preview-prev' || action === 'preview-next') {
    page += action === 'preview-next' ? 1 : -1;
    preview();
  }
  if (action === 'return-editor') {
    const hash = draft?.kind === 'book' ? (draft.id ? '#editar/' + draft.id : '#criar') :
      '#contribuir/' + draft?.bookId;
    navigate(hash, true);
  }
  if (action === 'cancel') navigate(route().view === 'contribuir' ? '#livro/' + route().id : route()
    .view === 'criar' ? '#area' : '#meus-livros');
  if (action === 'publish') publishDraft();
  if (action === 'accept' || action === 'reject') decide(id, action === 'accept');
  if (action === 'withdraw') {
    const item = state.pending.find(entry => entry.id === id && entry.senderId === user?.id);
    if (item) confirmDialog('Cancelar este pedido?',
      'A proposta deixará de estar disponível para revisão. O livro não será alterado.', async () => {
        if (!await transaction(() => {
            state.history.push({
              ...item,
              status: 'cancelled'
            });
            state.pending = state.pending.filter(entry => entry.id !== id);
          })) return;
        proposalDetail(id, true);
        announce('Pedido cancelado.');
      }, 'Sim, cancelar pedido', 'Não, manter pedido');
  }

});
modal.addEventListener('cancel', event => {
  event.preventDefault();
  closeModal();
});
window.addEventListener('beforeunload', event => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('hashchange', () => {
  if (cloudBusy) {
    history.replaceState(null, '', activeHash);
    return;
  }
  const destination = location.hash;
  const editorHash = editorCache && (editorCache.key.startsWith('book/') ? (editorCache.key ===
      'book/new' ? '#criar' : '#editar/' + editorCache.key.split('/')[1]) : '#contribuir/' + editorCache
    .key.split('/')[1]);
  if (dirty && destination !== '#previsualizar' && destination !== editorHash) {
    history.replaceState(null, '', activeHash);
    navigate(destination);
    return;
  }
  if (!['editar', 'criar', 'previsualizar'].includes(route().view)) page = 0;
  render();
});
render(false);
bootstrapCloud();
