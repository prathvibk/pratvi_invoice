sync function api(path, opts = {}) {
  const res = await fetch(path, opts);
  return await res.json().catch(() => ({}));
}

function el(s) { return document.querySelector(s); }
function qAll(s) { return Array.from(document.querySelectorAll(s)); }

let passengersCache = [];


async function loadPassengers(q = '') {
  const url = '/api/passengers' + (q ? '?q=' + encodeURIComponent(q) : '');
  const data = await api(url);
  passengersCache = data || [];
  renderPassengers(passengersCache);
}

function renderPassengers(list) {
  const tbody = el('#pass-body'); tbody.innerHTML = '';
  const empty = el('#pass-empty');
  if (!list || list.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  
  const cards = el('#pass-cards');
  cards.innerHTML = `
    <div class="card"><div>Total</div><div style="font-weight:700">${list.length}</div></div>
    <div class="card"><div>Pending Downloads</div><div style="font-weight:700">${list.filter(x => x.download_status === 'Pending').length}</div></div>
    <div class="card"><div>Parsed</div><div style="font-weight:700">${list.filter(x => x.parse_status === 'Success').length}</div></div>
  `;

  for (const p of list) {
    const tr = document.createElement('tr');
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();

    const dBadge = p.download_status === 'Success' ? `<span class="badge success">Success</span>` :
      (p.download_status === 'Pending' ? `<span class="badge pending">Pending</span>` :
        `<span class="badge error">${p.download_status}</span>`);

    const pBadge = p.parse_status === 'Success' ? `<span class="badge success">Success</span>` :
      (p.parse_status === 'Pending' ? `<span class="badge pending">Pending</span>` :
        `<span class="badge error">${p.parse_status}</span>`);

    
    const downloadBtn = p.download_status !== 'Success'
      ? `<button class="btn download-btn" data-ticket="${p.ticket_number}">Download</button>` : '';

    const parseBtn = (p.download_status === 'Success' && p.parse_status !== 'Success')
      ? `<button class="btn parse-btn" data-ticket="${p.ticket_number}">Parse</button>` : '';

    const openPdf = p.pdf_filename ? `<a target="_blank" href="/invoices/${p.pdf_filename}">Open PDF</a>` : '';

    tr.innerHTML = `
      <td>${p.ticket_number || '—'}</td>
      <td>${escapeHtml(name)}</td>
      <td>${dBadge}</td>
      <td>${pBadge}</td>
      <td>${downloadBtn} ${parseBtn} ${openPdf}</td>
      <td><input type="checkbox" class="flag" /></td>
    `;
    tbody.appendChild(tr);
  }

  attachPassengerActions();
}

function attachPassengerActions() {
  qAll(".download-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ticket = btn.dataset.ticket;
      await fetch(`/api/download/${ticket}`, { method: 'POST' });
      await loadPassengers();
    });
  });

  qAll(".parse-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ticket = btn.dataset.ticket;
      await fetch(`/api/parse/${ticket}`, { method: 'POST' });
      await loadPassengers();
      await loadInvoices();
      await loadSummary();
    });
  });
}

async function downloadAll() {
  for (const p of passengersCache) {
    if (p.download_status !== 'Success') {
      await fetch(`/api/download/${p.ticket_number}`, { method: 'POST' });
    }
  }
  await loadPassengers();
}

/*INVOICES*/
async function loadInvoices() {
  const data = await api('/api/invoices');
  const tbody = el('#inv-body'); tbody.innerHTML = '';
  const empty = el('#inv-empty');
  if (!data || data.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  for (const inv of data) {
    const tr = document.createElement('tr');
    const high = inv.amount && inv.amount > 10000;
    tr.innerHTML = `
      <td>${inv.invoice_number || '—'}</td>
      <td>${inv.date || '—'}</td>
      <td>${inv.airline || '—'}</td>
      <td>${inv.amount ? '₹' + inv.amount : '—'} ${high ? '<span class="badge error">High</span>' : ''}</td>
      <td>${inv.gstin || '—'}</td>
      <td>${inv.confidence || '—'}%</td>
      <td>${inv.first_name ? inv.first_name + ' ' + (inv.last_name || '') : inv.ticket_number}</td>
      <td>${inv.pdf ? `<a target="_blank" href="${inv.pdf}">Open PDF</a>` : '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

/*SUMMARY */
async function loadSummary() {
  const res = await api('/api/summary');
  const box = el('#summary-box');
  if (!res || !res.airline_totals || res.airline_totals.length === 0) {
    box.innerHTML = `<div class="summary">No invoices yet.</div>`; return;
  }
  let html = `<div class="summary"><h3>Airline Totals</h3><ul>`;
  res.airline_totals.forEach(a =>
    html += `<li><b>${escapeHtml(a.airline || 'Unknown')}</b>: ₹${a.total || 0} — ${a.count} invoices</li>`);
  html += `</ul><div style="margin-top:8px"><b>High-value invoices (>₹10,000):</b> ${res.high_value_count || 0}</div></div>`;
  box.innerHTML = html;
}

qAll('.tab').forEach(b => b.addEventListener('click', () => {
  qAll('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const t = b.dataset.target;
  qAll('.tabpane').forEach(p => p.style.display = (p.id === t) ? 'block' : 'none');
  if (t === 'tab-pass') loadPassengers();
  if (t === 'tab-inv') loadInvoices();
  if (t === 'tab-sum') loadSummary();
}));


el('#search').addEventListener('input', (e) => loadPassengers(e.target.value.trim()));

loadPassengers();
loadInvoices();
loadSummary();


function escapeHtml(str) {
  if (!str) return '';
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
