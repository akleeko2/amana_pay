# Amana Pay — التوثيق الشامل للمشروع

> بروتوتايب كامل لتأكيد دفعات **CliQ** تلقائياً فوق **JoPACC Open Finance**.
> الأموال لا تمرّ عبر المنصّة؛ تُكتشف الدفعة على حساب التاجر وتُطابَق بالطلب وتُؤكَّد في ثوانٍ.

هذا الملف يوثّق **كل ما أُنشئ** في المشروع: الفكرة، المعمارية، الـ SDK، الخدمات، الـ API، قاعدة البيانات، الواجهات، نظام التصميم، الأمان، نموذج الربح، التشغيل، والاختبار.

---

## جدول المحتويات

1. [نظرة عامة وملخص تنفيذي](#1-نظرة-عامة-وملخص-تنفيذي)
2. [المشكلة والحل](#2-المشكلة-والحل)
3. [المفاهيم الأساسية](#3-المفاهيم-الأساسية)
4. [المعمارية العامة](#4-المعمارية-العامة)
5. [بنية المشروع (الملفات)](#5-بنية-المشروع-الملفات)
6. [الواجهة الخلفية (Backend)](#6-الواجهة-الخلفية-backend)
   - [الإعدادات](#61-الإعدادات-configconfigjs)
   - [قاعدة البيانات](#62-قاعدة-البيانات-database)
   - [Mock JoPACC SDK](#63-mock-jopacc-sdk)
   - [الخدمات](#64-الخدمات-services)
   - [الـ REST API](#65-الـ-rest-api-routes)
   - [Middleware و Realtime](#66-middleware--realtime)
7. [محرك المطابقة الذكي](#7-محرك-المطابقة-الذكي)
8. [نموذج الموافقة (Consent)](#8-نموذج-الموافقة-consent)
9. [نموذج الربح](#9-نموذج-الربح)
10. [الواجهة الأمامية (Frontend)](#10-الواجهة-الأمامية-frontend)
11. [نظام التصميم والهوية](#11-نظام-التصميم-والهوية)
12. [الأمان](#12-الأمان)
13. [التشغيل والتثبيت](#13-التشغيل-والتثبيت)
14. [مرجع الـ API الكامل](#14-مرجع-الـ-api-الكامل)
15. [التحقق والاختبار](#15-التحقق-والاختبار)
16. [القرارات المعمارية والتصحيحات](#16-القرارات-المعمارية-والتصحيحات)
17. [الانتقال للإنتاج](#17-الانتقال-للإنتاج)

---

## 1. نظرة عامة وملخص تنفيذي

**Amana Pay** منصّة وسيطة (TPP) تجلس فوق **JoPACC Open Finance** لأتمتة تأكيد دفعات CliQ للتجار. بدلاً من السكرين شوت والمطابقة اليدوية، تولّد المنصّة لكل طلب **مبلغاً ديناميكياً فريداً** ومرجعاً، ثم تراقب حساب التاجر عبر Open Finance لتكتشف الدفعة الواردة وتطابقها بالطلب وتؤكّدها تلقائياً + ترسل Webhook.

| البند | القيمة |
|------|--------|
| النوع | بروتوتايب كامل (Full-stack) يحاكي الواقع |
| الواجهة الخلفية | Node.js + Express + WebSocket + SQLite (`node:sqlite`) |
| الواجهة الأمامية | HTML/CSS/JS خالص (بلا أطر)، ثنائي اللغة AR/EN |
| التكامل | Mock SDK لـ 11 خدمة JoPACC مبني على OpenAPI Specs الحقيقية |
| الهوية | تصميم فاتح بأسلوب Stripe + أيقونات SVG (بلا إيموجي) |
| الحالة | المراحل 1–8 مكتملة ومختبَرة |

المراحل المكتملة: البنية التحتية، Mock SDK، الخدمات الأساسية، REST API، صفحة الدفع، لوحة التحكم، شاشة الموافقة، التكامل والصقل.

---

## 2. المشكلة والحل

### المشكلة (الواقع الحالي)
التاجر في الأردن يقبل CliQ، لكن التحقق **يدوي بالكامل**: العميل يصوّر شاشة التحويل ويرسلها، والتاجر يفتح تطبيق البنك ويبحث عن المعاملة ويطابق المبلغ والمرسل يدوياً. النتيجة: 5–30 دقيقة لكل عملية، أخطاء بشرية، سكرين شوت قابل للتزوير، ولا يتوسّع.

### الحل
طبقة موحّدة فوق Open Finance: التاجر يتكامل مرة واحدة مع Amana Pay (التي تتكامل مع JoPACC) بدل التكامل مع كل بنك. لكل طلب:
1. تُولَّد قيمة فريدة (مبلغ ديناميكي + مرجع).
2. العميل يدفع عبر CliQ **مباشرة لحساب التاجر** (الأموال لا تلمس المنصّة).
3. المنصّة تراقب حساب التاجر عبر Open Finance (Balances اليوم، Transactions مستقبلاً).
4. محرك المطابقة يربط الدفعة بالطلب ويؤكّد + Webhook.

---

## 3. المفاهيم الأساسية

### وضعا المطابقة (Matching Modes)
- **BALANCE_ONLY** (متاح اليوم): يعتمد على Balances API. يكتشف الدفعة من تغيّر `availableBalance` + `lastModificationDate`، ويطابق دلتا الرصيد مع المبلغ الديناميكي الفريد + النافذة الزمنية.
- **FULL** (عند نشر Transactions API): يضيف العوامل الحاسمة (هوية المرسل، المرجع، حساب التاجر، حالة المعاملة). الترقية **تلقائية** عند توفّر المعاملات.

> السبب: Transactions API غير منشور كخدمة منفصلة في الكتالوج (12 إدخالاً)، لكن نماذج `debtor/creditor` وروابط HATEOAS لـ `/accounts/{id}/transactions` موجودة داخل مواصفتَي Accounts و IBAN Confirmation.

### مستويا العميل (Tiers)
- **EXPRESS** (افتراضي، صفر احتكاك): لا OAuth للعميل. المطابقة بالمبلغ الديناميكي الفريد. العوامل الأساسية وحدها تكفي للتأكيد.
- **VERIFIED** (موافقة لمرة واحدة): موافقة AIS طويلة الأمد (90 يوماً) قابلة لإعادة الاستخدام عبر **كل المتاجر**. تضيف عامل **هوية المرسل** الحاسم + فحص الرصيد المسبق (CAF). العميل العائد لا يمر بأي redirect.

### المبلغ الديناميكي
لكل طلب مبلغ فريد (مثال: `10.024` بدل `10.000`) بإضافة كسر 0.001–0.099، يضمن عدم تعارض الطلبات المعلّقة لنفس التاجر.

---

## 4. المعمارية العامة

```
العميل (متصفح)                التاجر (متصفح)
     │                              │
     ▼                              ▼
┌─────────────────────────────────────────────┐
│  Frontend (HTML/CSS/JS)                       │
│  landing · payment-page · dashboard · consent │
└───────────────┬───────────────────────────────┘
                │ REST /api/v1  +  WebSocket /ws
                ▼
┌─────────────────────────────────────────────┐
│  Express Server (server.js)                   │
│  routes → services → jopacc-sdk (mock)        │
│  middleware (auth, errors) · realtime (ws)    │
│  polling.service (بوّاب كل 15 ث)              │
└───────────────┬───────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌───────────────────────────┐
│ SQLite DB    │  │ Mock JoPACC SDK            │
│ (node:sqlite)│  │ accounts/balances/caf/iban │
│              │  │ /fees/consent/jades/jwe... │
└──────────────┘  └───────────────────────────┘
```

تدفق التأكيد: `payment.service` ينشئ الطلب → العميل يدفع → `demo.service` (للعرض) يحقن معاملة ويغيّر الرصيد → `polling.service` يكتشف → `matching.service` يطابق → عند CONFIRMED: `billing` (عمولة) + سجل معاملة + `webhook.service` + بث `realtime`.

---

## 5. بنية المشروع (الملفات)

```
مشروع_بحث/
├── implementation_plan.md          # خطة التنفيذ النهائية (مرجع التصميم)
├── tasks.md                        # قائمة المهام (8 مراحل، كلها مكتملة)
├── README.md                       # دليل تشغيل سريع
├── PROJECT_DOCUMENTATION.md        # هذا الملف
├── docs/
│   └── API.md                      # توثيق Merchant API
├── sdks/jopacc-open-finance/       # مواصفات JoPACC المنزّلة (المرجع)
│   ├── api-catalog.json            # 12 إدخالاً (v0.4.3 + JWE v3.0.1)
│   ├── full-api-metadata.json
│   ├── openapi-specs/              # 13 ملف OpenAPI JSON
│   └── raml-specs/                 # 11 ملف RAML
│
├── backend/
│   ├── package.json                # express, ws, uuid, dotenv
│   ├── server.js                   # Express + HTTP + WebSocket + بوّاب
│   ├── realtime.js                 # WebSocket hub (قنوات + بث)
│   ├── .env.example
│   ├── config/config.js            # إعدادات مركزية تعكس الـ SDKs
│   ├── middleware/
│   │   ├── auth.js                 # مصادقة مفتاح التاجر (x-api-key)
│   │   └── error-handler.js        # أخطاء JSON موحّدة + 404
│   ├── database/
│   │   ├── schema.sql              # 6 جداول
│   │   ├── db.js                   # طبقة node:sqlite + repositories
│   │   ├── seed.js                 # تاجر تجريبي
│   │   └── seed-demo.js            # سيناريو عرض كامل + روابط
│   ├── jopacc-sdk/                 # Mock SDK (11 client)
│   │   ├── index.js                # نقطة تصدير موحّدة
│   │   ├── _store.js               # مخزن ذاكرة قابل للتغيير
│   │   ├── _helpers.js             # هيدرات إلزامية + أخطاء
│   │   ├── auth-client.js          # API Key + Basic Auth + tokens
│   │   ├── jades-client.js         # توقيع RS256 حقيقي
│   │   ├── jwe-client.js           # تشفير RSA-OAEP-256 + A256GCM
│   │   ├── accounts-client.js      # GET /accounts (IBAN/accountId/CLIQ)
│   │   ├── balances-client.js      # GET /accounts/{id}/balances
│   │   ├── transactions-client.js  # list/get/inject
│   │   ├── caf-client.js           # POST /accounts/{id}/CAF
│   │   ├── iban-client.js          # GET /institution/ibanConf
│   │   ├── fees-client.js          # GET /institution/fees/SSTs
│   │   ├── consent-client.js       # محاكاة OAuth/AIS
│   │   ├── institutions-client.js  # GET /institution
│   │   └── mock-data/
│   │       ├── banks.json          # 7 بنوك أردنية
│   │       ├── accounts.json       # تاجر + 3 عملاء
│   │       ├── transactions.json
│   │       └── fees.json
│   ├── services/
│   │   ├── _util.js                # أدوات (round3, toMs, ...)
│   │   ├── matching.service.js     # محرك المطابقة (وضعان + مستويان)
│   │   ├── payment.service.js      # إنشاء/إدارة الدفع
│   │   ├── verification.service.js # تحقق ما قبل الدفع
│   │   ├── merchant.service.js     # تسجيل + auto-lookup
│   │   ├── consent.service.js      # موافقة طويلة الأمد + إعادة استخدام
│   │   ├── polling.service.js      # بوّاب Balances + Transactions
│   │   ├── billing.service.js      # عمولة + باقة مجانية
│   │   ├── webhook.service.js      # إرسال موقّع + إعادة محاولة
│   │   └── demo.service.js         # محاكاة دفعة CliQ
│   └── routes/
│       ├── api.routes.js           # /api/v1/merchants, payments, ...
│       ├── payment-page.routes.js  # صفحة الدفع (عام)
│       ├── dashboard.routes.js     # لوحة التحكم
│       └── demo.routes.js          # محاكاة (mock فقط)
│
└── frontend/
    ├── index.html                  # صفحة الهبوط
    ├── shared/
    │   ├── theme.css               # نظام تصميم Stripe الفاتح
    │   ├── icons.js                # مكتبة أيقونات SVG (~35 أيقونة)
    │   ├── logo.png / logo-256 / logo-128   # الشعار (شفاف)
    │   └── favicon-64.png / favicon-32.png
    ├── payment-page/               # index.html + styles.css + app.js + i18n.js
    ├── dashboard/                  # index.html + styles.css + app.js + i18n.js
    └── consent/                    # index.html + styles.css + app.js
```

---

## 6. الواجهة الخلفية (Backend)

### 6.1 الإعدادات (`config/config.js`)
مصدر الحقيقة الوحيد، يعكس الـ SDKs بالكامل:
- **روابط البوابة** لكل 11 خدمة (من حقل `servers.url` في كل spec).
- **المسارات الفعلية** (endpoints) المستخرجة من المواصفات.
- **الأمان**: `x-Gateway-APIKey` + HTTP Basic + الهيدرات الإلزامية (`Authorization`, `x-interactions-id`, `x-idempotency-key`, `x-jws-signature`).
- **التشفير**: JAdES `RS256`، JWE `RSA-OAEP-256` + `A256GCM`.
- **المطابقة**: أوزان وعتبات (`confirmExpress=75`, `confirmVerified=60`, `review=50`)، نافذة 30 دقيقة، استطلاع 15 ث.
- **الدفع**: العملة JOD، انتهاء 30 دقيقة، كسر المبلغ الديناميكي.
- **الفوترة**: نسبة العمولة (1% افتراضي)، الباقة المجانية (50/شهر).
- **الموافقة**: 90 يوماً، صلاحيات `AccountInfo/Balances/Transactions`.

### 6.2 قاعدة البيانات (`database/`)
محرك **`node:sqlite`** المدمج (بلا تبعيات native). الجداول (`schema.sql`):

| الجدول | الوصف |
|--------|-------|
| `merchants` | التجار: بيانات الحساب (IBAN, CliQ, البنك, accountType, lockedForCredit), مفتاح API, Webhook, حالة Consent |
| `customer_consents` | موافقات العملاء طويلة الأمد القابلة لإعادة الاستخدام عبر المتاجر |
| `payment_requests` | طلبات الدفع: المبلغ الأصلي/الديناميكي, المرجع, `payment_tier`, هوية العميل المتوقعة, `match_mode`, `commission_amount`, الحالة |
| `transactions` | المعاملات المكتشفة: debtor/creditor, `match_status`, العوامل, `detection_source` |
| `webhook_deliveries` | سجل إرسال الـ Webhooks (الحالة, المحاولات) |
| `audit_log` | سجل تدقيق لكل عملية + أي JoPACC API استُدعي |

`db.js` يوفّر: اتصال مفرد + تشغيل المخطط + `run/get/all/tx/insert/updateById` + repositories (merchants, payments, transactions, customerConsents, webhooks, audit).

### 6.3 Mock JoPACC SDK
11 client مبنية على OpenAPI Specs الحقيقية، كلها موقّعة تلقائياً بـ JAdES وتولّد الهيدرات الإلزامية:

| Client | يحاكي | ملاحظات |
|--------|-------|---------|
| `auth-client` | الأمان | `x-Gateway-APIKey` + Basic + إصدار/فحص tokens |
| `jades-client` | JAdES B-B | توقيع **RS256 حقيقي** بمفاتيح RSA + canonical مرتّب |
| `jwe-client` | JWE v3.0.1 | تشفير/فك **حقيقي** RSA-OAEP-256 + AES-256-GCM |
| `accounts-client` | Accounts | `getAccount` بـ IBAN/accountId/CLIQ + `listAccounts`؛ بلا اسم صاحب الحساب (مطابق للعقد) |
| `balances-client` | Balances | `availableBalance.balanceAmount` + `lastModificationDate` |
| `transactions-client` | Transactions | `list/get` + **`injectTransaction`** للديمو |
| `caf-client` | CAF | `checkFunds` → `{fundsAvailable, validityDateTime}` |
| `iban-client` | IBAN Confirmation | `accountType` **هيدر إلزامي**، يرجع `status/lockedFor*/accountOwner.name`؛ بلا accountType في الخرج |
| `fees-client` | Fees | `getServiceFees/getCliQFees` (SST-scoped) |
| `consent-client` | OAuth/AIS | initiate/authorize/revoke + `findReusableConsent` |
| `institutions-client` | Financial Institutions | `getInstitution` + `listBanks` |

`_store.js`: مخزن ذاكرة قابل للتغيير (يدعم تغيير الرصيد وحقن المعاملات للعرض)، يُحمّل من `mock-data/`.

### 6.4 الخدمات (`services/`)

| الخدمة | المسؤولية |
|--------|-----------|
| `matching.service` | محرك المطابقة (دالة نقية): يأخذ الطلب + معاملة + تغيّر رصيد ويُرجع `{mode, tier, score, decision, senderVerified, factors, apisUsed}` |
| `payment.service` | توليد المبلغ الديناميكي والمرجع (الفريدين) + إنشاء/جلب/إلغاء + pre-check + الرسوم + عرض صفحة الدفع |
| `verification.service` | تحقق التاجر عبر IBAN Confirmation (يرفض `lockedForCredit`) + baseline الرصيد |
| `merchant.service` | تسجيل بـ auto-lookup (Accounts للحساب + IBAN Confirmation للاسم) + verify |
| `consent.service` | بدء/توثيق موافقة العميل + حفظ دائم + `findReusable` + CAF |
| `polling.service` | البوّاب: كشف Balances + Transactions، معالجة الدلتا المتعددة، التثبيت (settle)، إنهاء المنتهية |
| `billing.service` | حساب العمولة على CONFIRMED فقط + الباقة المجانية + ملخص شهري |
| `webhook.service` | إرسال أحداث موقّعة (HMAC) + إعادة محاولة + تسجيل |
| `demo.service` | محاكاة دفعة CliQ (حقن معاملة + تغيير رصيد + استطلاع فوري) |

### 6.5 الـ REST API (`routes/`)
أربعة راوترات خلف `/api/v1` (التفاصيل في [القسم 14](#14-مرجع-الـ-api-الكامل)):
- `api.routes.js` — التجار، الموافقة، المدفوعات، المعاملات، الرسوم، الإحصائيات.
- `payment-page.routes.js` — صفحة الدفع (عام): العرض، الحالة، identify، consent-callback.
- `dashboard.routes.js` — overview، chart، transactions، settings.
- `demo.routes.js` — محاكاة الدفع (محصور بوضع mock).

### 6.6 Middleware و Realtime
- `auth.js` — يحمي مسارات التاجر بمفتاح `x-api-key` (أو Bearer)، يرفق `req.merchant`.
- `error-handler.js` — صيغة خطأ موحّدة بنمط JoPACC `{id, code, desc, errors?}` + معالج 404.
- `realtime.js` — WebSocket hub بنظام قنوات (`payment:<id>`, `merchant:<id>`) + `broadcast()` + فحص حيوية.

---

## 7. محرك المطابقة الذكي

دالة نقية في `matching.service.js`. **هوية المرسل معزِّز حاسم وليست بوابة إلزامية** — العوامل الأساسية وحدها تكفي للتأكيد.

### الوضع الكامل (FULL) — العوامل الأساسية (مجموعها 100):
| العامل | الوزن | المصدر |
|--------|------|--------|
| المبلغ الديناميكي | 35 | Transactions |
| المرجع | 25 | Transactions |
| النافذة الزمنية | 15 | Transactions |
| حساب التاجر (creditor) | 10 | Transactions |
| حالة المعاملة | 5 | Transactions |
| تغيّر الرصيد (تأكيد) | 10 | Balances |
| **هوية المرسل** (SENDER_IDENTITY) | معزِّز حاسم | Consent + Transactions |

القرار: `(senderVerified && score≥60) || score≥75` → **CONFIRMED**؛ `≥50` → REVIEW؛ غير ذلك UNMATCHED.

### وضع اليوم (BALANCE_ONLY):
دلتا الرصيد = المبلغ الديناميكي (**70**) + النافذة الزمنية (**30**). عند **تعدّد الدلتا في نفس النافذة** (`ambiguous`) → REVIEW بدل التأكيد التلقائي.

---

## 8. نموذج الموافقة (Consent)

- موافقة **AIS طويلة الأمد** (حتى 90 يوماً)، مرتبطة بالعميل تجاه Amana Pay (TPP)، **قابلة لإعادة الاستخدام عبر كل المتاجر** — ليست لكل عملية ولا لكل متجر.
- **اختيارية**: المطابقة الأساسية (Express) تتم بالمبلغ الديناميكي دون موافقة.
- العميل لأول مرة: قد يربط حسابه مرة واحدة (Verified). العميل العائد: **صفر redirect** (الرمز المحفوظ يُستخدم صامتاً).
- ملاحظة: لا يوجد Consent API ضمن الـ SDKs المنزّلة؛ تُحاكى طبقة OAuth/CBJ بنموذج AIS طويل الأمد.

تدفق الشاشة المستقلة: `initiate` يُصدر `redirectUrl` لـ `/consent/index.html` → الموافقة تُوثّق عبر `/merchants/consent/callback` → تُفعّل Verified على الطلب → تعيد التوجيه لصفحة الدفع.

---

## 9. نموذج الربح

- عمولة **0.5%–1%** على المعاملات **المؤكدة (CONFIRMED) فقط**، تُحسب آلياً وتُجمَّع وتُخصم **شهرياً**.
- **باقة مجانية** (أول 50 معاملة/شهر افتراضياً) لجذب التجار الصغار.
- **لا تمسّ حركة الأموال** — الأموال تذهب مباشرة لحساب التاجر.
- يُعرض في تبويب الفوترة باللوحة: العدد المؤكد، الحجم، العمولة المستحقة، الباقة المتبقية.

---

## 10. الواجهة الأمامية (Frontend)

HTML/CSS/JS خالص، ثنائي اللغة (AR/EN) مع RTL/LTR، بلا أطر وبلا إيموجي (أيقونات SVG).

| الواجهة | الوصف |
|---------|-------|
| **صفحة الهبوط** (`index.html`) | Hero بتدرّج Stripe + بطاقة إيصال، شريط إحصائيات، شبكة Bento للمزايا، stepper |
| **صفحة الدفع** (`payment-page/`) | المبلغ أبرز عنصر، حقول نسخ، **بطاقة تعليمات إلزامية** بارزة (5 خطوات)، مؤقت، مساري Express/Verified، تحديث حي (WebSocket + استطلاع)، رسم ✓ + confetti |
| **لوحة التحكم** (`dashboard/`) | شريط علوي + تنقّل جانبي (يتحول لشريط سفلي على الجوال): Overview (بطاقات + رسم 7 أيام + حالة Open Finance)، Payments (جدول stacked متجاوب)، Transactions (بطاقات)، Billing، Settings |
| **شاشة الموافقة** (`consent/`) | شاشة OAuth بنكية: شعار البنك، صلاحيات بأيقونات، شارة أمان، رسم ✓ |

**الاستجابة الكاملة:** ديسكتوب / تابلت / جوال — تنقّل سفلي ثابت على الجوال، جداول تتحول لبطاقات، دعم `100dvh` و notch-safe.

**التحديث الحي:** WebSocket على قنوات `payment:<id>` و`merchant:<id>` لتأكيد فوري + استطلاع احتياطي.

---

## 11. نظام التصميم والهوية

`frontend/shared/theme.css` — نظام تصميم فاتح بأسلوب **Stripe**:
- **الألوان**: خلفية `#f6f9fc`، بطاقات بيضاء، نص `#0a2540`، حدود `#e3e8ee`، أساسي blurple `#635bff`، تدرّج بنفسجي، لمسة teal.
- **المكوّنات**: أزرار، حقول بـ focus-ring، badges دلالية، chips، toast داكن، spinner، skeleton، reveal، select بسهم SVG.
- **الظلال**: خفيفة متعددة الطبقات بأسلوب Stripe.
- **الأيقونات** (`icons.js`): مكتبة ~35 أيقونة SVG على نمط Lucide، تُحقن عبر `data-icon` وتتوفّر للمحتوى الديناميكي عبر `window.APIcon(name, size)`.

**الشعار**: عُولج من صورة المصدر (إزالة الخلفية السوداء مع استرجاع اللون عند الحواف، قصّ، توسيط في مربّع، وتصدير أحجام شفافة: 512/256/128 + favicon 64/32). مربوط في `.ap-logo` بكل الصفحات.

---

## 12. الأمان

| الطبقة | التنفيذ |
|--------|---------|
| توقيع الطلبات (JoPACC) | JAdES B-B بخوارزمية **RS256** في هيدر `x-jws-signature` (مفاتيح RSA حقيقية في الـ mock) |
| تشفير الحمولة | JWE **RSA-OAEP-256** + **A256GCM** (تنفيذ حقيقي) |
| أمان البوابة | `x-Gateway-APIKey` + HTTP Basic Auth |
| مصادقة التاجر (Amana Pay) | مفتاح API عبر `x-api-key` (منفصل عن أمان JoPACC) |
| Webhook | توقيع HMAC-SHA256 بـ `webhook_secret` في `X-Amana-Signature` |
| الموافقة | AIS وفق نموذج البنك المركزي، صلاحيات صريحة، مدة محدودة |
| عدم لمس الأموال | الأموال تذهب مباشرة للتاجر؛ المنصّة تقرأ فقط |

---

## 13. التشغيل والتثبيت

**المتطلبات:** Node.js ≥ 22.5 (مُختبَر على v24). لا حاجة لقاعدة بيانات خارجية (`node:sqlite` مدمج).

```bash
cd backend
npm install            # express, ws, uuid, dotenv
npm run seed-demo      # يهيّئ تاجراً + طلب دفع + موافقة عميل ويطبع الروابط
npm start              # http://localhost:4000
```

ثم افتح `http://localhost:4000/index.html`.

**سكربتات npm:** `start` · `dev` (watch) · `init-db` · `seed` · `seed-demo`.

**متغيّرات البيئة** (`.env` — انظر `.env.example`): `PORT`, `NODE_ENV`, `DB_FILE`, `JOPACC_MODE`, `COMMISSION_RATE`, `FREE_TIER_MONTHLY`, `CONSENT_VALIDITY_DAYS`, `POLL_INTERVAL_MS`, `PAYMENT_EXPIRY_MS`.

---

## 14. مرجع الـ API الكامل

**Base:** `/api/v1` · **Auth:** `x-api-key` (يُصدَر مرة عند التسجيل) · **الأخطاء:** `{id, code, desc, errors?}`.

### التجار
| Method | Path | الوصف |
|--------|------|-------|
| POST | `/merchants/register` | تسجيل + auto-lookup (يُرجع `apiKey` مرة واحدة) |
| GET | `/merchants/me` | بيانات التاجر (محمي) |
| GET | `/merchants/verify` | تحقق الحساب عبر IBAN Confirmation + Balances |

### الموافقة
| Method | Path | الوصف |
|--------|------|-------|
| POST | `/merchants/consent/initiate` | بدء موافقة العميل (يعيد موافقة سارية إن وُجدت) |
| POST | `/merchants/consent/callback` | توثيق الموافقة (عام) |

### المدفوعات
| Method | Path | الوصف |
|--------|------|-------|
| POST | `/payments` | إنشاء طلب دفع (pre-check + مبلغ ديناميكي + مرجع) |
| GET | `/payments` | قائمة (فلتر `?status=`) |
| GET | `/payments/:id` | حالة طلب |
| POST | `/payments/:id/cancel` | إلغاء طلب معلّق |

### معاملات / رسوم / إحصائيات
| Method | Path | الوصف |
|--------|------|-------|
| GET | `/transactions` | سجل المعاملات المطابَقة |
| GET | `/fees` | رسوم الخدمة (`?service=CLIQ`) |
| GET | `/stats` | إحصائيات + ملخص فوترة |

### لوحة التحكم (محمي)
| Method | Path |
|--------|------|
| GET | `/dashboard/overview` · `/dashboard/chart?days=7` · `/dashboard/transactions` · `/dashboard/settings` |

### صفحة الدفع (عام)
| Method | Path | الوصف |
|--------|------|-------|
| GET | `/payment-page/:id` | بيانات العرض |
| GET | `/payment-page/:id/status` | الحالة (polling) |
| POST | `/payment-page/:id/identify` | إدخال الهاتف → Express أو Verified (إعادة استخدام صامت + CAF) |
| POST | `/payment-page/:id/consent-callback` | إتمام موافقة العميل لأول مرة |

### الديمو (mock فقط)
| Method | Path |
|--------|------|
| POST | `/demo/simulate-payment/:paymentId` |

### Webhook (صادر)
`POST` إلى `webhook_url` التاجر مع `X-Amana-Signature` (HMAC) و`X-Amana-Event`. الأحداث: `payment.confirmed/expired/failed`.

### WebSocket
`ws://<host>/ws` → اشترك بـ `{"type":"subscribe","channel":"payment:<id>"}` أو `"merchant:<id>"`.

> التفاصيل الكاملة للحقول والأمثلة في `docs/API.md`.

---

## 15. التحقق والاختبار

اختُبر كل جزء عبر اختبارات دخان/تكامل على خادم حيّ (نُظّفت بعد كل مرحلة):

| المرحلة | النتيجة |
|---------|---------|
| 1 — البنية التحتية | health/info/ping + WebSocket ✅ |
| 2 — Mock SDK | 29/29 (توقيع JAdES، JWE، الأنماط الثلاثة، CAF، رفض IBANConf بلا accountType، إعادة الموافقة، حقن، تغيّر رصيد) |
| 3 — Core Services | 25/25 (تسجيل، Express CONFIRMED بدرجة 90، Verified + هوية المرسل، Balance-Only، الفوترة) |
| 4 — REST API | 25/25 (تدفق HTTP كامل + 401 + إلغاء) |
| 5 — صفحة الدفع | 11/11 (تُقدَّم + Express→Verified→تأكيد) |
| 6 — لوحة التحكم | 15/15 (كل النقاط) |
| 7 — شاشة الموافقة | 10/10 (redirect→authorize→Verified→CONFIRMED) |
| 8 — التكامل | 18/18 (التدفق الكامل 14 خطوة + العميل العائد + WebSocket حيّ) |
| تجاوب + UI | فحوص الاستجابة، صفر إيموجي، سلامة معرّفات الـ JS، معالجة الشعار ✅ |

سيناريو العرض الكامل (14 خطوة): تسجيل تاجر → auto-lookup → IBAN Confirmation → إنشاء دفع → identify → موافقة عميل → CAF → محاكاة → SENDER_IDENTITY → تأكيد → لوحة → معاملات → عميل عائد بصفر redirect.

---

## 16. القرارات المعمارية والتصحيحات

تصحيحات نتجت عن تحليل الـ SDKs الحقيقية مقابل الخطة الأولية:

1. **`accountType (CHK.BUS)`** يأتي من **Accounts API** لا IBAN Confirmation (حيث هو هيدر إدخال إلزامي وليس حقل خرج).
2. **اسم صاحب الحساب** يُجلب من **IBAN Confirmation** (`accountOwner.name`)؛ مخطط `account` لا يحتوي اسماً.
3. **`accountSchema=CLIQ`** كقيمة استعلام: استنتاج معماري (CLIQ مؤكدة كقيمة خرج في `routings[]` فقط) — المعرّف المضمون IBAN/accountId.
4. **Fees API** محصورة بـ SSTs حالياً؛ تغطية رسوم CliQ غير مضمونة.
5. **`callbacks: {}`** كائن فارغ (boilerplate) لا يثبت جاهزية Webhooks — الاعتماد على Polling.
6. **Transactions API** غير منشور؛ لذا وضعان (Balance-Only اليوم / Full لاحقاً) بترقية تلقائية.
7. **هوية المرسل** معزِّز حاسم لا بوابة (لئلا يفشل Express بلا موافقة العميل).
8. **موافقة العميل** طويلة الأمد قابلة لإعادة الاستخدام واختيارية (حلّ احتكاك الـ redirect لكل عملية).

---

## 17. الانتقال للإنتاج

البنية مصمّمة بحيث يكون الانتقال = **استبدال `jopacc-sdk` بـ SDK حقيقي** دون تغيير المستهلكين:
- كل الخدمات تستورد من `jopacc-sdk/index.js` فقط.
- `config.js` يحوي روابط البوابة الحقيقية والأمان جاهزة (`JOPACC_MODE=live`).
- عند نشر **Transactions API**: يرتقي محرك المطابقة تلقائياً إلى الوضع الكامل.
- استبدال SQLite بقاعدة إنتاجية (PostgreSQL) عبر طبقة `db.js`.
- تفعيل HTTPS، مفاتيح API حقيقية، أسرار Webhook، وإدارة موافقة CBJ الحقيقية.

> **تنويه:** هذا بروتوتايب — جميع خدمات JoPACC mock تحاكي الاستجابات الحقيقية بناءً على OpenAPI Specs المنزّلة في `sdks/`.

---

*آخر تحديث: يوليو 2026 — Amana Pay Prototype.*
