/* Estado partilhado, sessão, permissões e utilitários de identificação. */
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
let draftSaving = false;
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

let user = null;
let loginDestination = '#area';
let dirty = false;
let activeHash = location.hash || '#inicio';
let editorCache = null;
let modalCancel = null;
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
