/* Amana Pay — Merchant Dashboard logic */
(function () {
  'use strict';

  const API = '/api/v1';
  let lang = localStorage.getItem('ap_lang') || 'ar';
  let apiKey = localStorage.getItem('ap_key') || '';
  let merchant = null;
  let ws = null;
  let currentPage = 'overview';

  const $ = (id) => document.getElementById(id);
  const t = (k) => (window.I18N[lang] && window.I18N[lang][k]) || k;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => Number(n || 0).toFixed(3);

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error((data && data.desc) || 'error'), { status: res.status, data });
    return data;
  }

  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n'); if (window.I18N[lang][k]) el.textContent = window.I18N[lang][k];
    });
    [$('auth-lang'), $('app-lang')].forEach((b) => { if (b) b.textContent = lang === 'ar' ? 'EN' : 'ع'; });
    if (merchant && !$('app').classList.contains('hidden')) renderPage(currentPage);
  }
  function toggleLang() { lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('ap_lang', lang); applyLang(); }
  $('auth-lang').addEventListener('click', toggleLang);
  $('app-lang').addEventListener('click', toggleLang);

  // ---------- auth ----------
  document.querySelectorAll('.auth-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tabs .tab').forEach((x) => x.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.getAttribute('data-tab');
      $('tab-login').classList.toggle('hidden', which !== 'login');
      $('tab-register').classList.toggle('hidden', which !== 'register');
    });
  });

  $('login-btn').addEventListener('click', async () => {
    const key = $('login-key').value.trim();
    if (!key) return;
    apiKey = key;
    try {
      const me = await api('GET', '/merchants/me');
      merchant = me.merchant;
      localStorage.setItem('ap_key', apiKey);
      enterApp();
    } catch {
      apiKey = '';
      $('login-err').textContent = lang === 'ar' ? 'مفتاح غير صالح' : 'Invalid key';
    }
  });

  $('reg-btn').addEventListener('click', async () => {
    $('reg-err').textContent = '';
    const payload = {
      name: $('reg-name').value.trim(),
      email: $('reg-email').value.trim(),
      lookupValue: $('reg-lookup').value.trim(),
      lookupSchema: $('reg-schema').value,
    };
    if (!payload.name || !payload.email || !payload.lookupValue) {
      $('reg-err').textContent = lang === 'ar' ? 'يرجى تعبئة الحقول' : 'Please fill all fields';
      return;
    }
    try {
      const res = await api('POST', '/merchants/register', payload);
      apiKey = res.apiKey;
      merchant = res.merchant;
      localStorage.setItem('ap_key', apiKey);
      const box = $('reg-key-box'); box.classList.remove('hidden');
      $('reg-key').textContent = res.apiKey;
      setTimeout(enterApp, 1600);
    } catch (e) {
      $('reg-err').textContent = (e.data && e.data.desc) || (lang === 'ar' ? 'تعذّر التسجيل' : 'Registration failed');
    }
  });

  $('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('ap_key'); apiKey = ''; merchant = null;
    if (ws) { try { ws.close(); } catch {} ws = null; }
    $('app').classList.add('hidden'); $('auth-screen').classList.remove('hidden');
  });

  function enterApp() {
    $('auth-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('merchant-label').textContent = `${merchant.name} · ${merchant.bank_name || ''}`;
    connectLive();
    renderPage('overview');
  }

  // ---------- navigation ----------
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
      item.classList.add('active');
      renderPage(item.getAttribute('data-page'));
    });
  });

  async function renderPage(page) {
    currentPage = page;
    $('page-title').textContent = t('nav' + page.charAt(0).toUpperCase() + page.slice(1)) ||
      ({ overview: t('navOverview'), payments: t('navPayments'), transactions: t('navTx'), billing: t('navBilling'), settings: t('navSettings') }[page]);
    const c = $('page-content');
    c.innerHTML = '<div class="spinner-sm"></div>';
    try {
      if (page === 'overview') return renderOverview(c);
      if (page === 'payments') return renderPayments(c);
      if (page === 'transactions') return renderTransactions(c);
      if (page === 'billing') return renderBilling(c);
      if (page === 'settings') return renderSettings(c);
    } catch (e) {
      c.innerHTML = `<div class="empty">${esc((e.data && e.data.desc) || 'Error')}</div>`;
    }
  }

  function setOfStatus(connected) {
    $('of-led').classList.toggle('off', !connected);
    $('of-text').textContent = connected ? t('ofConnected') : t('ofDisconnected');
  }

  // ---------- Overview ----------
  async function renderOverview(c) {
    const ov = await api('GET', '/dashboard/overview');
    const chart = await api('GET', '/dashboard/chart?days=7');
    setOfStatus(ov.openFinance.connected);
    const k = ov.cards;
    const maxCount = Math.max(1, ...chart.series.map((s) => s.count));
    const bars = chart.series.map((s) => {
      const h = Math.round((s.count / maxCount) * 130);
      const d = new Date(s.date).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en', { weekday: 'short' });
      return `<div class="bar-col"><div class="bar" style="height:${h}px" title="${s.count}"></div><span class="lbl">${esc(d)}</span></div>`;
    }).join('');

    c.innerHTML = `
      <div class="cards">
        <div class="stat-card glass"><div class="label">${t('cardTotal')}</div><div class="value">${k.total}</div></div>
        <div class="stat-card glass"><div class="label">${t('cardConfirmed')}</div><div class="value green">${k.confirmed}</div></div>
        <div class="stat-card glass"><div class="label">${t('cardPending')}</div><div class="value amber">${k.pending}</div></div>
        <div class="stat-card glass"><div class="label">${t('cardVolume')}</div><div class="value">${money(k.confirmedVolume)}</div></div>
      </div>
      <div class="panel glass"><h2>${t('chart7')}</h2><div class="chart">${bars}</div></div>
      <div class="panel glass">
        <h2>${t('recentPayments')} <button class="btn btn-primary" id="ov-new">${t('btnNew')}</button></h2>
        ${paymentsTable(ov.recentPayments)}
      </div>`;
    $('ov-new').addEventListener('click', openNewPayment);
    bindPaymentRowActions();
  }

  // ---------- Payments ----------
  async function renderPayments(c) {
    const res = await api('GET', '/payments');
    c.innerHTML = `<div class="panel glass">
      <h2>${t('allPayments')} <button class="btn btn-primary" id="pg-new">${t('btnNew')}</button></h2>
      ${paymentsTable(res.payments)}</div>`;
    $('pg-new').addEventListener('click', openNewPayment);
    bindPaymentRowActions();
  }

  function paymentsTable(list) {
    if (!list || !list.length) return `<div class="empty">${t('empty')}</div>`;
    const rows = list.map((p) => `
      <tr>
        <td class="mono" data-label="${t('colDate')}">${new Date(p.confirmedAt || Date.now()).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en')}</td>
        <td class="mono" data-label="${t('colReference')}">${esc(p.reference)}</td>
        <td class="mono" data-label="${t('colAmount')}">${money(p.amount)} <span class="muted">JOD</span></td>
        <td data-label="${t('colTier')}"><span class="badge ${p.tier}">${p.tier}</span></td>
        <td data-label="${t('colStatus')}"><span class="badge ${p.status}">${p.status}</span></td>
        <td class="mono" data-label="${t('colScore')}">${p.confidenceScore != null ? p.confidenceScore : '—'}</td>
        <td class="row-actions" data-label="">
          <button class="icon-btn" data-link="${esc(p.id)}" title="${t('copyLink')}">${window.APIcon ? window.APIcon('link', 15) : '↗'}</button>
          ${['PENDING', 'PROCESSING'].includes(p.status) ? `<button class="icon-btn" data-cancel="${esc(p.id)}" title="${t('cancelPay')}">${window.APIcon ? window.APIcon('x', 15) : '×'}</button>` : ''}
        </td>
      </tr>`).join('');
    return `<div class="table-wrap"><table class="stacked">
      <thead><tr><th>${t('colDate')}</th><th>${t('colReference')}</th><th>${t('colAmount')}</th><th>${t('colTier')}</th><th>${t('colStatus')}</th><th>${t('colScore')}</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function bindPaymentRowActions() {
    document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', async () => {
      const link = `${location.origin}/payment-page/index.html?id=${b.getAttribute('data-link')}`;
      try { await navigator.clipboard.writeText(link); } catch {}
      toast(t('linkCopied'));
    }));
    document.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      await api('POST', `/payments/${b.getAttribute('data-cancel')}/cancel`, {});
      toast(t('cancelled')); renderPage(currentPage);
    }));
  }

  // ---------- Transactions ----------
  async function renderTransactions(c) {
    const res = await api('GET', '/dashboard/transactions');
    if (!res.transactions.length) { c.innerHTML = `<div class="panel glass"><h2>${t('txLog')}</h2><div class="empty">${t('empty')}</div></div>`; return; }
    const cards = res.transactions.map((x) => {
      const matched = x.match_status === 'MATCHED';
      const factors = (x.match_factors || []).map((f) => `<span class="chip">${esc(f.factor)}</span>`).join('');
      const row = (k, v) => `<div class="tx-row"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;
      return `<div class="tx-card">
        <div class="tx-head">
          <span class="tx-amount num">+${money(x.amount)} <span class="cur">JOD</span></span>
          <span class="badge ${matched ? 'CONFIRMED' : 'PENDING'}">${esc(x.match_status)}</span>
        </div>
        <div class="tx-rows">
          ${row(t('colDate'), new Date(x.received_at).toLocaleString(lang === 'ar' ? 'ar-JO' : 'en'))}
          ${row(t('colReference'), esc(x.reference || '—'))}
          ${row(t('colDebtor'), esc(x.debtor_iban || '—'))}
          ${row(t('colDetect'), esc(x.detection_source || '—'))}
        </div>
        ${factors ? `<div class="tx-factors"><span class="muted tiny">${t('colFactors')}</span><div class="factors">${factors}</div></div>` : ''}
      </div>`;
    }).join('');
    c.innerHTML = `<div class="panel glass"><h2>${t('txLog')}</h2><div class="tx-list">${cards}</div></div>`;
  }

  // ---------- Billing ----------
  async function renderBilling(c) {
    const s = await api('GET', '/stats');
    const b = s.billing;
    const planLabel = lang === 'ar' ? b.planNameAr : b.planName;
    const feeModel = b.feeApplies ? t('feeModelFraction') : t('feeModelIncluded');
    c.innerHTML = `
      <div class="cards">
        <div class="stat-card glass"><div class="label">${t('currentPlan')}</div><div class="value">${planLabel}</div></div>
        <div class="stat-card glass"><div class="label">${t('confirmedCount')}</div><div class="value green">${b.confirmedCount}</div></div>
        <div class="stat-card glass"><div class="label">${t('matchingFeesDue')}</div><div class="value">${money(b.matchingFeesDue)}</div></div>
        <div class="stat-card glass"><div class="label">${t('totalDue')}</div><div class="value amber">${money(b.totalDue)}</div></div>
      </div>
      <div class="panel glass">
        <h2>${t('billingTitle')}</h2>
        <div class="setting-row"><span class="k">${t('currentPlan')}</span><span class="v">${planLabel} — ${b.monthlyFee} JOD/${t('perMonth')}</span></div>
        <div class="setting-row"><span class="k">${t('matchingFeeModel')}</span><span class="v">${feeModel}</span></div>
        <div class="setting-row"><span class="k">${t('confirmedCount')}</span><span class="v">${b.confirmedCount}</span></div>
        <div class="setting-row"><span class="k">${t('avgFeePerTx')}</span><span class="v">${b.feeApplies ? money(b.avgFeePerTx) + ' JOD' : '—'}</span></div>
        <div class="setting-row"><span class="k">${t('subscriptionDue')}</span><span class="v">${money(b.subscriptionDue)} JOD</span></div>
        <div class="setting-row"><span class="k">${t('matchingFeesDue')}</span><span class="v">${money(b.matchingFeesDue)} JOD</span></div>
        <div class="setting-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px"><span class="k"><b>${t('totalDue')}</b></span><span class="v"><b>${money(b.totalDue)} JOD</b></span></div>
        <p class="muted small" style="margin-top:14px">${t('billingNote')}</p>
      </div>`;
  }

  // ---------- Settings ----------
  async function renderSettings(c) {
    const s = await api('GET', '/dashboard/settings');
    const a = s.account;
    const row = (k, v) => `<div class="setting-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
    c.innerHTML = `<div class="panel glass"><h2>${t('accountInfo')}</h2>
      ${row(t('bank'), a.bankName)}
      ${row(t('iban'), a.iban)}
      ${row(t('cliq'), a.cliqAlias || '—')}
      ${row(t('accType'), a.accountType)}
      ${row(t('accStatus'), a.accountStatus)}
      ${row(t('acceptsCredit'), a.lockedForCredit ? t('no') : t('yes'))}
      ${row(t('webhookUrl'), s.webhook.url || '—')}
      ${row(t('apiKeyLabel'), apiKey)}
    </div>`;
  }

  // ---------- New payment modal ----------
  function openNewPayment() {
    $('np-amount').value = ''; $('np-order').value = ''; $('np-phone').value = '';
    $('np-result').classList.add('hidden'); $('np-result').innerHTML = '';
    $('new-payment-modal').classList.remove('hidden');
  }
  $('np-cancel').addEventListener('click', () => $('new-payment-modal').classList.add('hidden'));
  var npTop = $('new-pay-top'); if (npTop) npTop.addEventListener('click', openNewPayment);
  $('np-create').addEventListener('click', async () => {
    const amount = parseFloat($('np-amount').value);
    if (!(amount > 0)) return;
    try {
      const res = await api('POST', '/payments', {
        amount,
        orderId: $('np-order').value.trim() || undefined,
        customerPhone: $('np-phone').value.trim() || undefined,
      });
      const p = res.payment;
      const link = `${location.origin}/payment-page/index.html?id=${p.id}`;
      const box = $('np-result'); box.classList.remove('hidden');
      box.innerHTML = `<p class="muted small">${t('paymentCreated')} — ${esc(p.reference)} · ${money(p.amount)} JOD</p>
        <code>${esc(link)}</code>
        <button class="btn btn-soft btn-block" id="np-copy" style="margin-top:10px">${t('copyLink')}</button>`;
      $('np-copy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); } catch {}
        $('new-payment-modal').classList.add('hidden');
        toast(t('linkCopied'));
      });
      toast(t('paymentCreated'));
    } catch (e) {
      toast((e.data && e.data.desc) || 'Error');
    }
  });

  // ---------- live ----------
  function connectLive() {
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', channel: `merchant:${merchant.id}` }));
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.channel === `merchant:${merchant.id}` && m.type === 'payment.confirmed') {
          toast(t('cardConfirmed'));
          if (['overview', 'payments', 'transactions', 'billing'].includes(currentPage)) renderPage(currentPage);
        }
      };
    } catch { /* تجاهل */ }
  }

  // ---------- boot ----------
  applyLang();
  if (apiKey) {
    api('GET', '/merchants/me').then((me) => { merchant = me.merchant; enterApp(); }).catch(() => { localStorage.removeItem('ap_key'); apiKey = ''; });
  }
})();
