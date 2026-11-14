/* Componentes de apresentação, formulários e mensagens acessíveis. */
async function save() {
  try {
    if (user) await PoyDraftStore.write(user.id, state.bookDrafts || []);
    return true;
  } catch {
    announce('Não foi possível guardar. O armazenamento do navegador pode estar cheio ou desativado.');
    return false;
  }
}

function announce(message) {
  document.querySelector('#status').textContent = message;
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => document.querySelector('#status').textContent = '', 6000);
}

function route() {
  const [view, id] = location.hash.slice(1).split('/');
  return {
    view: view || 'inicio',
    id
  };
}

function bookById(id) {
  return state.books.find(book => book.id === id);
}

function cover(book) {
  if (book.coverDesign) return '<div class="cover custom-cover">' + designMarkup(book.coverDesign) + '</div>';
  return `<div class="cover" style="--cover:${/^#[a-f0-9]{6}$/i.test(book.color) ? book.color : '#697658'}"><small>PAGES OF YOU</small><span class="cover-name">${e(book.name)}</span><span class="cover-symbol" aria-hidden="true">${e(book.symbol || '✳')}</span></div>`;
}

function card(book, personal = false) {
  return `<article>
    <a class="book-card" href="#livro/${e(book.id)}" aria-label="Ler o livro de ${e(book.name)}">
    <div class="book-stage">${cover(book)}</div>
    <div class="book-meta">
    <div>
    <h3>${e(book.name)}</h3>
    <p>${book.memories.length} memórias</p>
    </div>
    <span class="book-arrow" aria-hidden="true">↗</span>
    </div>
    </a>${personal ? `<div class="panel-actions">
    <a class="text-button" href="#editar/${e(book.id)}">Editar livro</a>
    <span class="badge">${book.visibility === 'private' ? 'Privado' : 'Público'}</span>
    </div>` : ''}</article>`;
}

function updateResults() {
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const books = state.books.filter(book => book.visibility === 'public' && (filter === 'Todos' || book
    .category === filter) && normalized(book.name).includes(normalized(query)));
  document.querySelector('#book-results').innerHTML = books.length ? books.map(book => card(book)).join('') :
    '<div class="empty"><h3>Não encontrámos esse livro.</h3><p>Experimente outro nome ou selecione «Todos».</p><button class="button secondary" data-action="clear-search">Limpar pesquisa e filtros</button></div>';
  document.querySelector('#result-count').textContent =
    `${books.length} livros públicos para descobrir`;
}

function media(memory) {
  if (!memory.media || !
    /^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4)|video\/(mp4|webm));base64,/.test(memory
      .media)) return '';
  const src = e(memory.media);
  if (memory.media.startsWith('data:image/'))
  return `<img class="media" src="${src}" alt="${e(memory.mediaDescription || memory.title)}">`;
  return memory.media.startsWith('data:audio/') ?
    `<audio class="media" controls src="${src}" aria-label="${e(memory.title)}"></audio>` :
    `<video class="media" controls src="${src}" aria-label="${e(memory.title)}"></video>`;
}

function reading(book, memory, preview = false) {
  if (memory?.design) return '<div class="memory-composition">' + designMarkup(memory.design) +
    '<p class="memory-credit">Partilhada por ' + e(memory.author) + '</p></div>';
  if (book.design && !memory) return designMarkup(book.design);
  return `<div class="reading ${book.layout === 'minimal' ? 'minimal' : ''}"><section class="dedication"><span class="eyebrow">${preview ? 'Pré-visualização' : 'Um livro de memórias'}</span><h2>${e(book.name)}</h2><p><em>${e(book.subtitle)}</em></p><span aria-hidden="true">✳</span></section><section>${memory ? `<span class="eyebrow">Uma memória partilhada</span><h2>${e(memory.title)}</h2>${media(memory)}<p>${e(memory.text)}</p><small class="muted">Partilhada por ${e(memory.author)}</small>` : '<h2>Uma história por começar</h2><p>As primeiras memórias vão dar vida a estas páginas.</p>'}</section></div>`;
}

function editorForm(kind, book) {
  const form = document.createElement('form');
  const isBook = kind === 'book';
  form.id = isBook ? 'book-form' : 'memory-form';
  form.innerHTML = isBook ?
    '<input type="hidden" name="name" value="' + e(book?.name || '') + '">' +
    '<div class="field"><label for="online-visibility">Quem pode consultar?</label>' +
    '<select id="online-visibility" name="visibility"><option value="public">Público — biblioteca e instalação</option>' +
    '<option value="private">Privado — apenas a minha conta</option></select></div>' :
    '<div class="field"><label for="author">O seu nome e relação com a pessoa *</label>' +
    '<input id="author" name="author" required maxlength="90" autocomplete="name"></div>';
  form.insertAdjacentHTML('beforeend',
    '<div class="panel-actions"><button class="button" type="submit">Pré-visualizar →</button>' +
    '<button class="text-button" type="button" data-action="cancel">Cancelar</button></div>');
  return form;
}

function about() {
  main.innerHTML = `<article class="page prose">
    <span class="eyebrow">Sobre o projeto</span>
    <h1>Uma vida nunca cabe numa só história.</h1>
    <p>O Pages of You reúne histórias e memórias sobre pessoas e momentos partilhados. Cada livro pode incluir histórias, fotografias e vozes de quem faz parte da sua vida.</p>
    <h2>Memórias construídas em conjunto</h2>
    <p>Qualquer visitante pode explorar a biblioteca pública e propor uma memória. A pessoa responsável pelo livro revê cada contributo, podendo aceitá-lo ou recusá-lo. Cada relato é identificado como uma perspetiva pessoal.</p>
    <h2>Um lugar para voltar, ao seu ritmo</h2>
    <p>Recordar pode trazer emoções diferentes. Pode parar a leitura a qualquer momento e regressar quando desejar. Não há reprodução automática de áudio ou vídeo.</p>
    <h2>Esta primeira versão</h2>
    <p>Este é um projeto académico em HTML, CSS e JavaScript, ligado ao Supabase. Os livros publicados são guardados online. Os livros públicos aparecem também na instalação; os privados ficam acessíveis apenas na conta responsável. Os rascunhos ficam guardados neste navegador.</p>
    <a class="button" href="#biblioteca">Explorar a biblioteca →</a>
    </article>`;
}

function missing() {
  main.innerHTML =
    '<div class="page"><h1>Não encontrámos este livro.</h1><p>Pode ter sido removido ou a ligação estar incompleta.</p><a class="button" href="#biblioteca">Voltar à biblioteca</a></div>';
}

function openModal(html) {
  document.querySelector('#modal-content').innerHTML = html;
  if (!modal.open) modal.showModal();
}
