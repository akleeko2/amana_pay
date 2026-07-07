/**
 * Nova Gadgets — مخزن السلال والطلبات (في الذاكرة، بلا تسجيل دخول)
 * -----------------------------------------------------------------------------
 * كل زبون يُعرَّف بمعرّف جلسة (cart_id) يُخزَّن في كوكي بسيط. لا يوجد حساب
 * مستخدم ولا كلمة مرور — فقط تصفّح، إضافة للسلة، وشراء.
 */
'use strict';

const crypto = require('crypto');
const products = require('../data/products');

const carts = new Map(); // cartId -> [{ productId, qty }]
const orders = new Map(); // orderId -> order

function newCartId() {
  return 'cart_' + crypto.randomBytes(12).toString('hex');
}

function getCart(cartId) {
  return carts.get(cartId) || [];
}

function addItem(cartId, productId, qty = 1) {
  if (!products.findById(productId)) {
    const e = new Error('منتج غير موجود');
    e.status = 404;
    throw e;
  }
  const items = carts.get(cartId) || [];
  const existing = items.find((i) => i.productId === productId);
  if (existing) existing.qty += qty;
  else items.push({ productId, qty });
  carts.set(cartId, items);
  return items;
}

function updateItem(cartId, productId, qty) {
  const items = carts.get(cartId) || [];
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx === -1) return items;
  if (qty <= 0) items.splice(idx, 1);
  else items[idx].qty = qty;
  carts.set(cartId, items);
  return items;
}

function removeItem(cartId, productId) {
  return updateItem(cartId, productId, 0);
}

function clearCart(cartId) {
  carts.set(cartId, []);
}

/** يحسب تفاصيل السلة (المنتجات + الكميات + المجموع) للعرض والدفع. */
function cartDetails(cartId) {
  const items = getCart(cartId);
  const lines = items
    .map((i) => {
      const p = products.findById(i.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        nameAr: p.nameAr,
        image: p.image,
        price: p.price,
        qty: i.qty,
        lineTotal: Number((p.price * i.qty).toFixed(3)),
      };
    })
    .filter(Boolean);
  const subtotal = Number(lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(3));
  return { lines, subtotal, count: lines.reduce((s, l) => s + l.qty, 0) };
}

/** إنشاء طلب شراء محلي في المتجر (قبل ربطه بدفعة Amana Pay). */
function createOrder(cartId, { customerName, customerPhone }) {
  const details = cartDetails(cartId);
  if (!details.lines.length) {
    const e = new Error('السلة فاضية');
    e.status = 400;
    throw e;
  }
  const orderId = 'NG-' + Date.now().toString(36).toUpperCase();
  const order = {
    orderId,
    cartId,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    lines: details.lines,
    subtotal: details.subtotal,
    status: 'AWAITING_PAYMENT', // AWAITING_PAYMENT | PAID | EXPIRED | CANCELLED
    amanaPaymentId: null,
    createdAt: new Date().toISOString(),
  };
  orders.set(orderId, order);
  return order;
}

function getOrder(orderId) {
  return orders.get(orderId);
}

function attachPayment(orderId, amanaPaymentId) {
  const order = orders.get(orderId);
  if (order) order.amanaPaymentId = amanaPaymentId;
  return order;
}

function markPaid(orderId) {
  const order = orders.get(orderId);
  if (order) {
    order.status = 'PAID';
    order.paidAt = new Date().toISOString();
    // الطلب دُفع؛ نُفرغ السلة المرتبطة به
    clearCart(order.cartId);
  }
  return order;
}

module.exports = {
  newCartId,
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  cartDetails,
  createOrder,
  getOrder,
  attachPayment,
  markPaid,
};
