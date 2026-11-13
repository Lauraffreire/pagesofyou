const KEY = 'pages-of-you-v1';
let legacyState;
try {
  legacyState = JSON.parse(localStorage.getItem(KEY));
  if (legacyState && (!Array.isArray(legacyState.books) || !Array.isArray(legacyState.pending))) throw Error('Dados inválidos');
} catch {
  legacyState = null;
}
// A chave antiga nunca é sobrescrita: permite importar e recuperar o protótipo.
let state = { books: [], pending: [], history: [], bookDrafts: [] };
let cloudReady = false;
let cloudBusy = false;
let cloudLoading = false;
let sessionGeneration = 0;
let started = false;
let recoveryMode = false;
let authSubscription = null;
let authOperation = false;
let filter = 'Todos';
let query = '';
let page = 0;
let draft = null;
const main = document.querySelector('main');
const modal = document.querySelector('#modal');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const e = escapeHTML;

function save() {
  try {
    if (user) localStorage.setItem('poy-online-drafts-v1:' + user.id, JSON.stringify(state.bookDrafts || []));
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

/* 02. Biblioteca e pesquisa */
function updateResults() {
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const books = state.books.filter(book => book.visibility === 'public' && (filter === 'Todos' || book
    .category === filter) && normalized(book.name).includes(normalized(query)));
  document.querySelector('#book-results').innerHTML = books.length ? books.map(book => card(book)).join('') :
    '<div class="empty"><h3>Não encontrámos esse livro.</h3><p>Experimente outro nome ou selecione «Todos».</p><button class="button secondary" data-action="clear-search">Limpar pesquisa e filtros</button></div>';
  document.querySelector('#result-count').textContent =
    `${books.length} livros públicos para descobrir`;
}

/* 03. Leitura de livros e apresentação de diferentes conteúdos */
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

/* 04. Criação, edição e envio de memórias */
function baseBookForm(id) {
  const book = id ? bookById(id) : null;
  if (id && !book?.owner) return missing();
  main.innerHTML = `<div class="page">
    <a href="#area" class="back-link">← Voltar à área pessoal</a>
    <span class="eyebrow" style="display:block;margin-top:20px">Um espaço para recordar</span>
    <h1>${book?'Editar um livro':'Cada vida começa uma história.'}</h1>
    <p class="muted">${book?'Atualize os detalhes e organize as memórias deste livro.':'Escolha os primeiros detalhes. Poderá continuar a escrever e editar mais tarde.'}</p>
    <div class="form-layout">
    <form id="book-form" data-id="${id||''}">
    <div class="field">
    <label for="name">Nome da pessoa *</label>
    <input id="name" name="name" required maxlength="70" value="${e(book?.name||'')}" autocomplete="name">
    </div>
    <div class="field">
    <label for="subtitle">Uma frase para a capa</label>
    <input id="subtitle" name="subtitle" maxlength="120" placeholder="O que gostaria de recordar?" value="${e(book?.subtitle||'')}">
    </div>
    <div class="field">
    <label for="category">Categoria</label>
    <select id="category" name="category">${['Família','Amigos','Comunidade'].map(x=>`<option ${book?.category===x?'selected':''}>${x}</option>`).join('')}</select>
    </div>
    <div class="field">
    <label for="color">Cor da capa</label>
    <select id="color" name="color">${[['#697658','Verde oliveira'],['#b16e50','Terracota'],['#525e74','Azul ardósia'],['#aa8c52','Ocre']].map(([v,t])=>`<option value="${v}" ${book?.color===v?'selected':''}>${t}</option>`).join('')}</select>
    </div>
    <div class="field">
    <label for="visibility">Quem pode consultar?</label>
    <select id="visibility" name="visibility">
    <option value="public" ${book?.visibility==='public'?'selected':''}>Público — aparece na biblioteca e na instalação</option>
    <option value="private" ${book?.visibility==='private'?'selected':''}>Privado — apenas na minha área pessoal</option>
    </select>
    </div>
    <div class="panel-actions">
    <button class="button" type="submit">Pré-visualizar livro →</button>
    <button type="button" class="text-button" data-action="cancel">Cancelar</button>
    </div>
    </form>
    <aside>
    <h2>Um livro que pode crescer.</h2>
    <p>Comece pelo nome e por uma frase. Depois, acrescente histórias, fotografias, áudio ou vídeo.</p>
    <p>É a pessoa responsável por este livro e decide quais os contributos que fazem parte dele.</p>
    <small>* Campo obrigatório. Os livros públicos podem ser consultados por todas as pessoas. Os privados ficam acessíveis apenas na sua conta.</small>
    </aside>
    </div>${book?`<section class="panel">
    <h2>Memórias do livro</h2>
    ${book.memories.map((memory,index)=>`<div class="memory">
    <h3>${e(memory.title)}</h3>
    <div class="panel-actions">
    <button class="text-button" data-action="edit-memory" data-index="${index}" data-id="${book.id}">Editar</button>
    <button class="text-button" data-action="move-memory" data-index="${index}" data-id="${book.id}" ${index===0?'disabled':''}>Mover para cima</button>
    <button class="text-button danger" data-action="delete-memory" data-index="${index}" data-id="${book.id}">Retirar memória</button>
    </div>
    </div>`).join('')}</section>`:''}</div>`;
}

function baseContribution(id) {
  if (!bookById(id)) return missing();
  main.innerHTML = '<div class="page"><div class="form-layout"><form id="memory-form">' +
    '<div class="field"><label for="author">O seu nome e rela\u00e7\u00e3o com a pessoa *</label>' +
    '<input id="author" name="author" required maxlength="90" autocomplete="name"></div>' +
    '<div class="panel-actions"><button class="button" type="submit">Pr\u00e9-visualizar</button>' +
    '<button class="text-button" type="button" data-action="cancel">Cancelar</button></div></form></div></div>';
}

/* 05. Área pessoal e moderação */
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

/* 06. Contas reais. As permissões são também verificadas no Supabase. */
let user = null;
let loginDestination = '#area';
let dirty = false;
let activeHash = location.hash || '#inicio';
let editorCache = null;
let modalCancel = null;
let successResult = null;
let attachmentLoading = false;
const owns = book => Boolean(book && user && book.ownerId === user.id);
const accessible = book => Boolean(book && (book.visibility === 'public' || owns(book)));
const received = () => state.pending.filter(item => owns(bookById(item.bookId)));
const sent = () => [...state.pending.map(item => ({
  ...item,
  status: 'pending'
})), ...state.history].filter(item => item.senderId === user?.id);
const statusText = status => ({
  pending: 'Pendente de revisão',
  accepted: 'Aceite e publicado',
  rejected: 'Recusado',
  cancelled: 'Cancelado por si'
})[status] || 'Pendente de revisão';
const uid = () => crypto.randomUUID();

function localTransaction(change) {
  const before = structuredClone(state);
  change();
  if (save()) return true;
  state = before;
  return false;
}

function cloudNotice(message = '') {
  document.querySelector('#cloud-message').textContent = message;
  document.querySelector('#cloud-notice').hidden = !message;
}

function loadLocalDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem('poy-online-drafts-v1:' + user?.id) || '[]');
    state.bookDrafts = Array.isArray(drafts) ? drafts.filter(item => item.ownerId === user?.id) : [];
  } catch { state.bookDrafts = []; }
}

