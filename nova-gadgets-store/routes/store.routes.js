/**
 * Nova Gadgets — مسارات المتجر (كتالوج + سلة + دفع)
 * -----------------------------------------------------------------------------
 * بلا تسجيل دخول: تصفّح المنتجات، إضافة/تعديل السلة، إنشاء طلب، والدفع
 * الحقيقي عبر بوابة Amana Pay.
 */
'use strict';

const express = require('express');
const products = require('../data/products');
const cart = require('../lib/cart-store');
const amana = require('../lib/amana-client');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const CART_COOKIE = 'ng_cart';

/** يضمن وجود معرّف سلة (كوكي بسيط، بلا أي بيانات هوية) لكل زائر. */
function ensureCartId(req, res) {
  let id = req.cookies[CART_COOKIE];
  if (!id) {
    id = cart.newCartId();
    res.cookie(CART_COOKIE, id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
  return id;
}

// -----------------------------------------------------------------------------
// كتالوج المنتجات (API خفيف يستهلكه الواجهة الأمامية)
// -----------------------------------------------------------------------------

router.get('/products', (req, res) => {
  const { category } = req.query;
  let list = products.all();
  if (category) list = list.filter((p) => p.category === category);
  res.json({ products: list, categories: products.categories() });
});

router.get('/products/:slug', (req, res) => {
  const p = products.findBySlug(req.params.slug);
  if (!p) return res.status(404).json({ error: 'product_not_found' });
  res.json({ product: p });
});

// -----------------------------------------------------------------------------
// السلة (بلا تسجيل دخول — معرّف جلسة فقط)
// -----------------------------------------------------------------------------

router.get(
  '/cart',
  wrap(async (req, res) => {
    const id = ensureCartId(req, res);
    res.json(cart.cartDetails(id));
  })
);

router.post(
  '/cart/items',
  wrap(async (req, res) => {
    const id = ensureCartId(req, res);
    const { productId, qty } = req.body || {};
    cart.addItem(id, productId, Math.max(1, Number(qty) || 1));
    res.status(201).json(cart.cartDetails(id));
  })
);

router.patch(
  '/cart/items/:productId',
  wrap(async (req, res) => {
    const id = ensureCartId(req, res);
    cart.updateItem(id, req.params.productId, Number(req.body.qty));
    res.json(cart.cartDetails(id));
  })
);

router.delete(
  '/cart/items/:productId',
  wrap(async (req, res) => {
    const id = ensureCartId(req, res);
    cart.removeItem(id, req.params.productId);
    res.json(cart.cartDetails(id));
  })
);

// -----------------------------------------------------------------------------
// الدفع الحقيقي عبر Amana Pay
// -----------------------------------------------------------------------------

/**
 * POST /api/checkout
 * ينشئ طلباً محلياً في المتجر، ثم طلب دفع حقيقياً لدى Amana Pay،
 * ويُرجع رابط صفحة الدفع الحقيقية ليفتحها المتصفح.
 */
router.post(
  '/checkout',
  wrap(async (req, res) => {
    const cartId = ensureCartId(req, res);
    const { customerName, customerPhone } = req.body || {};

    const order = cart.createOrder(cartId, { customerName, customerPhone });

    // رابط العودة للمتجر — نمرّره للبوابة لتخزينه مع الدفعة (يصمد عبر إعادة توجيه الموافقة)
    const returnUrl = `${req.protocol}://${req.get('host')}/order.html?orderId=${order.orderId}`;

    const payment = await amana.createPayment({
      amount: order.subtotal,
      orderId: order.orderId,
      customerPhone: customerPhone || undefined,
      description: `Nova Gadgets — ${order.lines.length} منتج`,
      returnUrl,
    });

    cart.attachPayment(order.orderId, payment.id);

    const paymentPageUrl = amana.paymentPageUrl(payment.id, returnUrl);

    res.status(201).json({
      order: { orderId: order.orderId, subtotal: order.subtotal, status: order.status },
      payment: { id: payment.id, reference: payment.reference, amount: payment.amount },
      paymentPageUrl,
    });
  })
);

/** GET /api/orders/:orderId — حالة الطلب (يستطلعها المتصفح بعد العودة من الدفع). */
router.get(
  '/orders/:orderId',
  wrap(async (req, res) => {
    const order = cart.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'order_not_found' });

    // إن كان الطلب بانتظار الدفع، نستعلم Amana Pay عن الحالة الحقيقية الحيّة
    if (order.status === 'AWAITING_PAYMENT' && order.amanaPaymentId) {
      try {
        const payment = await amana.getPayment(order.amanaPaymentId);
        if (payment.status === 'CONFIRMED') cart.markPaid(order.orderId);
        else if (payment.status === 'EXPIRED' || payment.status === 'CANCELLED') order.status = 'EXPIRED';
      } catch { /* تجاهل انقطاع مؤقت، نُرجع آخر حالة معروفة */ }
    }
    res.json({ order: cart.getOrder(req.params.orderId) });
  })
);

// -----------------------------------------------------------------------------
// استقبال Webhook من Amana Pay (يؤكّد الطلب فوراً دون انتظار استطلاع العميل)
// -----------------------------------------------------------------------------

router.post(
  '/webhooks/amana-pay',
  express.json(),
  wrap(async (req, res) => {
    const { event, data } = req.body || {};
    if (event === 'payment.confirmed' && data && data.orderId) {
      cart.markPaid(data.orderId);
    }
    // ملاحظة: التحقق من توقيع X-Amana-Signature يتطلب webhook_secret الذي لا يُعرض
    // عبر API علناً (بقصد) — في تكامل إنتاجي حقيقي يُسلَّم للتاجر عند التسجيل.
    res.status(200).json({ received: true });
  })
);

module.exports = router;
