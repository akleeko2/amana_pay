/**
 * Amana Pay — Central Configuration
 * -----------------------------------------------------------------------------
 * مصدر الحقيقة الوحيد لإعدادات التطبيق. القيم المتعلقة بـ JoPACC Open Finance
 * مستخرجة مباشرة من OpenAPI Specs الموجودة في `sdks/jopacc-open-finance/`.
 *
 * المراجع:
 *  - api-catalog.json (12 إدخالاً، v0.4.3 لمعظم الخدمات، JWE v3.0.1)
 *  - openapi-specs/*.json (المسارات، أنظمة الأمان، الهيدرات الإلزامية)
 */
'use strict';

const path = require('path');
require('dotenv').config();

const env = process.env;
const toBool = (v, d = false) => (v == null ? d : String(v).toLowerCase() === 'true');
const toNum = (v, d) => (v == null || v === '' ? d : Number(v));

// -----------------------------------------------------------------------------
// عام
// -----------------------------------------------------------------------------
const server = {
  port: toNum(env.PORT, 4000),
  host: env.HOST || '0.0.0.0',
  nodeEnv: env.NODE_ENV || 'development',
  // مسار الواجهات الثابتة (تُقدَّم من نفس الخادم في البروتوتايب)
  frontendDir: path.resolve(__dirname, '..', '..', 'frontend'),
};

const database = {
  // ملف SQLite (node:sqlite المدمج)
  file: env.DB_FILE || path.resolve(__dirname, '..', 'database', 'amana_pay.db'),
  schemaFile: path.resolve(__dirname, '..', 'database', 'schema.sql'),
};

// -----------------------------------------------------------------------------
// JoPACC Open Finance SDK — مرجع كامل من OpenAPI Specs
// -----------------------------------------------------------------------------
const GATEWAY_ROOT = env.JOPACC_GATEWAY_ROOT
  || 'https://jpcjofsdev.apigw-az-eu.webmethods.io/gateway';

const jopacc = {
  // وضع التشغيل: 'mock' (بروتوتايب) أو 'live' (عند الانتقال للإنتاج)
  mode: env.JOPACC_MODE || 'mock',
  gatewayRoot: GATEWAY_ROOT,

  // إصدارات الخدمات كما في api-catalog.json
  versions: {
    default: 'v0.4.3',
    jwe: 'v3.0.1',
  },

  // عناوين الأساس لكل خدمة (من حقل servers.url في كل spec)
  baseUrls: {
    accounts: `${GATEWAY_ROOT}/Accounts/v0.4.3`,
    balances: `${GATEWAY_ROOT}/Balances/v0.4.3`,
    beneficiaries: `${GATEWAY_ROOT}/Beneficiaries/v0.4.3`,
    branches: `${GATEWAY_ROOT}/Branches/v0.4.3`,
    caf: `${GATEWAY_ROOT}/Confirmation%20of%20Availability%20of%20Funds/v0.4.3`,
    fees: `${GATEWAY_ROOT}/Fees/v0.4.3`,
    financialInstitutions: `${GATEWAY_ROOT}/Financial%20Institutions/v0.4.3`,
    fx: `${GATEWAY_ROOT}/Foreign%20Exchange%20%28FX%29/v0.4.3`,
    ibanConfirmation: `${GATEWAY_ROOT}/IBAN%20Confirmation/v0.4.3`,
    jades: `${GATEWAY_ROOT}/JAdES%20-%20JSON%20Advanced%20Electronic%20Signature%20Level%20B-B/v0.4.3`,
    jwe: `${GATEWAY_ROOT}/JWE%20-%20JSON%20Web%20Encryption/v3.0.1`,
  },

  // المسارات الفعلية (paths) المستخرجة من المواصفات
  endpoints: {
    accounts: { list: '/accounts', getOne: '/accounts/{accountAddress}' },
    balances: { get: '/accounts/{accountId}/balances' },
    beneficiaries: {
      list: '/accounts/{accountId}/beneficiaries',
      getOne: '/accounts/{accountId}/beneficiaries/{beneficiaryId}',
    },
    branches: { list: '/institution/branches', getOne: '/institution/branches/{branchId}' },
    caf: { create: '/accounts/{accountId}/CAF' }, // POST
    fees: { ssts: '/institution/fees/SSTs' },
    financialInstitutions: { get: '/institution' },
    fx: {
      list: '/institution/FXs',
      byCurrency: '/institution/FXs/{targetCurrency}',
      quote: '/institution/FXs/quote',
      quoteById: '/institution/FXs/quote/{quoteId}',
    },
    ibanConfirmation: { get: '/institution/ibanConf' },
    jades: { generate: '/generateJAdESBB', verify: '/verifyJAdESBB', publicKey: '/publicKey' },
    jwe: { generate: '/generateJWE', verify: '/verifyJWE', publicKey: '/publicKey' },
  },

  // أنظمة الأمان كما في securitySchemes بكل spec
  security: {
    apiKeyHeader: 'x-Gateway-APIKey', // type: apiKey
    httpBasicAuth: true, // type: http basic
    apiKey: env.JOPACC_API_KEY || 'mock-gateway-api-key',
    basicUser: env.JOPACC_BASIC_USER || 'mock-user',
    basicPass: env.JOPACC_BASIC_PASS || 'mock-pass',
  },

  // الهيدرات الإلزامية المشتركة عبر خدمات JOF
  requiredHeaders: [
    'Authorization',
    'x-interactions-id',
    'x-idempotency-key',
    'x-jws-signature', // توقيع JAdES (RS256)
  ],
  optionalHeaders: ['x-financial-id', 'x-auth-date', 'x-customer-id', 'x-customer-ip-address', 'x-customer-user-agent'],

  // خوارزميات التوقيع/التشفير كما في مواصفتَي JAdES و JWE
  crypto: {
    jadesAlg: 'RS256',
    jweAlg: 'RSA-OAEP-256',
    jweEnc: 'A256GCM',
  },
};

