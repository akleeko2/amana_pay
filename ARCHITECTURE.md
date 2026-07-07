# Amana Pay — وثيقة المعمارية (Architecture)

> معمارية بروتوتايب تأكيد دفعات **CliQ** تلقائياً فوق **JoPACC Open Finance**.
> هذه الوثيقة تصف الطبقات، المكوّنات، تدفقات البيانات، نماذج البيانات، الأمان، والقرارات المعمارية.

**الإصدار:** 1.0 · **التاريخ:** يوليو 2026 · يكمّل: `PROJECT_DOCUMENTATION.md`، `implementation_plan.md`، `docs/API.md`.

---

## جدول المحتويات
1. [المبادئ المعمارية](#1-المبادئ-المعمارية)
2. [نظرة سياقية (C4 — Context)](#2-نظرة-سياقية-c4--context)
3. [الحاويات (C4 — Containers)](#3-الحاويات-c4--containers)
4. [المكوّنات (C4 — Components)](#4-المكوّنات-c4--components)
5. [نموذج البيانات (ERD)](#5-نموذج-البيانات-erd)
6. [تدفقات التسلسل (Sequence)](#6-تدفقات-التسلسل-sequence)
7. [آلة حالة الدفع (State Machine)](#7-آلة-حالة-الدفع-state-machine)
8. [محرك المطابقة (منطق القرار)](#8-محرك-المطابقة-منطق-القرار)
9. [معمارية الأمان](#9-معمارية-الأمان)
10. [الاتصال اللحظي (Realtime)](#10-الاتصال-اللحظي-realtime)
11. [تكامل JoPACC SDK (Anti-Corruption Layer)](#11-تكامل-jopacc-sdk-anti-corruption-layer)
12. [معمارية الواجهة الأمامية](#12-معمارية-الواجهة-الأمامية)
13. [النشر والبيئات](#13-النشر-والبيئات)
14. [الجودة والقابلية للتشغيل](#14-الجودة-والقابلية-للتشغيل)
15. [قرارات معمارية (ADRs)](#15-قرارات-معمارية-adrs)
16. [مسار الإنتاج](#16-مسار-الإنتاج)

---

## 1. المبادئ المعمارية

| المبدأ | التطبيق |
|--------|---------|
| **عدم لمس الأموال (Money-out-of-band)** | الأموال تنتقل مباشرة عبر CliQ من العميل للتاجر؛ المنصّة تقرأ وتطابق فقط. |
| **طبقة مانعة للفساد (ACL)** | كل تكامل JoPACC خلف `jopacc-sdk/index.js`؛ الخدمات لا تعرف تفاصيل البوابة. |
| **التدهور الرشيق (Graceful degradation)** | يعمل اليوم بـ Balances فقط (Balance-Only)، ويرتقي تلقائياً إلى Full عند توفّر Transactions. |
| **أقل احتكاك (Progressive disclosure)** | Express افتراضي بلا موافقة؛ Verified ترقية اختيارية لمرة واحدة. |
| **مصدر حقيقة واحد للإعداد** | `config.js` يجمع روابط البوابة والأمان والعتبات. |
| **قابلية الاستبدال** | mock ↔ live عبر تبديل تنفيذ الـ SDK دون تغيير المستهلكين. |
| **المراقبة والتدقيق** | `audit_log` يسجّل كل عملية وأي JoPACC API استُدعي. |

---

## 2. نظرة سياقية (C4 — Context)

```
                         ┌──────────────────────────────┐
                         │          Amana Pay            │
        دفع CliQ مباشر    │   (TPP — منصّة التأكيد)        │
   ┌───────────────────► │                               │
   │                     │  - يولّد مبلغاً فريداً + مرجع  │
┌──────────┐             │  - يراقب حساب التاجر           │   Open Finance APIs
│  العميل  │             │  - يطابق ويؤكّد + Webhook      │ ◄──────────────────┐
│ (Payer)  │             └──────────────┬────────────────┘                    │
└────┬─────┘                            │                                     │
     │ يحوّل عبر CliQ                    │ REST/WS                             ▼
     │ (تطبيق بنكه)                      ▼                          ┌────────────────────┐
     │                          ┌────────────────┐                  │   JoPACC Gateway    │
     └─────────────────────────►│    التاجر      │                  │  (Open Finance)     │
        الأموال لحساب التاجر     │  (Merchant)    │                  │  Accounts/Balances/ │
                                 │  لوحة التحكم   │                  │  CAF/IBANConf/Fees/ │
                                 └────────────────┘                  │  JAdES/JWE/...      │
                                                                     └─────────┬───────────┘
                                                                               │
                                                                     ┌─────────▼───────────┐
                                                                     │  البنوك الأردنية     │
                                                                     │  (عبر JoPACC)        │
                                                                     └─────────────────────┘
```

**الفاعلون:** العميل (Payer)، التاجر (Merchant)، JoPACC (مزوّد Open Finance)، البنوك (خلف JoPACC)، Amana Pay (TPP وسيط).

---

## 3. الحاويات (C4 — Containers)

```
┌──────────────────────────────── Browser ─────────────────────────────────┐
│  Landing  │  Payment Page  │  Merchant Dashboard  │  Consent Screen        │
│  (HTML/CSS/JS خالص · ثنائي اللغة · shared/theme.css + icons.js)            │
└───────────────┬───────────────────────────────────────────┬───────────────┘
                │ HTTPS REST /api/v1                          │ WS /ws
                ▼                                             ▼
┌────────────────────────────── Node.js (server.js) ───────────────────────┐
│  Express App                                  WebSocket Hub (realtime.js)  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐    │
│  │  Middleware  │  │   Routes      │  │   Background Poller           │    │
│  │ auth/errors  │  │ api/payment-  │  │  polling.service (كل 15s)     │    │
│  │              │  │ page/dash/demo│  │  كشف + مطابقة + تثبيت          │    │
│  └──────┬───────┘  └──────┬────────┘  └──────────────┬───────────────┘    │
│         └─────────────────┴──────────────────────────┘                    │
│                              ▼ Services Layer                              │
│   payment · matching · verification · merchant · consent · billing ·      │
│   webhook · demo                                                           │
│                              ▼ ACL                                         │
│                   jopacc-sdk/index.js  (mock | live)                       │
└───────────────┬───────────────────────────────────┬───────────────────────┘
                ▼                                     ▼
        ┌───────────────┐                  ┌────────────────────────┐
        │  SQLite        │                  │  JoPACC Gateway        │
        │  (node:sqlite) │                  │  (في الإنتاج)          │
        │  6 جداول       │                  │  HTTPS + JAdES + JWE   │
        └───────────────┘                  └────────────────────────┘
```

| الحاوية | التقنية | المسؤولية |
|---------|---------|-----------|
| Frontend | HTML/CSS/JS | 4 واجهات تُقدَّم ثابتة من نفس الخادم |
| API Server | Express | REST + تقديم ثابت + توجيه |
| Realtime Hub | `ws` | بث الأحداث عبر القنوات |
| Poller | setInterval | كشف الدفعات دورياً |
| SDK (ACL) | mock/live | عزل تكامل JoPACC |
| Database | node:sqlite | تخزين دائم |

---

## 4. المكوّنات (C4 — Components)

### طبقة الخدمات وتبعياتها
```
routes/
  api.routes ─────────► merchant.service ──► verification.service ──► sdk(iban,balances)
                        payment.service ───► verification, consent, billing, sdk(fees)
                        billing.service
  payment-page.routes ► payment.service, consent.service ──► sdk(accounts,iban,caf,consent)
  dashboard.routes ───► payment.service, billing.service, db
  demo.routes ────────► demo.service ──► sdk(transactions.inject, _store.balanceDelta)
                                         └► polling.service.processOnce()

polling.service ──► matching.service (نقي)
                 ├─► billing.service (عمولة)
                 ├─► webhook.service (إرسال)
                 ├─► realtime (بث)
                 └─► sdk(balances, transactions)

كل الخدمات ──► database/db.js (repositories)
كل الـ sdk clients ──► jades-client (توقيع تلقائي) + _store + _helpers
```

### مسؤولية كل مكوّن
| المكوّن | النوع | المسؤولية الأساسية |
|---------|------|---------------------|
| `matching.service` | Pure function | قرار المطابقة (mode/tier/score/decision) |
| `payment.service` | Service | توليد فريد + دورة حياة الدفع + عرض |
| `verification.service` | Service | تحقق ما قبل الدفع (IBANConf + baseline) |
| `merchant.service` | Service | تسجيل + auto-lookup هوية الحساب |
| `consent.service` | Service | موافقة طويلة الأمد + إعادة استخدام + CAF |
| `polling.service` | Orchestrator | الكشف الدوري + التنسيق + التثبيت |
| `billing.service` | Service | العمولة + الباقة المجانية |
| `webhook.service` | Service | إرسال موقّع + إعادة محاولة |
| `demo.service` | Service | محاكاة دفعة (للعرض) |

---

## 5. نموذج البيانات (ERD)

```
┌────────────────────┐         ┌──────────────────────────┐
│     merchants      │ 1     * │     payment_requests     │
│────────────────────│────────►│──────────────────────────│
│ id (PK)            │         │ id (PK)                  │
│ name, email        │         │ merchant_id (FK)         │
│ api_key (UQ)       │         │ original_amount          │
│ iban, cliq_alias   │         │ dynamic_amount (UQ idx)  │
│ bank_bic, ...      │         │ reference (UQ)           │
│ account_type_code  │         │ payment_tier             │
│ locked_for_credit  │         │ expected_debtor_iban     │
│ last_known_balance │         │ match_mode, confidence   │
│ consent_*          │         │ commission_amount        │
│ webhook_url/secret │         │ status, expires_at       │
└─────────┬──────────┘         └──────────┬───────────────┘
          │ 1                              │ 1
          │ *                              │ *
┌─────────▼──────────┐         ┌───────────▼──────────────┐
│ webhook_deliveries │         │      transactions        │
│────────────────────│         │──────────────────────────│
│ id, merchant_id    │         │ id, merchant_id          │
│ payment_request_id │         │ payment_request_id (FK)  │
│ event_type, status │         │ amount, reference        │
│ attempts, payload  │         │ debtor_iban, creditor_*  │
└────────────────────┘         │ match_status, factors    │
                               │ detection_source         │
┌────────────────────┐         └──────────────────────────┘
│ customer_consents  │         ┌──────────────────────────┐
│────────────────────│         │        audit_log         │
│ id, phone (idx)    │         │──────────────────────────│
│ account_id, iban   │         │ id, merchant_id          │
│ customer_name      │         │ entity_type, entity_id   │
│ status, expires_at │         │ action, details          │
│ access_token       │         │ jopacc_api_called        │
└────────────────────┘         └──────────────────────────┘
   (مرتبط بالعميل عبر phone — قابل لإعادة الاستخدام عبر كل التجار)
```

**ملاحظات:**
- `customer_consents` غير مرتبط بتاجر (مرتبط بالعميل/TPP) لتمكين إعادة الاستخدام عبر المتاجر.
- فهارس على: `api_key`, `cliq_alias`, `reference`, `dynamic_amount`, `phone`, `match_status`.

---

## 6. تدفقات التسلسل (Sequence)

### 6.1 تسجيل التاجر (auto-lookup)
```
Merchant UI → API: POST /merchants/register {lookupValue, schema}
API → merchant.service.register
  merchant.service → sdk.accounts.getAccount()      ── IBAN, accountType, routings, bank
  merchant.service → verification.verifyMerchantAccount
        verification → sdk.iban.confirmIBAN()        ── status, lockedForCredit, accountOwner.name
        verification → sdk.balances.getBalance()      ── baseline
  merchant.service → db.insert(merchants)
API → Merchant UI: { merchant, apiKey }   (apiKey يُعرض مرة واحدة)
```

### 6.2 إنشاء طلب دفع + الدفع + التأكيد (المسار الكامل)
```
Merchant UI → API: POST /payments {amount, customerPhone?}
  payment.service → verification.prePaymentCheck()    ── يرفض إن lockedForCredit
  payment.service → consent.findReusable(phone)       ── Verified إن وُجدت موافقة
  payment.service → sdk.fees.getCliQFees()            ── رسوم متوقعة
  payment.service → db.insert(payment_requests)        ── status=PENDING, مبلغ ديناميكي + مرجع
API → Merchant UI: { payment }  →  رابط صفحة الدفع

Customer → Payment Page: يفتح الرابط
Payment Page → API: POST /payment-page/:id/identify {phone}
  └ إن موافقة سارية: Verified + CAF بلا redirect
  └ غير ذلك: Express + خيار موافقة (redirect إلى /consent)

Customer → بنكه: تحويل CliQ بالمبلغ الديناميكي  (خارج النظام)

[Demo] Payment Page → API: POST /demo/simulate-payment/:id
  demo.service → sdk.transactions.injectTransaction()
  demo.service → sdk._store.applyBalanceDelta()
  demo.service → polling.processOnce()                 ── استطلاع فوري

polling.service:
  for each pending payment:
     sdk.balances.getBalance()      ── delta + lastModificationDate
     sdk.transactions.list()        ── معاملة مطابقة (إن وُجدت)
     matching.match(payment, tx, balanceChange) → decision
     if CONFIRMED:
        billing.computeCommission()
        db.update(payment=CONFIRMED) + db.insert(transactions)
        webhook.dispatch('payment.confirmed')   → التاجر
        realtime.broadcast('payment:<id>' / 'merchant:<id>')

Payment Page ◄── WS: payment.confirmed   → شاشة "تم الدفع" + confetti
Dashboard    ◄── WS: payment.confirmed   → تحديث حي
```

### 6.3 موافقة العميل (Verified — لمرة واحدة)
```
Payment Page → API: identify → consentOption.redirectUrl
Browser → /consent/index.html?consentId&subject&paymentId&return
Consent UI → API: POST /merchants/consent/callback {consentId, phone}
  consent.service → sdk.consent.authorizeConsent()
  consent.service → sdk.accounts.getAccount(phone, CLIQ)   ── IBAN
  consent.service → sdk.iban.confirmIBAN()                  ── الاسم
  consent.service → db.insert(customer_consents)            ── 90 يوماً
Consent UI → API: POST /payment-page/:id/identify  → Verified
Browser → return (صفحة الدفع) ?consent=granted
```

---

## 7. آلة حالة الدفع (State Machine)

```
                 إنشاء
                   │
                   ▼
              ┌─────────┐   identify/مطابقة جزئية   ┌────────────┐
              │ PENDING │ ─────────────────────────►│ PROCESSING │
              └────┬────┘                            └─────┬──────┘
       انتهاء المهلة│        ┌──────────────────────────────┤
                   ▼        ▼            مطابقة ≥ العتبة     │
              ┌─────────┐  ┌───────────┐                    ▼
              │ EXPIRED │  │ CANCELLED │              ┌────────────┐
              └─────────┘  └───────────┘              │ CONFIRMED  │──► Webhook + بث
                              ▲                        └────────────┘
                       إلغاء يدوي                  مطابقة غامضة → REVIEW (تبقى PROCESSING)
```

| الحالة | الوصف |
|--------|-------|
| `PENDING` | بانتظار الدفع |
| `PROCESSING` | جارٍ التحقق / مراجعة (REVIEW) |
| `CONFIRMED` | مؤكّد (نهائي) — يحسب العمولة + Webhook |
| `EXPIRED` | انتهت المهلة |
| `CANCELLED` | أُلغي يدوياً |
| `FAILED` | فشل (محجوز) |

---

## 8. محرك المطابقة (منطق القرار)

```
                    ┌──────────────────────────┐
                    │  match(payment, tx, bal)  │
                    └────────────┬──────────────┘
              tx موجودة؟          │
            ┌──────────────┬──────┘
           نعم            لا
            ▼              ▼
   ┌─────────────────┐  ┌──────────────────────────┐
   │  FULL mode      │  │  BALANCE_ONLY mode        │
   │  أساس=100       │  │  دلتا الرصيد(70)+وقت(30)   │
   │  + SENDER_ID    │  │  ambiguous → REVIEW        │
   │   (معزِّز حاسم) │  └──────────────────────────┘
   └────────┬────────┘
            ▼
   decision:
     (senderVerified && score≥60) || score≥75 → CONFIRMED
     score≥50 → REVIEW
     else     → UNMATCHED
```

**أوزان FULL:** DYNAMIC_AMOUNT 35 · REFERENCE 25 · TIME_WINDOW 15 · MERCHANT_ACCOUNT 10 · STATUS 5 · BALANCE_CHANGE 10 · SENDER_IDENTITY (حاسم، لا يستهلك من الأساس).

**خصائص:** دالة **نقية** بلا آثار جانبية (قابلة للاختبار) — كل التأثيرات في `polling.service`.

---

## 9. معمارية الأمان

```
طلب صادر إلى JoPACC (في الإنتاج):
  body → jwe.encrypt (RSA-OAEP-256 + A256GCM)
       → jades.sign (RS256) → x-jws-signature
       → headers: Authorization, x-Gateway-APIKey, x-interactions-id,
                  x-idempotency-key  (+ Basic Auth)

مصادقة التاجر (Amana Pay):  x-api-key  →  middleware/auth → req.merchant
Webhook صادر:               X-Amana-Signature = HMAC-SHA256(payload, webhook_secret)
موافقة العميل:              AIS طويلة الأمد (CBJ) — صلاحيات صريحة + انتهاء
عزل الأموال:                لا تمرّ عبر المنصّة (قراءة فقط)
```

**حدود الثقة (Trust boundaries):** المتصفح ↔ الخادم (مفتاح API)، الخادم ↔ JoPACC (JAdES/JWE/APIKey)، الخادم ↔ التاجر (HMAC Webhook).

---

## 10. الاتصال اللحظي (Realtime)

```
العميل/التاجر ── WS connect ──► /ws
client → {type:'subscribe', channel:'payment:<id>' | 'merchant:<id>'}
server (realtime.broadcast):
   payment.confirmed / payment.expired / payment.processing
آلية احتياطية: استطلاع REST كل 3 ثوان من صفحة الدفع
فحص حيوية: ping/pong كل 30 ثانية
```

القنوات: `payment:<id>` (لصفحة الدفع)، `merchant:<id>` (للوحة التحكم).

---

## 11. تكامل JoPACC SDK (Anti-Corruption Layer)

```
Services  ──►  jopacc-sdk/index.js  ──►  { mock clients }  ──►  _store (ذاكرة)
                     │                                            ▲
                     │ (live)                                     │ mock-data/*.json
                     ▼
              JoPACC Gateway (HTTPS)
```

- **نقطة دخول واحدة** (`index.js`) تُصدّر كل الـ clients — المستهلكون لا يستوردون ملفات فردية.
- كل client يحاكي عقد OpenAPI الحقيقي (مسارات، حقول، هيدرات، أخطاء بنمط JoPACC).
- `jades-client`/`jwe-client` بتنفيذ تشفير **حقيقي** (RSA) — جاهزة للإنتاج مفهومياً.
- التبديل mock↔live عبر `config.jopacc.mode` دون لمس الخدمات.

**الخدمات الـ11 المُحاكاة:** Accounts · Balances · Transactions · CAF · IBAN Confirmation · Fees · Financial Institutions · JAdES · JWE · Consent(OAuth) · Auth(Gateway).

---

## 12. معمارية الواجهة الأمامية

```
shared/theme.css   → نظام تصميم (tokens, primitives) — Stripe الفاتح
shared/icons.js    → حقن أيقونات SVG عبر data-icon + window.APIcon()
shared/logo*.png   → الشعار (شفاف، أحجام متعددة)

كل واجهة = index.html + styles.css + app.js (+ i18n.js)
نمط التطبيق: Vanilla JS، حالة محلية، fetch للـ REST، WebSocket للحظي.
```

| الواجهة | النمط المعماري |
|---------|----------------|
| Landing | صفحة ثابتة (hero + bento + stepper) |
| Payment Page | آلة حالات (loading/pending/processing/confirmed/expired) + WS |
| Dashboard | SPA مصغّر: تنقّل + render لكل صفحة عبر REST + WS |
| Consent | آلة حالات (consent/loading/success/denied/error) |

**الاستجابة:** Desktop / Tablet / Mobile (تنقّل سفلي ثابت، جداول تتحوّل بطاقات، `100dvh`، notch-safe). **ثنائي اللغة** AR/EN مع RTL/LTR.

---

## 13. النشر والبيئات

```
┌─────────────── بيئة واحدة (البروتوتايب) ───────────────┐
│  node server.js  →  يقدّم Frontend الثابت + REST + WS  │
│  SQLite ملف محلي · JoPACC mode=mock                    │
└────────────────────────────────────────────────────────┘

┌─────────────── الإنتاج (مقترح) ────────────────────────┐
│  CDN/Static  →  Frontend                                │
│  App (Node) خلف HTTPS/Reverse proxy  →  REST + WS       │
│  PostgreSQL  ·  JoPACC mode=live (HTTPS + JAdES/JWE)    │
│  Secrets manager · مراقبة/سجلات مركزية                  │
└────────────────────────────────────────────────────────┘
```

| البيئة | DB | JoPACC | ملاحظات |
|--------|----|--------|---------|
| Development | SQLite ملف | mock | `npm run dev` |
| Production | PostgreSQL (عبر db.js) | live | HTTPS، أسرار، توسّع أفقي للـ poller |

---

## 14. الجودة والقابلية للتشغيل

| السمة | المعالجة |
|-------|----------|
| **الموثوقية** | idempotency-key، إعادة محاولة Webhook، معالجة الدلتا الغامضة → REVIEW |
| **الاتساق** | معاملات DB (`tx`)، مبلغ ديناميكي فريد، مرجع فريد |
| **القابلية للملاحظة** | `audit_log` لكل عملية + أي JoPACC API، سجلات الخادم |
| **الأداء** | استطلاع 15s، أيقونات SVG خفيفة، شعار 128px (5.8KB) للواجهة |
| **القابلية للاختبار** | محرك المطابقة دالة نقية؛ خدمات قابلة للحقن؛ DB معزولة للاختبار |
| **إمكانية الوصول** | `prefers-reduced-motion`، تباين فاتح، تسميات أيقونات |
| **التدويل** | AR/EN + RTL/LTR كامل |

**نقاط التوسّع المستقبلية:** فصل الـ poller كعملية مستقلة، قائمة Webhook (queue)، تفعيل callbacks/Push عند دعم JoPACC.

---

## 15. قرارات معمارية (ADRs)

| # | القرار | السياق | البديل المرفوض |
|---|--------|--------|----------------|
| ADR-1 | **node:sqlite** بدل better-sqlite3 | تجنّب بناء native على ويندوز | better-sqlite3 (يحتاج تصريف) |
| ADR-2 | **وضعان للمطابقة** (Balance-Only / Full) | Transactions API غير منشور | الاعتماد الكامل على Transactions |
| ADR-3 | **هوية المرسل معزِّز لا بوابة** | لئلا يفشل Express بلا موافقة | جعلها 40% بوابة إلزامية |
| ADR-4 | **موافقة طويلة الأمد قابلة لإعادة الاستخدام** | تقليل احتكاك redirect لكل عملية | موافقة لكل عملية |
| ADR-5 | **ACL عبر sdk/index.js** | عزل تغيّرات JoPACC | استدعاء البوابة من الخدمات مباشرة |
| ADR-6 | **Vanilla Frontend** | خفّة + لا بناء | إطار SPA ثقيل |
| ADR-7 | **Polling أساسي** | `callbacks: {}` فارغ لا يثبت Push | افتراض جاهزية Webhooks من البوابة |
| ADR-8 | **الأموال خارج النطاق** | تقليل المخاطر التنظيمية والأمنية | وساطة الأموال (PIS كامل) |

---

## 16. مسار الإنتاج

```
1) JoPACC mode=live  →  استبدال mock clients بنداءات HTTPS حقيقية (نفس الواجهة)
2) نشر Transactions API  →  ترقية تلقائية لمحرك المطابقة (FULL)
3) PostgreSQL  →  عبر طبقة db.js (نفس الـ repositories)
4) أمان  →  HTTPS، أسرار Webhook/API، إدارة موافقة CBJ حقيقية
5) تشغيل  →  poller مستقل + قائمة Webhook + مراقبة مركزية
6) callbacks/Push  →  عند تفعيل JoPACC، الانتقال من Polling إلى Real-time
```

> الانتقال للإنتاج لا يتطلب إعادة كتابة: المعمارية مبنية على فصل الطبقات (ACL + repositories + خدمات نقية).

---

*وثيقة المعمارية — Amana Pay Prototype · يوليو 2026.*
