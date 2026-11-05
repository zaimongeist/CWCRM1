/* Nexus CRM – app shell, routing, views. Vanilla JS, no build step. */
(() => {
  'use strict';

  /* ------------------------------------------------------------ constants */
  const STAGES = [
    { id: 'lead', label: 'Lead', prob: 10 },
    { id: 'contatto', label: 'Contattato', prob: 25 },
    { id: 'proposta', label: 'Proposta', prob: 50 },
    { id: 'negoziazione', label: 'Negoziazione', prob: 75 },
    { id: 'vinto', label: 'Vinto', prob: 100 },
    { id: 'perso', label: 'Perso', prob: 0 },
  ];
  const OPEN_STAGES = ['lead', 'contatto', 'proposta', 'negoziazione'];
  const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));

  const TYPES = [
    { id: 'call', label: 'Chiamata', icon: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.9 2.1z"/>' },
    { id: 'meeting', label: 'Incontro', icon: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 19a4.5 4.5 0 0 1 7 0"/>' },
    { id: 'email', label: 'Email', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
    { id: 'linkedin', label: 'LinkedIn', icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 11v6M8 8v.1M12 17v-4a2 2 0 0 1 4 0v4"/>' },
    { id: 'evento', label: 'Evento', icon: '<path d="M4 20V10l8-6 8 6v10z"/><path d="M4 10h16M10 20v-5h4v5"/>' },
    { id: 'caffe', label: 'Caffè / pranzo', icon: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M7 3v2M10 3v2M13 3v2"/>' },
    { id: 'followup', label: 'Follow-up', icon: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>' },
    { id: 'nota', label: 'Nota', icon: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>' },
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
  const DEFAULT_TAGS = ['Cliente', 'Prospect', 'Partner', 'Investitore', 'Fornitore', 'Advisor', 'Amico'];

  /* ------------------------------------------------------------ state */
  const S = { contacts: [], deals: [], activities: [], byContact: {}, byDeal: {}, q: '', dealFilter: 'open', contactFilter: '', agendaDay: null };

  async function reload() {
    [S.contacts, S.deals, S.activities] = await Promise.all([DB.all('contacts'), DB.all('deals'), DB.all('activities')]);
    S.contacts.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
    S.byContact = Object.fromEntries(S.contacts.map((c) => [c.id, c]));
    S.byDeal = Object.fromEntries(S.deals.map((d) => [d.id, d]));
  }

  /* ------------------------------------------------------------ helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const money = (n) => eur.format(Number(n) || 0);
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate();
  const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
  const fmtDate = (s, opts = { day: 'numeric', month: 'short' }) => (s ? parseDate(s).toLocaleDateString('it-IT', opts) : '');
  const fmtDateLong = (s) => fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const relDay = (s) => {
    if (!s) return '';
    const t = today();
    if (s === t) return 'Oggi';
    if (s === addDays(t, 1)) return 'Domani';
    if (s === addDays(t, -1)) return 'Ieri';
    return fmtDate(s);
  };
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const icon = (paths, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${paths}</svg>`;
  const typeIcon = (id) => icon((TYPE[id] || TYPE.nota).icon);
  const contactName = (id) => (S.byContact[id] || {}).nome || '';
  const dealTitle = (id) => (S.byDeal[id] || {}).titolo || '';
  const stageChip = (id) => `<span class="chip stage-${id}"><i class="dot"></i>${esc(STAGE[id]?.label || id)}</span>`;
  const dueChip = (date, label) => {
    if (!date) return '';
    const t = today();
    const cls = date < t ? 'overdue' : date === t ? 'today' : '';
    return `<span class="chip ${cls}">${esc(label || '')}${label ? ' ' : ''}${esc(relDay(date))}</span>`;
  };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function matches(q, ...fields) {
    if (!q) return true;
    const n = q.toLowerCase();
    return fields.some((f) => String(f || '').toLowerCase().includes(n));
  }

  /* ------------------------------------------------------------ sheet (bottom modal) */
  const sheet = {
    el: $('#sheet'), bd: $('#sheet-backdrop'),
    open(html) {
      this.el.innerHTML = `<div class="grab"></div>${html}`;
      this.el.hidden = false; this.bd.hidden = false;
      document.body.style.overflow = 'hidden';
      const first = this.el.querySelector('input[autofocus]');
      if (first) setTimeout(() => first.focus(), 80);
    },
    close() { this.el.hidden = true; this.bd.hidden = true; this.el.innerHTML = ''; document.body.style.overflow = ''; },
  };
  sheet.bd.addEventListener('click', () => sheet.close());

  function confirmSheet(title, text, okLabel = 'Elimina') {
    return new Promise((resolve) => {
      sheet.open(`
        <div class="sheet-h"><h2>${esc(title)}</h2></div>
        <p class="muted" style="margin:0 0 16px">${esc(text)}</p>
        <div class="btn-row">
          <button class="btn ghost" data-r="0">Annulla</button>
          <button class="btn danger" data-r="1">${esc(okLabel)}</button>
        </div>`);
      sheet.el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { sheet.close(); resolve(b.dataset.r === '1'); }));
    });
  }

  const field = (name, label, value = '', attrs = '') => `
    <div class="field"><label for="f-${name}">${esc(label)}</label><input id="f-${name}" name="${name}" value="${esc(value)}" ${attrs}></div>`;
  const textarea = (name, label, value = '', ph = '') => `
    <div class="field"><label for="f-${name}">${esc(label)}</label><textarea id="f-${name}" name="${name}" placeholder="${esc(ph)}">${esc(value)}</textarea></div>`;
  const select = (name, label, options, value = '') => `
    <div class="field"><label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${name}">
      ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select></div>`;
  const contactOptions = (sel) => [{ value: '', label: '— nessuno —' }, ...S.contacts.map((c) => ({ value: c.id, label: c.nome + (c.azienda ? ` · ${c.azienda}` : '') }))];
  const dealOptions = (sel) => [{ value: '', label: '— nessuno —' }, ...S.deals.filter((d) => OPEN_STAGES.includes(d.stage) || d.id === sel).map((d) => ({ value: d.id, label: d.titolo }))];
  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  /* ------------------------------------------------------------ forms */
  function formContact(c = {}, after) {
    sheet.open(`
      <div class="sheet-h"><button data-x>Annulla</button><h2>${c.id ? 'Modifica contatto' : 'Nuovo contatto'}</h2><button class="primary" data-save>Salva</button></div>
      <form class="form" id="frm">
        ${field('nome', 'Nome e cognome', c.nome, 'required autofocus autocomplete="off"')}
        <div class="field-row">${field('azienda', 'Azienda', c.azienda)}${field('ruolo', 'Ruolo', c.ruolo)}</div>
        <div class="field-row">${field('email', 'Email', c.email, 'type="email" inputmode="email" autocapitalize="off"')}${field('telefono', 'Telefono', c.telefono, 'type="tel" inputmode="tel"')}</div>
        <div class="field-row">${field('linkedin', 'LinkedIn (URL)', c.linkedin, 'type="url" inputmode="url" autocapitalize="off"')}${field('citta', 'Città', c.citta)}</div>
        <div class="field-row">${field('tag', 'Tag (virgola)', (c.tag || []).join(', '), 'list="taglist"')}${field('fonte', 'Come ci siamo conosciuti', c.fonte)}</div>
        <datalist id="taglist">${DEFAULT_TAGS.map((t) => `<option value="${t}">`).join('')}</datalist>
        ${textarea('note', 'Note', c.note, 'Interessi, contesto, cosa gli serve…')}
      </form>`);
    $('[data-x]', sheet.el).onclick = () => sheet.close();
    $('[data-save]', sheet.el).onclick = async () => {
      const f = $('#frm'); if (!f.reportValidity()) return;
      const d = formData(f);
      d.tag = d.tag.split(',').map((t) => t.trim()).filter(Boolean);
      const saved = await DB.put('contacts', { ...c, ...d });
      sheet.close(); await reload(); toast('Contatto salvato');
      if (after) after(saved); else route();
    };
  }

  function formDeal(d = {}, after) {
    const stage = d.stage || 'lead';
    sheet.open(`
      <div class="sheet-h"><button data-x>Annulla</button><h2>${d.id ? 'Modifica deal' : 'Nuovo deal'}</h2><button class="primary" data-save>Salva</button></div>
      <form class="form" id="frm">
        ${field('titolo', 'Titolo del deal', d.titolo, 'required autofocus autocomplete="off" placeholder="es. Consulenza Q1 – Rossi SpA"')}
        ${select('contactId', 'Contatto', contactOptions(), d.contactId)}
        <div class="field-row">${field('valore', 'Valore (€)', d.valore ?? '', 'type="number" inputmode="decimal" min="0" step="1"')}${field('probabilita', 'Probabilità (%)', d.probabilita ?? STAGE[stage].prob, 'type="number" inputmode="numeric" min="0" max="100"')}</div>
        <div class="field-row">${select('stage', 'Fase', STAGES.map((s) => ({ value: s.id, label: s.label })), stage)}${field('dataChiusura', 'Chiusura prevista', d.dataChiusura, 'type="date"')}</div>
        <div class="field-row">${field('prossimoStep', 'Prossimo step', d.prossimoStep, 'placeholder="es. Inviare proposta"')}${field('dataProssimoStep', 'Entro il', d.dataProssimoStep, 'type="date"')}</div>
        ${field('fonte', 'Origine', d.fonte, 'placeholder="Referral, evento, LinkedIn…"')}
        ${textarea('note', 'Note', d.note, 'Bisogno, decisori, budget, obiezioni…')}
      </form>`);
    $('[data-x]', sheet.el).onclick = () => sheet.close();
    $('#f-stage', sheet.el).onchange = (e) => { $('#f-probabilita', sheet.el).value = STAGE[e.target.value].prob; };
    $('[data-save]', sheet.el).onclick = async () => {
      const f = $('#frm'); if (!f.reportValidity()) return;
      const v = formData(f);
      v.valore = Number(v.valore) || 0; v.probabilita = Math.min(100, Math.max(0, Number(v.probabilita) || 0));
      const closed = ['vinto', 'perso'].includes(v.stage);
      const obj = { ...d, ...v, closedAt: closed ? (d.closedAt || DB.now()) : null };
      const saved = await DB.put('deals', obj);
      sheet.close(); await reload(); toast('Deal salvato');
      if (after) after(saved); else route();
    };
  }

  function formActivity(a = {}, after) {
    const data = a.data || S.agendaDay || today();
    sheet.open(`
      <div class="sheet-h"><button data-x>Annulla</button><h2>${a.id ? 'Modifica attività' : 'Nuova attività'}</h2><button class="primary" data-save>Salva</button></div>
      <form class="form" id="frm">
        <div class="seg" id="typeseg">${TYPES.map((t) => `<button type="button" data-t="${t.id}" class="${(a.tipo || 'call') === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
        <input type="hidden" name="tipo" value="${a.tipo || 'call'}">
        ${field('titolo', 'Oggetto', a.titolo, 'required autofocus autocomplete="off" placeholder="es. Call di allineamento"')}
        <div class="field-row">${field('data', 'Data', data, 'type="date" required')}${field('ora', 'Ora', a.ora ?? (a.id ? '' : nowTime()), 'type="time"')}</div>
        ${select('contactId', 'Contatto', contactOptions(), a.contactId)}
        ${select('dealId', 'Deal collegato', dealOptions(a.dealId), a.dealId)}
        ${textarea('note', 'Note / cosa è emerso', a.note, 'Punti chiave, decisioni, impegni presi…')}
        <div class="field-row">${field('esito', 'Esito', a.esito, 'placeholder="Positivo, da ricontattare…"')}${field('followUp', 'Follow-up il', a.followUp, 'type="date"')}</div>
        <div class="field"><label>Stato</label><select name="fatto"><option value="1" ${a.fatto !== false ? 'selected' : ''}>Fatta</option><option value="0" ${a.fatto === false ? 'selected' : ''}>Da fare</option></select></div>
      </form>`);
    $('[data-x]', sheet.el).onclick = () => sheet.close();
    $('#typeseg', sheet.el).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]'); if (!b) return;
      sheet.el.querySelectorAll('#typeseg button').forEach((x) => x.classList.toggle('active', x === b));
      $('input[name=tipo]', sheet.el).value = b.dataset.t;
    });
    $('[data-save]', sheet.el).onclick = async () => {
      const f = $('#frm'); if (!f.reportValidity()) return;
      const v = formData(f); v.fatto = v.fatto === '1';
      const saved = await DB.put('activities', { ...a, ...v });
      sheet.close(); await reload(); toast('Attività salvata');
      if (after) after(saved); else route();
    };
  }

  function menuAdd(ctx = {}) {
    sheet.open(`
      <div class="sheet-h"><h2>Aggiungi</h2><button data-x>Chiudi</button></div>
      <div class="menu">
        <button data-m="act">${typeIcon('call')}<span>Attività di network<small>Chiamata, incontro, email, evento…</small></span></button>
        <button data-m="deal">${icon('<path d="M3 6h18M3 12h12M3 18h6"/>')}<span>Deal potenziale<small>Opportunità con valore, fase e prossimo step</small></span></button>
        <button data-m="contact">${icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}<span>Contatto<small>Persona o azienda della tua rete</small></span></button>
      </div>`);
    $('[data-x]', sheet.el).onclick = () => sheet.close();
    sheet.el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'act') formActivity({ contactId: ctx.contactId, dealId: ctx.dealId });
      if (m === 'deal') formDeal({ contactId: ctx.contactId });
      if (m === 'contact') formContact();
    }));
  }

  /* ------------------------------------------------------------ attachments */
  const objectUrls = [];
  const freeUrls = () => { objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u)); };

  function compressImage(file, max = 1600, quality = 0.82) {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/') || file.size < 400 * 1024) return resolve(file);
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b || file); }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function addAttachments(entityType, entityId, files) {
    for (const f of files) {
      const blob = await compressImage(f);
      await DB.put('attachments', { entityType, entityId, nome: f.name, mime: blob.type || f.type, size: blob.size, blob });
    }
    toast(files.length > 1 ? `${files.length} immagini allegate` : 'Immagine allegata');
  }

  async function attachmentsSection(entityType, entityId) {
    const list = await DB.attachmentsFor(entityType, entityId);
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const items = list.map((a) => {
      const u = URL.createObjectURL(a.blob); objectUrls.push(u);
      return `<div class="att" data-id="${a.id}"><img src="${u}" alt="${esc(a.nome)}" loading="lazy"><button class="del" data-del="${a.id}" aria-label="Elimina">${icon('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>`;
    }).join('');
    return `
      <div class="section" id="att-section">
        <div class="section-h"><h2>Allegati</h2><span class="small muted">${list.length ? list.length : ''}</span></div>
        <div class="att-grid">
          ${items}
          <label class="att add">${icon('<path d="M12 5v14M5 12h14"/>')}<input type="file" accept="image/*" multiple data-att></label>
        </div>
        <p class="tiny muted" style="margin:8px 2px 0">Screenshot di mail, biglietti da visita, foto. Restano sul dispositivo.</p>
      </div>`;
  }

  function bindAttachments(root, entityType, entityId) {
    const input = root.querySelector('[data-att]');
    if (input) input.onchange = async () => { if (input.files.length) { await addAttachments(entityType, entityId, [...input.files]); route(); } };
    root.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (await confirmSheet('Eliminare allegato?', 'L\'immagine verrà rimossa definitivamente.')) { await DB.del('attachments', b.dataset.del); route(); }
    });
    root.querySelectorAll('.att img').forEach((img) => img.onclick = () => { const lb = $('#lightbox'); lb.querySelector('img').src = img.src; lb.hidden = false; });
  }
  $('#lightbox').addEventListener('click', () => { $('#lightbox').hidden = true; });

  /* ------------------------------------------------------------ computed */
  function dealStats(deals) {
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
    const total = open.reduce((s, d) => s + (Number(d.valore) || 0), 0);
    const weighted = open.reduce((s, d) => s + (Number(d.valore) || 0) * (Number(d.probabilita) || 0) / 100, 0);
    const won = deals.filter((d) => d.stage === 'vinto');
    return { open, total, weighted, won, wonTotal: won.reduce((s, d) => s + (Number(d.valore) || 0), 0) };
  }
  function pendingItems() {
    const t = today();
    const items = [];
    for (const a of S.activities) {
      if (a.fatto === false && a.data) items.push({ kind: 'act', date: a.data, label: a.titolo, sub: contactName(a.contactId) || TYPE[a.tipo]?.label, ref: a });
      if (a.followUp && a.followUp <= addDays(t, 7) && !S.activities.some((x) => x.id !== a.id && x.data >= a.followUp && x.contactId && x.contactId === a.contactId))
        items.push({ kind: 'fu', date: a.followUp, label: `Follow-up: ${a.titolo}`, sub: contactName(a.contactId), ref: a });
    }
    for (const d of S.deals) {
      if (OPEN_STAGES.includes(d.stage) && d.dataProssimoStep) items.push({ kind: 'deal', date: d.dataProssimoStep, label: d.prossimoStep || 'Prossimo step', sub: d.titolo, ref: d });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ------------------------------------------------------------ views */
  const view = $('#view');
  const setTitle = (t) => { $('#page-title').textContent = t; document.title = `${t} · Nexus CRM`; };

  function vOggi() {
    setTitle('Oggi');
    const t = today();
    const h = new Date().getHours();
    const hello = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
    const st = dealStats(S.deals);
    const pending = pendingItems();
    const overdue = pending.filter((p) => p.date < t);
    const todayItems = pending.filter((p) => p.date === t);
    const upcoming = pending.filter((p) => p.date > t).slice(0, 5);
    const todayActs = S.activities.filter((a) => a.data === t).sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
    const weekStart = addDays(t, -6);
    const weekActs = S.activities.filter((a) => a.data >= weekStart && a.data <= t && a.fatto !== false).length;

    const stageMix = OPEN_STAGES.map((s) => ({ s, v: st.open.filter((d) => d.stage === s).reduce((x, d) => x + (Number(d.valore) || 0), 0) }));

    const item = (p) => {
      const href = p.kind === 'deal' ? `#/deal/${p.ref.id}` : `#/attivita/${p.ref.id}`;
      return `<a class="card" href="${href}">
        <div class="type-ic">${p.kind === 'deal' ? icon('<path d="M3 6h18M3 12h12M3 18h6"/>') : typeIcon(p.kind === 'fu' ? 'followup' : p.ref.tipo)}</div>
        <div class="body"><div class="title">${esc(p.label)}</div><div class="sub">${esc(p.sub || '')}</div></div>
        <div class="right">${dueChip(p.date)}</div></a>`;
    };

    view.innerHTML = `
      <p class="greeting">${hello}.</p>
      <p class="muted" style="margin:0">${fmtDateLong(t)}</p>
      <div class="kpis">
        <div class="kpi"><div class="label">Pipeline aperta</div><div class="value">${money(st.total)}</div><div class="sub">${st.open.length} deal · pesata ${money(st.weighted)}</div></div>
        <div class="kpi ${overdue.length ? 'alert' : ''}"><div class="label">In ritardo</div><div class="value">${overdue.length}</div><div class="sub">${todayItems.length} da fare oggi</div></div>
        <div class="kpi"><div class="label">Attività 7 giorni</div><div class="value">${weekActs}</div><div class="sub">${S.contacts.length} contatti in rete</div></div>
        <div class="kpi"><div class="label">Vinto</div><div class="value">${money(st.wonTotal)}</div><div class="sub">${st.won.length} deal chiusi</div></div>
      </div>
      ${st.total ? `<div class="pipebar">${stageMix.map((m) => `<span style="width:${(m.v / st.total * 100).toFixed(1)}%;background:var(--stage-${m.s})"></span>`).join('')}</div>
      <div class="pipebar-legend">${stageMix.filter((m) => m.v).map((m) => `<span><i style="background:var(--stage-${m.s})"></i>${STAGE[m.s].label} ${money(m.v)}</span>`).join('')}</div>` : ''}

      ${overdue.length ? `<div class="section"><div class="section-h"><h2>In ritardo</h2></div><div class="list">${overdue.map(item).join('')}</div></div>` : ''}
      <div class="section"><div class="section-h"><h2>Da fare oggi</h2><a href="#/agenda">Agenda</a></div>
        ${todayItems.length ? `<div class="list">${todayItems.map(item).join('')}</div>` : '<div class="empty">Nessuna scadenza per oggi.</div>'}
      </div>
      <div class="section"><div class="section-h"><h2>Attività registrate oggi</h2><button data-add-act>+ Aggiungi</button></div>
        ${todayActs.length ? `<div class="list">${todayActs.map(actCard).join('')}</div>` : '<div class="empty"><strong>Ancora nulla oggi</strong>Registra la prima attività di network.</div>'}
      </div>
      ${upcoming.length ? `<div class="section"><div class="section-h"><h2>Prossimi giorni</h2></div><div class="list">${upcoming.map(item).join('')}</div></div>` : ''}
      ${!S.contacts.length && !S.deals.length ? `<div class="section"><div class="kv"><div class="row col"><div class="k">Per iniziare</div><div class="v pre">1. Aggiungi i contatti chiave della tua rete.\n2. Apri un deal per ogni opportunità, con valore e prossimo step.\n3. Ogni giorno registra le attività: la disciplina del log è il vero asset.\n\nSu iPhone: Condividi → "Aggiungi alla schermata Home". Su Android: menu → "Installa app".</div></div></div></div>` : ''}
    `;
    const b = $('[data-add-act]', view); if (b) b.onclick = () => formActivity();
  }

  function actCard(a) {
    const who = contactName(a.contactId); const deal = dealTitle(a.dealId);
    return `<a class="card ${a.fatto === false ? '' : ''}" href="#/attivita/${a.id}">
      <div class="type-ic">${typeIcon(a.tipo)}</div>
      <div class="body"><div class="title">${esc(a.titolo)}</div>
        <div class="sub">${esc([who, deal].filter(Boolean).join(' · ') || TYPE[a.tipo]?.label || '')}</div>
        ${a.note ? `<div class="sub" style="white-space:normal;margin-top:4px;color:var(--text-3)">${esc(a.note.length > 110 ? a.note.slice(0, 110) + '…' : a.note)}</div>` : ''}
        <div class="meta">${a.fatto === false ? '<span class="chip">Da fare</span>' : ''}${a.followUp ? dueChip(a.followUp, 'Follow-up') : ''}</div>
      </div>
      <div class="right"><div class="when">${esc(a.ora || '')}</div></div></a>`;
  }

  function vContatti() {
    setTitle('Contatti');
    const tags = [...new Set(S.contacts.flatMap((c) => c.tag || []))].sort();
    const list = S.contacts.filter((c) => matches(S.q, c.nome, c.azienda, c.ruolo, c.email, (c.tag || []).join(' ')) && (!S.contactFilter || (c.tag || []).includes(S.contactFilter)));
    const lastTouch = {};
    for (const a of S.activities) if (a.contactId && (!lastTouch[a.contactId] || a.data > lastTouch[a.contactId])) lastTouch[a.contactId] = a.data;
    view.innerHTML = `
      <div class="search">${icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="q" type="search" placeholder="Cerca per nome, azienda, ruolo, tag" value="${esc(S.q)}" autocomplete="off"></div>
      ${tags.length ? `<div class="seg" id="tagseg"><button data-tag="" class="${!S.contactFilter ? 'active' : ''}">Tutti<span class="n">${S.contacts.length}</span></button>${tags.map((t) => `<button data-tag="${esc(t)}" class="${S.contactFilter === t ? 'active' : ''}">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="section"><div class="section-h"><h2>${list.length} contatt${list.length === 1 ? 'o' : 'i'}</h2></div>
      ${list.length ? `<div class="list">${list.map((c) => {
        const openDeals = S.deals.filter((d) => d.contactId === c.id && OPEN_STAGES.includes(d.stage)).length;
        return `<a class="card" href="#/contatto/${c.id}">
          <div class="avatar">${esc(initials(c.nome))}</div>
          <div class="body"><div class="title">${esc(c.nome)}</div><div class="sub">${esc([c.ruolo, c.azienda].filter(Boolean).join(' · '))}</div>
            <div class="meta">${(c.tag || []).slice(0, 3).map((t) => `<span class="chip tag">${esc(t)}</span>`).join('')}${openDeals ? `<span class="chip">${openDeals} deal</span>` : ''}</div></div>
          <div class="right"><div class="when">${lastTouch[c.id] ? esc(relDay(lastTouch[c.id])) : '—'}</div></div></a>`;
      }).join('')}</div>` : '<div class="empty"><strong>Nessun contatto</strong>Premi + per aggiungere il primo.</div>'}</div>`;
    $('#q', view).oninput = (e) => { S.q = e.target.value; vContatti(); const i = $('#q', view); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    const seg = $('#tagseg', view); if (seg) seg.onclick = (e) => { const b = e.target.closest('[data-tag]'); if (b) { S.contactFilter = b.dataset.tag; vContatti(); } };
  }

  async function vContatto(id) {
    const c = S.byContact[id]; if (!c) { location.hash = '#/contatti'; return; }
    setTitle(c.nome);
    const deals = S.deals.filter((d) => d.contactId === id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const acts = S.activities.filter((a) => a.contactId === id).sort((a, b) => (b.data + (b.ora || '')).localeCompare(a.data + (a.ora || '')));
    const tel = (c.telefono || '').replace(/\s+/g, '');
    const att = await attachmentsSection('contact', id);
    view.innerHTML = `
      <div class="hero"><div class="avatar lg">${esc(initials(c.nome))}</div>
        <div><div class="h-title">${esc(c.nome)}</div><div class="h-sub">${esc([c.ruolo, c.azienda].filter(Boolean).join(' · ') || '—')}</div>
        <div class="meta" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${(c.tag || []).map((t) => `<span class="chip tag">${esc(t)}</span>`).join('')}</div></div></div>
      <div class="actions">
        ${tel ? `<a href="tel:${esc(tel)}">${icon(TYPE.call.icon)}Chiama</a><a href="sms:${esc(tel)}">${icon('<path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>')}Messaggio</a>` : ''}
        ${c.email ? `<a href="mailto:${esc(c.email)}">${icon(TYPE.email.icon)}Email</a>` : ''}
        ${c.linkedin ? `<a href="${esc(c.linkedin)}" target="_blank" rel="noopener">${icon(TYPE.linkedin.icon)}LinkedIn</a>` : ''}
        <button data-edit>${icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')}Modifica</button>
      </div>
      <div class="section"><div class="kv">
        ${c.email ? `<div class="row"><span class="k">Email</span><span class="v">${esc(c.email)}</span></div>` : ''}
        ${c.telefono ? `<div class="row"><span class="k">Telefono</span><span class="v">${esc(c.telefono)}</span></div>` : ''}
        ${c.citta ? `<div class="row"><span class="k">Città</span><span class="v">${esc(c.citta)}</span></div>` : ''}
        ${c.fonte ? `<div class="row"><span class="k">Conosciuto</span><span class="v">${esc(c.fonte)}</span></div>` : ''}
        <div class="row"><span class="k">In rubrica dal</span><span class="v">${esc(fmtDate((c.createdAt || '').slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div>
        ${c.note ? `<div class="row col"><span class="k">Note</span><span class="v pre">${esc(c.note)}</span></div>` : ''}
      </div></div>
      <div class="section"><div class="section-h"><h2>Deal</h2><button data-add-deal>+ Nuovo</button></div>
        ${deals.length ? `<div class="list">${deals.map(dealCard).join('')}</div>` : '<div class="empty">Nessun deal collegato.</div>'}</div>
      <div class="section"><div class="section-h"><h2>Storico attività</h2><button data-add-act>+ Registra</button></div>
        ${acts.length ? `<div class="timeline">${acts.map(tlItem).join('')}</div>` : '<div class="empty">Nessuna attività registrata.</div>'}</div>
      ${att}
      <div class="section"><button class="btn danger" data-del>Elimina contatto</button></div>`;
    $('[data-edit]', view).onclick = () => formContact(c);
    $('[data-add-deal]', view).onclick = () => formDeal({ contactId: id });
    $('[data-add-act]', view).onclick = () => formActivity({ contactId: id });
    $('[data-del]', view).onclick = async () => {
      if (await confirmSheet('Eliminare contatto?', `${c.nome} verrà rimosso. Deal e attività restano, senza collegamento.`)) {
        await DB.del('contacts', id); await DB.deleteEntityAttachments('contact', id); await reload(); location.hash = '#/contatti'; toast('Contatto eliminato');
      }
    };
    bindAttachments(view, 'contact', id);
  }

  function dealCard(d) {
    const who = contactName(d.contactId); const co = d.azienda || (S.byContact[d.contactId] || {}).azienda;
    return `<a class="card" href="#/deal/${d.id}">
      <div class="body"><div class="title">${esc(d.titolo)}</div><div class="sub">${esc([who, co].filter(Boolean).join(' · ') || '—')}</div>
        <div class="meta">${stageChip(d.stage)}${OPEN_STAGES.includes(d.stage) && d.dataProssimoStep ? dueChip(d.dataProssimoStep, d.prossimoStep ? '' : 'Step') : ''}</div></div>
      <div class="right"><div class="amount">${money(d.valore)}</div><div class="when">${d.probabilita ?? 0}%</div></div></a>`;
  }

  function tlItem(a) {
    return `<a class="tl-item ${a.fatto === false ? '' : 'done'}" href="#/attivita/${a.id}" style="display:block">
      <div class="when">${esc(relDay(a.data))}${a.ora ? ` · ${esc(a.ora)}` : ''} · ${esc(TYPE[a.tipo]?.label || a.tipo)}${a.dealId ? ` · ${esc(dealTitle(a.dealId))}` : ''}</div>
      <div class="what">${esc(a.titolo)}</div>
      ${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}
      ${a.esito || a.followUp ? `<div class="meta" style="display:flex;gap:6px;margin-top:6px">${a.esito ? `<span class="chip">${esc(a.esito)}</span>` : ''}${a.followUp ? dueChip(a.followUp, 'Follow-up') : ''}</div>` : ''}
    </a>`;
  }

  function vDeal() {
    setTitle('Deal');
    const f = S.dealFilter;
    const filtered = S.deals.filter((d) => (f === 'open' ? OPEN_STAGES.includes(d.stage) : f === 'all' ? true : d.stage === f) && matches(S.q, d.titolo, contactName(d.contactId), d.note, d.prossimoStep));
    filtered.sort((a, b) => {
      const ai = OPEN_STAGES.indexOf(a.stage), bi = OPEN_STAGES.indexOf(b.stage);
      if (ai !== bi) return bi - ai;
      return (Number(b.valore) || 0) - (Number(a.valore) || 0);
    });
    const st = dealStats(filtered);
    const counts = Object.fromEntries(STAGES.map((s) => [s.id, S.deals.filter((d) => d.stage === s.id).length]));
    view.innerHTML = `
      <div class="search">${icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="q" type="search" placeholder="Cerca deal" value="${esc(S.q)}" autocomplete="off"></div>
      <div class="seg" id="stageseg">
        <button data-f="open" class="${f === 'open' ? 'active' : ''}">Aperti<span class="n">${S.deals.filter((d) => OPEN_STAGES.includes(d.stage)).length}</span></button>
        ${STAGES.map((s) => `<button data-f="${s.id}" class="${f === s.id ? 'active' : ''}">${s.label}<span class="n">${counts[s.id]}</span></button>`).join('')}
        <button data-f="all" class="${f === 'all' ? 'active' : ''}">Tutti</button>
      </div>
      <div class="kpis" style="margin-top:12px">
        <div class="kpi"><div class="label">Valore ${f === 'open' ? 'pipeline' : 'selezione'}</div><div class="value">${money(filtered.reduce((s, d) => s + (Number(d.valore) || 0), 0))}</div><div class="sub">${filtered.length} deal</div></div>
        <div class="kpi"><div class="label">Pesato per probabilità</div><div class="value">${money(filtered.reduce((s, d) => s + (Number(d.valore) || 0) * (Number(d.probabilita) || 0) / 100, 0))}</div><div class="sub">media ${filtered.length ? Math.round(filtered.reduce((s, d) => s + (Number(d.probabilita) || 0), 0) / filtered.length) : 0}%</div></div>
      </div>
      <div class="section">${filtered.length ? `<div class="list">${filtered.map(dealCard).join('')}</div>` : '<div class="empty"><strong>Nessun deal qui</strong>Premi + per aprirne uno.</div>'}</div>`;
    $('#q', view).oninput = (e) => { S.q = e.target.value; vDeal(); const i = $('#q', view); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $('#stageseg', view).onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { S.dealFilter = b.dataset.f; vDeal(); } };
  }

  async function vDealDetail(id) {
    const d = S.byDeal[id]; if (!d) { location.hash = '#/deal'; return; }
    setTitle(d.titolo);
    const c = S.byContact[d.contactId];
    const acts = S.activities.filter((a) => a.dealId === id).sort((a, b) => (b.data + (b.ora || '')).localeCompare(a.data + (a.ora || '')));
    const idx = OPEN_STAGES.indexOf(d.stage);
    const track = OPEN_STAGES.map((s, i) => `<span class="${d.stage === 'vinto' ? 'won' : d.stage === 'perso' ? 'lost' : i <= idx ? 'on' : ''}"></span>`).join('');
    const age = Math.max(0, Math.round((Date.now() - new Date(d.createdAt).getTime()) / 86400000));
    const att = await attachmentsSection('deal', id);
    view.innerHTML = `
      <div style="margin-top:10px">
        <div class="deal-amount">${money(d.valore)}</div>
        <div class="muted">${d.probabilita ?? 0}% di probabilità · pesato ${money((Number(d.valore) || 0) * (Number(d.probabilita) || 0) / 100)}</div>
        <div class="stage-track">${track}</div>
        <div class="stage-switch">${STAGES.map((s) => `<button data-stage="${s.id}" class="stage-${s.id} ${d.stage === s.id ? 'active' : ''}" style="color:var(--stage-${s.id})">${s.label}</button>`).join('')}</div>
      </div>
      <div class="section"><div class="kv">
        <div class="row"><span class="k">Contatto</span><span class="v">${c ? `<a class="linkish" href="#/contatto/${c.id}">${esc(c.nome)}</a>${c.azienda ? ` · ${esc(c.azienda)}` : ''}` : '—'}</span></div>
        <div class="row"><span class="k">Prossimo step</span><span class="v">${esc(d.prossimoStep || '—')} ${d.dataProssimoStep ? dueChip(d.dataProssimoStep) : ''}</span></div>
        <div class="row"><span class="k">Chiusura prevista</span><span class="v">${d.dataChiusura ? esc(fmtDate(d.dataChiusura, { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</span></div>
        ${d.fonte ? `<div class="row"><span class="k">Origine</span><span class="v">${esc(d.fonte)}</span></div>` : ''}
        <div class="row"><span class="k">Aperto da</span><span class="v">${age} giorni${d.closedAt ? ` · chiuso ${esc(fmtDate(d.closedAt.slice(0, 10)))}` : ''}</span></div>
        ${d.note ? `<div class="row col"><span class="k">Note</span><span class="v pre">${esc(d.note)}</span></div>` : ''}
      </div></div>
      <div class="actions" style="grid-auto-flow:column">
        <button data-add-act>${typeIcon('nota')}Aggiungi step</button>
        <button data-edit>${icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')}Modifica</button>
      </div>
      <div class="section"><div class="section-h"><h2>Step e informazioni</h2><span class="small muted">${acts.length || ''}</span></div>
        ${acts.length ? `<div class="timeline">${acts.map(tlItem).join('')}</div>` : '<div class="empty">Nessuno step registrato. Ogni call, mail o incontro collegato al deal comparirà qui.</div>'}</div>
      ${att}
      <div class="section"><button class="btn danger" data-del>Elimina deal</button></div>`;
    $('[data-edit]', view).onclick = () => formDeal(d);
    $('[data-add-act]', view).onclick = () => formActivity({ dealId: id, contactId: d.contactId });
    view.querySelectorAll('[data-stage]').forEach((b) => b.onclick = async () => {
      const s = b.dataset.stage; if (s === d.stage) return;
      const closed = ['vinto', 'perso'].includes(s);
      await DB.put('deals', { ...d, stage: s, probabilita: STAGE[s].prob, closedAt: closed ? DB.now() : null });
      await reload(); toast(`Fase: ${STAGE[s].label}`); route();
    });
    $('[data-del]', view).onclick = async () => {
      if (await confirmSheet('Eliminare deal?', `"${d.titolo}" e i suoi allegati verranno rimossi. Le attività restano in agenda.`)) {
        await DB.del('deals', id); await DB.deleteEntityAttachments('deal', id); await reload(); location.hash = '#/deal'; toast('Deal eliminato');
      }
    };
    bindAttachments(view, 'deal', id);
  }

  async function vAttivita(id) {
    const a = S.activities.find((x) => x.id === id); if (!a) { location.hash = '#/agenda'; return; }
    setTitle(TYPE[a.tipo]?.label || 'Attività');
    const c = S.byContact[a.contactId]; const d = S.byDeal[a.dealId];
    const att = await attachmentsSection('activity', id);
    view.innerHTML = `
      <div class="hero"><div class="type-ic" style="width:52px;height:52px;border-radius:14px">${typeIcon(a.tipo)}</div>
        <div><div class="h-title">${esc(a.titolo)}</div><div class="h-sub">${esc(fmtDateLong(a.data))}${a.ora ? ` · ${esc(a.ora)}` : ''}</div></div></div>
      <div class="section"><div class="kv">
        <div class="row"><span class="k">Stato</span><span class="v">${a.fatto === false ? 'Da fare' : 'Fatta'}</span></div>
        ${c ? `<div class="row"><span class="k">Contatto</span><span class="v"><a class="linkish" href="#/contatto/${c.id}">${esc(c.nome)}</a></span></div>` : ''}
        ${d ? `<div class="row"><span class="k">Deal</span><span class="v"><a class="linkish" href="#/deal/${d.id}">${esc(d.titolo)}</a></span></div>` : ''}
        ${a.esito ? `<div class="row"><span class="k">Esito</span><span class="v">${esc(a.esito)}</span></div>` : ''}
        ${a.followUp ? `<div class="row"><span class="k">Follow-up</span><span class="v">${dueChip(a.followUp)}</span></div>` : ''}
        ${a.note ? `<div class="row col"><span class="k">Note</span><span class="v pre">${esc(a.note)}</span></div>` : ''}
      </div></div>
      <div class="actions">
        ${a.fatto === false ? `<button data-done>${icon('<path d="M5 12l5 5L20 7"/>')}Segna fatta</button>` : ''}
        ${a.followUp ? `<button data-fu>${typeIcon('followup')}Pianifica follow-up</button>` : ''}
        <button data-edit>${icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')}Modifica</button>
      </div>
      ${att}
      <div class="section"><button class="btn danger" data-del>Elimina attività</button></div>`;
    $('[data-edit]', view).onclick = () => formActivity(a);
    const done = $('[data-done]', view); if (done) done.onclick = async () => { await DB.put('activities', { ...a, fatto: true }); await reload(); route(); };
    const fu = $('[data-fu]', view); if (fu) fu.onclick = () => formActivity({ tipo: 'followup', titolo: `Follow-up: ${a.titolo}`, data: a.followUp, ora: '', contactId: a.contactId, dealId: a.dealId, fatto: false });
    $('[data-del]', view).onclick = async () => {
      if (await confirmSheet('Eliminare attività?', 'Verrà rimossa dall\'agenda e dagli storici.')) { await DB.del('activities', id); await DB.deleteEntityAttachments('activity', id); await reload(); history.back(); toast('Attività eliminata'); }
    };
    bindAttachments(view, 'activity', id);
  }

  function vAgenda() {
    setTitle('Agenda');
    const t = today();
    if (!S.agendaDay) S.agendaDay = t;
    const sel = S.agendaDay;
    const dow = (parseDate(sel).getDay() + 6) % 7; // Monday = 0
    const monday = addDays(sel, -dow);
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const perDay = {}; for (const a of S.activities) (perDay[a.data] ||= []).push(a);
    const dayActs = (perDay[sel] || []).slice().sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
    const due = pendingItems().filter((p) => p.date === sel && p.kind !== 'act');
    const monthActs = S.activities.filter((a) => a.data.slice(0, 7) === sel.slice(0, 7) && a.fatto !== false);
    const byType = {}; for (const a of monthActs) byType[a.tipo] = (byType[a.tipo] || 0) + 1;
    view.innerHTML = `
      <div class="daynav"><div class="label">${esc(parseDate(sel).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }))}</div>
        <div class="btns"><button class="icon-btn" data-nav="-7">${icon('<path d="M15 18l-6-6 6-6"/>')}</button><button class="icon-btn" data-nav="0" style="width:auto;padding:0 10px;font-size:13px;font-weight:600">Oggi</button><button class="icon-btn" data-nav="7">${icon('<path d="M9 18l6-6-6-6"/>')}</button></div></div>
      <div class="daystrip">${week.map((d) => `<button data-day="${d}" class="${d === sel ? 'sel' : ''} ${d === t ? 'today' : ''}">
        <span class="dow">${parseDate(d).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)}</span><span class="dom">${parseDate(d).getDate()}</span>
        <span class="dotz">${(perDay[d] || []).slice(0, 3).map(() => '<i></i>').join('')}</span></button>`).join('')}</div>
      <div class="section"><div class="section-h"><h2>${esc(relDay(sel))} · ${esc(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><button data-add>+ Aggiungi</button></div>
        ${due.length ? `<div class="list" style="margin-bottom:8px">${due.map((p) => `<a class="card" href="#/deal/${p.ref.id}"><div class="type-ic">${icon('<path d="M3 6h18M3 12h12M3 18h6"/>')}</div><div class="body"><div class="title">${esc(p.label)}</div><div class="sub">${esc(p.sub || '')}</div></div><div class="right">${dueChip(p.date)}</div></a>`).join('')}</div>` : ''}
        ${dayActs.length ? `<div class="list">${dayActs.map(actCard).join('')}</div>` : (due.length ? '' : '<div class="empty"><strong>Giornata vuota</strong>Registra un\'attività o pianificane una.</div>')}
      </div>
      <div class="section"><div class="section-h"><h2>Il mese in numeri</h2></div>
        <div class="kv">
          <div class="row"><span class="k">Attività svolte</span><span class="v">${monthActs.length}</span></div>
          ${TYPES.filter((ty) => byType[ty.id]).map((ty) => `<div class="row"><span class="k">${ty.label}</span><span class="v">${byType[ty.id]}</span></div>`).join('')}
          <div class="row"><span class="k">Contatti toccati</span><span class="v">${new Set(monthActs.map((a) => a.contactId).filter(Boolean)).size}</span></div>
        </div></div>`;
    view.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => { S.agendaDay = b.dataset.day; vAgenda(); });
    view.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => { const n = Number(b.dataset.nav); S.agendaDay = n === 0 ? t : addDays(sel, n); vAgenda(); });
    $('[data-add]', view).onclick = () => formActivity({ data: sel });
  }

  async function vImpostazioni() {
    setTitle('Impostazioni');
    const est = await DB.estimate();
    const atts = await DB.all('attachments');
    const attBytes = atts.reduce((s, a) => s + (a.size || (a.blob && a.blob.size) || 0), 0);
    const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
    const theme = localStorage.getItem('theme') || 'auto';
    view.innerHTML = `
      <div class="settings-group"><h3>Esporta in CSV</h3>
        <p class="tiny muted" style="margin:0 2px 8px">Intestazioni in inglese, pronte per Google Sheets, HubSpot, Pipedrive, Notion. Il separatore è la virgola; su Excel usa "Dati → Da testo/CSV".</p>
        <div class="kv">
          <div class="row"><span class="k">Contatti <span class="tiny">(${S.contacts.length})</span></span><button data-csv="contacts">Esporta</button></div>
          <div class="row"><span class="k">Deal <span class="tiny">(${S.deals.length})</span></span><button data-csv="deals">Esporta</button></div>
          <div class="row"><span class="k">Attività <span class="tiny">(${S.activities.length})</span></span><button data-csv="activities">Esporta</button></div>
        </div></div>
      <div class="settings-group"><h3>Backup completo</h3>
        <p class="tiny muted" style="margin:0 2px 8px">Un file JSON con tutto, immagini incluse. Usalo per cambiare telefono o come copia di sicurezza periodica.</p>
        <div class="kv">
          <div class="row"><span class="k">Esporta backup</span><button data-backup>Esporta</button></div>
          <div class="row"><span class="k">Ripristina da backup</span><label class="btnlike" for="imp-json">Importa</label><input id="imp-json" type="file" accept="application/json,.json"></div>
          <div class="row"><span class="k">Importa contatti da CSV</span><label class="btnlike" for="imp-csv">Importa</label><input id="imp-csv" type="file" accept="text/csv,.csv"></div>
        </div></div>
      <div class="settings-group"><h3>Aspetto</h3>
        <div class="kv">
          <div class="row"><span class="k">Tema</span><span class="v"><select id="theme-sel" style="background:transparent;border:0;font-weight:600;text-align:right"><option value="auto" ${theme === 'auto' ? 'selected' : ''}>Automatico</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Chiaro</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Scuro</option></select></span></div>
        </div></div>
      <div class="settings-group"><h3>Archivio</h3>
        <div class="kv">
          <div class="row"><span class="k">Dati</span><span class="v">${S.contacts.length} contatti · ${S.deals.length} deal · ${S.activities.length} attività</span></div>
          <div class="row"><span class="k">Allegati</span><span class="v">${atts.length} · ${mb(attBytes)}</span></div>
          ${est ? `<div class="row"><span class="k">Spazio usato</span><span class="v">${mb(est.usage)} di ${mb(est.quota)}</span></div>` : ''}
          <div class="row"><span class="k">Archiviazione persistente</span><button data-persist>Richiedi</button></div>
          <div class="row danger"><span class="k">Cancella tutti i dati</span><button data-wipe>Cancella</button></div>
        </div>
        <p class="tiny muted" style="margin:8px 2px 0">Tutto resta sul tuo dispositivo: nessun server, nessun account. Fai un backup prima di cancellare dati del browser o cambiare telefono.</p></div>
      <div class="settings-group"><h3>Installazione</h3>
        <div class="kv"><div class="row col"><span class="v pre">iPhone: apri in Safari → Condividi → "Aggiungi alla schermata Home".\nAndroid: Chrome → menu ⋮ → "Installa app" / "Aggiungi a schermata Home".</span></div></div></div>
      <p class="tiny muted" style="text-align:center;margin-top:28px">Nexus CRM · v1.0 · dati locali</p>`;

    const stamp = isoDate().replace(/-/g, '');
    view.querySelectorAll('[data-csv]').forEach((b) => b.onclick = () => {
      const k = b.dataset.csv;
      const csv = k === 'contacts' ? CSV.contacts(S.contacts) : k === 'deals' ? CSV.deals(S.deals, S.byContact) : CSV.activities(S.activities, S.byContact, S.byDeal);
      CSV.share(`nexus-${k}-${stamp}.csv`, csv, 'text/csv;charset=utf-8'); toast('Export pronto');
    });
    $('[data-backup]', view).onclick = async () => {
      const blobToDataUrl = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      const attachments = [];
      for (const a of atts) attachments.push({ ...a, blob: undefined, data: await blobToDataUrl(a.blob) });
      const payload = { app: 'nexus-crm', version: 1, exportedAt: DB.now(), contacts: S.contacts, deals: S.deals, activities: S.activities, attachments };
      CSV.share(`nexus-backup-${stamp}.json`, JSON.stringify(payload), 'application/json'); toast('Backup pronto');
    };
    $('#imp-json', view).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const p = JSON.parse(await f.text());
        if (p.app !== 'nexus-crm') throw new Error('Formato non riconosciuto');
        const n = (p.contacts?.length || 0) + (p.deals?.length || 0) + (p.activities?.length || 0);
        const ok = await confirmSheet('Ripristinare backup?', `${n} record e ${p.attachments?.length || 0} allegati verranno importati. I record con lo stesso id vengono sovrascritti.`, 'Importa');
        if (!ok) return;
        for (const c of p.contacts || []) await DB.put('contacts', c);
        for (const d of p.deals || []) await DB.put('deals', d);
        for (const a of p.activities || []) await DB.put('activities', a);
        for (const a of p.attachments || []) { const blob = await (await fetch(a.data)).blob(); await DB.put('attachments', { ...a, data: undefined, blob }); }
        await reload(); toast('Backup ripristinato'); route();
      } catch (err) { toast(`Errore: ${err.message}`); }
    };
    $('#imp-csv', view).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rows = CSV.parse(await f.text());
      const pick = (r, ...keys) => { for (const k of keys) if (r[k]) return r[k]; return ''; };
      let n = 0;
      for (const r of rows) {
        const nome = pick(r, 'full_name', 'name', 'nome') || [pick(r, 'first_name', 'firstname', 'nome'), pick(r, 'last_name', 'lastname', 'cognome')].filter(Boolean).join(' ');
        if (!nome) continue;
        await DB.put('contacts', { nome, azienda: pick(r, 'company', 'azienda', 'organization'), ruolo: pick(r, 'job_title', 'title', 'ruolo', 'position'), email: pick(r, 'email', 'e-mail'), telefono: pick(r, 'phone', 'telefono', 'mobile', 'phone_number'), linkedin: pick(r, 'linkedin', 'linkedin_url'), citta: pick(r, 'city', 'citta', 'città'), fonte: pick(r, 'source', 'fonte'), tag: pick(r, 'tags', 'tag').split(/[;,]/).map((t) => t.trim()).filter(Boolean), note: pick(r, 'notes', 'note') });
        n++;
      }
      await reload(); toast(`${n} contatti importati`); route();
    };
    $('#theme-sel', view).onchange = (e) => { applyTheme(e.target.value); };
    $('[data-persist]', view).onclick = async () => { const ok = await DB.persist(); toast(ok ? 'Archiviazione persistente attiva' : 'Non concessa dal browser'); };
    $('[data-wipe]', view).onclick = async () => {
      if (await confirmSheet('Cancellare tutto?', 'Contatti, deal, attività e allegati verranno eliminati definitivamente da questo dispositivo.')) {
        await DB.clearAll(); await reload(); toast('Dati cancellati'); location.hash = '#/oggi';
      }
    };
  }

  function applyTheme(t) {
    localStorage.setItem('theme', t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  }

  /* ------------------------------------------------------------ router */
  const TAB_ROUTES = { oggi: vOggi, contatti: vContatti, deal: vDeal, agenda: vAgenda };
  let currentCtx = {};

  async function route() {
    freeUrls();
    const hash = location.hash || '#/oggi';
    const [, seg, id] = hash.split('/');
    const back = $('#btn-back'); const fab = $('#fab'); const tabbar = $('#tabbar');
    const isTab = seg in TAB_ROUTES;
    back.hidden = isTab;
    fab.hidden = seg === 'impostazioni' || seg === 'attivita';
    tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === seg));
    if (isTab && !['contatti', 'deal'].includes(seg)) S.q = '';
    if (seg === 'contatti' && S._lastTab !== 'contatti') S.q = '';
    if (seg === 'deal' && S._lastTab !== 'deal') S.q = '';
    if (isTab) S._lastTab = seg;
    currentCtx = {};
    view.scrollTop = 0; window.scrollTo(0, 0);
    if (seg === 'contatto') { currentCtx = { contactId: id }; await vContatto(id); }
    else if (seg === 'deal' && id) { currentCtx = { dealId: id, contactId: (S.byDeal[id] || {}).contactId }; await vDealDetail(id); }
    else if (seg === 'attivita') await vAttivita(id);
    else if (seg === 'impostazioni') await vImpostazioni();
    else (TAB_ROUTES[seg] || vOggi)();
  }

  $('#fab').onclick = () => {
    const [, seg, id] = (location.hash || '#/oggi').split('/');
    if (seg === 'contatti') return formContact();
    if (seg === 'deal' && !id) return formDeal();
    if (seg === 'agenda') return formActivity({ data: S.agendaDay });
    menuAdd(currentCtx);
  };
  $('#btn-back').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/oggi'; };
  $('#btn-settings').onclick = () => { location.hash = location.hash.startsWith('#/impostazioni') ? '#/oggi' : '#/impostazioni'; };
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------------ boot */
  (async () => {
    applyTheme(localStorage.getItem('theme') || 'auto');
    await reload();
    await route();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
