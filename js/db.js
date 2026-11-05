/* Nexus CRM – IndexedDB layer. Everything stays on the device. */
const DB = (() => {
  const NAME = 'nexus-crm';
  const VERSION = 1;
  const STORES = ['contacts', 'deals', 'activities', 'attachments', 'meta'];
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('contacts')) {
          const s = db.createObjectStore('contacts', { keyPath: 'id' });
          s.createIndex('azienda', 'azienda');
        }
        if (!db.objectStoreNames.contains('deals')) {
          const s = db.createObjectStore('deals', { keyPath: 'id' });
          s.createIndex('contactId', 'contactId');
          s.createIndex('stage', 'stage');
        }
        if (!db.objectStoreNames.contains('activities')) {
          const s = db.createObjectStore('activities', { keyPath: 'id' });
          s.createIndex('data', 'data');
          s.createIndex('contactId', 'contactId');
          s.createIndex('dealId', 'dealId');
        }
        if (!db.objectStoreNames.contains('attachments')) {
          const s = db.createObjectStore('attachments', { keyPath: 'id' });
          s.createIndex('entity', ['entityType', 'entityId']);
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      try { out = fn(s); } catch (err) { reject(err); return; }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const now = () => new Date().toISOString();

  const api = {
    uid, now,
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
    get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
    put(store, obj) {
      if (!obj.id) obj.id = uid();
      if (!obj.createdAt) obj.createdAt = now();
      obj.updatedAt = now();
      return tx(store, 'readwrite', (s) => s.put(obj)).then(() => obj);
    },
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
    byIndex: (store, index, value) => tx(store, 'readonly', (s) => s.index(index).getAll(value)),
    clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
    clearAll: () => Promise.all(STORES.map((s) => api.clear(s))),
    meta: {
      get: (key) => api.get('meta', key).then((r) => (r ? r.value : undefined)),
      set: (key, value) => tx('meta', 'readwrite', (s) => s.put({ key, value })),
    },
    attachmentsFor: (entityType, entityId) => api.byIndex('attachments', 'entity', [entityType, entityId]),
    async deleteEntityAttachments(entityType, entityId) {
      const list = await api.attachmentsFor(entityType, entityId);
      await Promise.all(list.map((a) => api.del('attachments', a.id)));
    },
    async estimate() {
      if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
      return null;
    },
    async persist() {
      if (navigator.storage && navigator.storage.persist) return navigator.storage.persist();
      return false;
    },
  };
  return api;
})();
