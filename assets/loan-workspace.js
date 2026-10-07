/* Borrower files, repayment register, and local email receipt drafts. */
(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const api = () => window.gemachApp;
  const money = value => api().money(value);
  const value = text => text ? esc(text) : '<span class="workspace-missing">לא הוזן</span>';
  let currentLoan = null;
  let currentPerson = null;
  let lastReceipt = null;

  function view(id) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('section');
      node.className = 'view workspace-view';
      node.id = id;
      document.querySelector('main.content').appendChild(node);
    }
    return node;
  }

  function activate(id, navId) {
    window.showView(id);
    document.querySelectorAll('[data-target="' + navId + '"]').forEach(node => node.classList.add('active'));
  }

  function metric(label, amount, extra = '') {
    return '<div class="workspace-metric"><span>' + esc(label) + '</span><strong>' + esc(amount) + '</strong>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</div>';
  }

  function fact(label, text) {
    return '<div class="workspace-fact"><span>' + esc(label) + '</span><strong>' + value(text) + '</strong></div>';
  }

  function displayName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') + ' ' + parts[0] : name;
  }

  function renderPerson(name) {
    currentPerson = name;
    const person = api().getPerson(name);
    const loans = api().personLoans(name);
    const guaranteed = api().guaranteedLoans(name);
    const total = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const balance = loans.reduce((sum, loan) => sum + loan.balance, 0);
    const open = loans.filter(loan => loan.balance > 0).length;
    const card = loan => '<button type="button" class="workspace-loan-link" data-loan="' + esc(loan.number) + '"><span><strong>הלוואה #' + esc(loan.number) + '</strong><small>' + esc(loan.purpose || 'מטרת ההלוואה לא צוינה') + ' · להחזרה ' + esc(loan.due) + '</small></span><span class="workspace-loan-values"><b>' + esc(money(loan.balance)) + '</b><small>יתרה מתוך ' + esc(money(loan.amount)) + '</small></span></button>';
    const node = view('view-person-workspace');
    node.innerHTML = '<div class="workspace-header"><div class="workspace-heading"><button type="button" class="workspace-back" data-back="people">→ לווים וערבים</button><div><span class="workspace-kicker">תיק איש קשר · ' + (person.role === 'guarantor' ? 'ערב' : 'לווה') + '</span><h2>' + esc(displayName(name)) + '</h2></div>' + (person.blacklisted ? '<span class="workspace-warning">רשימה שחורה</span>' : '') + '</div><div class="workspace-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-person">עריכת פרטים</button><button type="button" class="btn btn-ghost btn-sm" data-action="blacklist">' + (person.blacklisted ? 'הסר מרשימה שחורה' : 'סמן ברשימה שחורה') + '</button></div></div>' +
      '<div class="workspace-scroll"><div class="workspace-metrics">' + metric('הלוואות', loans.length, open === 1 ? 'אחת פתוחה' : open + ' פתוחות') + metric('סך שניתן', money(total)) + metric('הוחזר עד כה', money(total - balance)) + metric('יתרה פתוחה', money(balance)) + '</div>' +
      '<div class="workspace-columns"><div class="workspace-stack"><section class="workspace-panel"><div class="workspace-panel-title"><h3>פרטי זיהוי וקשר</h3><span>ניתן לעדכן את הפרטים לפי הצורך</span></div><div class="workspace-facts">' +
      fact('תעודת זהות', person.idnum) + fact('טלפון נייד', person.phone) + fact('טלפון נוסף', person.homePhone) + fact('דואר אלקטרוני', person.email) + fact('כתובת', person.address) + fact('דרך קשר מועדפת', person.contactPreference) + fact('איש קשר חלופי', person.alternateContact) + fact('טלפון איש קשר חלופי', person.alternatePhone) + '</div></section>' +
      '<section class="workspace-panel"><div class="workspace-panel-title"><h3>רקע וקשרים</h3></div><div class="workspace-facts">' + fact('בן או בת זוג', person.spouse) + fact('תעודת זהות בן או בת זוג', person.spouseId) + fact('מקום עבודה', person.work) + fact('טלפון בעבודה', person.workPhone) + fact('הופנה על ידי', person.referrer) + fact('קשר ראשוני', person.relationship) + '</div><div class="workspace-notes"><span>הערות פנימיות</span><p>' + value(person.notes) + '</p></div></section></div>' +
      '<div class="workspace-stack"><section class="workspace-panel"><div class="workspace-panel-title"><h3>הלוואות והחזרים</h3><span>' + (loans.length === 1 ? 'רשומה אחת' : loans.length + ' רשומות') + '</span></div><div class="workspace-loan-list">' + (loans.length ? loans.map(card).join('') : '<p class="workspace-empty">אין הלוואות לאיש קשר זה.</p>') + '</div></section>' +
      '<section class="workspace-panel"><div class="workspace-panel-title"><h3>ערבויות</h3><span>' + (guaranteed.length === 1 ? 'רשומה אחת' : guaranteed.length + ' רשומות') + '</span></div><div class="workspace-loan-list">' + (guaranteed.length ? guaranteed.map(card).join('') : '<p class="workspace-empty">לא רשומות ערבויות.</p>') + '</div></section></div></div></div>';
    activate(node.id, 'view-people');
  }

  function renderLoan(number) {
    currentLoan = Number(number);
    const loan = api().getLoan(number);
    if (!loan) { api().notify('ההלוואה לא נמצאה.'); return; }
    const person = api().getPerson(loan.borrower);
    const paid = Math.max(0, loan.amount - loan.balance);
    const knownPayments = loan.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const previous = Math.max(0, paid - knownPayments);
    const state = loan.balance === 0 ? 'הוחזרה במלואה' : loan.due && new Date(loan.due.split('.').reverse().join('-')) < new Date().setHours(0,0,0,0) ? 'באיחור' : 'פתוחה';
    const ledger = (previous ? '<div class="workspace-payment"><div><strong>החזרים קודמים</strong><small>יתרה קיימת לפני תחילת רישום התנועות</small></div><b>' + esc(money(previous)) + '</b></div>' : '') +
      loan.payments.map(payment => '<div class="workspace-payment"><div><strong>' + esc(payment.date) + ' · ' + esc(payment.method) + '</strong><small>' + esc([payment.reference && 'אסמכתא ' + payment.reference, payment.notes].filter(Boolean).join(' · ') || 'החזר שנרשם במערכת') + '</small></div><b>' + esc(money(payment.amount)) + '</b><button type="button" class="workspace-text-button" data-receipt="' + esc(payment.id) + '">אישור</button></div>').join('');
    const node = view('view-loan-workspace');
    node.innerHTML = '<div class="workspace-header"><div class="workspace-heading"><button type="button" class="workspace-back" data-back="loans">→ הלוואות</button><div><span class="workspace-kicker">תיק הלוואה #' + esc(loan.number) + '</span><h2>' + esc(displayName(loan.borrower)) + '</h2></div><span class="workspace-state">' + esc(state) + '</span></div><div class="workspace-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="person">תיק לווה</button>' + (loan.balance > 0 ? '<button type="button" class="btn btn-primary btn-sm" data-action="full">אישור החזר מלא</button>' : '') + '</div></div>' +
      '<div class="workspace-scroll"><div class="workspace-metrics">' + metric('סכום שניתן', money(loan.amount)) + metric('הוחזר עד כה', money(paid)) + metric('יתרה להחזר', money(loan.balance)) + metric('מועד החזרה', loan.due || 'לא נקבע') + '</div><div class="workspace-columns workspace-loan-columns"><div class="workspace-stack"><section class="workspace-panel"><div class="workspace-panel-title"><h3>פרטי ההלוואה</h3></div><div class="workspace-facts">' + fact('מספר הלוואה', '#' + loan.number) + fact('תאריך מתן', loan.issued) + fact('מועד החזרה', loan.due) + fact('מטרת ההלוואה', loan.purpose) + fact('לווה', displayName(loan.borrower)) + fact('טלפון', person.phone) + fact('כתובת', person.address) + fact('ערבים', (loan.guarantors || []).map(displayName).join(' · ')) + '</div></section>' +
      '<section class="workspace-panel"><div class="workspace-panel-title"><h3>הסדר ומסמכים</h3><button type="button" class="workspace-text-button" data-action="edit-loan">עריכה</button></div><div class="workspace-facts">' + fact('אופן ההחזר שסוכם', loan.repaymentArrangement) + fact('מספר תשלומים', loan.installments) + fact('הסכם הלוואה', loan.agreementSigned) + fact('שטר חוב', loan.noteSigned) + fact('אישור ערבים', loan.guarantorApproval) + fact('בטוחה / תנאי נוסף', loan.collateral) + fact('תאריך קשר אחרון', loan.lastContact) + '</div><div class="workspace-notes"><span>הערות למעקב</span><p>' + value(loan.followupNotes) + '</p></div></section>' +
      '<section class="workspace-panel"><div class="workspace-panel-title"><h3>תנועות והחזרים</h3><span>' + (loan.payments.length === 1 ? 'תנועה אחת' : loan.payments.length + ' תנועות') + '</span></div><div class="workspace-payments">' + (ledger || '<p class="workspace-empty">עדיין לא נרשמו החזרים.</p>') + '</div></section></div>' +
      '<div class="workspace-stack"><section class="workspace-panel workspace-form-panel"><div class="workspace-panel-title"><h3>רישום החזר</h3><span>מעדכן את היתרה מיד עם האישור</span></div>' + (loan.balance > 0 ? '<form id="workspace-repayment-form"><div class="workspace-shortcuts"><button type="button" class="workspace-chip active" data-amount="partial">החזר חלקי</button><button type="button" class="workspace-chip" data-amount="full">החזר מלא</button></div><div class="workspace-form-grid"><label>סכום שהוחזר<input name="amount" type="number" min="0.01" max="' + esc(loan.balance) + '" step="0.01" inputmode="decimal" required placeholder="₪"></label><label>תאריך קבלת ההחזר<input name="date" type="date" required></label><label>אמצעי תשלום<select name="method"><option>העברה בנקאית</option><option>מזומן</option><option>צ׳ק</option><option>אחר</option></select></label><label>מספר אסמכתא<input name="reference" type="text" placeholder="לא חובה"></label></div><label class="workspace-wide-field">הערה פנימית<textarea name="notes" rows="2" placeholder="למשל: מי קיבל את התשלום"></textarea></label><p class="workspace-form-help">האישור יוצר תנועת החזר במכשיר זה ומעדכן את יתרת ההלוואה.</p><button type="submit" class="btn btn-primary">אישור ורישום ההחזר</button></form>' : '<div class="workspace-complete">ההלוואה הוחזרה במלואה. ניתן להציג אישורים מהתנועות הרשומות.</div>') + '</section><section class="workspace-panel workspace-mail-panel"><h3>אישור בדואר אלקטרוני</h3><p>לאחר רישום החזר אפשר להכין נוסח אישור עם סכום ההלוואה, ההחזרים והיתרה. ההודעה מוצגת כאן להעתקה; בשלב זה אין שליחת מייל.</p><div>כתובת הלווה: <strong>' + value(person.email) + '</strong></div></section></div></div></div><div class="workspace-receipt" hidden></div>';
    const dateInput = $('[name="date"]', node);
    if (dateInput) dateInput.value = new Date().toLocaleDateString('sv-SE');
    activate(node.id, 'view-loans');
  }

  function editPerson() {
    const person = api().getPerson(currentPerson);
    const fields = [
      ['idnum','תעודת זהות'], ['phone','טלפון נייד'], ['homePhone','טלפון נוסף'], ['email','דואר אלקטרוני'],
      ['address','כתובת'], ['contactPreference','דרך קשר מועדפת'], ['alternateContact','איש קשר חלופי'], ['alternatePhone','טלפון איש קשר חלופי'], ['spouse','בן או בת זוג'], ['spouseId','תעודת זהות בן או בת זוג'],
      ['work','מקום עבודה'], ['workPhone','טלפון בעבודה'], ['referrer','הופנה על ידי']
    ];
    const overlay = document.createElement('div');
    overlay.className = 'workspace-overlay';
    overlay.innerHTML = '<div class="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title"><div class="workspace-dialog-head"><h3 id="profile-edit-title">עריכת פרטי ' + esc(displayName(currentPerson)) + '</h3><button type="button" data-close aria-label="סגירה">×</button></div><form id="workspace-profile-form"><div class="workspace-form-grid">' + fields.map(([key,label]) => '<label>' + esc(label) + '<input name="' + key + '" type="' + (key === 'email' ? 'email' : 'text') + '" value="' + esc(person[key]) + '"></label>').join('') + '</div><label class="workspace-wide-field">הערות פנימיות<textarea name="notes" rows="3">' + esc(person.notes) + '</textarea></label><div class="workspace-dialog-actions"><button type="button" class="btn btn-ghost" data-close>ביטול</button><button type="submit" class="btn btn-primary">שמירת פרטים</button></div></form></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-close]')) overlay.remove(); });
    $('#workspace-profile-form', overlay).addEventListener('submit', event => {
      event.preventDefault();
      const result = Object.fromEntries(new FormData(event.currentTarget).entries());
      if (!api().saveProfile(currentPerson, result)) return;
      overlay.remove();
      renderPerson(currentPerson);
      api().notify('פרטי איש הקשר נשמרו במכשיר זה.');
    });
  }

  function editLoan() {
    const loan = api().getLoan(currentLoan);
    if (!loan) return;
    const fields = [
      ['repaymentArrangement','אופן ההחזר שסוכם'], ['installments','מספר תשלומים'],
      ['agreementSigned','הסכם הלוואה'], ['noteSigned','שטר חוב'],
      ['guarantorApproval','אישור ערבים'], ['collateral','בטוחה / תנאי נוסף'],
      ['lastContact','תאריך קשר אחרון']
    ];
    const overlay = document.createElement('div');
    overlay.className = 'workspace-overlay';
    overlay.innerHTML = '<div class="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="loan-edit-title"><div class="workspace-dialog-head"><h3 id="loan-edit-title">מעקב הלוואה #' + esc(loan.number) + '</h3><button type="button" data-close aria-label="סגירה">×</button></div><form id="workspace-loan-edit-form"><div class="workspace-form-grid">' + fields.map(([key,label]) => '<label>' + esc(label) + '<input name="' + key + '" type="' + (key === 'lastContact' ? 'date' : key === 'installments' ? 'number' : 'text') + '" value="' + esc(loan[key]) + '"></label>').join('') + '</div><label class="workspace-wide-field">הערות למעקב<textarea name="followupNotes" rows="3">' + esc(loan.followupNotes) + '</textarea></label><div class="workspace-dialog-actions"><button type="button" class="btn btn-ghost" data-close>ביטול</button><button type="submit" class="btn btn-primary">שמירת מעקב</button></div></form></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-close]')) overlay.remove(); });
    $('#workspace-loan-edit-form', overlay).addEventListener('submit', event => {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
      if (!api().saveLoanDetails(currentLoan, fields)) return;
      overlay.remove();
      renderLoan(currentLoan);
      api().notify('פרטי המעקב נשמרו במכשיר זה.');
    });
  }

  function receiptText(loan, payment) {
    const person = api().getPerson(loan.borrower);
    const priorPaid = Math.max(0, loan.amount - loan.balance - loan.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    let runningPaid = priorPaid;
    for (const item of loan.payments) {
      runningPaid += Number(item.amount || 0);
      if (item.id === payment.id) break;
    }
    const paid = payment.totalPaidAfter === undefined ? runningPaid : payment.totalPaidAfter;
    const balanceAfter = payment.balanceAfter === undefined ? Math.max(0, loan.amount - paid) : payment.balanceAfter;
    return 'נושא: אישור קבלת החזר להלוואה #' + loan.number + '\n' +
      'אל: ' + (person.email || 'יש להשלים כתובת דואר אלקטרוני') + '\n\n' +
      'שלום ' + displayName(loan.borrower) + ',\n\n' +
      'אנו מאשרים כי התקבל החזר עבור הלוואה #' + loan.number + '.\n' +
      'סכום ההלוואה המקורי: ' + money(loan.amount) + '\n' +
      'החזר זה: ' + money(payment.amount) + ' בתאריך ' + payment.date + '\n' +
      'אמצעי תשלום: ' + payment.method + (payment.reference ? '\nאסמכתא: ' + payment.reference : '') + '\n' +
      'סך שהוחזר עד כה: ' + money(paid) + '\n' +
      'יתרה להחזר: ' + money(balanceAfter) + '\n\n' +
      'בברכה, גמ״ח קהילתי\n\n' +
      'טיוטת אישור בלבד — ההודעה לא נשלחה.';
  }

  function showReceipt(paymentId) {
    const loan = api().getLoan(currentLoan);
    const payment = loan && loan.payments.find(item => item.id === paymentId);
    if (!payment) return;
    lastReceipt = receiptText(loan, payment);
    const container = $('.workspace-receipt', view('view-loan-workspace'));
    container.hidden = false;
    container.innerHTML = '<div class="workspace-receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><div class="workspace-dialog-head"><div><span class="workspace-kicker">טיוטה בלבד · לא נשלח מייל</span><h3 id="receipt-title">אישור החזר להלוואה #' + esc(loan.number) + '</h3></div><button type="button" data-close-receipt aria-label="סגירה">×</button></div><pre>' + esc(lastReceipt) + '</pre><div class="workspace-dialog-actions"><button type="button" class="btn btn-ghost" data-close-receipt>סגירה</button><button type="button" class="btn btn-primary" data-copy-receipt>העתקת נוסח האישור</button></div></div>';
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-loan], [data-back], [data-action], [data-amount], [data-receipt], [data-close-receipt], [data-copy-receipt]');
    if (!target) return;
    if (target.dataset.loan) return renderLoan(target.dataset.loan);
    if (target.dataset.back) return window.showView(target.dataset.back === 'people' ? 'view-people' : 'view-loans');
    if (target.dataset.action === 'edit-person') return editPerson();
    if (target.dataset.action === 'edit-loan') return editLoan();
    if (target.dataset.action === 'blacklist') { api().toggleBlacklist(currentPerson); return renderPerson(currentPerson); }
    if (target.dataset.action === 'person') return renderPerson(api().getLoan(currentLoan).borrower);
    if (target.dataset.action === 'full' || target.dataset.amount === 'full') {
      const loan = api().getLoan(currentLoan);
      const form = $('#workspace-repayment-form');
      if (loan && form) { form.elements.amount.value = loan.balance; form.elements.amount.focus(); form.scrollIntoView({ block: 'nearest' }); }
    }
    if (target.dataset.amount === 'partial') { const form = $('#workspace-repayment-form'); if (form) { form.elements.amount.value = ''; form.elements.amount.focus(); } }
    if (target.dataset.amount) document.querySelectorAll('.workspace-chip').forEach(chip => chip.classList.toggle('active', chip === target));
    if (target.dataset.receipt) return showReceipt(target.dataset.receipt);
    if (target.hasAttribute('data-close-receipt')) { const receipt = target.closest('.workspace-receipt'); if (receipt) receipt.hidden = true; }
    if (target.hasAttribute('data-copy-receipt')) {
      navigator.clipboard.writeText(lastReceipt || '').then(() => api().notify('נוסח האישור הועתק. המייל לא נשלח.'), () => api().notify('לא ניתן להעתיק בדפדפן זה. ניתן לבחור את הנוסח ידנית.'));
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'workspace-repayment-form') return;
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    const loan = api().getLoan(currentLoan);
    const amount = Number(values.amount);
    if (!loan || !Number.isFinite(amount) || amount <= 0 || amount > loan.balance) { api().notify('יש להזין סכום חיובי שאינו גבוה מהיתרה.'); form.elements.amount.focus(); return; }
    const result = api().recordRepayment(currentLoan, values);
    if (!result) { api().notify('לא ניתן לרשום את ההחזר. בדקו את התאריך והסכום.'); return; }
    renderLoan(currentLoan);
    showReceipt(result.payment.id);
    api().notify('ההחזר נרשם והיתרה עודכנה. הוכנה טיוטת אישור למייל.');
  });

  window.gemachWorkspace = { showPerson: renderPerson, showLoan: renderLoan };
})();
