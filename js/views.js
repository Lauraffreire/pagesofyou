/* Entrada, biblioteca, leitura, área pessoal e propostas. */
function personalShelfBooks(interactive = false) {
  const options = [
    ['criar', 'Criar um livro', '#d798aa', 4, 88, -3],
    ['meus-livros', 'Meus livros', '#8eafb6', 0, 96, 0],
    ['recebidas', 'Ver mem\u00f3rias', '#7b813e', 5, 83, 4],
    ['codigo', 'Adicionar contribui\u00e7\u00f5es', '#e9c64b', 2, 91, -2]
  ];
  return '<div class="personal-shelf-stage">' + options.map(([href, title, color, pattern, height, angle],
    i) => {
      const tag = interactive ? 'a' : 'span';
      return '<' + tag + ' class="wall-book wall-pattern-' + pattern + ' proportional-book' + (interactive ?
          ' shelf-menu-book dashboard-card' : '') + '" style="--volume-color:' + color + ';--book-height:' +
        height + '%;--volume-angle:' + angle + 'deg;--book-left:' + (8 + i * 22) + '%" ' + (interactive ?
          'href="#' + href + '"' : 'aria-hidden="true"') + '>' + (interactive ? '<span>' + title +
          '</span>' : '') + '<i aria-hidden="true"></i><b aria-hidden="true"></b></' + tag + '>';
    }).join('') + '</div>';
}

function home() {
  if (main.querySelector('.quiet-library')) {
    return;
  }

  const books = (offset, count) => Array.from({
    length: count
  }, (_, i) => {
    const n = i + offset;
    return '<span class="wall-book wall-pattern-' + (n % 8) + '" style="--volume-color:var(--wall-' + (n %
        7) + ');--volume-height:' + (72 + (n * 13) % 27) + '%;--volume-width:' + (24 + (n * 17) % 30) +
      ';--volume-angle:' + (n % 5 === 0 ? -9 : n % 4 === 0 ? 7 : n % 7 === 0 ? -4 : 0) +
      'deg"><i></i><b></b></span>';
  }).join('');
  main.innerHTML =
    '<div class="quiet-library"><div class="quiet-shelf quiet-outer" aria-hidden="true"><div class="quiet-book-group">' +
    books(0, 10) + '</div><div class="quiet-book-group">' + books(7, 7) +
    '</div></div><section class="quiet-shelf quiet-center" aria-labelledby="landing-title"><div class="quiet-side" aria-hidden="true">' +
    books(4, 2) +
    '</div><h1 id="landing-title" class="quiet-title"><a href="#area" aria-label="Pages of You: entrar na \u00e1rea pessoal"><span>Pages</span> <em>of</em> <span>You.</span></a></h1><div class="quiet-side" aria-hidden="true">' +
    books(9, 8) +
    '</div></section><div class="quiet-shelf quiet-outer" aria-hidden="true"><div class="quiet-book-group">' +
    books(11, 7) + '</div><div class="quiet-book-group">' + books(18, 7) + '</div></div></div>';
  const shelf = main.querySelector('.quiet-outer');
  shelf.removeAttribute('aria-hidden');
  shelf.firstElementChild.setAttribute('aria-hidden', 'true');
  const personalShelf = shelf.lastElementChild;
  personalShelf.classList.add('personal-shelf');
  personalShelf.innerHTML = personalShelfBooks(true);
  personalShelf.querySelectorAll('.wall-book').forEach(book => {
    book.tabIndex = -1;
    book.setAttribute('aria-hidden', 'true');
  });
  personalShelf.insertAdjacentHTML('beforeend',
    '<a class="personal shelf-personal-button" href="#area" aria-label="Abrir a prateleira da área pessoal"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="7" r="4" fill="currentColor"/><path d="M4 21v-3a8 8 0 0 1 16 0v3" fill="currentColor"/></svg></a>'
    );
}

