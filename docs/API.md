# Amana Pay — Merchant API

REST API لتأكيد دفعات CliQ تلقائياً فوق JoPACC Open Finance. الأموال لا تمرّ عبر المنصّة؛ تُكتشف الدفعة على حساب التاجر وتُطابَق بالطلب.

- **Base URL:** `http://localhost:4000/api/v1`
- **Auth:** مفتاح التاجر عبر هيدر `x-api-key` (أو `Authorization: Bearer <key>`). يُصدَر مرة واحدة عند التسجيل.
- **صيغة الأخطاء:** `{ "id", "code", "desc", "errors?" }` (مستوحاة من أخطاء JoPACC).

> ملاحظة أمان JoPACC داخلية: كل استدعاء SDK يُوقَّع بـ JAdES (RS256، هيدر `x-jws-signature`) ويستخدم `x-Gateway-APIKey` + هيدرات `x-interactions-id`/`x-idempotency-key` الإلزامية. هذه مُدارة داخل الـ backend ولا تخصّ مستهلك Merchant API.

---

## التدفقات والمفاهيم

- **وضعا المطابقة:** `BALANCE_ONLY` (اليوم، عبر Balances API) و`FULL` (عند توفّر Transactions API). الترقية تلقائية.
- **مستويا العميل:** `EXPRESS` (بلا موافقة — المطابقة بالمبلغ الديناميكي الفريد) و`VERIFIED` (موافقة AIS طويلة الأمد تضيف عامل هوية المرسل الحاسم).
- **المبلغ الديناميكي:** لكل طلب مبلغ فريد (مثل 10.024) لربط الدفعة بالطلب دون لبس.
- **نموذج الربح (SaaS + رسم مطابقة):** اشتراك شهري ثابت حسب الباقة + **رسم مطابقة لكل حركة مؤكّدة = نفس الكسر الديناميكي الذي دفعه المشتري** (بالضبط بالفلس؛ مثال: طلب 10.000 → المشتري دفع 10.024 → الرسم 0.024). فالمشتري عملياً يغطّي الرسم والتاجر يستلم صافي قيمة الطلب. الباقات: `STARTER` (15 د.أ) · `GROWTH` (25 د.أ) · `ENTERPRISE` (70 د.أ، غير محدود + ربط ERP، **بلا رسم مطابقة**). النموذج غير احتجازي — الأموال تذهب مباشرة لحساب التاجر.

---

## Merchants

### POST /merchants/register
تسجيل تاجر مع جلب بيانات الحساب آلياً (Accounts API) واسمه (IBAN Confirmation).

Body:
```json
{ "name": "Downtown Computers", "name_ar": "داون تاون", "email": "store@x.jo",
  "lookupValue": "acc_demo_001", "lookupSchema": "accountId", "nid": "0000",
  "plan": "GROWTH", "webhook_url": "https://..." }
```
- `lookupSchema`: `accountId` | `IBAN` | `CLIQ` (الأخير استنتاجي).
- `plan` (اختياري): `STARTER` | `GROWTH` | `ENTERPRISE` — الافتراضي `GROWTH`.

`201`:
```json
{ "merchant": { "id": "...", "name": "...", "iban": "JO94...", "bank_name": "Arab Bank",
  "account_name": "Downtown Computers", "account_type_code": "CHK.BUS", "locked_for_credit": 0,
  "plan": "GROWTH" },
  "apiKey": "ak_xxx" }
```
الأخطاء: `400 merchant.invalid_input`, `409 merchant.email_exists`, `422 merchant.locked_for_credit`.

### GET /plans
قائمة الباقات وتسعيرها (عام، بلا مصادقة).
```json
{ "plans": [ { "code": "STARTER", "monthlyFee": 15, "matchingFee": "dynamic_fraction" },
  { "code": "GROWTH", "monthlyFee": 25, "matchingFee": "dynamic_fraction", "popular": true },
  { "code": "ENTERPRISE", "monthlyFee": 70, "matchingFee": "included", "unlimited": true, "erpIntegration": true } ],
  "defaultPlan": "GROWTH" }
```

### GET /merchants/me
بيانات التاجر الحالي (محمي). `{ "merchant": { ... } }`

### GET /merchants/verify
تحقق حيّ من الحساب عبر IBAN Confirmation + Balances (محمي).
```json
{ "verification": { "verified": true, "accountStatus": "active", "acceptsCredit": true,
  "accountOwnerName": { "enName": "...", "arName": "..." }, "currentBalance": 1500, "bankName": {...} } }
```

---

## Consent (موافقة العميل)