function hasActiveEditor() {
  return dirty || (['editar', 'criar', 'previsualizar', 'contribuir', 'rascunho'].includes(route().view) && Boolean(editorCache || draft));
}

// Os formulários iniciais ainda não têm editorCache nem dirty.
// Mantém o DOM dos formulários e do leitor para preservar texto e a página aberta.
function hasActiveView() {
  return hasActiveEditor() || route().view === 'livro' || Boolean(main.querySelector('form'));
}

async function refreshCloud(background = false) {
  const generation = sessionGeneration;
  const collection = await PoyCloud.collection(Boolean(user));
  if (generation !== sessionGeneration) return false;
  if (background && (hasActiveView() || modal.open || cloudBusy)) return false;
  Object.assign(state, collection);
  cloudReady = true;
  cloudNotice();
  return true;
}

async function transaction(change) {
  if (cloudBusy) return false;
  if (!user || !cloudReady) {
    announce('Aguarde a ligação ao servidor antes de guardar.');
    return false;
  }
  const before = structuredClone(state);
  const generation = sessionGeneration;
  cloudBusy = true;
  main.inert = true;
  let committed = false;
  try {
    change();
    const after = structuredClone(state);
    // O estado visível só avança depois da confirmação do servidor.
    state = before;
    await PoyCloud.commit(before, after);
    committed = true;
    if (generation !== sessionGeneration) return false;
    state = after;
    if (!save()) cloudNotice('O livro foi guardado online, mas não foi possível atualizar os rascunhos locais.');
    try { await refreshCloud(); }
    catch (error) {
      cloudReady = false;
      cloudNotice('Guardado no servidor. Falta atualizar a coleção: ' + PoyCloud.message(error));
    }
    return true;
  } catch (error) {
    if (!committed && generation === sessionGeneration) state = before;
    cloudNotice(PoyCloud.message(error));
    announce('Não foi possível confirmar a gravação. O conteúdo em edição foi mantido.');
    return false;
  } finally {
    cloudBusy = false;
    main.inert = false;
  }
}