function library() {
  main.innerHTML =
    '<section class="page"><span class="eyebrow">Memórias que nos ligam</span><div class="section-head"><div><h1>A biblioteca</h1>' +
    '<p>Escolha um livro para conhecer as suas histórias.</p></div><label class="search"><span aria-hidden="true">⌕</span>' +
    '<input id="search" type="search" aria-label="Procurar uma pessoa" placeholder="Procurar uma pessoa…" value="' +
    e(query) + '"></label></div>' +
    '<div class="filters" aria-label="Categorias">' + ['Todos', 'Família', 'Amigos', 'Comunidade'].map(item =>
      '<button class="chip" data-filter="' + item + '" aria-pressed="' + (filter === item) + '">' + item +
      '</button>').join('') +
    '</div><div class="books" id="book-results"></div><p id="result-count" role="status" class="muted"></p></section>';
  updateResults();
  document.querySelector('#search').oninput = event => {
    query = event.target.value;
    updateResults();
  };
}

function reader(id) {
  const book = bookById(id);
  if (!accessible(book)) return missing();
  page = Math.min(Math.max(page, 0), Math.max(book.memories.length - 1, 0));
  if (book.pages?.length || book.coverDesign || book.design || book.memories.some(memory => memory.design)) {
    renderBookPreview(book, false);
    return;
  }
  main.innerHTML = '<div class="page reader-page">' + back(owns(book) ? '#meus-livros' : '#inicio') +
    reading(book, book.memories[page]) + (book.memories.length > 1 ?
      '<div class="page-controls"><button class="button" data-action="previous" ' + (page === 0 ? 'disabled' : '') +
      '>Anterior</button><button class="button" data-action="next" ' + (page >= book.memories.length - 1 ? 'disabled' : '') +
      '>Seguinte</button></div>' : '') + (owns(book) ? '<div class="review-actions"><a class="button" href="#editar/' +
      e(id) + '">Editar</a></div><p class="code-label">Código do livro: ' + e(book.code) + '</p>' : '') + '</div>';
}

function area() {
  const options = [
    ['criar', 'Criar livro'],
    ['meus-livros', 'Meus livros'],
    ['recebidas', 'Mem\u00f3rias recebidas'],
    ['codigo', 'Contribuir']
  ];
  main.innerHTML = '<section class="stack-area" aria-labelledby="personal-area-title">' +
    back('#inicio', 'Voltar \u00e0 estante') +
    '<header class="stack-heading"><p>Pages of You</p><h1 id="personal-area-title">A tua \u00e1rea pessoal</h1>' +
    '<span>' + e(user.name) + '</span></header>' +
    '<nav class="personal-book-stack" aria-label="Op\u00e7\u00f5es da \u00e1rea pessoal">' +
    options.map(([href, title], index) => '<a class="stack-book stack-book-' + index + '" href="#' + href +
      '"><span>' + title + '</span><i aria-hidden="true"></i></a>').join('') +
    '</nav>' +
    '<button type="button" class="text-button stack-logout" data-action="logout">Terminar sess\u00e3o</button></section>';
}

