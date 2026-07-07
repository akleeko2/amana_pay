/**
 * Nova Gadgets — Middleware كوكيز بسيط (بلا تبعية خارجية)
 * -----------------------------------------------------------------------------
 * يوفّر req.cookies (قراءة) و res.cookie(name, value, opts) (كتابة) بأقل
 * تنفيذ ممكن، كافٍ لتتبّع سلة الزائر بدون أي تسجيل دخول أو بيانات هوية.
 */
'use strict';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function cookieMiddleware(req, res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  res.cookie = (name, value, opts = {}) => {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    parts.push(`Path=${opts.path || '/'}`);
    if (opts.httpOnly) parts.push('HttpOnly');
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`);
    const prev = res.getHeader('Set-Cookie');
    const arr = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
    arr.push(parts.join('; '));
    res.setHeader('Set-Cookie', arr);
  };
  next();
}

module.exports = cookieMiddleware;