function back(href = '#area', text = 'Voltar à área pessoal') {
  return '<a class="back-link" href="' + e(href) + '">← ' + e(text) + '</a>';
}

function navigate(hash, allow = false) {
  if (cloudBusy) return;
  if (dirty && !allow) {
    if (editorCache?.key.startsWith('book/')) {
      if (!saveBookDraft()) return;
      modalCancel = null;
      if (modal.open) modal.close();
      dirty = false;
      draft = null;
      editorCache = null;
      navigate(hash, true);
      return;
    }
    confirmDialog('Descartar estas alterações?', 'Tem alterações por guardar. Se sair, serão perdidas.',
  () => {
      dirty = false;
      draft = null;
      editorCache = null;
      navigate(hash, true);
    }, 'Sim, descartar', 'Continuar a editar');
    return;
  }
  if (allow) dirty = false;
  if (hash === location.hash) render();
  else location.hash = hash;
}

function confirmDialog(title, text, callback, yes = 'Sim, confirmar', no = 'Não, voltar') {
  const previous = modal.open ? document.querySelector('#modal-content').innerHTML : '';
  openModal('<h2 id="modal-title">' + e(title) +
    '</h2><p>' + e(text) + '</p><div class="panel-actions"><button class="button secondary" data-action="close-modal" autofocus>' +
    e(no) + '</button><button class="button" id="confirm-operation">' + e(yes) + '</button></div>');
  modalCancel = previous ? () => openModal(previous) : null;
  document.querySelector('#confirm-operation').onclick = async () => {
    modalCancel = null;
    modal.close();
    try { await callback(); }
    catch (error) { cloudNotice(PoyCloud.message(error)); }
  };
}

function closeModal() {
  modal.close();
  const callback = modalCancel;
  modalCancel = null;
  if (callback) callback();
}

async function session(account) {
  const nextUser = account ? { id: account.id, email: account.email,
    name: account.user_metadata?.name || account.email?.split('@')[0] || 'A minha conta' } : null;
  if (user?.id !== nextUser?.id) {
    sessionGeneration++;
    state = { books: [], pending: [], history: [], bookDrafts: [] };
    draft = null;
    editorCache = null;
    dirty = false;
  }
  user = nextUser;
  cloudReady = false;
  loadLocalDrafts();
  try { await refreshCloud(); }
  catch (error) { cloudNotice(PoyCloud.message(error)); }
}

