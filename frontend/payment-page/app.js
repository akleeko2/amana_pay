/* Amana Pay — Payment Page logic */
(function () {
  'use strict';

  const API = '/api/v1';
  const qs = new URLSearchParams(location.search);
  const paymentId = qs.get('id') || qs.get('payment') || qs.get('paymentId');

  let lang = localStorage.getItem('ap_lang') || 'ar';
  let payment = null;
  let timerInt = null;
  let pollInt = null;
  let ws = null;
  let pendingConsent = null; // { consentId, phone }

  const $ = (id) => document.getElementById(id);
  const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || key;
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('langToggle').textContent = lang === 'ar' ? 'EN' : 'ع';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (window.I18N[lang][k]) el.textContent = window.I18N[lang][k];
    });
    if (payment) renderDynamic();
  }

  $('langToggle').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('ap_lang', lang);
    applyLang();
  });

  // ---------- state switching ----------
  const STATES = ['loading', 'error', 'pending', 'processing', 'confirmed', 'expired'];
  function show(state) {
    STATES.forEach((s) => $('state-' + s).classList.toggle('hidden', s !== state));
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  // ---------- load ----------
  async function load() {
    if (!paymentId) {
      show('error');
      $('error-msg').textContent = 'Missing payment id (?id=...)';
      return;
    }
    try {
      const res = await fetch(`${API}/payment-page/${paymentId}`);
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      payment = data.payment;
      route();
    } catch {
      show('error');
      $('error-msg').textContent = lang === 'ar' ? 'الطلب غير موجود' : 'Request not found';
    }
  }

  function route() {
    if (!payment) return;
    switch (payment.status) {
      case 'CONFIRMED': return renderConfirmed();
      case 'EXPIRED': return show('expired');
      case 'CANCELLED': show('expired'); return;
      case 'PROCESSING': renderPending(); return;
      default: renderPending();
    }
  }

  // ---------- pending ----------
  function renderPending() {
    show('pending');
    renderDynamic();
    startTimer();
    connectLive();
    handleConsentReturn();
  }

  // عند العودة من شاشة الموافقة المستقلة (?consent=granted|denied)
  function handleConsentReturn() {
    const c = qs.get('consent');
    if (!c) return;
    if (c === 'granted' && payment.tier === 'VERIFIED') {
      $('identify-hint').textContent = payment.customerName
        ? fmt(t('welcomeBack'), { name: payment.customerName })
        : t('fundsOk');
      revealInstructions();
      toast(t('fundsOk'));
    } else if (payment.expected_debtor_phone || payment.tier) {
      // رُفضت الموافقة → نتابع عبر Express
      $('identify-hint').textContent = t('expressHint');
      revealInstructions();
    }
  }

  function renderDynamic() {
    if (!payment) return;
    const name = payment.accountName || payment.cliqAlias || '—';
    $('merchant-name').textContent = name;
    $('merchant-initial').textContent = (name[0] || 'M').toUpperCase();
    $('merchant-bank').textContent = payment.bankName || '';
    const pill = $('tier-pill');
    const verified = payment.tier === 'VERIFIED';
    pill.textContent = verified ? t('tierVerified') : t('tierExpress');
    pill.className = 'badge ' + (verified ? 'VERIFIED' : 'EXPRESS');

    $('amount').innerHTML = `${Number(payment.amount).toFixed(3)} <span class="cur">JOD</span>`;
    $('original-note').textContent = fmt(t('originalNote'), { amt: Number(payment.originalAmount).toFixed(3) });
    $('cliq-alias').textContent = payment.cliqAlias || '—';
    $('amount-copy').textContent = Number(payment.amount).toFixed(3);
    $('reference').textContent = payment.reference || '—';
  }

  // ---------- identify (Express / Verified) ----------
  $('identify-btn').addEventListener('click', identify);
  $('phone-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') identify(); });

  async function identify() {
    const phone = $('phone-input').value.trim();
    if (!/^07\d{8}$/.test(phone)) {
      $('identify-hint').textContent = t('invalidPhone');
      return;
    }
    $('identify-btn').disabled = true;
    try {
      const res = await fetch(`${API}/payment-page/${paymentId}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.tier === 'VERIFIED' && data.reused) {
        payment.tier = 'VERIFIED';
        payment.customerName = data.customerName;
        $('identify-hint').textContent =
          fmt(t('welcomeBack'), { name: data.customerName }) + ' · ' + (data.fundsAvailable ? t('fundsOk') : t('fundsLow'));
        revealInstructions();
      } else {
        // Express متاح؛ نعرض خيار الربط لمرة واحدة عبر نافذة الموافقة
        pendingConsent = { consentId: data.consentOption && data.consentOption.consentId, phone };
        $('identify-hint').textContent = t('expressHint');
        revealInstructions();
        if (pendingConsent.consentId) openConsentModal();
      }
    } catch {
      $('identify-hint').textContent = lang === 'ar' ? 'تعذّر التحقق' : 'Verification failed';
    } finally {
      $('identify-btn').disabled = false;
    }
  }

  function revealInstructions() {
    $('identify-block').classList.add('hidden');
    $('instructions-block').classList.remove('hidden');
    renderDynamic();
  }

  // ---------- consent modal ----------
  function openConsentModal() {
    $('consent-bank-name').textContent = (payment.bankName || 'Bank');
    $('consent-modal').classList.remove('hidden');
  }
  function closeConsentModal() { $('consent-modal').classList.add('hidden'); }
  $('consent-deny').addEventListener('click', closeConsentModal);
  $('consent-approve').addEventListener('click', () => {
    // تدفق OAuth حقيقي: التوجّه لشاشة الموافقة المستقلة ثم العودة لصفحة الدفع
    if (!pendingConsent || !pendingConsent.consentId) return closeConsentModal();
    const ret = `${location.origin}${location.pathname}?id=${encodeURIComponent(paymentId)}`;
    const url =
      `/consent/index.html?consentId=${encodeURIComponent(pendingConsent.consentId)}` +
      `&subject=${encodeURIComponent(pendingConsent.phone)}` +
      `&bank=${encodeURIComponent(payment.bankName || '')}` +
      `&paymentId=${encodeURIComponent(paymentId)}` +
      `&return=${encodeURIComponent(ret)}`;
    location.href = url;
  });

  // ---------- copy buttons ----------
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = $(btn.getAttribute('data-copy'));
      const text = target ? target.textContent.trim() : '';
      try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
      btn.classList.add('copied');
      btn.innerHTML = (window.APIcon ? window.APIcon('check', 17) : '✓');
      toast(t('copied'));
      setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = (window.APIcon ? window.APIcon('copy', 17) : '⧉'); }, 1200);
    });
  });

  // ---------- timer ----------
  function startTimer() {
    clearInterval(timerInt);
    const end = new Date(payment.expiresAt).getTime();
    const tick = () => {
      const left = end - Date.now();
      const el = $('timer');
      if (left <= 0) {
        clearInterval(timerInt);
        el.textContent = '00:00';
        payment.status = 'EXPIRED';
        show('expired');
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      el.classList.toggle('urgent', left < 60000);
    };
    tick();
    timerInt = setInterval(tick, 1000);
  }

  // ---------- simulate ----------
  $('simulate-btn').addEventListener('click', async () => {
    $('simulate-btn').disabled = true;
    show('processing');
    try {
      await fetch(`${API}/demo/simulate-payment/${paymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // النتيجة ستصل عبر WebSocket؛ نستطلع احتياطاً
      pollStatus();
    } catch {
      $('simulate-btn').disabled = false;
      renderPending();
    }
  });

  // ---------- live updates ----------
  function connectLive() {
    // WebSocket
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', channel: `payment:${paymentId}` }));
      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.channel !== `payment:${paymentId}`) return;
        if (msg.type === 'payment.confirmed') { payment = Object.assign(payment || {}, msg.data); renderConfirmed(); }
        else if (msg.type === 'payment.expired') { show('expired'); }
        else if (msg.type === 'payment.processing') { show('processing'); }
      };
    } catch { /* fallback polling فقط */ }
    // استطلاع احتياطي كل 3 ثوان
    clearInterval(pollInt);
    pollInt = setInterval(pollStatus, 3000);
  }

  async function pollStatus() {
    try {
      const res = await fetch(`${API}/payment-page/${paymentId}/status`);
      const s = await res.json();
      if (s.status === 'CONFIRMED') {
        const full = await fetch(`${API}/payment-page/${paymentId}`).then((r) => r.json());
        payment = full.payment;
        renderConfirmed();
      } else if (s.status === 'EXPIRED' || s.status === 'CANCELLED') {
        show('expired');
        cleanup();
      }
    } catch { /* تجاهل */ }
  }

  // ---------- confirmed ----------
  function renderConfirmed() {
    cleanup();
    show('confirmed');
    $('confirmed-detail').textContent = fmt(t('confirmedDetail'), {
      amt: Number(payment.amount).toFixed(3),
      ref: payment.reference,
    });
    const box = $('match-info');
    box.innerHTML = '';
    const factors = payment.matchFactors || [];
    factors.forEach((f) => {
      const chip = document.createElement('div');
      chip.className = 'factor-chip';
      const label = f.factor === 'SENDER_IDENTITY' ? t('matchVerified') : `${f.factor} (${f.weight})`;
      chip.innerHTML = `<span class="row" style="gap:6px"><span class="icon">${window.APIcon ? window.APIcon('check', 15) : ''}</span>${label}</span><span class="src">${f.source || ''}</span>`;
      box.appendChild(chip);
    });
    fireConfetti();

    // زر العودة للمتجر (اختياري): يظهر فقط إذا مرّر المتجر ?return=<url>
    const returnUrl = qs.get('return') || qs.get('returnUrl');
    const backBtn = $('return-store-btn');
    if (returnUrl && backBtn) {
      backBtn.href = returnUrl;
      backBtn.classList.remove('hidden');
    }
  }

  function cleanup() {
    clearInterval(timerInt);
    clearInterval(pollInt);
    if (ws) { try { ws.close(); } catch {} ws = null; }
  }

  // ---------- confetti ----------
  function fireConfetti() {
    const colors = ['#4f8cff', '#7c5cff', '#2fe0a8', '#ffc857'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('span');
      c.style.cssText = `position:fixed;top:-10px;left:${Math.random() * 100}vw;width:8px;height:12px;background:${colors[i % 4]};z-index:100;border-radius:2px;pointer-events:none;opacity:0.9;`;
      document.body.appendChild(c);
      const dur = 1500 + Math.random() * 1500;
      c.animate(
        [{ transform: `translateY(0) rotate(0)`, opacity: 1 }, { transform: `translateY(105vh) rotate(${Math.random() * 720}deg)`, opacity: 0.3 }],
        { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)' }
      ).onfinish = () => c.remove();
    }
  }

  // ---------- boot ----------
  applyLang();
  show('loading');
  load();
})();
