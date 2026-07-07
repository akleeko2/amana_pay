/* Nova Gadgets — منطق مشترك: السلة، الدرج الجانبي، والدفع الحقيقي عبر Amana Pay */
(function () {
  'use strict';

  const API = '/api';
  const IMG_ICON = {
    'audio-1': 'headphones', 'watch-1': 'watch', 'charger-1': 'bolt', 'lamp-1': 'lamp',
    'keyboard-1': 'keyboard', 'webcam-1': 'camera', 'speaker-1': 'speaker', 'stand-1': 'stand',
  };
  const $ = (id) => document.getElementById(id);
  const imageSrc = (image) => `/images/products/${image}.svg`;
  const money = (n) => Number(n || 0).toFixed(3);

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'error'), { status: res.status, data });
    return data;
  }

  function toast(msg) {
    let el = document.getElementById('ng-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'ng-toast'; el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- Cart badge + drawer (present on every page) ----------
  async function refreshCartBadge() {
    try {
      const data = await api('GET', '/cart');
      const badge = document.querySelector('.cart-count');
      if (badge) badge.textContent = data.count || 0;
      return data;
    } catch { return { lines: [], subtotal: 0, count: 0 }; }
  }

  function iconFor(image) { return IMG_ICON[image] || 'headphones'; }

  async function renderDrawer() {
    const body = $('drawer-body');
    const foot = $('drawer-foot');
    if (!body) return;
    const data = await refreshCartBadge();
    if (!data.lines.length) {
      body.innerHTML = `<div class="cart-empty"><div class="icon" data-icon="cart" data-icon-size="46"></div><p>السلة فاضية</p></div>`;
      if (foot) foot.classList.add('hidden');
      window.NGIcons.hydrate(body);
      return;
    }
    if (foot) foot.classList.remove('hidden');
    body.innerHTML = data.lines.map((l) => `
      <div class="cart-line" data-pid="${l.productId}">
        <div class="thumb"><img src="${imageSrc(l.image)}" alt="${l.nameAr}" loading="lazy" /></div>
        <div class="meta">
          <div class="name">${l.nameAr}</div>
          <div class="price num">${money(l.price)} JOD</div>
          <div class="qty-ctrl">
            <button data-act="dec">−</button>
            <span>${l.qty}</span>
            <button data-act="inc">+</button>
          </div>
        </div>
        <button class="rm" data-act="rm" title="حذف"><span class="icon" data-icon="trash" data-icon-size="18"></span></button>
      </div>`).join('');
    window.NGIcons.hydrate(body);
    $('cart-subtotal').textContent = money(data.subtotal) + ' JOD';

    body.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const line = btn.closest('.cart-line');
        const pid = line.getAttribute('data-pid');
        const act = btn.getAttribute('data-act');
        if (act === 'rm') await api('DELETE', `/cart/items/${pid}`);
        else {
          const current = data.lines.find((l) => l.productId === pid).qty;
          const next = act === 'inc' ? current + 1 : current - 1;
          await api('PATCH', `/cart/items/${pid}`, { qty: next });
        }
        renderDrawer();
      });
    });
  }

  function openDrawer() {
    $('cart-drawer').classList.add('open');
    $('drawer-overlay').classList.add('open');
    renderDrawer();
  }
  function closeDrawer() {
    $('cart-drawer').classList.remove('open');
    $('drawer-overlay').classList.remove('open');
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshCartBadge();
    const cartBtn = $('cart-btn'); if (cartBtn) cartBtn.addEventListener('click', openDrawer);
    const closeBtn = $('drawer-close'); if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    const overlay = $('drawer-overlay'); if (overlay) overlay.addEventListener('click', closeDrawer);

    const checkoutBtn = $('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => { closeDrawer(); openCheckoutModal(); });
  });

  // ---------- Add to cart (used by catalog + product page) ----------
  async function addToCart(productId, qty, btnEl) {
    await api('POST', '/cart/items', { productId, qty: qty || 1 });
    await refreshCartBadge();
    toast('تمت الإضافة للسلة');
    if (btnEl) {
      btnEl.classList.add('added');
      const orig = btnEl.innerHTML;
      btnEl.innerHTML = '<span class="icon" data-icon="check" data-icon-size="16"></span> أُضيف';
      window.NGIcons.hydrate(btnEl);
      setTimeout(() => { btnEl.classList.remove('added'); btnEl.innerHTML = orig; window.NGIcons.hydrate(btnEl); }, 1200);
    }
  }
  window.NGAddToCart = addToCart;

  // ---------- Checkout modal (name + phone, then real Amana Pay payment) ----------
  function openCheckoutModal() {
    let modal = document.getElementById('checkout-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkout-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal">
          <h3>إتمام الشراء</h3>
          <p class="muted" style="font-size:13px">الدفع عبر CliQ من خلال بوابة Amana Pay.</p>
          <div class="checkout-summary" id="co-summary"></div>
          <div class="field">
            <label>الاسم (اختياري)</label>
            <input id="co-name" type="text" placeholder="اسمك" />
          </div>
          <div class="field">
            <label>رقم الهاتف (اختياري — لتجربة أسرع لاحقاً)</label>
            <input id="co-phone" type="tel" placeholder="07XXXXXXXX" maxlength="10" />
          </div>
          <p class="err-text" id="co-err"></p>
          <div class="modal-actions">
            <button class="btn btn-outline" id="co-cancel">إلغاء</button>
            <button class="btn btn-brand" id="co-pay">الدفع عبر CliQ</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#co-cancel').addEventListener('click', () => modal.remove());
      modal.querySelector('#co-pay').addEventListener('click', submitCheckout);
    }
    api('GET', '/cart').then((data) => {
      const sum = document.getElementById('co-summary');
      sum.innerHTML = data.lines.map((l) => `<div class="row"><span>${l.nameAr} × ${l.qty}</span><span class="num">${money(l.lineTotal)}</span></div>`).join('')
        + `<div class="row total"><span>الإجمالي</span><span class="num">${money(data.subtotal)} JOD</span></div>`;
    });
  }

  async function submitCheckout() {
    const btn = document.getElementById('co-pay');
    const err = document.getElementById('co-err');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'جارٍ التحويل…';
    try {
      const name = document.getElementById('co-name').value.trim();
      const phone = document.getElementById('co-phone').value.trim();
      const res = await api('POST', '/checkout', { customerName: name || undefined, customerPhone: phone || undefined });
      // تحويل حقيقي لصفحة الدفع الفعلية في Amana Pay
      location.href = res.paymentPageUrl;
    } catch (e) {
      err.textContent = (e.data && e.data.error) || 'تعذّر بدء عملية الدفع، حاول مرة أخرى';
      btn.disabled = false;
      btn.textContent = 'الدفع عبر CliQ';
    }
  }

  window.NGStore = { api, toast, money, iconFor, imageSrc, openCheckoutModal };
})();