function auth(register = false) {
  main.innerHTML = '<div class="page auth-page">' + back('#inicio', 'Voltar ao início') +
    '<section class="auth-card"><h1>' +
    (register ? 'Criar conta' : 'Iniciar sessão') +
    '</h1><form id="auth-form">' +
    (register ?
      '<div class="field"><label for="account-name">Nome</label><input id="account-name" name="name" required maxlength="60" autocomplete="name"></div>' :
      '') +
    '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" maxlength="150"></div>' +
    '<div class="field"><label for="password">Palavra-passe</label><div class="password-field">' +
    '<input id="password" name="password" type="password" required minlength="8" autocomplete="' + (register ? 'new-password' : 'current-password') + '">' +
    '</div>' +
    '</div>' +
    '<p class="form-error" id="auth-error" role="alert"></p>' +
    '<button class="button full-width">' + (register ? 'Criar conta' : 'Entrar') + '</button></form>' +
    '<p class="auth-switch">' + (register ? 'Já tem conta? <a href="#login">Iniciar sessão</a>' :
      'Ainda não tem conta? <a href="#registar">Criar conta</a>') +
    '</p><p><a href="#recuperar">Recuperar palavra-passe</a></p></section></div>';
  document.querySelector('#auth-form').onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const email = data.email.trim().toLowerCase();
    const error = document.querySelector('#auth-error');
    const submit = event.target.querySelector('button[type="submit"], button');
    submit.disabled = true;
    authOperation = true;
    error.textContent = '';
    try {
      const client = PoyCloud.connection();
      let result;
      if (register) {
        if (!data.name.trim()) throw new Error('Indique o seu nome.');
        result = PoyCloud.check(await client.auth.signUp({ email, password: data.password,
          options: { data: { name: data.name.trim() }, emailRedirectTo: location.href.split('#')[0] } }));
        if (!result.session) {
          error.textContent = 'Consulte o seu email e confirme a conta. Depois, volte para iniciar sessão.';
          return;
        }
      } else result = PoyCloud.check(await client.auth.signInWithPassword({ email, password: data.password }));
      await session(result.user);
      navigate(loginDestination, true);
      announce('Sessão iniciada.');
    } catch (failure) { error.textContent = PoyCloud.message(failure); }
    finally { submit.disabled = false; authOperation = false; }
  };
}

function recover() {
  main.innerHTML = '<div class="page auth-page">' + back('#login', 'Voltar ao início de sessão') +
    '<section class="auth-card"><h1>' + (recoveryMode ? 'Nova palavra-passe' : 'Recuperar acesso') + '</h1>' +
    '<form id="recovery-form"><div class="field"><label for="recovery-value">' +
    (recoveryMode ? 'Nova palavra-passe' : 'Email') + '</label><input id="recovery-value" required ' +
    (recoveryMode ? 'type="password" minlength="8" autocomplete="new-password"' : 'type="email" autocomplete="email"') +
    '></div><p id="recovery-message" role="status"></p><button class="button">' +
    (recoveryMode ? 'Guardar palavra-passe' : 'Enviar email de recuperação') + '</button></form></section></div>';
  document.querySelector('#recovery-form').onsubmit = async event => {
    event.preventDefault();
    const value = document.querySelector('#recovery-value').value;
    const message = document.querySelector('#recovery-message');
    const submit = event.target.querySelector('button');
    submit.disabled = true;
    try {
      if (recoveryMode) {
        PoyCloud.check(await PoyCloud.connection().auth.updateUser({ password: value }));
        recoveryMode = false;
        navigate('#area', true);
        announce('Palavra-passe atualizada.');
      } else {
        PoyCloud.check(await PoyCloud.connection().auth.resetPasswordForEmail(value.trim(), {
          redirectTo: location.href.split('#')[0]
        }));
        message.textContent = 'Se existir uma conta com este email, receberá uma ligação de recuperação.';
      }
    } catch (error) { message.textContent = PoyCloud.message(error); }
    finally { submit.disabled = false; }
  };
}

