/* Persistência, sincronização e recuperação dos dados do protótipo. */
async function localTransaction(change) {
  const generation = sessionGeneration;
  const before = structuredClone(state);
  change();
  if (await save()) return true;
  if (generation === sessionGeneration) state = before;
  return false;
}

function cloudNotice(message = '') {
  document.querySelector('#cloud-message').textContent = message;
  document.querySelector('#cloud-notice').hidden = !message;
}

async function loadLocalDrafts() {
  try {
    const drafts = user ? await PoyDraftStore.read(user.id) : [];
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
    if (!await save()) cloudNotice('O livro foi guardado online, mas não foi possível atualizar os rascunhos locais.');
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
            if (dirty && editorCache?.key.startsWith('book/')) await saveBookDraft();
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