### POST /merchants/consent/initiate
بدء تدفق موافقة العميل (محمي). يعيد موافقة سارية إن وُجدت (إعادة استخدام صامت).
Body: `{ "phone": "0791234567" }`
```json
{ "reused": false, "consentId": "cns_...", "status": "pending", "expiresAt": "...",
  "redirectUrl": "/consent/index.html?consentId=...&subject=0791234567" }
```

### POST /merchants/consent/callback
توثيق الموافقة بعد موافقة العميل (عام). Body: `{ "consentId", "phone" }`
```json
{ "consent": { "id": "...", "status": "authorized", "customerName": "Ahmad ...", "expiresAt": "..." } }
```

---

## Payments

### POST /payments
إنشاء طلب دفع (محمي) — مع تحقق مسبق + مبلغ ديناميكي + مرجع.
Body: `{ "amount": 10, "orderId": "ORD-1", "customerPhone": "0791234567", "description": "..." }`
```json
{ "payment": { "id": "...", "status": "PENDING", "tier": "EXPRESS|VERIFIED",
  "amount": 10.024, "originalAmount": 10, "currency": "JOD", "reference": "AP-1024-X7K9",
  "cliqAlias": "DOWNTOWN", "bankName": "Arab Bank", "estimatedFee": 0, "expiresAt": "..." } }
```

### GET /payments — قائمة طلبات التاجر. فلتر اختياري: `?status=CONFIRMED`
### GET /payments/:id — حالة طلب.
### POST /payments/:id/cancel — إلغاء طلب معلّق.

---

## Transactions / Fees / Stats

### GET /transactions
سجل المعاملات المطابَقة للتاجر.

### GET /fees
رسوم الخدمة عبر Fees API. فلتر اختياري: `?service=CLIQ` (SST-scoped حالياً).

### GET /stats
```json
{ "stats": { "total", "confirmed", "pending", "expired", "cancelled" },
  "billing": { "plan", "planName", "monthlyFee", "unlimited", "feeApplies",
    "confirmedCount", "matchingFeesDue", "avgFeePerTx", "subscriptionDue",
    "volume", "volumeReceived", "totalDue" } }
```

---

## Dashboard (محمي)

- `GET /dashboard/overview` → `{ cards, recentPayments, openFinance, billing }`
- `GET /dashboard/chart?days=7` → `{ series: [{ date, count, confirmed, volume }] }`
- `GET /dashboard/transactions` → `{ transactions: [... , match_factors[] ] }`
- `GET /dashboard/settings` → `{ merchant, account, webhook, consent }`

---

## Payment Page (عام — لصفحة العميل)

- `GET /payment-page/:id` → بيانات العرض.
- `GET /payment-page/:id/status` → `{ status, tier, confirmedAt, confidenceScore, matchMode }`.
- `POST /payment-page/:id/identify` — Body `{ phone }`. يكتشف موافقة سارية:
  - VERIFIED: `{ "tier": "VERIFIED", "reused": true, "customerName", "fundsAvailable" }`
  - EXPRESS: `{ "tier": "EXPRESS", "reused": false, "consentOption": { consentId, redirectUrl } }`
- `POST /payment-page/:id/consent-callback` — Body `{ consentId, phone }` → ترقية الطلب لـ VERIFIED.

---

## Demo (وضع mock فقط)

### POST /demo/simulate-payment/:paymentId
محاكاة وصول دفعة CliQ (حقن معاملة + تغيّر رصيد) ثم استطلاع فوري.
Body اختياري: `{ "fromIban", "fromName", "useReference": true, "exactAmount": true }`
```json
{ "ok": true, "payment": { "status": "CONFIRMED", "matchFactors": [...], "confidenceScore": 90 } }
```

---

## Webhooks

عند تغيّر حالة الطلب يُرسل أمانة باي POST إلى `webhook_url` التاجر:
- Headers: `X-Amana-Signature` (HMAC-SHA256 بـ `webhook_secret`), `X-Amana-Event`.
- Events: `payment.confirmed`, `payment.expired`, `payment.failed`.
```json
{ "event": "payment.confirmed", "timestamp": "...",
  "data": { "paymentId", "orderId", "reference", "amount", "currency", "status", "tier", "matchMode", "confidenceScore", "confirmedAt" } }
```

---

## Realtime (WebSocket)

`ws://<host>/ws` — أرسل `{ "type": "subscribe", "channel": "payment:<id>" }` أو `"merchant:<id>"`.
البث: `{ "type": "payment.confirmed|payment.expired|payment.processing", "channel", "data" }`.
