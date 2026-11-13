/* Rascunhos locais com suporte para fotografias, sem publicar o livro. */
window.PoyDraftStore = (() => {
  let opening;
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('poy-book-drafts-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Armazenamento ocupado.'));
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function access(owner, value, write) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', write ? 'readwrite' : 'readonly');
      const request = write ? tx.objectStore('drafts').put(value, owner) : tx.objectStore('drafts').get(owner);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('Falha ao guardar.'));
    });
  }
  async function read(owner) {
    let stored;
    try { stored = await access(owner, null, false); } catch { /* Tenta os rascunhos antigos. */ }
    if (Array.isArray(stored)) return stored;
    const legacy = JSON.parse(localStorage.getItem('poy-online-drafts-v1:' + owner) || '[]');
    return Array.isArray(legacy) ? legacy : [];
  }
  async function write(owner, drafts) {
    try { await access(owner, drafts, true); }
    catch (error) {
      // Compatibilidade com navegadores que bloqueiam IndexedDB.
      localStorage.setItem('poy-online-drafts-v1:' + owner, JSON.stringify(drafts));
      return;
    }
    // Apaga a cópia antiga apenas depois da transação confirmada.
    try { localStorage.removeItem('poy-online-drafts-v1:' + owner); } catch { /* Cópia principal segura. */ }
  }
  return { read, write };
})();
