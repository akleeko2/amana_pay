# Implementation Plan: Amana Pay

## Overview

قائمة مهام تنفيذ بروتوتايب Amana Pay الكامل بناءً على `implementation_plan.md`. المهام مرتّبة تدريجياً وقابلة للاختبار، وتراعي: الوضعين (Balance-Only / Full)، المستويين (Express / Verified)، الموافقة طويلة الأمد القابلة لإعادة الاستخدام، ونموذج العمولة. مرجع SDK: `sdks/jopacc-open-finance/`.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "description": "البنية التحتية",
      "tasks": ["1.1", "1.2", "1.3", "1.4"]
    },
    {
      "wave": 2,
      "description": "Mock JoPACC SDK (يعتمد على البنية التحتية)",
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"]
    },
    {
      "wave": 3,
      "description": "Core Services (يعتمد على SDK)",
      "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11"]
    },
    {
      "wave": 4,
      "description": "REST API (يعتمد على Services)",
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"]
    },
    {
      "wave": 5,
      "description": "الواجهات (تعتمد على REST API، قابلة للتوازي)",
      "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "7.1", "7.2"]
    },
    {
      "wave": 6,
      "description": "Integration + Polish (يعتمد على الكل)",
      "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"]
    }
  ]
}
```

## Tasks

### المرحلة 1: البنية التحتية ✅

- [x] 1.1 تهيئة المشروع: `backend/package.json` (express, ws, uuid, dotenv) + `server.js` (Express + HTTP + WebSocket) + `config/config.js` (إعدادات كاملة تعكس الـ SDKs: روابط البوابة، الأمان، الهيدرات، عتبات المطابقة، العمولة، الباقة المجانية).
- [x] 1.2 هيكل المجلدات: `jopacc-sdk/mock-data/`, `services/`, `routes/`, `middleware/`, `database/` تحت backend؛ و`payment-page/`, `dashboard/`, `consent/` تحت frontend.
- [x] 1.3 قاعدة البيانات: `schema.sql` (merchants, customer_consents, payment_requests + `payment_tier` + `expected_debtor_*` nullable + commission, transactions, webhook_deliveries, audit_log) + `db.js` (node:sqlite + تشغيل المخطط + repositories) + `seed.js`.
- [x] 1.4 Middleware: `auth.js` (API Key للتاجر) + `error-handler.js` (أخطاء JSON موحّدة بنمط JoPACC) + `realtime.js` (WebSocket hub).

### المرحلة 2: Mock JoPACC SDK ✅

- [x] 2.1 بيانات وهمية: `banks.json` (7 بنوك أردنية + BIC + cliqSupported)، `accounts.json` (تاجر + 3 عملاء، mainRoute IBAN + routings CLIQ + accountType + lockedFor*)، `transactions.json`، `fees.json` (CLIQ + ATM). + `_store.js` (مخزن قابل للتغيير) + `_helpers.js`.
- [x] 2.2 `auth-client.js`: x-Gateway-APIKey + HTTP Basic Auth + issueToken/introspect + buildHeaders (الهيدرات الإلزامية).
- [x] 2.3 `jades-client.js`: sign (RS256 + canonical مرتّب → x-jws-signature) + verify + getPublicKey (مفاتيح RSA حقيقية).
- [x] 2.4 `jwe-client.js`: encrypt/decrypt حقيقي (RSA-OAEP-256 + A256GCM، JWE compact 5 أجزاء).
- [x] 2.5 `accounts-client.js`: getAccount(IBAN/accountId/CLIQ) + listAccounts ({data}+_links)؛ بلا اسم صاحب الحساب.
- [x] 2.6 `balances-client.js`: availableBalance/currentBalance.balanceAmount + balanceCurrency + lastModificationDate.
- [x] 2.7 `transactions-client.js`: listTransactions + getTransaction + injectTransaction (debtorAccount/creditorAccount).
- [x] 2.8 `caf-client.js`: checkFunds → {fundsAvailable, validityDateTime, instructionAmount}.
- [x] 2.9 `iban-client.js`: confirmIBAN({accountId, accountType[إلزامي], uidType, uidValue}) → status/lockedFor*/accountOwner.name/institutionBasicInfo (بلا accountType في الخرج).
- [x] 2.10 `fees-client.js`: getServiceFees(service) + getCliQFees (تنويه SST-scoped).
- [x] 2.11 `consent-client.js`: initiate/authorize/getStatus/revoke + findReusableConsent (طويل الأمد، إعادة استخدام صامت).
- [x] 2.12 `institutions-client.js`: getInstitution (/institution) + listBanks.
- [x] 2.13 `jopacc-sdk/index.js`: تصدير موحّد لكل الـ clients. *(تم التحقق: 29/29 اختبار دخان ناجح.)*

### المرحلة 3: Core Services ✅

- [x] 3.1 `payment.service.js`: generateDynamicAmount/generateReference (فريدان) + createPayment (pre-check + رسوم + baseline + Express/Verified) + get/list/cancel + toMatchInput + paymentPageView.
- [x] 3.2 `verification.service.js`: verifyMerchantAccount (IBAN Confirmation: status + lockedForCredit) + baseline؛ يرفض إن lockedForCredit + prePaymentCheck.
- [x] 3.3 `matching.service.js` وضع Full: العوامل الأساسية مجموعها 100.
- [x] 3.4 `matching.service.js` SENDER_IDENTITY معزِّز حاسم (VERIFIED، عتبة 60)، Express ≥ 75؛ {mode, tier, score, decision, senderVerified, factors, apisUsed}.
- [x] 3.5 `matching.service.js` وضع Balance-Only: دلتا الرصيد (70) + النافذة الزمنية (30) + ambiguous→REVIEW.
- [x] 3.6 `polling.service.js` Dual Poller: Balances + Transactions + معالجة الدلتا المتعددة + settle (عمولة+سجل+webhook+بث) + expireOld + start/stop/processOnce.
- [x] 3.7 `consent.service.js`: initiate/authorize + حفظ دائم + findReusable + identityFromConsent + checkCustomerFunds (CAF).
- [x] 3.8 `merchant.service.js`: register (auto-lookup Accounts + الاسم من IBAN Confirmation) + verify + publicView.
- [x] 3.9 `demo.service.js`: simulatePayment (حقن معاملة + تغيير الرصيد + استطلاع فوري).
- [x] 3.10 `webhook.service.js`: dispatch (توقيع HMAC + إعادة محاولة + تسجيل في webhook_deliveries).
- [x] 3.11 `billing.service.js`: computeCommission (CONFIRMED + باقة مجانية) + monthlySummary. *(تم التحقق: 25/25 اختبار تكامل ناجح.)*

### المرحلة 4: REST API ✅

- [x] 4.1 `api.routes.js` (محمي API Key): merchants/register (يُرجع apiKey مرة واحدة) + merchants/me + merchants/verify + consent/initiate + consent/callback.
- [x] 4.2 `api.routes.js` payments: POST/GET/list/:id/cancel (مع pre-payment validation) + transactions + fees + stats (+ billing summary).
- [x] 4.3 `payment-page.routes.js` (عام): GET /payment-page/:id + /status + /identify (Express/Verified + إعادة استخدام صامت + CAF) + /consent-callback.
- [x] 4.4 `dashboard.routes.js`: overview (بطاقات + آخر المدفوعات + حالة Open Finance + الفوترة) + chart + transactions + settings.
- [x] 4.5 `demo.routes.js`: POST /demo/simulate-payment/:paymentId (محصور بوضع mock). *(تم التحقق: 25/25 اختبار HTTP حيّ ناجح.)*

### المرحلة 5: صفحة الدفع (frontend/payment-page) ✅

- [x] 5.1 تصميم Dark + Glassmorphism (orbs متحركة، بطاقة زجاجية)، Mobile-first + RTL، ثنائي اللغة (AR/EN عبر i18n.js).
- [x] 5.2 تعليمات الدفع (CliQ Alias, البنك, المبلغ الديناميكي, المرجع) + أزرار نسخ لكل حقل + toast.
- [x] 5.3 اختيار المستوى Express (مباشر) / Verified (نافذة موافقة لمرة واحدة + إعادة استخدام صامت + عرض CAF) عبر /identify و/consent-callback.
- [x] 5.4 مؤقت عد تنازلي (urgent < دقيقة) + تحديث حي عبر WebSocket + استطلاع احتياطي كل 3 ثوان.
- [x] 5.5 زر محاكاة الدفع (للمقدّم) + أنيميشن تأكيد (رسم checkmark + confetti).
- [x] 5.6 حالات الصفحة: PENDING / PROCESSING / CONFIRMED (مع عوامل المطابقة) / EXPIRED + ERROR. *(تم التحقق: 11/11 — الصفحة تُقدَّم والتدفق الكامل يعمل.)*

### المرحلة 6: Dashboard (frontend/dashboard) ✅

- [x] 6.1 Overview: بطاقات (إجمالي/مؤكدة/معلّقة/الحجم) + رسم 7 أيام + آخر المدفوعات + حالة الربط (LED).
- [x] 6.2 Payments: جدول كامل + إنشاء طلب دفع (نافذة + رابط دفع قابل للنسخ) + إلغاء.
- [x] 6.3 Transactions: سجل المعاملات + عوامل المطابقة (chips) + مصدر الكشف (balances/transactions).
- [x] 6.4 Settings: معلومات الحساب (IBAN/CliQ/البنك/النوع/الحالة/lockedForCredit) + Webhook + API Key.
- [x] 6.5 Billing: بطاقات (مؤكدة/الحجم/العمولة المستحقة/الباقة المجانية) + ملخص شهري + ملاحظة عدم مرور الأموال.
- [x] 6.6 شاشة دخول/تسجيل (API Key أو auto-lookup)، شريط جانبي، WebSocket لتحديث حي، ثنائي اللغة (AR/EN)، Mobile responsive. *(تم التحقق: 15/15 ناجح.)*

### المرحلة 7: Consent Flow + الشاشة البنكية (frontend/consent) ✅

- [x] 7.1 شاشة OAuth Consent مستقلة (نمط بنكي: شعار البنك + شارة أمان + الصلاحيات AccountInfo/Balances/Transactions + حساب مُقنّع + مدة 90 يوماً + إعادة الاستخدام عبر كل المتاجر)، ثنائية اللغة + أنيميشن نجاح.
- [x] 7.2 تدفق الموافقة الكامل: تُصدر `initiate` redirectUrl لـ /consent/index.html؛ الموافقة تُوثّق عبر /merchants/consent/callback ثم تُفعّل Verified على الطلب وتعيد التوجيه لصفحة الدفع (مع معالجة العودة granted/denied). *(تم التحقق: 10/10 — الشاشة تُقدَّم والتدفق الكامل redirect→authorize→Verified→CONFIRMED يعمل.)*

### المرحلة 8: Integration + Polish ✅

- [x] 8.1 ربط كل المكونات: الراوترات الأربعة مركّبة خلف /api/v1، الواجهات تُقدَّم ثابتة، صفحة هبوط `frontend/index.html` تربط الكل، البوّاب يعمل.
- [x] 8.2 اختبار التدفق الكامل (14 خطوة): تسجيل → auto-lookup → IBAN Confirmation → دفع → identify → موافقة → CAF → محاكاة → SENDER_IDENTITY → تأكيد → لوحة → معاملات.
- [x] 8.3 اختبار العميل العائد (صفر redirect): دفعة ثانية auto-VERIFIED + identify reused بلا consentOption + تأكيد.
- [x] 8.4 صقل UX/UI + بيانات الديمو: صفحة هبوط، `seed-demo.js` يطبع روابط جاهزة، سكربتات npm (seed/seed-demo)، README للمشروع.
- [x] 8.5 `docs/API.md`: توثيق Merchant API كامل (مصادقة، تدفقات، كل النقاط، Webhooks، WebSocket). *(تم التحقق: 18/18 تكامل شامل + WebSocket حيّ + seed-demo ناجح.)*

## Notes

معايير القبول (Definition of Done):
- التسجيل يجلب بيانات الحساب آلياً (Accounts) + الاسم (IBAN Confirmation) + يرفض lockedForCredit.
- إنشاء طلب دفع يولّد مبلغاً ديناميكياً فريداً + مرجعاً + يسجّل baseline الرصيد.
- Express يتأكّد بالعوامل الأساسية وحدها (دون موافقة عميل).
- Verified يضيف SENDER_IDENTITY ويرفع المستوى مع موافقة محفوظة تُعاد صامتة.
- Balance-Only يكتشف الدفعة اليوم؛ والترقية إلى Full تلقائية عند توفّر Transactions.
- الدلتا المتعددة في نفس النافذة تذهب إلى REVIEW لا التأكيد التلقائي.
- العمولة تُحسب على CONFIRMED فقط مع احترام الباقة المجانية، دون مساس بحركة الأموال.
- Webhook يُرسل عند التأكيد، وصفحة الدفع/Dashboard تتحدثان حياً.

مرجع الترميز: `[ ]` لم تبدأ · `[-]` قيد التنفيذ · `[x]` مكتملة.