function downloadLegacyBackup() {
  if (!legacyState) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(legacyState, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pages-of-you-copia-local.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importLocalBooks() {
  if (!user || !legacyState || !cloudReady) return announce('Inicie sessão e aguarde a ligação online.');
  const importId = book => 'local-' + user.id + '-' + book.id;
  const candidates = legacyState.books.filter(book => typeof book.id === 'string' &&
    Array.isArray(book.memories) && !bookById(importId(book)));
  openModal('<h2 id="modal-title">Importar livros antigos</h2>' +
    '<p>Escolha apenas os livros que lhe pertencem. Serão copiados para a conta ' + e(user.email) +
    '. Os originais ficam guardados neste navegador.</p>' +
    '<p>Os livros marcados como públicos ficarão visíveis para todas as pessoas, incluindo na instalação. ' +
    'Os pedidos de contribuição antigos não são importados.</p>' +
    '<button type="button" class="text-button" data-action="backup-local">Descarregar cópia de segurança</button>' +
    '<form id="import-form">' + candidates.map((book, index) =>
      '<label class="import-choice"><input type="checkbox" name="book" value="' + index + '"> ' +
      e(book.name || 'Livro sem título') + ' — ' + (book.visibility === 'public' ? 'Público' : 'Privado') + '</label>'
    ).join('') + (!candidates.length ? '<p>Todos os livros disponíveis já foram importados para esta conta.</p>' : '') +
    '<p id="import-message" role="status"></p><div class="panel-actions">' +
    '<button type="button" class="button secondary" data-action="close-modal">Fechar</button>' +
    (candidates.length ? '<button type="submit" class="button">Importar selecionados</button>' : '') + '</div></form>');
  document.querySelector('#import-form').onsubmit = async event => {
    event.preventDefault();
    const chosen = new FormData(event.target).getAll('book').map(index => candidates[Number(index)]);
    const message = document.querySelector('#import-message');
    if (!chosen.length) { message.textContent = 'Selecione pelo menos um livro.'; return; }
    const accountId = user.id;
    const form = event.target;
    form.querySelectorAll('button, input').forEach(element => { element.disabled = true; });
    message.textContent = 'A importar os livros e as imagens…';
    const done = await transaction(() => {
      for (const original of chosen) {
        const id = importId(original);
        const imported = structuredClone(original);
        delete imported._revision;
        state.books.push({ ...imported, id, ownerId: accountId, owner: true,
          code: 'POY-' + accountId.slice(0, 8).toUpperCase() + '-' + original.id.toUpperCase(),
          visibility: original.visibility === 'public' ? 'public' : 'private' });
      }
    });
    form.querySelectorAll('button, input').forEach(element => { element.disabled = false; });
    if (done) {
      modal.close();
      navigate('#meus-livros', true);
      announce(chosen.length + ' livro(s) importado(s) para a sua conta.');
    } else message.textContent = 'Não foi possível confirmar a importação. Os originais continuam intactos. Atualize a coleção antes de voltar a tentar.';
  };
}

async function bootstrapCloud() {
  if (cloudLoading) return;
  cloudLoading = true;
  try {
    const client = PoyCloud.connection();
    if (!authSubscription) {
      authSubscription = client.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'PASSWORD_RECOVERY') recoveryMode = true;
        // O callback de Auth mantém-se síncrono para não bloquear o SDK.
        setTimeout(async () => {
          if (!started || authOperation) return;
          if (event === 'PASSWORD_RECOVERY') navigate('#recuperar', true);
          if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
          if ((nextSession?.user?.id || null) !== (user?.id || null)) {
            if (dirty && editorCache?.key.startsWith('book/')) saveBookDraft();
            await session(nextSession?.user || null);
            render(false);
          }
        }, 0);
      }).data.subscription;
    }
    const current = PoyCloud.check(await client.auth.getSession());
    await session(current.session?.user || null);
    started = true;
    if (recoveryMode) navigate('#recuperar', true);
    else render(false);
  } catch (error) {
    started = true;
    cloudReady = false;
    render(false);
    cloudNotice(PoyCloud.message(error));
  } finally { cloudLoading = false; }
}

async function retryCloud() {
  if (cloudBusy || cloudLoading) return;
  if (hasActiveView()) {
    cloudNotice('O conteúdo aberto foi mantido. Volte à biblioteca para atualizar a coleção.');
    return;
  }
  if (!authSubscription) return bootstrapCloud();
  cloudLoading = true;
  try {
    await refreshCloud();
    // Uma atualização nunca substitui o conteúdo do editor ou da pré-visualização.
    if (!hasActiveView() && !modal.open) render(false);
    announce('Coleção atualizada.');
  } catch (error) { cloudNotice(PoyCloud.message(error)); }
  finally { cloudLoading = false; }
}