function myBooks() {
  main.dataset.section = 'my-books';
  const books = state.books.filter(owns);
  main.innerHTML = '<div class="page">' + back() +
    '<h1 class="screen-brand">Pages of You</h1><div class="personal-books">' + (books.length ? books.map(
        book => '<article class="simple-book">' + (book.coverDesign ? '<div class="custom-book-thumbnail">' +
          designMarkup(book.coverDesign) + '</div>' : '<div class="custom-book-thumbnail">' + designMarkup(defaultBookCover(book)) + '</div>'
          ) + '<div class="book-list-actions"><span class="badge">' + (book.visibility === 'private' ? 'Privado — apenas a minha conta' : 'Público — biblioteca e instalação') + '</span><a class="button" href="#livro/' + e(book.id) + '">Ver livro</a><button type="button" class="text-button danger" data-action="delete-book" data-id="' + e(book.id) + '">Eliminar livro</button></div></article>').join('') :
      '<p>Ainda não tem livros.</p>') + '</div></div>';
  const drafts = (state.bookDrafts || []).filter(item => item.ownerId === user.id);
  main.querySelector('.page').insertAdjacentHTML('beforeend',
    '<section class="saved-drafts"><h2>Rascunhos guardados</h2>' + (drafts.length ? drafts.map(item =>
        '<article class="proposal-card draft-book-card"><div class="custom-book-thumbnail" aria-label="Capa do rascunho">' +
        designMarkup(item.cache.coverDesign || defaultBookCover({ ...item.cache.bookInfo, ...item.cache.values })) +
        '</div><div><h3>' + e(item.cache.values?.name || item.cache.bookInfo
          ?.name || 'Livro sem título') +
        '</h3><span class="badge">Rascunho</span></div><div class="book-list-actions"><a class="button secondary" href="#rascunho/' + e(
          item.id) + '">Continuar a editar</a><button type="button" class="text-button danger" data-action="delete-book-draft" data-id="' + e(item.id) + '">Eliminar rascunho</button></div></article>').join('') :
      '<p>Ainda não tem rascunhos guardados.</p>') + '</section>');
}

function deleteSavedBook(id, isDraft) {
  const allowed = () => isDraft ? (state.bookDrafts || []).some(item => item.id === id && item.ownerId === user?.id) : owns(bookById(id));
  if (!user || !allowed()) return;
  confirmDialog(isDraft ? 'Eliminar este rascunho?' : 'Eliminar este livro?',
    isDraft ? 'O rascunho será eliminado. O livro publicado mantém-se.' :
    'O livro e os pedidos associados serão eliminados online e deixarão de estar disponíveis nos dois sites. Esta ação não pode ser desfeita.', async () => {
      if (!user || !allowed()) return;
      if (!await (isDraft ? localTransaction : transaction)(() => {
        if (isDraft) state.bookDrafts = (state.bookDrafts || []).filter(item => item.id !== id || item.ownerId !== user.id);
        else {
          state.books = state.books.filter(book => book.id !== id);
          state.pending = state.pending.filter(item => item.bookId !== id);
          state.bookDrafts = (state.bookDrafts || []).filter(item => item.bookId !== id);
        }
      })) return;
      if (isDraft ? editorCache?.savedDraftId === id : editorCache?.key === 'book/' + id) {
        editorCache = null;
        draft = null;
        dirty = false;
      }
      myBooks();
      announce(isDraft ? 'Rascunho eliminado.' : 'Livro eliminado.');
    }, 'Eliminar', 'Cancelar');
}

async function saveBookDraft() {
  if (draftSaving || !user || !editorCache?.key.startsWith('book/')) return false;
  draftSaving = true;
  const generation = sessionGeneration;
  const wasInert = main.inert;
  main.inert = true;
  try {
  const form = document.querySelector('#book-form');
  if (form) editorCache.values = Object.fromEntries(new FormData(form));
  const id = editorCache.savedDraftId || uid();
  const cache = structuredClone({
    ...editorCache,
    savedDraftId: id
  });
  delete cache.designHistories;
  const bookId = cache.key.split('/')[1];
  if (bookId !== 'new' && !owns(bookById(bookId))) return false;
  if (!await localTransaction(() => {
      state.bookDrafts ||= [];
      const item = {
        id,
        ownerId: user.id,
        bookId: bookId === 'new' ? null : bookId,
        cache,
        updatedAt: new Date().toISOString()
      };
      const index = state.bookDrafts.findIndex(entry => entry.id === id && entry.ownerId === user.id);
      if (index < 0) state.bookDrafts.push(item);
      else state.bookDrafts[index] = item;
    })) return false;
  if (generation !== sessionGeneration) return false;
  editorCache.savedDraftId = id;
  dirty = false;
  const status = document.querySelector('#draft-state');
  if (status) status.textContent = 'Rascunho guardado';
  announce('Rascunho guardado neste navegador. Pode continuar em Meus livros.');
  return true;
  } finally {
    draftSaving = false;
    main.inert = wasInert;
  }
}

