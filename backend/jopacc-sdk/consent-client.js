/**
 * Amana Pay — Mock Consent Client (OAuth/AIS simulation)
 * -----------------------------------------------------------------------------
 * يحاكي طبقة موافقة Open Finance (لا يوجد Consent API ضمن الـ SDKs المنزّلة؛
 * هذه محاكاة لطبقة OAuth/CBJ بنموذج AIS طويل الأمد قابل لإعادة الاستخدام).
 *
 *   initiateConsent(subjectId, permissions, validityDays) → { consentId, redirectUrl, status:'pending' }
 *   authorizeConsent(consentId)  → محاكاة موافقة المستخدم في البنك
 *   getConsentStatus(consentId)  → pending/authorized/revoked/expired
 *   revokeConsent(consentId)
 *   findReusableConsent(subjectId) → موافقة سارية محفوظة (إعادة استخدام صامت)
 *
 * الموافقة مرتبطة بـ subject (تاجر أو عميل) تجاه Amana Pay كـ TPP،
 * وتُعاد استخدامها عبر كل المتاجر طوال الصلاحية (حتى 90 يوماً).
 */
'use strict';

const crypto = require('crypto');
const config = require('../config/config');
const auth = require('./auth-client');

// سجل موافقات في الذاكرة (consent.service يتكفّل بالحفظ الدائم في DB)
const registry = new Map();

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function initiateConsent(subjectId, permissions = config.consent.permissions, validityDays = config.consent.validityDays) {
  const consentId = 'cns_' + crypto.randomUUID();
  const record = {
    consentId,
    subjectId,
    permissions,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: addDays(validityDays),
    accessToken: null,
  };
  registry.set(consentId, record);
  return {
    consentId,
    status: 'pending',
    permissions,
    expiresAt: record.expiresAt,
    redirectUrl: `/consent/index.html?consentId=${consentId}&subject=${encodeURIComponent(subjectId)}`,
  };
}

/** محاكاة موافقة المستخدم داخل بنكه → إصدار access token. */
function authorizeConsent(consentId, { scope } = {}) {
  const rec = registry.get(consentId);
  if (!rec) return null;
  rec.status = 'authorized';
  rec.authorizedAt = new Date().toISOString();
  const { accessToken } = auth.issueToken({
    subject: rec.subjectId,
    scope: scope || rec.permissions,
    ttlSeconds: 60 * 60, // رمز وصول قصير؛ الموافقة نفسها طويلة الأمد
  });
  rec.accessToken = accessToken;
  return { consentId, status: 'authorized', accessToken, expiresAt: rec.expiresAt };
}

function getConsentStatus(consentId) {
  const rec = registry.get(consentId);
  if (!rec) return { consentId, status: 'not_found' };
  if (rec.status === 'authorized' && new Date(rec.expiresAt) < new Date()) rec.status = 'expired';
  return { consentId, status: rec.status, expiresAt: rec.expiresAt, permissions: rec.permissions };
}

function revokeConsent(consentId) {
  const rec = registry.get(consentId);
  if (!rec) return { consentId, status: 'not_found' };
  rec.status = 'revoked';
  return { consentId, status: 'revoked' };
}

/** موافقة سارية قابلة لإعادة الاستخدام لنفس الـ subject (عبر كل المتاجر). */
function findReusableConsent(subjectId) {
  for (const rec of registry.values()) {
    if (
      rec.subjectId === subjectId &&
      rec.status === 'authorized' &&
      new Date(rec.expiresAt) > new Date()
    ) {
      return { consentId: rec.consentId, status: rec.status, accessToken: rec.accessToken, expiresAt: rec.expiresAt, permissions: rec.permissions };
    }
  }
  return null;
}

module.exports = {
  initiateConsent,
  authorizeConsent,
  getConsentStatus,
  revokeConsent,
  findReusableConsent,
  _registry: registry,
};
