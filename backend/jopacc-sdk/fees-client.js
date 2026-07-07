/**
 * Amana Pay — Mock Fees Client
 * -----------------------------------------------------------------------------
 * يحاكي: GET /institution/fees/SSTs?service=...
 * يرجع { data: [{ feeId, service, feeCategory, serviceChannel, fees:[{feeType, feeAmount:{amount,currency}}] }] }
 *
 * تنويه: الخدمة محصورة بـ SSTs حالياً؛ قيمة service=CLIQ مدعومة كمثال
 * لكن تغطية رسوم CliQ الفعلية ستتوفر عند توسّع الخدمة.
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders } = require('./_helpers');

/** GET /institution/fees/SSTs — مع فلترة اختيارية بحقل service. */
async function getServiceFees(service, opts = {}) {
  const all = store.fees.data || [];
  const data = service ? all.filter((f) => f.service && f.service.startsWith(service)) : all;
  return {
    headers: buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ service })['x-jws-signature'] }),
    data,
    _links: { self: { href: '/institution/fees/SSTs', method: 'GET' } },
  };
}

/** اختصار لرسوم CliQ (service=CLIQ). */
async function getCliQFees(opts = {}) {
  return getServiceFees('CLIQ', opts);
}

module.exports = { getServiceFees, getCliQFees };
