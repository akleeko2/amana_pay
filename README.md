# Amana Pay

بروتوتايب كامل لتأكيد دفعات **CliQ** تلقائياً فوق **JoPACC Open Finance**. بدلاً من السكرين شوت والمطابقة اليدوية، يولّد أمانة باي مبلغاً ديناميكياً فريداً ويراقب حساب التاجر عبر Open Finance ليؤكّد الدفعة في ثوانٍ — **دون أن تمرّ الأموال عبر المنصّة**.

## التشغيل السريع

```bash
cd backend
npm install
npm run seed-demo     # يهيّئ تاجراً + طلب دفع + موافقة عميل ويطبع الروابط
npm start             # يشغّل الخادم على http://localhost:4000
```

ثم افتح: `http://localhost:4000/index.html`

- **لوحة التاجر:** `/dashboard/index.html` (سجّل أو ادخل بمفتاح API)
- **صفحة الدفع:** الرابط يُطبَع من `seed-demo` أو يُنشأ من اللوحة
- **شاشة الموافقة:** تُفتح ضمن تدفق الدفع

## البنية

```
backend/
  config/        إعدادات مركزية (مرجع كامل لـ SDKs: روابط البوابة، الأمان، الهيدرات)
  jopacc-sdk/    Mock SDK لـ 11 خدمة JoPACC (موقّع بـ JAdES، مبني على OpenAPI specs)
  services/      محرك المطابقة، الدفع، التحقق، الموافقة، التاجر، الاستطلاع، Webhook، الفوترة، الديمو
  routes/        REST API (/api/v1): merchant, payment-page, dashboard, demo
  middleware/    مصادقة مفتاح API + معالج أخطاء
  database/      SQLite (node:sqlite) + schema + seeds
  server.js      Express + WebSocket + بوّاب الاستطلاع
frontend/
  index.html     صفحة الهبوط
  payment-page/  صفحة دفع العميل (Express/Verified، تحديث حي)
  dashboard/     لوحة التاجر (Overview/Payments/Transactions/Billing/Settings)
  consent/       شاشة موافقة Open Finance المستقلة (OAuth-style)
sdks/            مواصفات JoPACC OpenAPI/RAML المنزّلة (المرجع)
docs/API.md      توثيق Merchant API
```

## مفاهيم أساسية

- **وضعا المطابقة:** `BALANCE_ONLY` (اليوم، عبر Balances) و`FULL` (عند توفّر Transactions) — ترقية تلقائية.
- **مستويا العميل:** `EXPRESS` (بلا موافقة) و`VERIFIED` (موافقة AIS طويلة الأمد، عامل هوية مرسل حاسم).
- **الأمان (محاكى):** JAdES RS256 (`x-jws-signature`) + JWE RSA-OAEP-256/A256GCM + `x-Gateway-APIKey`.
- **نموذج الربح:** عمولة على المؤكد فقط + باقة مجانية شهرية.

## المرجعية

كل شيء مبنيّ على `implementation_plan.md` و`tasks.md`، وعقود الـ SDK في `sdks/jopacc-open-finance/`. راجع `docs/API.md` لتفاصيل النقاط.

> بروتوتايب: جميع خدمات JoPACC mock تحاكي الاستجابات الحقيقية. الانتقال للإنتاج = استبدال `jopacc-sdk` بـ SDK حقيقي دون تغيير المستهلكين.
ا