setInterval(async () => {
  if (!started || cloudBusy || cloudLoading || hasActiveView() || modal.open || document.hidden) return;
  cloudLoading = true;
  const previous = JSON.stringify([state.books, state.pending, state.history]);
  try {
    const refreshed = await refreshCloud(true);
    if (refreshed && !hasActiveView() && !modal.open &&
      previous !== JSON.stringify([state.books, state.pending, state.history])) render(false);
  } catch (error) {
    cloudReady = false;
    cloudNotice('Não foi possível atualizar a coleção. ' + PoyCloud.message(error));
  } finally { cloudLoading = false; }
}, 15000);

/* 07. Entrada e biblioteca: a estante passa a ser o ponto de partida. */
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

function saveBookDraft() {
  if (!user || !editorCache?.key.startsWith('book/')) return false;
  const form = document.querySelector('#book-form');
  if (form) editorCache.values = Object.fromEntries(new FormData(form));
  const id = editorCache.savedDraftId || uid();
  const cache = structuredClone({
    ...editorCache,
    savedDraftId: id
  });
  const bookId = cache.key.split('/')[1];
  if (bookId !== 'new' && !owns(bookById(bookId))) return false;
  if (!localTransaction(() => {
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
  editorCache.savedDraftId = id;
  dirty = false;
  const status = document.querySelector('#draft-state');
  if (status) status.textContent = 'Rascunho guardado';
  announce('Rascunho guardado neste navegador. Pode continuar em Meus livros.');
  return true;
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
  if (kind === 'book') baseBookForm(id);
  else baseContribution(id);
  const form = document.querySelector(kind === 'book' ? '#book-form' : '#memory-form');
  for (const name of ['category', 'visibility']) form.querySelector('[name="' + name + '"]')?.closest(
    '.field').remove();
  const cached = editorCache.values;
  if (cached)
    for (const element of form.elements) {
      if (element.name && cached[element.name] !== undefined) {
        if (element.type === 'checkbox') element.checked = Boolean(cached[element.name]);
        else element.value = cached[element.name];
      }
    }
  if (kind === 'book') {
    const nameInput = form.querySelector('[name="name"]');
    nameInput.type = 'hidden';
    nameInput.required = false;
    form.append(nameInput);
    form.querySelectorAll('.field').forEach(field => field.remove());
    form.insertAdjacentHTML('afterbegin',
      '<div class="field"><label for="online-visibility">Quem pode consultar?</label>' +
      '<select id="online-visibility" name="visibility"><option value="public">Público — biblioteca e instalação</option>' +
      '<option value="private">Privado — apenas a minha conta</option></select></div>');
    form.querySelector('[name="visibility"]').value = cached?.visibility || book?.visibility || 'public';
  }
  // O consentimento passa a ter nome, para sobreviver ao regresso da pré-visualização.
  const consent = form.querySelector('input[type="checkbox"]');
  if (consent) {
    consent.name = 'consent';
    if (cached) consent.checked = Boolean(cached.consent);
  }
  const details = document.querySelector('.form-layout aside');
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
    const check = replacement.querySelector('[name="consent"]');
    if (check) editorCache.values.consent = check.checked;
    dirty = true;
    document.querySelector('#draft-state').textContent = 'Alterações por guardar';
    updateEditorPreview(kind, id);
  });
  const upload = replacement.querySelector('#file');
  if (upload) upload.onchange = async () => {
    const file = upload.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !
      /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4)|video\/(mp4|webm))$/.test(file.type)) {
      upload.value = '';
      announce('Escolha um formato indicado com, no máximo, 2 MB.');
      return;
    }
    const cache = editorCache;
    attachmentLoading = true;
    try {
      const result = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (cache !== editorCache) return;
      cache.media = result;
      const label = document.querySelector('#attachment-state');
      if (label) label.textContent = 'Ficheiro pronto para pré-visualizar.';
      dirty = true;
      updateEditorPreview(kind, id);
    } catch {
      announce('Não foi possível ler o ficheiro.');
    } finally {
      attachmentLoading = false;
    }
  };
  replacement.onsubmit = async event => {
    event.preventDefault();
    if (attachmentLoading) return announce('Aguarde a leitura do ficheiro e tente novamente.');
    const values = Object.fromEntries(new FormData(replacement));
    const required = kind === 'book' ? ['name'] : ['author'];
    if (required.some(name => !values[name]?.trim())) return announce(
      'Preencha os campos obrigatórios com texto.');
    if (kind === 'memory' && !editorCache.design.elements.length) return announce(
      'Adicione texto ou formas para compor a mem\u00f3ria.');
    const selected = replacement.querySelector('#file')?.files[0];
    if (selected && !editorCache.media) {
      if (selected.size > 2 * 1024 * 1024 || !
        /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4)|video\/(mp4|webm))$/.test(selected.type))
        return announce('Escolha um formato indicado com, no máximo, 2 MB.');
      attachmentLoading = true;
      try {
        editorCache.media = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selected);
        });
      } catch {
        return announce('Não foi possível ler o ficheiro.');
      } finally {
        attachmentLoading = false;
      }
    }
    if (kind === 'memory' && editorCache.media && !values.mediaDescription.trim()) return announce(
      'Acrescente uma descrição ou transcrição do ficheiro.');
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
  if (editorCache.media && document.querySelector('#attachment-state'))
    document.querySelector('#attachment-state').textContent = 'Ficheiro preservado no rascunho.';
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