// -----------------------------------------------------------------------------
// محرك المطابقة — أوزان وعتبات (مطابقة لـ matching.service في الخطة)
// -----------------------------------------------------------------------------
const matching = {
  // وضع Full: العوامل الأساسية (Express) مجموعها 100
  fullWeights: {
    DYNAMIC_AMOUNT: 35,
    REFERENCE: 25,
    TIME_WINDOW: 15,
    MERCHANT_ACCOUNT: 10,
    STATUS: 5,
    BALANCE_CHANGE: 10,
  },
  // وضع Balance-Only (اليوم): دلتا الرصيد + النافذة الزمنية
  balanceOnlyWeights: {
    BALANCE_DELTA_MATCH: 70,
    TIME_WINDOW: 30,
  },
  thresholds: {
    confirmExpress: 75, // تأكيد دون موافقة عميل (العوامل الأساسية وحدها)
    confirmVerified: 60, // عتبة مخفّضة عند تطابق هوية المرسل
    review: 50,
  },
  amountToleranceJOD: 0.001, // فلس واحد
  timeWindowMs: 30 * 60 * 1000, // 30 دقيقة
  pollIntervalMs: toNum(env.POLL_INTERVAL_MS, 15000), // 15 ثانية
};

// -----------------------------------------------------------------------------
// طلبات الدفع
// -----------------------------------------------------------------------------
const payments = {
  currency: 'JOD',
  expiryMs: toNum(env.PAYMENT_EXPIRY_MS, 30 * 60 * 1000), // 30 دقيقة
  // المبلغ الديناميكي: يضيف كسراً فريداً 0.001 - 0.099
  dynamicFractionMin: 1,
  dynamicFractionMax: 99,
  dynamicFractionDivisor: 1000,
  referencePrefix: 'AP',
};

// -----------------------------------------------------------------------------
// نموذج الربح (Business Model) — SaaS مشترك + رسوم حركة عند تجاوز السقف
// -----------------------------------------------------------------------------
// ثلاث باقات: اشتراك شهري ثابت + سقف حركات مطابَقة مجانية + رسوم للحركة الإضافية.
// النموذج غير احتجازي (Non-Custodial): الأموال تذهب مباشرة لحساب التاجر.
const plans = {
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    name_ar: 'المتاجر الناشئة',
    monthlyFee: 15, // د.أ / شهرياً
    matchingFee: 'dynamic_fraction', // رسم المطابقة = الكسر الديناميكي الذي دفعه المشتري
    unlimited: false,
    erpIntegration: false,
    targetAr: 'الصفحات الصغيرة والمشاريع المنزلية (Instagram)',
  },
  GROWTH: {
    code: 'GROWTH',
    name: 'Growth',
    name_ar: 'النمو',
    monthlyFee: 25,
    matchingFee: 'dynamic_fraction',
    unlimited: false,
    erpIntegration: false,
    popular: true,
    targetAr: 'المتاجر الإلكترونية المتوسطة والمستقرة',
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    name_ar: 'الشركات',
    monthlyFee: 70,
    matchingFee: 'included', // بلا رسوم مطابقة — مشمولة بالاشتراك (Unlimited + ERP)
    unlimited: true,
    erpIntegration: true, // ربط مباشر مع نظام المحاسبة (ERP)
    targetAr: 'الشركات الكبيرة (سلاسل، توصيل، معارض إلكترونيات)',
  },
};

const billing = {
  plans,
  defaultPlan: env.DEFAULT_PLAN || 'GROWTH',
  // نموذج الرسوم: رسم المطابقة لكل حركة مؤكّدة = الكسر الديناميكي الذي دفعه المشتري
  // (بالضبط بالفلس)، عدا Enterprise (مشمول). لا تمسّ حركة الأموال (Non-Custodial).
  matchingFeeModel: 'dynamic_fraction',
  // التكلفة المتغيرة (COGS): استعلام Open Finance لكل حركة مطابَقة
  costPerApiQueryJOD: toNum(env.COGS_PER_TX, 0.005), // 5 فلس
  chargeOnlyConfirmed: true, // الرسوم تُحسب على الحركات المؤكدة فقط
};

// -----------------------------------------------------------------------------
// الموافقة (Consent) — نموذج AIS طويل الأمد قابل لإعادة الاستخدام
// -----------------------------------------------------------------------------
const consent = {
  validityDays: toNum(env.CONSENT_VALIDITY_DAYS, 90),
  permissions: ['AccountInfo', 'Balances', 'Transactions'],
  reusableAcrossMerchants: true,
};

// حالات موحّدة (مرجع للخدمات والـ schema)
const enums = {
  paymentStatus: ['PENDING', 'PROCESSING', 'CONFIRMED', 'REVIEW', 'EXPIRED', 'CANCELLED', 'FAILED'],
  paymentTier: ['EXPRESS', 'VERIFIED'],
  plan: ['STARTER', 'GROWTH', 'ENTERPRISE'],
  matchMode: ['BALANCE_ONLY', 'FULL'],
  matchStatus: ['UNMATCHED', 'MATCHED', 'REVIEW'],
  consentStatus: ['none', 'pending', 'authorized', 'revoked', 'expired'],
  webhookEvents: ['payment.confirmed', 'payment.expired', 'payment.failed', 'payment.review'],
};

module.exports = {
  server,
  database,
  jopacc,
  matching,
  payments,
  billing,
  consent,
  enums,
};
