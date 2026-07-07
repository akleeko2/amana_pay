/* Nova Gadgets — صفحة حالة الطلب: تستطلع GET /api/orders/:id حتى التأكيد */
(function () {
  'use strict';

  const root = document.getElementById('order-root');
  if (!root) return;

  const { api, money } = window.NGStore;

  let pollTimer = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 40; // ~2 دقيقة بمعدل كل 3 ثواني

  function renderPaid(order) {
    root.innerHTML = `
      <div class="order-icon"><span class="icon" data-icon="checkCircle" data-icon-size="34"></span></div>
      <h2>تم الدفع بنجاح!</h2>
      <p class="muted">رقم الطلب: <span class="num">${order.orderId}</span></p>
      <p class="muted">المبلغ المدفوع: <span class="num">${money(order.subtotal)} JOD</span></p>
      <a href="/" class="btn btn-brand" style="margin-top:20px;display:inline-flex">
        <span class="icon" data-icon="arrowLeft" data-icon-size="16"></span> متابعة التسوّق
      </a>`;
    window.NGIcons.hydrate(root);
  }

  function renderExpired(order) {
    root.innerHTML = `
      <div class="order-icon pending"><span class="icon" data-icon="x" data-icon-size="30"></span></div>
      <h2>انتهت صلاحية الطلب</h2>
      <p class="muted">لم تكتمل عملية الدفع لرقم الطلب <span class="num">${order.orderId}</span> في الوقت المحدد.</p>
      <a href="/" class="btn btn-outline" style="margin-top:20px;display:inline-flex">عودة للمتجر</a>`;
    window.NGIcons.hydrate(root);
  }

  function renderPending(order) {
    root.innerHTML = `
      <div class="order-icon pending"><span class="icon" data-icon="info" data-icon-size="30"></span></div>
      <h2>بانتظار تأكيد الدفع…</h2>
      <p class="muted">رقم الطلب: <span class="num">${order.orderId}</span> — سنحدّث الصفحة تلقائياً فور تأكيد الدفع عبر Amana Pay.</p>`;
    window.NGIcons.hydrate(root);
  }

  function renderNotFound() {
    root.innerHTML = `
      <div class="order-icon pending"><span class="icon" data-icon="x" data-icon-size="30"></span></div>
      <h2>الطلب غير موجود</h2>
      <p class="muted">تعذّر العثور على هذا الطلب.</p>
      <a href="/" class="btn btn-outline" style="margin-top:20px;display:inline-flex">عودة للمتجر</a>`;
    window.NGIcons.hydrate(root);
  }

  async function poll(orderId) {
    attempts += 1;
    try {
      const data = await api('GET', `/orders/${orderId}`);
      const order = data.order;
      if (order.status === 'PAID') { renderPaid(order); return; }
      if (order.status === 'EXPIRED' || order.status === 'CANCELLED') { renderExpired(order); return; }
      renderPending(order);
      if (attempts < MAX_ATTEMPTS) {
        pollTimer = setTimeout(() => poll(orderId), 3000);
      } else {
        renderExpired(order);
      }
    } catch {
      renderNotFound();
    }
  }

  const orderId = new URLSearchParams(location.search).get('orderId');
  if (!orderId) renderNotFound();
  else poll(orderId);

  window.addEventListener('beforeunload', () => clearTimeout(pollTimer));
})();
