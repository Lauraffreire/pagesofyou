/* Camada comum aos dois sites. Os ficheiros de dados locais não são publicados. */
'use strict';
window.PoyCloud = (() => {
  const config = window.POY_SUPABASE_CONFIG;
  let client;
  function connection() {
    if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) {
      throw new Error('Não foi possível carregar a ligação online. Verifique a Internet e volte a tentar.');
    }
    client ||= window.supabase.createClient(config.url, config.publishableKey, {
      global: { fetch: (url, options = {}) => fetch(url, {
        ...options, signal: options.signal || AbortSignal.timeout(20000)
      }) },
      auth: {
        storageKey: 'poy-supabase-session',
        persistSession: document.body.classList.contains('creation-site'),
        autoRefreshToken: document.body.classList.contains('creation-site'),
        detectSessionInUrl: document.body.classList.contains('creation-site')
      }
    });
    return client;
  }
  function check(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  async function allRows(query) {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const batch = check(await query().range(offset, offset + 99));
      rows.push(...batch);
      if (batch.length < 100) return rows;
    }
  }
  function book(row) {
    return { ...row.data, id: row.id, ownerId: row.owner_id, visibility: row.visibility,
      memories: Array.isArray(row.data.memories) ? row.data.memories : [], _revision: row.updated_at };
  }
  async function publicBooks() {
    return (await allRows(() => connection().from('poy_books').select('*')
      .eq('visibility', 'public').order('id'))).map(book);
  }
  async function collection(signedIn) {
    const [books, requests] = await Promise.all([
      allRows(() => connection().from('poy_books').select('*').order('id')),
      signedIn ? allRows(() => connection().from('poy_contributions').select('*').order('id')) : []
    ]);
    const contributions = requests.map(row => ({ ...row.data, id: row.id,
      bookId: row.book_id, senderId: row.sender_id, status: row.status }));
    return { books: books.map(book),
      pending: contributions.filter(item => item.status === 'pending'),
      history: contributions.filter(item => item.status !== 'pending') };
  }
  const sorted = value => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, sorted(value[key])])
    );
    return value;
  };
  const fingerprint = value => JSON.stringify(sorted(value && Object.fromEntries(
    Object.entries(value).filter(([key]) => !['_revision', 'owner'].includes(key))
  )));
  function changes(before, after) {
    const oldBooks = new Map(before.books.map(item => [item.id, item]));
    const newBooks = new Map(after.books.map(item => [item.id, item]));
    const decisions = after.history.filter(item => before.pending.some(old => old.id === item.id))
      .map(item => ({ id: item.id, status: item.status }));
    const decidedBooks = new Set(decisions.filter(item => item.status === 'accepted')
      .map(item => before.pending.find(old => old.id === item.id).bookId));
    return {
      books: after.books.filter(item => !decidedBooks.has(item.id) &&
        fingerprint(item) !== fingerprint(oldBooks.get(item.id))).map(item => ({
          data: JSON.parse(fingerprint(item)), expected: oldBooks.get(item.id)?._revision || null
        })),
      deleted: before.books.filter(item => !newBooks.has(item.id))
        .map(item => ({ id: item.id, expected: item._revision })),
      requests: after.pending.filter(item => !before.pending.some(old => old.id === item.id)),
      decisions
    };
  }
  async function commit(before, after) {
    const payload = changes(before, after);
    if (Object.values(payload).every(items => !items.length)) return;
    try { check(await connection().rpc('poy_commit', { p_changes: payload })); }
    catch (error) {
      // Uma resposta pode perder-se depois de o servidor guardar. Confirma o
      // resultado antes de pedir outra tentativa, evitando publicações duplicadas.
      if (/fetch|network|load failed|timeout|abort/i.test(error?.message || '')) {
        try {
          const remote = await collection(true);
          const requests = [...remote.pending, ...remote.history];
          const done = payload.books.every(item => fingerprint(remote.books.find(book => book.id === item.data.id)) === fingerprint(item.data)) &&
            payload.deleted.every(item => !remote.books.some(book => book.id === item.id)) &&
            payload.requests.every(item => requests.some(request => request.id === item.id)) &&
            payload.decisions.every(item => requests.some(request => request.id === item.id && request.status === item.status));
          if (done) return;
        } catch { /* Sem confirmação: a interface mantém o conteúdo em edição. */ }
      }
      throw error;
    }
  }
  function message(error) {
    const text = error?.message || '';
    if (/poy_commit|PGRST202/.test(text)) return 'Falta concluir a configuração da base de dados (02-operacoes.sql).';
    if (/invalid login credentials/i.test(text)) return 'Email ou palavra-passe incorretos.';
    if (/email not confirmed/i.test(text)) return 'Confirme o seu email antes de entrar.';
    if (/already registered/i.test(text)) return 'Este email já está registado. Inicie sessão.';
    if (/rate limit|too many requests/i.test(text)) return 'Foram feitas demasiadas tentativas. Aguarde alguns minutos.';
    if (/fetch|network|load failed|timeout|abort/i.test(text)) return 'Não foi possível contactar o servidor. Verifique a ligação à Internet.';
    if (/row-level security|permission denied/i.test(text)) return 'Não tem autorização para esta operação. Verifique a sua sessão.';
    return text || 'Não foi possível concluir a operação. Volte a tentar.';
  }
  return { connection, check, collection, publicBooks, commit, changes, message };
})();
