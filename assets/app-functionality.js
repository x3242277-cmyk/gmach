/* Local interactions for the community loan manager. Data stays in this browser. */
(function () {
  'use strict';

  const STORAGE_KEY = 'gemach-community-local-v1';
  let data = readData();
  let activeLoanFilter = 'all';

  function buildLoadSample() {
    const firstNames = ['אליהו','מרדכי','יונתן','נחום','יצחק','שמואל','רפאל','מיכל','אסתר','רחל','תמר','אביגיל','מלכה','דבורה','יעל'];
    const surnames = ['פרידמן','רוזנברג','ברקוביץ','כהנא','לוין','שפירא','שטרנברג','בלום','הלוי','נוימן','הורוביץ','בן דוד','קליין','פישר','לנדאו'];
    const purposes = ['הוצאות משפחה','שכר לימוד','הוצאות רפואיות','מעבר דירה','ציוד לבית','אירוע משפחתי'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const loans = [];
    const people = [];
    for (let i = 0; i < 45; i++) {
      const name = firstNames[i % firstNames.length] + ' ' + surnames[(i * 7 + Math.floor(i / 15) * 3) % surnames.length];
      const daysFromToday = i < 8 ? [0, 1, 2, 3, 4, 6, 8, 12][i] :
        i < 15 ? [-2, -5, -9, -15, -25, -38, -45][i - 8] :
        i < 35 ? 15 + (i - 15) * 3 : -30 - (i - 35) * 16;
      const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysFromToday);
      const issued = new Date(due.getFullYear(), due.getMonth(), due.getDate() - 180);
      const amount = 3000 + ((i * 7) % 14) * 750;
      const balance = i >= 35 ? 0 : amount - (i % 3) * 500;
      const number = 1043 + i;
      const date = function (d) { return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth() + 1).padStart(2,'0') + '.' + d.getFullYear(); };
      loans.push({ number, borrower: name, guarantors: [], amount, balance, purpose: purposes[i % purposes.length], issued: date(issued), due: date(due), sample: true });
      people.push({ key: 'sample-person-' + number, name, role: 'borrower', phone: '050-000-' + String(1000 + i), relationship: 'הלוואה #' + number, sample: true });
    }
    return { people, loans };
  }

  function readData() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (_) {}
    let people = Array.isArray(saved.people) ? saved.people : [];
    let loans = Array.isArray(saved.loans) ? saved.loans : [];
    if (saved.seedVersion !== 1) {
      const sample = buildLoadSample();
      people = sample.people.concat(people);
      loans = sample.loans.concat(loans);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, people, loans, seedVersion: 1 })); } catch (_) {}
    }
    return {
      people, loans, seedVersion: 1,
      blacklist: Array.isArray(saved.blacklist) ? saved.blacklist : [],
      restored: Array.isArray(saved.restored) ? saved.restored : [],
      staticBalances: saved.staticBalances && typeof saved.staticBalances === 'object' ? saved.staticBalances : {},
      loanPayments: saved.loanPayments && typeof saved.loanPayments === 'object' ? saved.loanPayments : {},
      loanDetails: saved.loanDetails && typeof saved.loanDetails === 'object' ? saved.loanDetails : {},
      profileDetails: saved.profileDetails && typeof saved.profileDetails === 'object' ? saved.profileDetails : {},
      settings: saved.settings && typeof saved.settings === 'object' ? saved.settings : null
    };
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('gemach:local-data-changed', { detail: { loans: data.loans, people: data.people } }));
      return true;
    } catch (_) {
      notify('לא ניתן לשמור במכשיר זה. בדקו שהאחסון בדפדפן זמין.');
      return false;
    }
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(function () { toast.classList.remove('show'); }, 3600);
  }

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('he-IL').replace(/[\s\-.,#׳״'"()]/g, '');
  }

  function personNameParts(person) {
    const parts = String(person.name || '').trim().split(/\s+/).filter(Boolean);
    return {
      first: person.firstName || parts[0] || '',
      last: person.lastName || parts.slice(1).join(' ') || ''
    };
  }

  function personDisplayName(person) {
    const name = personNameParts(person);
    return [name.last, name.first].filter(Boolean).join(' ');
  }

  function personIdentity(person) {
    const idnum = String(person.idnum || '').replace(/\D/g, '');
    return idnum ? 'id:' + idnum : 'name:' + normalize(person.name);
  }

  function isBlacklisted(person) {
    return data.blacklist.includes('name:' + normalize(person.name)) || data.blacklist.includes(personIdentity(person));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function money(amount) {
    return amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) ?
      new Intl.NumberFormat('he-IL').format(Number(amount)) + ' ₪' : '—';
  }

  function parseDate(value) {
    const input = String(value || '').trim();
    const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const local = input.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    const year = iso ? +iso[1] : local ? +local[3] : 0;
    const month = iso ? +iso[2] : local ? +local[2] : 0;
    const day = iso ? +iso[3] : local ? +local[1] : 0;
    const date = new Date(year, month - 1, day);
    if (!year || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function dateText(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return String(date.getDate()).padStart(2, '0') + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + date.getFullYear();
  }

  function statusFor(loan) {
    if (loan.balance !== null && loan.balance !== undefined && loan.balance !== '' && Number(loan.balance) === 0) return 'paid';
    const due = parseDate(loan.due);
    if (!due) return 'active';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return 'overdue';
    if (days <= 30) return 'due';
    return 'active';
  }

  function badge(status) {
    const names = { paid: 'שולמה', overdue: 'באיחור', due: 'מתקרב', active: 'פעילה' };
    const classes = { paid: 'badge-paid', overdue: 'badge-overdue', due: 'badge-due', active: 'badge-active' };
    return el('span', 'badge ' + (classes[status] || classes.active), names[status] || names.active);
  }

  function rowStatus(row) {
    if (row.dataset.localStatus) return row.dataset.localStatus;
    const b = row.querySelector('.badge');
    if (!b) return 'active';
    if (b.classList.contains('badge-paid')) return 'paid';
    if (b.classList.contains('badge-overdue')) return 'overdue';
    if (b.classList.contains('badge-due')) return 'due';
    return 'active';
  }

  function tableFor(sectionId) {
    return document.querySelector('#' + sectionId + ' tbody');
  }

  function tableRows(sectionId) {
    const tbody = tableFor(sectionId);
    return tbody ? Array.from(tbody.querySelectorAll('tr:not(.local-empty-row)')) : [];
  }

  function applyTable(sectionId) {
    const panel = document.getElementById(sectionId);
    if (!panel) return;
    const tbody = panel.querySelector('tbody');
    const input = panel.querySelector('.search-box input');
    if (!tbody) return;
    const query = normalize(input && input.value);
    let shown = 0;
    const rows = tableRows(sectionId);
    rows.forEach(function (row) {
      const matchesText = !query || normalize(row.textContent + ' ' + (row.dataset.canonicalName || '')).includes(query);
      const status = rowStatus(row);
      const matchesStatus = sectionId !== 'view-loans' || activeLoanFilter === 'all' ||
        (activeLoanFilter === 'active' && status !== 'paid') ||
        (activeLoanFilter === 'overdue' && status === 'overdue') ||
        (activeLoanFilter === 'paid' && status === 'paid');
      row.hidden = !(matchesText && matchesStatus);
      if (!row.hidden) shown++;
    });
    let empty = tbody.querySelector('.local-empty-row');
    if (!shown) {
      if (!empty) {
        empty = el('tr', 'local-empty-row');
        const cell = el('td', 'cell-muted', 'לא נמצאו רשומות מתאימות');
        cell.colSpan = panel.querySelectorAll('thead th').length;
        cell.style.cssText = 'padding:28px;text-align:center;font-size:14px';
        empty.appendChild(cell);
        tbody.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
    const count = panel.querySelector('.pager .cell-muted');
    if (count) count.textContent = 'מציג ' + shown + ' מתוך ' + rows.length;
  }

  function bindLists() {
    ['people-borrowers', 'people-guarantors', 'view-loans'].forEach(function (id) {
      const panel = document.getElementById(id);
      if (!panel) return;
      const input = panel.querySelector('.search-box input');
      if (input) input.addEventListener('input', function () { applyTable(id); });
      const pager = panel.querySelector('.pager');
      if (pager) pager.hidden = true;
    });
    const loanView = document.getElementById('view-loans');
    if (loanView) {
      const filters = loanView.querySelectorAll('.filter-tab');
      const values = ['all', 'active', 'overdue', 'paid'];
      filters.forEach(function (button, index) {
        button.addEventListener('click', function () {
          activeLoanFilter = values[index] || 'all';
          filters.forEach(function (item) { item.classList.toggle('active', item === button); });
          applyTable('view-loans');
        });
      });
    }
    refreshTables();
  }

  function refreshTables() {
    ['people-borrowers', 'people-guarantors', 'view-loans'].forEach(applyTable);
  }

  function addCell(row, text, className) {
    const cell = el('td', className, text);
    row.appendChild(cell);
    return cell;
  }

  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join('.');
  }

  function sortPeopleRows() {
    const collator = new Intl.Collator('he-IL', { sensitivity: 'base', numeric: true });
    ['people-borrowers', 'people-guarantors'].forEach(function (sectionId) {
      const tbody = tableFor(sectionId);
      if (!tbody) return;
      const rows = tableRows(sectionId);
      rows.sort(function (left, right) {
        const leftName = personNameParts({ name: left.dataset.canonicalName || left.querySelector('.cell-strong').textContent });
        const rightName = personNameParts({ name: right.dataset.canonicalName || right.querySelector('.cell-strong').textContent });
        return collator.compare(left.dataset.personLastName || leftName.last, right.dataset.personLastName || rightName.last) ||
          collator.compare(left.dataset.personFirstName || leftName.first, right.dataset.personFirstName || rightName.first);
      });
      rows.forEach(function (row) { tbody.appendChild(row); });
    });
  }

  function updateBlacklistIndicators() {
    document.querySelectorAll('#view-people tbody tr[data-person-key]').forEach(function (row) {
      const marked = isBlacklisted({ name: row.dataset.canonicalName, idnum: row.dataset.personIdnum });
      row.classList.toggle('person-blacklisted', marked);
      let badge = row.querySelector('.person-blacklist-badge');
      if (marked && !badge) {
        badge = el('span', 'person-blacklist-badge', 'רשימה שחורה');
        row.querySelector('.person-cell').appendChild(badge);
      } else if (!marked && badge) badge.remove();
    });
    document.querySelectorAll('.blacklist-toggle').forEach(function (button) {
      const marked = isBlacklisted({ name: button.dataset.personName, idnum: button.dataset.personIdnum });
      button.textContent = marked ? 'הסר מהרשימה השחורה' : 'סמן ברשימה שחורה';
      button.setAttribute('aria-pressed', String(marked));
      button.classList.toggle('is-blacklisted', marked);
    });
  }

  function toggleBlacklist(person) {
    const previous = data.blacklist.slice();
    const marked = isBlacklisted(person);
    const keys = ['name:' + normalize(person.name), personIdentity(person)];
    if (marked) data.blacklist = data.blacklist.filter(function (key) { return !keys.includes(key); });
    else data.blacklist.push(keys[0]);
    if (!saveData()) {
      data.blacklist = previous;
      return;
    }
    updateBlacklistIndicators();
    notify(marked ? 'איש הקשר הוסר מהרשימה השחורה.' : 'איש הקשר סומן ברשימה השחורה.');
  }

  function blacklistButton(person) {
    const button = el('button', 'btn btn-ghost btn-sm blacklist-toggle');
    button.type = 'button';
    button.dataset.personKey = personIdentity(person);
    button.dataset.personName = person.name;
    button.dataset.personIdnum = person.idnum || '';
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleBlacklist(person);
    });
    return button;
  }

  function showBlacklistControl(person, viewId) {
    const header = document.querySelector('#' + viewId + ' .view-header');
    if (!header) return;
    const previous = header.querySelector('.blacklist-toggle');
    if (previous) previous.remove();
    header.appendChild(blacklistButton(person));
    updateBlacklistIndicators();
  }

  function preparePersonRow(row, person) {
    const name = personNameParts(person);
    row.dataset.canonicalName = person.name;
    row.dataset.personFirstName = name.first;
    row.dataset.personLastName = name.last;
    row.dataset.personKey = personIdentity(person);
    row.dataset.personIdnum = person.idnum || '';
    const label = row.querySelector('.person-cell .cell-strong');
    if (label) label.textContent = personDisplayName(person);
    const action = row.cells[row.cells.length - 1];
    if (action && !action.querySelector('.blacklist-toggle')) action.appendChild(blacklistButton(person));
    updateBlacklistIndicators();
  }

  function showGenericDetail(kind, title, entries, returnView) {
    let view = document.getElementById('view-local-detail');
    if (!view) {
      view = el('section', 'view');
      view.id = 'view-local-detail';
      document.querySelector('main.content').appendChild(view);
    }
    view.replaceChildren();
    const header = el('div', 'view-header');
    const titleWrap = el('div');
    const back = el('button', 'btn btn-ghost btn-sm', '→ חזרה לרשימה');
    back.style.marginBottom = '10px';
    back.addEventListener('click', function () { window.showView(returnView); });
    titleWrap.append(back, el('h2', '', title));
    header.appendChild(titleWrap);
    const panel = el('div', 'panel');
    const panelHead = el('div', 'panel-head');
    panelHead.appendChild(el('h3', '', kind));
    const grid = el('div', 'field-grid');
    entries.forEach(function (item) {
      if (item[1] === undefined || item[1] === null || item[1] === '') return;
      const box = el('div', 'kv');
      box.append(el('div', 'k', item[0]), el('div', 'v', String(item[1])));
      grid.appendChild(box);
    });
    panel.append(panelHead, grid);
    view.append(header, panel);
    window.showView(view.id);
  }

  function showPerson(person) {
    if (window.gemachWorkspace) { window.gemachWorkspace.showPerson(person.name); return; }
    showGenericDetail('פרטי איש קשר', personDisplayName(person), [
      ['סוג קשר', person.role === 'guarantor' ? 'ערב' : 'לווה'],
      ['תעודת זהות', person.idnum], ['טלפון', person.phone],
      ['כתובת', person.address], ['בן/בת זוג', person.spouse],
      ['מקום עבודה', person.work], ['טלפון בעבודה', person.workPhone],
      ['הופנה על ידי', person.referrer], ['הערות', person.notes]
    ], 'view-people');
    showBlacklistControl(person, 'view-local-detail');
  }

  function showLoan(loan) {
    if (window.gemachWorkspace) { window.gemachWorkspace.showLoan(loan.number); return; }
    showGenericDetail('פרטי הלוואה', 'הלוואה #' + loan.number, [
      ['לווה', loan.borrower], ['סכום', money(loan.amount)],
      ['יתרה לתשלום', money(loan.balance)], ['מועד מתן', dateText(loan.issued)],
      ['מועד החזרה', dateText(loan.due)], ['מטרה', loan.purpose],
      ['ערבים', (loan.guarantors || []).filter(Boolean).join(', ')],
      ['מצב', badge(statusFor(loan)).textContent]
    ], 'view-loans');
  }

  function personRow(person) {
    const row = el('tr', 'local-saved-row');
    row.style.cursor = 'pointer';
    const nameCell = el('td');
    const wrapper = el('div', 'person-cell');
    wrapper.append(el('div', 'avatar', initials(person.name)), el('span', 'cell-strong', personDisplayName(person)));
    nameCell.appendChild(wrapper);
    row.appendChild(nameCell);
    addCell(row, person.phone || '—');
    addCell(row, person.relationship || (person.role === 'guarantor' ? 'לא שויך להלוואה' : 'איש קשר'));
    const action = el('td');
    const button = el('button', 'btn btn-ghost btn-sm', 'פרטים');
    button.type = 'button';
    button.addEventListener('click', function (event) { event.stopPropagation(); showPerson(person); });
    action.appendChild(button);
    row.appendChild(action);
    row.addEventListener('click', function () { showPerson(person); });
    preparePersonRow(row, person);
    return row;
  }

  function loanRow(loan) {
    const row = el('tr', 'local-saved-row');
    row.dataset.localStatus = statusFor(loan);
    addCell(row, '#' + loan.number, 'cell-strong');
    addCell(row, loan.borrower || '—');
    addCell(row, money(loan.amount));
    addCell(row, dateText(loan.issued), 'cell-muted');
    addCell(row, dateText(loan.due));
    addCell(row, money(loan.balance));
    const stateCell = el('td');
    stateCell.appendChild(badge(row.dataset.localStatus));
    row.appendChild(stateCell);
    const action = el('td');
    const button = el('button', 'btn btn-ghost btn-sm', 'פרטים');
    button.type = 'button';
    button.addEventListener('click', function () { showLoan(loan); });
    action.appendChild(button);
    row.appendChild(action);
    return row;
  }

  function renderSavedRows() {
    document.querySelectorAll('.local-saved-row').forEach(function (row) { row.remove(); });
    data.people.forEach(function (person) {
      const displayedPerson = { ...person, ...(data.profileDetails[normalize(person.name)] || {}) };
      const target = tableFor(person.role === 'guarantor' ? 'people-guarantors' : 'people-borrowers');
      if (target) target.prepend(personRow(displayedPerson));
      if (window.peopleDB && person.name && !window.peopleDB[person.name]) {
        window.peopleDB[person.name] = { idnum: person.idnum || '', phone: person.phone || '', address: person.address || '' };
        if (window.existingPeople && !window.existingPeople.includes(person.name)) window.existingPeople.push(person.name);
      }
    });
    data.loans.forEach(function (loan) {
      const target = tableFor('view-loans');
      if (target) target.prepend(loanRow(loan));
    });
    const personTabs = document.querySelectorAll('#view-people > .tabs .tab-btn');
    if (personTabs[0]) personTabs[0].textContent = 'לווים (' + tableRows('people-borrowers').length + ')';
    if (personTabs[1]) personTabs[1].textContent = 'ערבים (' + tableRows('people-guarantors').length + ')';
    const peopleCount = document.querySelector('#view-people .feature-count');
    if (peopleCount) peopleCount.textContent = tableRows('people-borrowers').length + tableRows('people-guarantors').length;
    sortPeopleRows();
    updateBlacklistIndicators();
    updateSummary();
    refreshTables();
  }

  function numberIn(text) {
    return Number(String(text || '').replace(/[^\d]/g, '')) || 0;
  }

  function moneyIn(text) {
    return Number(String(text || '').replace(/[^\d.,-]/g, '').replace(/,/g, '')) || 0;
  }

  function updateSummary() {
    const rows = tableRows('view-loans');
    const records = rows.map(function (row) {
      const cells = row.cells;
      const number = numberIn(cells[0].textContent);
      if (!row.classList.contains('local-saved-row') && Object.prototype.hasOwnProperty.call(data.staticBalances, number)) {
        cells[5].textContent = money(data.staticBalances[number]);
      }
      const loan = {
        number, borrower: cells[1].textContent.trim(),
        amount: moneyIn(cells[2].textContent), due: cells[4].textContent.trim(),
        balance: moneyIn(cells[5].textContent)
      };
      loan.status = statusFor(loan);
      row.dataset.localStatus = loan.status;
      const oldBadge = cells[6].querySelector('.badge');
      if (oldBadge) oldBadge.replaceWith(badge(loan.status));
      return loan;
    });
    // Keep the loans needing attention visible at the top of the inner list.
    const priority = { overdue: 0, due: 1, active: 2, paid: 3 };
    rows.sort(function (a, b) {
      const aStatus = rowStatus(a);
      const bStatus = rowStatus(b);
      if (priority[aStatus] !== priority[bStatus]) return priority[aStatus] - priority[bStatus];
      const aDate = parseDate(a.cells[4].textContent);
      const bDate = parseDate(b.cells[4].textContent);
      const dateDifference = (aDate ? aDate.getTime() : Infinity) - (bDate ? bDate.getTime() : Infinity);
      if (dateDifference) return aStatus === 'paid' ? -dateDifference : dateDifference;
      return numberIn(a.cells[0].textContent) - numberIn(b.cells[0].textContent);
    });
    const loanBody = tableFor('view-loans');
    if (loanBody) rows.forEach(function (row) { loanBody.appendChild(row); });
    const open = records.filter(function (loan) { return loan.status !== 'paid'; });
    const overdue = records.filter(function (loan) { return loan.status === 'overdue'; });
    const outstanding = open.reduce(function (sum, loan) { return sum + loan.balance; }, 0);
    const set = function (id, value) { const target = document.getElementById(id); if (target) target.textContent = value; };
    set('loan-record-count', records.length + ' הלוואות');
    set('loans-outstanding', money(outstanding));
    set('loans-active-count', open.length);
    set('loans-overdue-count', overdue.length);
    const cards = document.querySelectorAll('#view-dashboard .stats-row .stat-card .value');
    if (cards[0]) cards[0].textContent = open.length;
    if (cards[1]) cards[1].textContent = money(outstanding);
    if (cards[2]) cards[2].textContent = overdue.length;
    const trends = document.querySelectorAll('#view-dashboard .stats-row .stat-card .trend');
    if (trends[0]) trends[0].textContent = records.length + ' הלוואות רשומות';
    if (trends[1]) trends[1].textContent = 'ב־' + open.length + ' הלוואות פתוחות';
    const dashboardPanels = document.querySelectorAll('#view-dashboard .cols-2 > .panel .panel-body');
    function fillPanel(panel, loans) {
      if (!panel) return;
      panel.replaceChildren();
      loans.slice(0, 6).forEach(function (loan) {
        const row = el('div', 'list-row');
        const info = el('div');
        info.append(el('div', 'who', loan.borrower), el('div', 'meta', 'הלוואה #' + loan.number + ' · ' + dateText(loan.due)));
        row.append(info, el('div', 'amount', money(loan.balance)));
        panel.appendChild(row);
      });
      if (!loans.length) panel.appendChild(el('div', 'list-row', 'אין הלוואות להצגה'));
    }
    const upcoming = open.filter(function (loan) { return loan.status !== 'overdue' && parseDate(loan.due); })
      .sort(function (a, b) { return parseDate(a.due) - parseDate(b.due); });
    overdue.sort(function (a, b) { return parseDate(a.due) - parseDate(b.due); });
    fillPanel(dashboardPanels[0], upcoming);
    fillPanel(dashboardPanels[1], overdue);
    const overdueBadge = document.querySelector('#view-dashboard .cols-2 > .panel:nth-child(2) .panel-head .badge');
    if (overdueBadge) overdueBadge.textContent = overdue.length + ' הלוואות';
    window.dispatchEvent(new CustomEvent('gemach:loan-register-updated', { detail: { loans: records } }));
  }

  function required(input, label) {
    if (String(input.value || '').trim()) return true;
    input.setCustomValidity('יש למלא ' + label);
    input.reportValidity();
    input.focus();
    return false;
  }

  function fieldValue(panel, index) {
    const input = panel.querySelectorAll('input, textarea')[index];
    return input ? String(input.value || '').trim() : '';
  }

  function validatePanel(wizardId, step) {
    const scope = document.getElementById(wizardId === 'wiz-person' ? 'view-person-new' : 'view-loan-new');
    const panel = scope && scope.querySelector('.wizard-panel[data-panel="' + step + '"]');
    if (!panel) return false;
    const inputs = Array.from(panel.querySelectorAll('input:not([type="checkbox"])'));
    const requiredIndexes = wizardId === 'wiz-person' ? (step === 1 ? [0, 1, 2, 3] : []) :
      (step <= 3 ? [0, 1, 2] : step === 4 ? [0, 2, 3] : []);
    for (const index of requiredIndexes) {
      const input = inputs[index];
      if (!input || !required(input, input.closest('.field').querySelector('label').textContent)) return false;
    }
    if (wizardId === 'wiz-person' && step === 1 || wizardId === 'wiz-loan' && step <= 3) {
      const idIndex = wizardId === 'wiz-person' ? 2 : 1;
      const phoneIndex = wizardId === 'wiz-person' ? 3 : 2;
      if (!/^\d{9}$/.test(inputs[idIndex].value.replace(/\D/g, ''))) {
        inputs[idIndex].setCustomValidity('יש להזין תשע ספרות בתעודת הזהות');
        inputs[idIndex].reportValidity(); inputs[idIndex].focus(); return false;
      }
      if (inputs[phoneIndex].value.replace(/\D/g, '').length < 9) {
        inputs[phoneIndex].setCustomValidity('יש להזין מספר טלפון תקין');
        inputs[phoneIndex].reportValidity(); inputs[phoneIndex].focus(); return false;
      }
    }
    if (wizardId === 'wiz-loan' && step === 4) {
      const amount = Number(inputs[0].value.replace(/[^\d.]/g, ''));
      if (!(amount > 0)) {
        inputs[0].setCustomValidity('יש להזין סכום גדול מאפס');
        inputs[0].reportValidity(); inputs[0].focus(); return false;
      }
      const issued = parseDate(inputs[2].value);
      const due = parseDate(inputs[3].value);
      if (!issued || !due || due < issued) {
        const bad = !issued ? inputs[2] : inputs[3];
        bad.setCustomValidity('יש להזין תאריך תקין ומועד החזרה שאינו קודם לתאריך המתן');
        bad.reportValidity(); bad.focus(); return false;
      }
    }
    const invalidEmail = inputs.find(function (input) { return input.type === 'email' && !input.checkValidity(); });
    if (invalidEmail) { invalidEmail.reportValidity(); invalidEmail.focus(); return false; }
    return true;
  }

  function uniquePersonId(idnum) {
    const normalized = String(idnum).replace(/\D/g, '');
    const inLocal = data.people.some(function (person) { return String(person.idnum || '').replace(/\D/g, '') === normalized; });
    const inSeed = Object.keys(window.peopleDB || {}).some(function (name) {
      return String(window.peopleDB[name].idnum || '').replace(/\D/g, '') === normalized;
    });
    return inLocal || inSeed;
  }

  function savePersonWizard() {
    const scope = document.getElementById('view-person-new');
    const first = scope.querySelector('.wizard-panel[data-panel="1"]');
    const second = scope.querySelector('.wizard-panel[data-panel="2"]');
    const roleSelect = document.getElementById('local-person-role');
    const person = {
      key: 'person-' + Date.now(), firstName: fieldValue(first, 0), lastName: fieldValue(first, 1),
      idnum: fieldValue(first, 2), phone: fieldValue(first, 3), homePhone: fieldValue(first, 4),
      address: fieldValue(first, 5), email: fieldValue(first, 6), role: roleSelect ? roleSelect.value : 'borrower',
      spouse: fieldValue(second, 0), spouseId: fieldValue(second, 1), work: fieldValue(second, 2),
      workPhone: fieldValue(second, 3), referrer: fieldValue(second, 4), notes: fieldValue(second, 5)
    };
    person.name = person.firstName + ' ' + person.lastName;
    if (uniquePersonId(person.idnum)) { notify('איש קשר עם תעודת הזהות הזו כבר קיים ברשומות המקומיות.'); return; }
    data.people.push(person);
    if (!saveData()) { data.people.pop(); return; }
    renderSavedRows();
    clearWizard(scope);
    window.showView('view-people');
    notify('איש הקשר נשמר במכשיר זה.');
  }

  function ensurePerson(name, idnum, phone, address, role, relationship, email) {
    const sectionId = role === 'guarantor' ? 'people-guarantors' : 'people-borrowers';
    const existing = tableRows(sectionId).some(function (row) {
      const label = row.querySelector('.person-cell .cell-strong');
      return label && normalize(label.textContent) === normalize(name);
    });
    if (!existing) data.people.push({ key: 'person-' + Date.now() + '-' + Math.random().toString(36).slice(2), name, idnum, phone, address, email: email || '', role, relationship });
  }

  function saveLoanWizard() {
    const scope = document.getElementById('view-loan-new');
    const panels = [1, 2, 3, 4].map(function (number) { return scope.querySelector('.wizard-panel[data-panel="' + number + '"]'); });
    const borrower = fieldValue(panels[0], 0);
    const guarantors = [fieldValue(panels[1], 0), fieldValue(panels[2], 0)];
    if (new Set([borrower, ...guarantors].map(normalize)).size !== 3) {
      notify('יש לבחור לווה ושני ערבים שונים.'); return;
    }
    const amount = Number(fieldValue(panels[3], 0).replace(/[^\d.]/g, ''));
    const knownNumbers = tableRows('view-loans').map(function (row) { return Number((row.cells[0].textContent || '').replace(/\D/g, '')); });
    const number = Math.max(1042, ...knownNumbers.filter(Number.isFinite)) + 1;
    const loan = {
      number, borrower, guarantors, amount, balance: amount, purpose: fieldValue(panels[3], 1),
      issued: dateText(fieldValue(panels[3], 2)), due: dateText(fieldValue(panels[3], 3)),
      reminders: Array.from(panels[3].querySelectorAll('input[type="checkbox"]')).map(function (box) { return box.checked; })
    };
    const originalPeopleCount = data.people.length;
    ensurePerson(borrower, fieldValue(panels[0], 1), fieldValue(panels[0], 2), fieldValue(panels[0], 3), 'borrower', 'הלוואה #' + number, fieldValue(panels[0], 4));
    guarantors.forEach(function (name, index) {
      const panel = panels[index + 1];
      ensurePerson(name, fieldValue(panel, 1), fieldValue(panel, 2), fieldValue(panel, 3), 'guarantor', 'הלוואה #' + number + ' · ' + borrower);
    });
    data.loans.push(loan);
    if (!saveData()) { data.loans.pop(); data.people.splice(originalPeopleCount); return; }
    renderSavedRows();
    clearWizard(scope);
    window.showView('view-loans');
    notify('ההלוואה נשמרה במכשיר זה.');
  }

  function clearWizard(scope) {
    scope.querySelectorAll('.wizard-panel input:not([type="checkbox"]), .wizard-panel textarea').forEach(function (input) { input.value = ''; input.setCustomValidity(''); });
    if (window.wizardShow) window.wizardShow(scope.id === 'view-loan-new' ? 'wiz-loan' : 'wiz-person', 1);
  }

  function bindWizards() {
    const roleGrid = document.querySelector('#view-person-new .wizard-panel[data-panel="1"] .field-grid');
    if (roleGrid && !document.getElementById('local-person-role')) {
      const field = el('div', 'field');
      const label = el('label', '', 'סוג איש קשר');
      label.htmlFor = 'local-person-role';
      const select = el('select');
      select.id = 'local-person-role';
      [['borrower', 'לווה'], ['guarantor', 'ערב']].forEach(function (entry) {
        const option = el('option', '', entry[1]); option.value = entry[0]; select.appendChild(option);
      });
      field.append(label, select);
      roleGrid.appendChild(field);
    }
    document.querySelectorAll('#view-person-new input, #view-loan-new input').forEach(function (input) {
      input.addEventListener('input', function () { input.setCustomValidity(''); });
    });
    document.addEventListener('click', function (event) {
      const button = event.target.closest('#wiz-person-next, #wiz-loan-next');
      if (!button) return;
      const wizardId = button.id === 'wiz-person-next' ? 'wiz-person' : 'wiz-loan';
      const scope = document.getElementById(wizardId === 'wiz-person' ? 'view-person-new' : 'view-loan-new');
      const total = scope.querySelectorAll('.wizard-panel').length;
      const step = window.wizardState && window.wizardState[wizardId] || 1;
      if (!validatePanel(wizardId, step)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (step === total) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (wizardId === 'wiz-person') savePersonWizard(); else saveLoanWizard();
      }
    }, true);
  }

  function archiveKey(row) {
    return normalize(row.cells[0].textContent + '|' + row.cells[1].textContent);
  }

  function bindArchive() {
    const archive = document.getElementById('view-archive');
    if (!archive) return;
    archive.querySelectorAll('tbody tr').forEach(function (row) {
      const key = archiveKey(row);
      if (data.restored.includes(key)) { row.remove(); return; }
      const button = row.querySelector('button');
      if (!button) return;
      button.addEventListener('click', function () {
        if (row.cells[0].textContent.includes('איש קשר')) {
          const name = row.querySelector('.archive-row-name').textContent.trim();
          const known = window.peopleDB && window.peopleDB[name] || {};
          data.people.push({ key: 'restored-' + key, name, role: 'guarantor', idnum: known.idnum || '', phone: known.phone || '', address: known.address || '', relationship: 'רשומה ששוחזרה מהארכיון' });
        } else {
          const label = row.querySelector('.archive-row-name').textContent;
          const match = label.match(/#(\d+)\s*·\s*(.*)/);
          data.loans.push({ number: match ? +match[1] : Date.now(), borrower: match ? match[2] : label, amount: null, balance: null, issued: '', due: '', purpose: 'רשומה ששוחזרה מהארכיון', guarantors: [] });
        }
        data.restored.push(key);
        if (!saveData()) { data.restored.pop(); if (row.cells[0].textContent.includes('איש קשר')) data.people.pop(); else data.loans.pop(); return; }
        row.remove();
        renderSavedRows();
        notify('הרשומה שוחזרה ברשימות במכשיר זה.');
      });
    });
    const pager = archive.querySelector('.pager');
    if (pager) pager.hidden = true;
  }

  function bindSettings() {
    const view = document.getElementById('view-settings');
    if (!view) return;
    const cards = view.querySelectorAll('.form-card');
    if (cards.length < 2) return;
    const nameInput = document.getElementById('settings-name');
    const phoneInput = document.getElementById('settings-phone');
    const button = document.getElementById('settings-save');
    if (!nameInput || !phoneInput || !button) return;
    const boxes = Array.from(cards[1].querySelectorAll('input[type="checkbox"]:not([disabled])'));
    if (data.settings) {
      if (data.settings.name) nameInput.value = data.settings.name;
      if (data.settings.phone) phoneInput.value = data.settings.phone;
      if (Array.isArray(data.settings.reminders)) boxes.forEach(function (box, index) { box.checked = !!data.settings.reminders[index]; });
    }
    button.addEventListener('click', function () {
      if (!required(nameInput, 'שם מלא')) return;
      const previous = data.settings;
      data.settings = { name: nameInput.value.trim(), phone: phoneInput.value.trim(), reminders: boxes.map(function (box) { return box.checked; }) };
      if (!saveData()) { data.settings = previous; return; }
      document.querySelectorAll('.tp-name').forEach(function (label) { label.textContent = data.settings.name; });
      notify('ההגדרות נשמרו במכשיר זה.');
    });
    if (data.settings && data.settings.name) document.querySelectorAll('.tp-name').forEach(function (label) { label.textContent = data.settings.name; });
  }

  function bindStaticDetails() {
    ['people-borrowers', 'people-guarantors'].forEach(function (sectionId) {
      const section = document.getElementById(sectionId);
      if (!section) return;
      section.querySelectorAll('tbody tr:not(.local-saved-row)').forEach(function (row) {
        const label = row.querySelector('.person-cell .cell-strong');
        if (!label) return;
        const name = label.textContent.trim();
        const info = window.peopleDB && window.peopleDB[name] || {};
        const person = { name, role: sectionId === 'people-guarantors' ? 'guarantor' : 'borrower', idnum: info.idnum, phone: info.phone || row.cells[1].textContent, address: info.address, relationship: row.cells[2].textContent,
          ...(data.profileDetails[normalize(name)] || {}) };
        if (person.phone) row.cells[1].textContent = person.phone;
        preparePersonRow(row, person);
        const open = function (event) {
          event.stopPropagation();
          showPerson(person);
        };
        row.onclick = open;
        const button = row.querySelector('button');
        if (button) button.onclick = open;
      });
    });
    sortPeopleRows();
    updateBlacklistIndicators();
    const loans = document.getElementById('view-loans');
    if (!loans) return;
    loans.querySelectorAll('tbody tr:not(.local-saved-row)').forEach(function (row) {
      if (row.cells.length < 8) return;
      const number = Number(row.cells[0].textContent.replace(/\D/g, ''));
      const button = row.querySelector('button');
      if (!button) return;
      button.onclick = function () {
        showLoan({ number, borrower: row.cells[1].textContent, amount: Number(row.cells[2].textContent.replace(/\D/g, '')), issued: row.cells[3].textContent, due: row.cells[4].textContent, balance: Number(row.cells[5].textContent.replace(/\D/g, '')), guarantors: [] });
      };
    });
  }

  function allLoans() {
    return tableRows('view-loans').map(function (row) {
      const cells = row.cells;
      const number = numberIn(cells[0].textContent);
      const saved = data.loans.find(function (loan) { return Number(loan.number) === number; }) || {};
      const staticExtra = {
        1042: { purpose: 'הוצאות רפואיות', guarantors: ['משה לוי', 'יוסף שטרן'] },
        1041: { purpose: 'הוצאות משפחה' },
        1040: { purpose: 'הוצאות משפחה', guarantors: ['יעקב כהן', 'רחל אברהם'] },
        1039: { purpose: 'הוצאות משפחה' },
        1038: { purpose: 'הוצאות משפחה' }
      }[number] || {};
      return {
        ...staticExtra, ...saved, ...(data.loanDetails[number] || {}), number,
        borrower: cells[1].textContent.trim(),
        amount: moneyIn(cells[2].textContent),
        issued: cells[3].textContent.trim(),
        due: cells[4].textContent.trim(),
        balance: moneyIn(cells[5].textContent),
        payments: (data.loanPayments[number] || []).slice()
      };
    });
  }

  function getLoan(number) {
    return allLoans().find(function (loan) { return Number(loan.number) === Number(number); }) || null;
  }

  function getPerson(name) {
    const key = normalize(name);
    const saved = data.people.find(function (person) { return normalize(person.name) === key; }) || {};
    const seed = window.peopleDB && window.peopleDB[name] || {};
    const row = Array.from(document.querySelectorAll('#view-people tbody tr')).find(function (item) { return normalize(item.dataset.canonicalName) === key; });
    const profile = data.profileDetails[key] || {};
    return { name, role: saved.role || (row && row.closest('#people-guarantors') ? 'guarantor' : 'borrower'),
      relationship: row && row.cells[2] ? row.cells[2].textContent.trim() : '',
      ...seed, ...saved, ...profile, name,
      blacklisted: isBlacklisted({ name, idnum: profile.idnum || saved.idnum || seed.idnum }) };
  }

  function saveProfile(name, fields) {
    const key = normalize(name);
    const previous = data.profileDetails[key];
    data.profileDetails[key] = { ...(previous || {}), ...fields };
    if (!saveData()) { if (previous) data.profileDetails[key] = previous; else delete data.profileDetails[key]; return false; }
    document.querySelectorAll('#view-people tbody tr:not(.local-saved-row)').forEach(function (row) {
      if (normalize(row.dataset.canonicalName) !== key) return;
      if (fields.phone && row.cells[1]) row.cells[1].textContent = fields.phone;
      if (fields.idnum) row.dataset.personIdnum = fields.idnum;
    });
    renderSavedRows();
    return true;
  }

  function saveLoanDetails(number, fields) {
    const previous = data.loanDetails[number];
    data.loanDetails[number] = { ...(previous || {}), ...fields };
    if (!saveData()) { if (previous) data.loanDetails[number] = previous; else delete data.loanDetails[number]; return false; }
    return true;
  }

  function recordRepayment(number, entry) {
    const loan = getLoan(number);
    const amount = Number(entry.amount);
    if (!loan || !Number.isFinite(amount) || amount <= 0 || amount > loan.balance || Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001) return null;
    const paidOn = parseDate(entry.date);
    if (!paidOn || paidOn < parseDate(loan.issued) || paidOn > new Date()) return null;
    const previousPayments = (data.loanPayments[number] || []).slice();
    const savedLoan = data.loans.find(function (item) { return Number(item.number) === Number(number); });
    const previousBalance = savedLoan ? savedLoan.balance : data.staticBalances[number];
    const nextBalance = Math.round((loan.balance - amount) * 100) / 100;
    const payment = { id: 'repayment-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      amount, date: dateText(entry.date), balanceAfter: nextBalance,
      totalPaidAfter: Math.round((loan.amount - nextBalance) * 100) / 100,
      method: String(entry.method || 'לא צוין'),
      reference: String(entry.reference || ''), notes: String(entry.notes || ''), recordedAt: new Date().toISOString() };
    data.loanPayments[number] = previousPayments.concat(payment);
    if (savedLoan) savedLoan.balance = nextBalance;
    else data.staticBalances[number] = nextBalance;
    if (!saveData()) {
      data.loanPayments[number] = previousPayments;
      if (savedLoan) savedLoan.balance = previousBalance;
      else if (previousBalance === undefined) delete data.staticBalances[number]; else data.staticBalances[number] = previousBalance;
      return null;
    }
    if (savedLoan) renderSavedRows(); else { updateSummary(); refreshTables(); }
    return { loan: getLoan(number), payment };
  }

  window.gemachApp = { allLoans, getLoan, getPerson, saveProfile, saveLoanDetails, recordRepayment,
    personLoans: function (name) { return allLoans().filter(function (loan) { return normalize(loan.borrower) === normalize(name); }); },
    guaranteedLoans: function (name) { return allLoans().filter(function (loan) { return (loan.guarantors || []).some(function (guarantor) { return normalize(guarantor) === normalize(name); }); }); },
    toggleBlacklist: function (name) { toggleBlacklist(getPerson(name)); },
    isBlacklisted: function (name) { return isBlacklisted(getPerson(name)); },
    money, dateText, notify };

  function init() {
    bindLists();
    renderSavedRows();
    bindStaticDetails();
    bindWizards();
    bindArchive();
    bindSettings();
    const todayLabel = document.getElementById('today-label');
    if (todayLabel) todayLabel.textContent = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    window.dispatchEvent(new CustomEvent('gemach:local-data-changed', { detail: { loans: data.loans, people: data.people } }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
