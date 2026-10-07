/* Deposits are money entrusted to the gemach. All records stay in this browser. */
(function () {
  'use strict';

  const KEY = 'gemach-community-deposits-v1';
  const DAY = 24 * 60 * 60 * 1000;
  const collator = new Intl.Collator('he-IL', { sensitivity: 'base', numeric: true });
  let records = load();
  let filter = 'all';
  let search = '';
  let selectedId = null;
  let editingId = null;

  function todayISO() {
    const now = new Date();
    return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  function iso(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function relativeISO(days) {
    const now = new Date();
    return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  }
  function validISO(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  function displayDate(value) {
    if (!validISO(value)) return 'ללא מועד';
    const [y, m, d] = value.split('-');
    return d + '.' + m + '.' + y;
  }
  function money(value) {
    return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(Number(value) || 0) + ' ₪';
  }
  function round(value) { return Math.round(Number(value) * 100) / 100; }
  function makeSamples() {
    return [
      { id: 'deposit-sample-1', name: 'פרידמן אברהם', phone: '052-620-1345', amount: 18000, depositedOn: relativeISO(-110), date: relativeISO(5), notes: '', returns: [], sample: true },
      { id: 'deposit-sample-2', name: 'לנדאו יעל', phone: '054-730-2481', amount: 12000, depositedOn: relativeISO(-75), date: '', notes: 'כסף נזיל ללא מועד החזרה קבוע', returns: [], sample: true },
      { id: 'deposit-sample-3', name: 'שטרן דוד', phone: '050-823-4267', amount: 25000, depositedOn: relativeISO(-140), date: relativeISO(21), notes: '', returns: [{ amount: 10000, date: relativeISO(-18) }], sample: true },
      { id: 'deposit-sample-4', name: 'רוזנברג שרה', phone: '053-540-1138', amount: 9000, depositedOn: relativeISO(-90), date: relativeISO(-4), notes: '', returns: [], sample: true },
      { id: 'deposit-sample-5', name: 'כהן משה', phone: '050-976-4412', amount: 7000, depositedOn: relativeISO(-180), date: relativeISO(-40), notes: '', returns: [{ amount: 7000, date: relativeISO(-41) }], sample: true }
    ];
  }
  function normalizeRecord(item) {
    if (!item || !item.id || !item.name) return null;
    const amount = round(item.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !validISO(item.depositedOn)) return null;
    const returns = Array.isArray(item.returns) ? item.returns.filter(function (entry) {
      return Number.isFinite(Number(entry.amount)) && Number(entry.amount) > 0 && validISO(entry.date);
    }).map(function (entry) { return { amount: round(entry.amount), date: entry.date }; }) : [];
    return {
      id: String(item.id), name: String(item.name), phone: String(item.phone || ''), amount,
      depositedOn: item.depositedOn, date: validISO(item.date) ? item.date : '',
      notes: String(item.notes || ''), returns, sample: Boolean(item.sample)
    };
  }
  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
    const entries = Array.isArray(saved.records) ? saved.records.map(normalizeRecord).filter(Boolean) : [];
    if (saved.seedVersion === 1) return entries;
    const existing = new Set(entries.map(function (entry) { return entry.id; }));
    const seeded = makeSamples().filter(function (entry) { return !existing.has(entry.id); }).concat(entries);
    try { localStorage.setItem(KEY, JSON.stringify({ seedVersion: 1, records: seeded })); } catch (_) {}
    return seeded;
  }
  function remaining(record) {
    return Math.max(0, round(record.amount - record.returns.reduce(function (sum, item) { return sum + item.amount; }, 0)));
  }
  function publicRecords() {
    return records.map(function (record) {
      return {
        id: record.id, name: record.name, amount: record.amount, remaining: remaining(record),
        date: record.date, depositedOn: record.depositedOn, phone: record.phone,
        returns: record.returns.map(function (entry) { return { amount: entry.amount, date: entry.date }; })
      };
    });
  }
  function publish() {
    window.dispatchEvent(new CustomEvent('gemach:deposits-changed', { detail: { deposits: publicRecords() } }));
  }
  window.gemachDeposits = Object.freeze({ list: publicRecords });
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ seedVersion: 1, records }));
      publish();
      return true;
    } catch (_) {
      notice('לא ניתן לשמור את ההפקדה בדפדפן זה.');
      return false;
    }
  }
  function notice(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notice.timer);
    notice.timer = setTimeout(function () { toast.classList.remove('show'); }, 3300);
  }
  function node(tag, className, textValue) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== undefined) element.textContent = textValue;
    return element;
  }
  function currentStatus(record) {
    if (remaining(record) <= 0) return 'returned';
    if (!record.date) return 'undated';
    if (record.date < todayISO()) return 'overdue';
    const horizon = relativeISO(30);
    return record.date <= horizon ? 'soon' : 'active';
  }
  function statusText(status) {
    return ({ returned: 'הוחזרה', undated: 'ללא מועד', overdue: 'באיחור', soon: 'בקרוב', active: 'פעילה' })[status] || 'פעילה';
  }
  function sortRecords(a, b) {
    const rank = { overdue: 0, soon: 1, active: 2, undated: 3, returned: 4 };
    const aStatus = currentStatus(a), bStatus = currentStatus(b);
    if (rank[aStatus] !== rank[bStatus]) return rank[aStatus] - rank[bStatus];
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    return collator.compare(a.name, b.name);
  }
  function match(record) {
    const status = currentStatus(record);
    if (filter === 'open' && status === 'returned') return false;
    if (filter === 'overdue' && status !== 'overdue') return false;
    if (filter === 'undated' && status !== 'undated') return false;
    if (filter === 'returned' && status !== 'returned') return false;
    const query = search.replace(/[\s\-.,#׳״'"()]/g, '').toLocaleLowerCase('he-IL');
    if (!query) return true;
    const target = (record.name + record.phone + record.id).replace(/[\s\-.,#׳״'"()]/g, '').toLocaleLowerCase('he-IL');
    return target.includes(query);
  }
  function navigate(id) {
    window.showView(id);
    if (id === 'view-deposit-form' || id === 'view-deposit-detail') {
      document.querySelectorAll('[data-target="view-deposits"]').forEach(function (item) { item.classList.add('active'); });
    }
  }
  const icon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5 12 4l9 4.5M4 10v9h16v-9M8 11v6M12 11v6M16 11v6M2.5 20.5h19"/></svg>';

  function installNav() {
    const desktop = document.querySelector('.topnav-links');
    const calendar = desktop && desktop.querySelector('[data-target="view-calendar"]');
    if (desktop && calendar && !desktop.querySelector('[data-target="view-deposits"]')) {
      const button = node('button', 'tlink');
      button.type = 'button';
      button.dataset.target = 'view-deposits';
      button.innerHTML = icon + 'הפקדות';
      button.addEventListener('click', function () { navigate('view-deposits'); });
      desktop.insertBefore(button, calendar);
    }
    const bottomSettings = document.querySelector('.bottom-nav [data-target="view-settings"]');
    if (bottomSettings) {
      bottomSettings.dataset.target = 'view-deposits';
      bottomSettings.innerHTML = icon + 'הפקדות';
      bottomSettings.setAttribute('aria-label', 'הפקדות');
      bottomSettings.onclick = function () { navigate('view-deposits'); };
      const bottomCalendar = document.querySelector('.bottom-nav [data-target="view-calendar"]');
      if (bottomCalendar) bottomCalendar.parentElement.insertBefore(bottomSettings, bottomCalendar);
    }
  }
  function installViews() {
    const content = document.querySelector('.content');
    if (!content || document.getElementById('view-deposits')) return;
    content.insertAdjacentHTML('beforeend', `
      <section class="view deposits-view" id="view-deposits" aria-labelledby="deposits-title">
        <div class="deposits-heading">
          <div class="deposits-heading-main"><span class="deposits-heading-icon" aria-hidden="true">${icon}</span><div><h2 id="deposits-title">הפקדות</h2><span id="deposits-count">0 הפקדות</span></div></div>
          <div class="deposits-stats"><span><small>יתרה למפקידים</small><strong id="deposits-balance">0 ₪</strong></span><span><small>פתוחות</small><strong id="deposits-open">0</strong></span><span><small>מועדים קרובים</small><strong id="deposits-soon">0</strong></span></div>
          <button class="btn btn-primary" type="button" id="deposit-new">הפקדה חדשה</button>
        </div>
        <div class="deposits-toolbar"><div class="deposits-filters" role="group" aria-label="סינון הפקדות"><button type="button" class="active" data-deposit-filter="all">הכל</button><button type="button" data-deposit-filter="open">פתוחות</button><button type="button" data-deposit-filter="overdue">באיחור</button><button type="button" data-deposit-filter="undated">ללא מועד</button><button type="button" data-deposit-filter="returned">הוחזרו</button></div><label class="deposits-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="deposit-search" type="search" placeholder="חיפוש לפי מפקיד או טלפון" aria-label="חיפוש הפקדות"></label></div>
        <div class="deposits-list-wrap"><table class="deposits-table"><thead><tr><th>מפקיד</th><th>סכום שהופקד</th><th>תאריך הפקדה</th><th>להחזרה עד</th><th>יתרה למפקיד</th><th>מצב</th><th></th></tr></thead><tbody id="deposits-rows"></tbody></table><div class="deposits-empty" id="deposits-empty" hidden><strong>לא נמצאו הפקדות</strong><span id="deposits-empty-copy">הוסיפו הפקדה חדשה כדי להתחיל.</span></div></div>
        <div class="deposits-foot" id="deposits-foot"></div>
      </section>
      <section class="view deposits-view" id="view-deposit-form" aria-labelledby="deposit-form-title">
        <div class="deposits-subhead"><div><button class="deposits-back" type="button" id="deposit-form-back">→ חזרה להפקדות</button><h2 id="deposit-form-title">הפקדה חדשה</h2></div></div>
        <form class="deposits-editor" id="deposit-editor" novalidate>
          <div class="deposits-form-grid">
            <label><span>שם המפקיד <b>*</b></span><input id="deposit-name" type="text" autocomplete="name" required placeholder="שם משפחה שם פרטי"></label>
            <label><span>טלפון</span><input id="deposit-phone" type="tel" autocomplete="tel" placeholder="050-0000000"></label>
            <label><span>סכום ההפקדה <b>*</b></span><input id="deposit-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
            <label><span>תאריך הפקדה <b>*</b></span><input id="deposit-date" type="date" required></label>
            <label><span>מועד החזרה למפקיד</span><input id="deposit-due" type="date"><small>אפשר להשאיר ריק כשהמועד אינו ידוע.</small></label>
            <label class="deposits-notes"><span>הערות</span><textarea id="deposit-notes" rows="3" placeholder="פרטים נוספים, אם יש"></textarea></label>
          </div>
          <p class="deposits-error" id="deposit-form-error" role="alert" hidden></p>
          <div class="deposits-form-actions"><button class="btn btn-ghost" type="button" id="deposit-cancel">ביטול</button><button class="btn btn-primary" type="submit">שמירת הפקדה</button></div>
        </form>
      </section>
      <section class="view deposits-view" id="view-deposit-detail" aria-labelledby="deposit-detail-title">
        <div class="deposits-subhead deposits-detail-head"><div><button class="deposits-back" type="button" id="deposit-detail-back">→ חזרה להפקדות</button><h2 id="deposit-detail-title">פרטי הפקדה</h2></div><div class="deposits-detail-actions"><span id="deposit-detail-status" class="deposit-status"></span><button type="button" class="btn btn-ghost btn-sm" id="deposit-edit">עריכת פרטים</button></div></div>
        <div class="deposits-detail-scroll"><div class="deposits-detail-summary" id="deposit-detail-summary"></div><div class="deposits-detail-columns"><div class="deposits-detail-card"><h3>פרטי ההפקדה</h3><dl id="deposit-detail-data"></dl><h3>החזרים למפקיד</h3><div id="deposit-return-history"></div></div><div class="deposits-detail-card deposits-return-card"><h3>רישום החזר למפקיד</h3><p id="deposit-return-hint">סכום שעדיין צריך להחזיר למפקיד.</p><form id="deposit-return-form" novalidate><label><span>סכום ההחזר</span><input id="deposit-return-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label><span>תאריך החזר</span><input id="deposit-return-date" type="date" required></label><p class="deposits-error" id="deposit-return-error" role="alert" hidden></p><button class="btn btn-primary" type="submit">רישום החזר</button></form><p id="deposit-return-complete" class="deposits-complete" hidden>הכסף הוחזר במלואו למפקיד.</p></div></div></div>
      </section>`);
  }

  function renderList() {
    const body = document.getElementById('deposits-rows');
    if (!body) return;
    body.replaceChildren();
    const visible = records.filter(match).sort(sortRecords);
    visible.forEach(function (record) {
      const row = node('tr');
      const cells = [record.name, money(record.amount), displayDate(record.depositedOn), displayDate(record.date), money(remaining(record))];
      cells.forEach(function (value, index) {
        const cell = node('td', index === 0 ? 'depositor-name' : '', value);
        cell.dataset.label = ['מפקיד', 'סכום שהופקד', 'תאריך הפקדה', 'להחזרה עד', 'יתרה למפקיד'][index];
        row.appendChild(cell);
      });
      const statusCell = node('td');
      statusCell.dataset.label = 'מצב';
      statusCell.appendChild(node('span', 'deposit-status is-' + currentStatus(record), statusText(currentStatus(record))));
      row.appendChild(statusCell);
      const actionCell = node('td', 'deposit-row-action');
      const details = node('button', 'btn btn-ghost btn-sm', 'פרטים');
      details.type = 'button';
      details.setAttribute('aria-label', 'פרטי הפקדה של ' + record.name);
      details.addEventListener('click', function () { openDetail(record.id); });
      actionCell.appendChild(details);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
    const empty = document.getElementById('deposits-empty');
    empty.hidden = visible.length !== 0;
    document.getElementById('deposits-empty-copy').textContent = records.length ? 'נסו לשנות את החיפוש או את הסינון.' : 'הוסיפו הפקדה חדשה כדי להתחיל.';
    const open = records.filter(function (item) { return remaining(item) > 0; });
    document.getElementById('deposits-count').textContent = records.length + ' הפקדות';
    document.getElementById('deposits-balance').textContent = money(open.reduce(function (sum, item) { return sum + remaining(item); }, 0));
    document.getElementById('deposits-open').textContent = open.length;
    document.getElementById('deposits-soon').textContent = open.filter(function (item) { return currentStatus(item) === 'soon' || currentStatus(item) === 'overdue'; }).length;
    document.getElementById('deposits-foot').textContent = 'מוצגות ' + visible.length + ' מתוך ' + records.length + ' הפקדות';
  }

  function openForm(id) {
    editingId = id || null;
    const record = records.find(function (item) { return item.id === editingId; });
    document.getElementById('deposit-form-title').textContent = record ? 'עריכת הפקדה' : 'הפקדה חדשה';
    document.getElementById('deposit-name').value = record ? record.name : '';
    document.getElementById('deposit-phone').value = record ? record.phone : '';
    document.getElementById('deposit-amount').value = record ? record.amount : '';
    document.getElementById('deposit-date').value = record ? record.depositedOn : todayISO();
    document.getElementById('deposit-due').value = record ? record.date : '';
    document.getElementById('deposit-notes').value = record ? record.notes : '';
    document.getElementById('deposit-form-error').hidden = true;
    navigate('view-deposit-form');
    document.getElementById('deposit-name').focus();
  }
  function formError(message) {
    const error = document.getElementById('deposit-form-error');
    error.textContent = message;
    error.hidden = false;
  }
  function saveForm(event) {
    event.preventDefault();
    const name = document.getElementById('deposit-name').value.trim().replace(/\s+/g, ' ');
    const phone = document.getElementById('deposit-phone').value.trim();
    const amount = round(document.getElementById('deposit-amount').value);
    const depositedOn = document.getElementById('deposit-date').value;
    const date = document.getElementById('deposit-due').value;
    const notes = document.getElementById('deposit-notes').value.trim();
    if (!name) return formError('יש להזין את שם המפקיד.');
    if (!Number.isFinite(amount) || amount <= 0) return formError('יש להזין סכום הפקדה גדול מאפס.');
    if (!validISO(depositedOn)) return formError('יש להזין תאריך הפקדה תקין.');
    if (date && !validISO(date)) return formError('יש להזין מועד החזרה תקין או להשאיר אותו ריק.');
    if (date && date < depositedOn) return formError('מועד ההחזרה לא יכול להיות לפני תאריך ההפקדה.');
    let record = records.find(function (item) { return item.id === editingId; });
    if (record) {
      const returned = record.returns.reduce(function (sum, item) { return sum + item.amount; }, 0);
      if (amount < returned) return formError('סכום ההפקדה אינו יכול להיות קטן מהסכום שכבר הוחזר.');
      Object.assign(record, { name, phone, amount, depositedOn, date, notes });
    } else {
      record = { id: 'deposit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name, phone, amount, depositedOn, date, notes, returns: [], sample: false };
      records.push(record);
    }
    if (!save()) return;
    renderList();
    openDetail(record.id);
    notice('ההפקדה נשמרה.');
  }

  function detailPair(label, value) {
    const wrapper = node('div');
    wrapper.appendChild(node('dt', '', label));
    wrapper.appendChild(node('dd', '', value));
    return wrapper;
  }
  function openDetail(id) {
    const record = records.find(function (item) { return item.id === id; });
    if (!record) return navigate('view-deposits');
    selectedId = id;
    document.getElementById('deposit-detail-title').textContent = 'הפקדה · ' + record.name;
    const status = document.getElementById('deposit-detail-status');
    status.className = 'deposit-status is-' + currentStatus(record);
    status.textContent = statusText(currentStatus(record));
    const summary = document.getElementById('deposit-detail-summary');
    summary.replaceChildren();
    [['סכום שהופקד', money(record.amount)], ['הוחזר עד כה', money(record.amount - remaining(record))], ['יתרה למפקיד', money(remaining(record))]].forEach(function (pair) {
      const item = node('div'); item.appendChild(node('small', '', pair[0])); item.appendChild(node('strong', '', pair[1])); summary.appendChild(item);
    });
    const data = document.getElementById('deposit-detail-data');
    data.replaceChildren(detailPair('מפקיד', record.name), detailPair('טלפון', record.phone || 'לא צוין'), detailPair('תאריך הפקדה', displayDate(record.depositedOn)), detailPair('מועד החזרה', displayDate(record.date)), detailPair('הערות', record.notes || 'אין הערות'));
    const history = document.getElementById('deposit-return-history');
    history.replaceChildren();
    if (record.returns.length === 0) history.appendChild(node('p', 'deposits-history-empty', 'עדיין לא נרשמו החזרים.'));
    else record.returns.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).forEach(function (item) {
      const line = node('div', 'deposits-history-row');
      line.appendChild(node('span', '', displayDate(item.date)));
      line.appendChild(node('strong', '', money(item.amount)));
      history.appendChild(line);
    });
    const finished = remaining(record) <= 0;
    document.getElementById('deposit-return-form').hidden = finished;
    document.getElementById('deposit-return-complete').hidden = !finished;
    document.getElementById('deposit-return-hint').hidden = finished;
    document.getElementById('deposit-return-amount').value = finished ? '' : remaining(record);
    document.getElementById('deposit-return-date').value = todayISO();
    document.getElementById('deposit-return-error').hidden = true;
    navigate('view-deposit-detail');
  }
  function saveReturn(event) {
    event.preventDefault();
    const record = records.find(function (item) { return item.id === selectedId; });
    if (!record || remaining(record) <= 0) return;
    const amount = round(document.getElementById('deposit-return-amount').value);
    const date = document.getElementById('deposit-return-date').value;
    const error = document.getElementById('deposit-return-error');
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining(record)) {
      error.textContent = 'יש להזין סכום חיובי שאינו גדול מהיתרה למפקיד.'; error.hidden = false; return;
    }
    if (!validISO(date) || date < record.depositedOn) {
      error.textContent = 'יש להזין תאריך החזר תקין שאינו מוקדם להפקדה.'; error.hidden = false; return;
    }
    record.returns.push({ amount, date });
    if (!save()) { record.returns.pop(); return; }
    renderList();
    openDetail(record.id);
    notice('ההחזר למפקיד נרשם.');
  }
  function bind() {
    document.getElementById('deposit-new').addEventListener('click', function () { openForm(null); });
    document.getElementById('deposit-form-back').addEventListener('click', function () { navigate(editingId ? 'view-deposit-detail' : 'view-deposits'); });
    document.getElementById('deposit-cancel').addEventListener('click', function () { navigate(editingId ? 'view-deposit-detail' : 'view-deposits'); });
    document.getElementById('deposit-detail-back').addEventListener('click', function () { navigate('view-deposits'); });
    document.getElementById('deposit-edit').addEventListener('click', function () { openForm(selectedId); });
    document.getElementById('deposit-editor').addEventListener('submit', saveForm);
    document.getElementById('deposit-return-form').addEventListener('submit', saveReturn);
    document.getElementById('deposit-search').addEventListener('input', function (event) { search = event.target.value; renderList(); });
    document.querySelectorAll('[data-deposit-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        filter = button.dataset.depositFilter;
        document.querySelectorAll('[data-deposit-filter]').forEach(function (item) { item.classList.toggle('active', item === button); });
        renderList();
      });
    });
  }
  function init() {
    installNav();
    installViews();
    bind();
    renderList();
    publish();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
