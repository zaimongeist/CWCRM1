/* CSV + JSON export/import helpers. Column names are kept in English to ease
   import into other CRMs (HubSpot, Pipedrive, Notion, Google Sheets...). */
const CSV = (() => {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const build = (headers, rows) => {
    const lines = [headers.map(esc).join(',')];
    for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
    return '﻿' + lines.join('\r\n');
  };
  const splitName = (full) => {
    const parts = (full || '').trim().split(/\s+/);
    if (parts.length <= 1) return { first: parts[0] || '', last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
  };

  function contacts(list) {
    const headers = ['id', 'first_name', 'last_name', 'full_name', 'company', 'job_title', 'email', 'phone', 'linkedin', 'city', 'tags', 'source', 'notes', 'created_at', 'updated_at'];
    const rows = list.map((c) => {
      const n = splitName(c.nome);
      return {
        id: c.id, first_name: n.first, last_name: n.last, full_name: c.nome, company: c.azienda, job_title: c.ruolo,
        email: c.email, phone: c.telefono, linkedin: c.linkedin, city: c.citta, tags: c.tag, source: c.fonte, notes: c.note,
        created_at: c.createdAt, updated_at: c.updatedAt,
      };
    });
    return build(headers, rows);
  }

  function deals(list, contactsById) {
    const headers = ['id', 'deal_name', 'contact_id', 'contact_name', 'company', 'stage', 'amount', 'currency', 'probability', 'weighted_amount', 'source', 'next_step', 'next_step_date', 'expected_close_date', 'closed_at', 'notes', 'created_at', 'updated_at'];
    const rows = list.map((d) => {
      const c = contactsById[d.contactId] || {};
      const amount = Number(d.valore) || 0;
      const prob = Number(d.probabilita) || 0;
      return {
        id: d.id, deal_name: d.titolo, contact_id: d.contactId || '', contact_name: c.nome || '', company: d.azienda || c.azienda || '',
        stage: d.stage, amount, currency: 'EUR', probability: prob, weighted_amount: Math.round(amount * prob / 100),
        source: d.fonte, next_step: d.prossimoStep, next_step_date: d.dataProssimoStep, expected_close_date: d.dataChiusura,
        closed_at: d.closedAt || '', notes: d.note, created_at: d.createdAt, updated_at: d.updatedAt,
      };
    });
    return build(headers, rows);
  }

  function activities(list, contactsById, dealsById) {
    const headers = ['id', 'date', 'time', 'type', 'subject', 'contact_id', 'contact_name', 'company', 'deal_id', 'deal_name', 'status', 'outcome', 'follow_up_date', 'notes', 'created_at'];
    const rows = list.map((a) => {
      const c = contactsById[a.contactId] || {};
      const d = dealsById[a.dealId] || {};
      return {
        id: a.id, date: a.data, time: a.ora || '', type: a.tipo, subject: a.titolo, contact_id: a.contactId || '', contact_name: c.nome || '',
        company: c.azienda || '', deal_id: a.dealId || '', deal_name: d.titolo || '', status: a.fatto ? 'done' : 'open',
        outcome: a.esito || '', follow_up_date: a.followUp || '', notes: a.note, created_at: a.createdAt,
      };
    });
    return build(headers, rows);
  }

  /* Minimal RFC4180 parser used for importing contacts. */
  function parse(text) {
    const rows = []; let row = []; let cur = ''; let q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
  }

  function download(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  async function share(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/csv' });
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return true; } catch (e) { if (e.name === 'AbortError') return true; }
    }
    download(filename, blob, blob.type);
    return true;
  }

  return { contacts, deals, activities, parse, download, share, build };
})();
