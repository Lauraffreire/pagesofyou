/* Entrada, biblioteca, leitura, área pessoal e propostas. */
function home() {
  if (main.querySelector('.landing-shelves')) return;
  const [olive, teal, forest, gold, terra, ochre] = PoyObjects.spinePresets;
  // As medidas da referência são escaladas em conjunto dentro de cada compartimento.
  const position = (x, width, height, bottom = 0) =>
    '--book-x:' + x + ';--book-width:' + width + ';--book-height:' + height + ';--book-bottom:' + bottom;
  const spine = (preset, x, width, height, { bottom = 0, angle = 0, flat = false, pages = false } = {}) =>
    '<span aria-hidden="true" class="landing-spine' + (flat ? ' landing-spine--flat' : '') +
    (pages ? ' landing-spine--pages' + (preset === terra ? ' landing-spine--right-binding' : '') : '') +
    (angle < 0 ? ' landing-spine--against-left' : angle > 0 ? ' landing-spine--against-right' : '') +
    '" style="' + position(x, width, height, bottom) +
    ';--spine-fill:' + preset.background + ';--spine-angle:' + angle + 'deg' +
    ';--spine-corners:' + (preset.radius ? (flat ? '5% / 22%' : preset.radius) : '0') + '">' +
    (pages ? '' : '<i class="spine-art" style="' + PoyObjects.spineArt(preset.id, preset.patternColor) + '"></i>') +
    '</span>';
  const flat = (preset, x, width, height, bottom, pages = false) =>
    spine(preset, x, width, height, { flat: true, bottom, pages });
  const compartment = (origin, width, contents) =>
    '<div class="landing-compartment" style="--origin:' + origin + ';--reference-width:' + width + '">' +
    contents + '</div>';
  const row = (divider, left, right) =>
    '<div class="landing-shelf" style="--division:' + divider / 2055 * 100 + '%">' +
    compartment(0, divider, left) + compartment(divider, 2055 - divider, right) + '</div>';
  const logo = '<h1 id="landing-title" style="' + position(104, 446, 96, 276) + '">' +
    '<a href="#area" aria-label="Pages of you. — Entrar na área pessoal"><span>Pages</span> <em>of</em> <span>you.</span></a></h1>';

  main.innerHTML = '<div class="quiet-library landing-shelves">' +
    row(1140,
      spine(olive, 10, 116, 426, { angle: -6.5 }) + spine(teal, 172, 91, 426) +
      spine(forest, 297, 91, 426) + spine(gold, 400, 112, 361) +
      spine(terra, 514, 91, 426) + spine(ochre, 644, 91, 426) +
      flat(teal, 784, 325, 67, 285) + flat(olive, 814, 305, 70, 215) +
      flat(gold, 801, 330, 71, 144) + flat(terra, 765, 331, 71, 73) +
      flat(gold, 783, 329, 73, 0, true),
      spine(teal, 1193, 91, 426, { angle: -5 }) + spine(olive, 1285, 91, 424) +
      spine(terra, 1386, 106, 310) + spine(forest, 1506, 83, 357) + spine(teal, 1603, 81, 395) +
      spine(gold, 1711, 91, 429) +
      spine(ochre, 1833, 91, 345) + spine(forest, 1955, 91, 425)) +
    row(704,
      spine(teal, 12, 57, 338, { angle: -2.5 }) +
      logo + flat(olive, 98, 395, 85, 191) + flat(gold, 145, 395, 104, 87) +
      flat(terra, 126, 398, 87, 0, true) + spine(forest, 552, 49, 258) +
      spine(terra, 607, 78, 345, { angle: 4 }),
      spine(ochre, 748, 91, 424, { angle: -4 }) + spine(teal, 857, 91, 424) +
      spine(forest, 966, 91, 426) + spine(terra, 1083, 91, 426) +
      spine(gold, 1175, 91, 424) +
      flat(ochre, 1332, 340, 65, 315) + flat(teal, 1304, 394, 67, 248) +
      flat(olive, 1323, 374, 67, 181) +
      flat(gold, 1287, 424, 90, 91, true) + flat(terra, 1294, 427, 91, 0, true) +
      spine(olive, 1753, 86, 358) + spine(ochre, 1850, 50, 292) +
      spine(teal, 1908, 91, 425, { angle: 8 })) +
    row(1397,
      spine(olive, 17, 91, 355, { angle: -2.5 }) + spine(teal, 108, 91, 321) +
      spine(gold, 213, 91, 424) + spine(forest, 322, 91, 426) +
      spine(terra, 453, 91, 372) +
      spine(ochre, 589, 91, 323) +
      flat(gold, 724, 328, 69, 352) +
      flat(terra, 746, 331, 71, 281, true) + flat(olive, 693, 330, 70, 211) +
      flat(terra, 737, 331, 70, 141) + flat(gold, 707, 330, 71, 70) +
      flat(teal, 723, 330, 70, 0) + spine(ochre, 1134, 90, 316) +
      spine(terra, 1258, 91, 427, { angle: 6.5 }),
      flat(olive, 1434, 315, 68, 277) + flat(ochre, 1418, 320, 67, 210) +
      flat(terra, 1425, 331, 70, 140) + flat(gold, 1436, 329, 70, 70, true) +
      flat(teal, 1426, 330, 70, 0) +
      spine(forest, 1773, 54, 280) +
      spine(olive, 1833, 91, 327) + spine(gold, 1964, 91, 424, { angle: 3 })) +
    '</div>';
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
    '<h1>Os meus livros</h1>' + (books.length ? '<div class="owned-bookshelves">' + books.map(
        book => '<article class="shelved-book"><div class="shelved-book-cover"><div class="custom-book-thumbnail">' +
          designMarkup(book.coverDesign || defaultBookCover(book)) +
          '</div></div><div class="book-list-actions"><span class="badge">' + (book.visibility === 'private' ? 'Privado — apenas a minha conta' : 'Público — biblioteca e instalação') + '</span><a class="button" href="#livro/' + e(book.id) + '" aria-label="Ver livro de ' + e(book.name) + '">Ver livro</a><button type="button" class="text-button danger" data-action="delete-book" data-id="' + e(book.id) + '">Eliminar livro</button></div></article>').join('') + '</div>' :
      '<p>Ainda não tem livros.</p>') + '</div>';
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