function resumeBookDraft(id) {
  const item = (state.bookDrafts || []).find(entry => entry.id === id && entry.ownerId === user.id);
  if (!item) return missing();
  if (item.bookId && !owns(bookById(item.bookId))) return missing();
  editorCache = structuredClone(item.cache);
  draft = null;
  history.replaceState(null, '', item.bookId ? '#editar/' + item.bookId : '#criar');
  editor('book', item.bookId || undefined);
  dirty = false;
  document.querySelector('#draft-state').textContent = 'Rascunho guardado';
}

function proposals() {
  main.dataset.section = 'received';
  const items = received();
  main.innerHTML = '<div class="page">' + back() +
    '<h1 class="screen-brand">Pages of You</h1><div class="proposal-list">' + (items.length ? items.map(
        item => '<article class="proposal-card"><div><h2>Memória de ' + e(item.author) +
        '</h2><p>Para o livro de ' + e(bookById(item.bookId)?.name) +
        '</p></div><a class="button" href="#pedido/' + e(item.id) + '">Ver memória</a></article>').join('') :
      '<p>Não há memórias pendentes.</p>') + '</div></div>';
}

function proposalDetail(id, outgoing = false) {
  const item = (outgoing ? sent() : received()).find(entry => entry.id === id);
  const book = item && bookById(item.bookId);
  if (!item || !book) return missing();
  main.innerHTML = '<div class="page reader-page">' + back(outgoing ? '#enviadas' : '#recebidas', outgoing ?
      'Voltar às propostas enviadas' : 'Voltar às memórias recebidas') +
    '<div class="page-top"><h1>' + e(item.title) + '</h1><span class="badge">' + statusText(item.status) +
    '</span></div>' + reading(book, item, true) +
    (outgoing ? '<p class="notice">' + ({
        accepted: 'A memória já faz parte do livro.',
        rejected: 'O responsável recusou a proposta. O livro não foi alterado.',
        cancelled: 'Cancelou este pedido. O livro não foi alterado.'
      } [item.status] || 'Aguarda revisão. A memória ainda não está publicada.') +
      '</p><div class="panel-actions">' +
      (item.status === 'pending' ? '<button class="button secondary" data-action="withdraw" data-id="' + e(
        id) + '">Cancelar pedido</button>' : '') +
      (accessible(book) ? '<a class="button" href="#livro/' + e(book.id) + '">Ver livro</a>' : '') +
      '</div>' :
      '<div class="review-actions"><button class="button secondary" data-action="reject" data-id="' + e(id) +
      '">Recusar pedido</button>' +
      '<button class="button" data-action="accept" data-id="' + e(id) + '">Aceitar pedido</button></div>') +
    '</div>';
}

function codeForm() {
  main.dataset.section = 'contribute';
  main.innerHTML = '<div class="page auth-page">' + back() +
    '<section class="auth-card"><span class="eyebrow">Adicionar contribuições</span><h1>Qual é o livro?</h1>' +
    '<p>Introduza o código partilhado pelo responsável.</p><form id="code-form"><div class="field"><label for="code">Código do livro *</label>' +
    '<input id="code" name="code" required maxlength="60" placeholder="Ex.: POY-AMELIA" aria-describedby="code-error"></div>' +
    '<p id="code-error" class="form-error" role="alert"></p><button class="button">Abrir e adicionar memória →</button></form>' +
    '</section></div>';
  document.querySelector('#code-form').onsubmit = event => {
    event.preventDefault();
    const code = new FormData(event.target).get('code').trim().toUpperCase();
    const book = state.books.find(item => item.code?.toUpperCase() === code);
    if (!accessible(book)) {
      document.querySelector('#code-error').textContent =
        'Código inválido ou livro indisponível. Confirme e tente novamente.';
      return;
    }
    navigate('#contribuir/' + book.id);
  };
}

/* 09. Editor em três colunas: navegação, livro e propriedades.
   Mantém o formulário original e a validação nativa, sem duplicar dados. */