function renderEditorMemories() {
  const extra = document.querySelector('#editor-extra');
  if (!extra) return;
  extra.innerHTML = '<section class="editor-memories"><h2>Memórias do livro</h2>' +
    editorCache.memories.map((memory, index) => '<article class="memory"><h3>' + e(memory.title) +
      '</h3><div class="panel-actions">' +
      '<button class="text-button" data-action="edit-memory" data-index="' + index + '">Editar</button>' +
      '<button class="text-button" data-action="move-memory" data-index="' + index + '" ' + (index === 0 ?
        'disabled' : '') + '>Mover para cima</button>' +
      '<button class="text-button danger" data-action="delete-memory" data-index="' + index +
      '">Retirar</button></div></article>').join('') + '</section>';
  extra.querySelectorAll('[data-index]').forEach(button => {
    if (isAcceptedEditorMemory(Number(button.dataset.index))) { button.disabled = true; button.title = 'Memória aceite: apenas leitura.'; }
  });
}

function isAcceptedEditorMemory(index) {
  const memory = editorCache?.memories?.[index];
  return Boolean(memory && (memory.locked || editorCache.pages?.some(page =>
    page.sourceMemoryId === (memory.id || 'legacy-memory-' + index))));
}

function memoryDialog(index) {
  if (index !== undefined && isAcceptedEditorMemory(index)) return announce('Memória aceite: apenas leitura.');
  const memory = editorCache.memories[index] || {
    title: '',
    text: '',
    author: user.name
  };
  openModal('<h2 id="modal-title">' + (index === undefined ? 'Adicionar memória' : 'Editar memória') +
    '</h2><form id="edit-memory-form">' +
    '<div class="field"><label for="edit-title">Título *</label><input id="edit-title" name="title" required maxlength="100" value="' +
    e(memory.title) + '"></div>' +
    '<div class="field"><label for="edit-text">Memória *</label><textarea id="edit-text" name="text" required maxlength="5000">' +
    e(memory.text) + '</textarea></div>' +
    '<div class="field"><label for="edit-author">Autoria *</label><input id="edit-author" name="author" required maxlength="90" value="' +
    e(memory.author) + '"></div>' +
    '<div class="panel-actions"><button class="button">Aplicar ao rascunho</button><button class="button secondary" type="button" data-action="close-modal">Cancelar</button></div></form>'
    );
  document.querySelector('#edit-memory-form').onsubmit = event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (Object.values(data).some(value => !value.trim())) return announce('Preencha os campos com texto.');
    if (index === undefined) editorCache.memories.push({
      ...data
    });
    else Object.assign(editorCache.memories[index], data);
    dirty = true;
    modal.close();
    renderEditorMemories();
    updateEditorPreview('book', route().id);
  };
}

