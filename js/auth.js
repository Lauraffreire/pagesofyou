/* Navegação protegida, diálogos e autenticação. */
function back(href = '#area', text = 'Voltar à área pessoal') {
  return '<a class="back-link" href="' + e(href) + '">← ' + e(text) + '</a>';
}

async function navigate(hash, allow = false) {
  if (cloudBusy || draftSaving) return;
  if (dirty && !allow) {
    if (editorCache?.key.startsWith('book/')) {
      if (!await saveBookDraft()) return;
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
  await loadLocalDrafts();
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