/* 10. Pré-visualização, confirmação e aplicação das alterações. */
function previewDraft() {
  navigate('#previsualizar', true);
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
      successResult = null;
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

/* 11. Navegação e ações centralizadas. */
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
  // Atualiza apenas o indicador de gestão dos dados legados.
  state.books.forEach(book => {
    book.owner = owns(book);
  });
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
  if (main.querySelector('.auth-page .auth-card')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'form-library-background';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = Array.from({ length: 4 }, (_, row) =>
      '<div class="form-library-shelf">' + Array.from({ length: 32 }, (_, i) => {
        const n = row * 11 + i;
        return '<span class="wall-book wall-pattern-' + (n % 8) +
          '" style="--volume-color:var(--wall-' + (n % 7) +
          ');--volume-height:' + (65 + (n * 13) % 32) +
          '%;--volume-width:' + (24 + (n * 17) % 30) +
          ';--volume-angle:' + (n % 5 === 0 ? -6 : n % 4 === 0 ? 5 : 0) +
          'deg"><i></i><b></b></span>';
      }).join('') + '</div>'
    ).join('');
    main.querySelector('.auth-page').prepend(backdrop);
  }
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
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === view || link.dataset.nav === 'area' && protectedViews.includes(view)) link
      .setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  activeHash = location.hash || '#inicio';
  if (focus) {
    main.focus();
    window.scrollTo(0, 0);
  }
  if (successResult) {
    const result = successResult;
    successResult = null;
    openModal('<span class="success-mark" aria-hidden="true">✓</span><h2 id="modal-title">' +
      (result.isBook ? (result.isEdit ? 'Alterações guardadas com sucesso!' : 'Livro publicado com sucesso!') : 'Pedido enviado com sucesso!') +
      '</h2><p>' + (result.isBook ? 'A nova versão já está guardada online.' :
        'A memória aguarda a revisão do responsável. Pode acompanhar o estado na área pessoal.') +
      '</p><div class="panel-actions"><button class="button" data-action="close-modal">' +
      (result.isBook ? 'Ver livro' : 'Ver estado do pedido') +
      '</button><a class="button secondary" href="#area">Voltar à área pessoal</a></div>');
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
  const index = Number(button.dataset.index);
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
  if (action === 'save-book-draft') saveBookDraft();
  if (action === 'delete-book' || action === 'delete-book-draft') deleteSavedBook(id, action === 'delete-book-draft');
  if (action === 'clear-search') {
    query = '';
    filter = 'Todos';
    library();
    document.querySelector('#search').focus();
  }
  if (action === 'password') {
    const input = document.querySelector('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'text' ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', input.type === 'text');
  }
  if (action === 'logout') confirmDialog('Terminar sessão?',
    'Os livros publicados continuam guardados na sua conta.', async () => {
      authOperation = true;
      try {
        if (dirty && editorCache?.key.startsWith('book/') && !saveBookDraft()) return;
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
  if (action === 'remove-media') {
    editorCache.media = '';
    const upload = document.querySelector('#file');
    if (upload) upload.value = '';
    document.querySelector('#attachment-state').textContent = 'Sem ficheiro.';
    dirty = true;
    updateEditorPreview('memory', route().id);
  }
  if (['edit-memory', 'move-memory', 'delete-memory'].includes(action) && isAcceptedEditorMemory(index)) return announce('Memória aceite: apenas leitura.');
  if (action === 'add-memory') memoryDialog();
  if (action === 'edit-memory') memoryDialog(index);
  if (action === 'move-memory' && index > 0) {
    const items = editorCache.memories;
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    dirty = true;
    renderEditorMemories();
    updateEditorPreview('book', route().id);
  }
  if (action === 'delete-memory') confirmDialog('Retirar esta memória do rascunho?',
    'A remoção só se aplica ao livro quando guardar as alterações.', () => {
      editorCache.memories.splice(index, 1);
      dirty = true;
      renderEditorMemories();
      updateEditorPreview('book', route().id);
    }, 'Sim, retirar');
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
  if (action === 'share') {
    try {
      await navigator.clipboard.writeText(location.href);
      announce('Ligação copiada. Apenas os livros públicos podem ser consultados por outras pessoas.');
    } catch {
      openModal(
        '<h2 id="modal-title">Copiar ligação</h2><div class="field"><label for="share-url">Ligação ao livro</label><input id="share-url" readonly value="' +
        e(location.href) +
        '"></div><p>Outras pessoas podem consultar esta ligação se o livro for público.</p><button class="button" data-action="close-modal">Fechar</button>'
        );
    }
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
