# Amana Pay — خطة التنفيذ النهائية
## بروتوتايب كامل للتقديم يحاكي الواقع

---

## تحليل الفكرة المعمّق

### المشكلة الحقيقية في السوق الأردني

في الأردن اليوم، آلاف التجار والمتاجر الإلكترونية يقبلون الدفع عبر **CliQ** (نظام الدفع الفوري من JoPACC). لكن عملية التحقق من الدفع **يدوية بالكامل**:

```
┌──────────────────────────────────────────────────────────────────┐
│                    الواقع الحالي (المشكلة)                         │
│                                                                   │
│  👤 العميل يطلب منتج ← 🏪 التاجر يرسل تفاصيل الدفع            │
│           ↓                                                       │
│  👤 العميل يحول عبر CliQ ← يصور الشاشة ← يرسل السكرين شوت     │
│           ↓                                                       │
│  🏪 التاجر يفتح التطبيق البنكي ← يبحث عن المعاملة يدوياً       │
│           ↓                                                       │
│  🏪 يتأكد من المبلغ والمرسل ← يوافق على الطلب يدوياً           │
│                                                                   │
│  ⏱️ الوقت: 5-30 دقيقة لكل عملية                                │
│  ❌ أخطاء بشرية (مبلغ خاطئ، معاملة خاطئة)                       │
│  ❌ لا يتوسع (يحتاج موظفين للمتابعة)                             │
│  ❌ سكرين شوت يمكن تزويره                                        │
└──────────────────────────────────────────────────────────────────┘
```

### كيف يحل Amana Pay المشكلة

**الفكرة الجوهرية**: بدلاً من أن يتكامل كل تاجر مع كل بنك على حدة (كل بنك له APIs مختلفة)، **JoPACC Open Finance** يوفر طبقة موحدة لجميع البنوك. Amana Pay تجلس **فوق** هذه الطبقة وتوفر:

```
┌──────────────────────────────────────────────────────────────────┐
│                    الحل: Amana Pay                                │
│                                                                   │
│  👤 العميل يطلب ← Amana Pay تولّد:                              │
│     • مبلغ فريد: 10.024 JOD (بدل 10.000)                         │
│     • مرجع فريد: AP-1024-X7K9                                    │
│     • تعليمات دفع واضحة                                          │
│           ↓                                                       │
│  👤 العميل يحول عبر CliQ مباشرة لحساب التاجر                     │
│     (الأموال تذهب مباشرة للتاجر — Amana Pay لا تلمسها)          │
│           ↓                                                       │
│  🔄 Amana Pay تراقب حساب التاجر عبر Open Finance APIs            │
│     تسترجع: المبلغ، المرجع، الوقت، معلومات المرسل                │
│           ↓                                                       │
│  🧠 Smart Matching Engine تطابق المعاملة مع الطلب تلقائياً       │
│           ↓                                                       │
│  ✅ تأكيد فوري ← Webhook للتاجر ← الطلب مدفوع!                  │
│                                                                   │
│  ⏱️ الوقت: ثواني معدودة                                         │
│  ✅ دقة عالية (مطابقة متعددة العوامل)                             │
│  ✅ يتوسع بلا حدود (بدون موظفين)                                 │
│  ✅ لا يمكن التزوير (بيانات مباشرة من البنك)                      │
└──────────────────────────────────────────────────────────────────┘
```

### لماذا Open Finance وليس تكامل مباشر مع البنوك؟

| | تكامل مباشر مع كل بنك | Open Finance (JoPACC) |
|--|------------------------|-----------------------|
| **التكلفة** | تكامل منفصل لكل بنك | تكامل واحد يغطي جميع البنوك |
| **التعقيد** | كل بنك له API مختلف | واجهة موحدة (JOF Standard) |
| **الأمان** | تفاوض أمني مع كل بنك | JoPACC تدير الأمان مركزياً (JAdES + JWE) |
| **الموافقة** | كل بنك له نظام consent مختلف | Consent موحد عبر Open Finance |
| **التوسع** | إضافة بنك جديد = مشروع جديد | إضافة بنك جديد = تلقائي |

### الابتكار الأساسي: المطابقة متعددة العوامل

بدلاً من الاعتماد على المرجع فقط (الذي قد ينساه العميل)، Amana Pay تستخدم **عوامل متعددة**:

| العامل | كيف يعمل | الدقة | مصدر البيانات | متاح اليوم؟ |
|--------|----------|-------|---------------|-------------|
| **تغيّر الرصيد** | مراقبة رصيد التاجر عبر Balances API (الفرق = المبلغ الديناميكي) | عالية | Balances API | ✅ متاح |
| **هوية المرسل** | مطابقة IBAN المستخرج من (OAuth Consent) مع `debtorAccount` في المعاملة | 100% (حاسمة) | Transactions API | ⏳ عند توفره |
| **المبلغ الديناميكي** | كل طلب له مبلغ فريد (10.024 بدل 10.000) | عالية جداً | Transactions API | ⏳ عند توفره |
| **المرجع** | AP-XXXX-YYYY في حقل المرجع | عالية | Transactions API | ⏳ عند توفره |
| **نافذة الوقت** | المعاملة خلال 30 دقيقة من إنشاء الطلب | متوسطة | Transactions API | ⏳ عند توفره |
| **حالة المعاملة** | المعاملة ناجحة ومكتملة | أساسية | Transactions API | ⏳ عند توفره |
| **حساب التاجر** | المعاملة وصلت لحساب التاجر المحدد | أساسية | Transactions API | ⏳ عند توفره |

> [!IMPORTANT]
> **وضعان للمطابقة (Matching Modes):** بما أن **Transactions API غير منشور حالياً** (حالة DRAFT v0.4.3)، فإن 6 من 7 عوامل تعتمد عليه. لذلك يعمل المحرك بوضعين:
> - **وضع اليوم (Balance-Only Mode):** يعتمد على Balance Change Detection (Balances API المتاحة). تُعاد معايرة الأوزان بحيث يكفي تطابق فرق الرصيد مع المبلغ الديناميكي الفريد + النافذة الزمنية لتجاوز عتبة التأكيد.
> - **الوضع الكامل (Full Mode):** يُفعَّل تلقائياً عند نشر Transactions API، فيدخل عامل هوية المرسل (الحاسم) وبقية العوامل بأوزانها الكاملة.
>
> المبلغ الديناميكي الفريد هو حجر الأساس في **كلا الوضعين** (يُكتشف عبر الرصيد اليوم، وعبر المعاملة لاحقاً).

---

### 🔥 اكتشافات من SDKs تقوّي الموقف (من تحليل OpenAPI Specs)

#### اكتشاف 1: CliQ Alias كـ Routing ضمن Accounts API

الحسابات تدعم routing بأنماط متعددة في `routingsComplexType`:
```json
// mainRoute
{"address": "JO27CBJO0010000000000000000001", "schema": "IBAN"}
// routings[] — CliQ مؤكدة كقيمة schema في المواصفة
{"address": "HSM", "schema": "CLIQ"}
```

> [!NOTE]
> **حدود التحقق:** `GET /accounts/{accountAddress}` يقبل هيدر `accountSchema` كـ `string` بقيمة افتراضية `accountId`، ووصفه يذكر صراحةً `accountId` و`IBAN` فقط (بدون `enum` يحصر القيم). أما `CLIQ` فمؤكدة كقيمة لـ `routings[].schema` في **بيانات الخرج**، لكن استخدامها كقيمة استعلام في الهيدر هو **استنتاج معماري لم تؤكده المواصفة صراحةً**.

**التأثير**: نسترجع IBAN واسم البنك و`routings` (بما فيها CliQ) **تلقائياً** عبر Open Finance. (التسجيل بـ CliQ Alias كمُعرّف بحث مباشر يبقى افتراضاً يحتاج تأكيد JoPACC، والبديل المضمون هو التسجيل بـ IBAN/accountId.)

#### اكتشاف 2: تحقق شامل قبل الدفع عبر مصدرين

**أ) IBAN Confirmation** — `GET /institution/ibanConf` ترجع:
- `status: active/inactive` — هل الحساب فعال؟
- `lockedForCredit: true/false` — هل يقبل تحويلات واردة؟
- `lockedForDebit: true/false`
- `accountOwner.name.enName / arName` — اسم صاحب الحساب **من البنك مباشرة** (لا يمكن تزويره) + `accountOwner.accountHolderType` (individual)
- `institutionBasicInfo` — اسم البنك و BIC Code (`institutionIdentification.address` + `schema: bicCode`) و `institutionType: BANK`
- `currencies` — عملات الحساب

> [!NOTE]
> **تصحيح مصدر البيانات:** حقل `accountType` في IBAN Confirmation هو **هيدر إدخال إلزامي (request header)** وليس حقلاً في الاستجابة. نوع الحساب `accountType.code: "CHK.BUS"` (Business Checking Account) يأتي فعلياً من **Accounts API** (مخطط `account`)، وكذلك حقلا `lockedForCredit`/`lockedForDebit` متوفران أيضاً ضمن مخطط `account`.

**ب) Accounts API** — مخطط `account` يوفّر إضافياً: `accountType.code: "CHK.BUS"` + `accountType.name`, `accountStatus: active`, `lockedForCredit/lockedForDebit`, `accountHolderType`, `availableBalance` مضمّن, و `routings` (IBAN + CLIQ).

**التأثير**: قبل كل دفعة نتحقق أن حساب التاجر فعال ويقبل تحويلات. إذا `lockedForCredit: true` → نوقف الطلب!

#### اكتشاف 3: Balance Change Detection — العمود الفقري العملي اليوم

Balances API ترجع `lastModificationDate` + `availableBalance.balanceAmount`. هذا يعني:
```
1. قبل الدفع: نسجل رصيد التاجر = 1500.000 JOD
2. العميل يدفع 10.024 JOD عبر CliQ
3. نراقب: GET /accounts/{id}/balances كل 15 ثانية
4. الرصيد الجديد = 1510.024 ← الفرق = 10.024 = المبلغ الديناميكي ✅
5. lastModificationDate تغيّر = وصل تحويل!
```

> [!WARNING]
> **قيود Balance Change Detection (يجب معالجتها):**
> - Balances API **لا ترجع هوية المرسل** (`debtorAccount`) — لذا المطابقة بالرصيد تعتمد كلياً على تفرّد المبلغ الديناميكي + النافذة الزمنية.
> - عند وصول **أكثر من تحويل في نفس النافذة**، أو تغيّر الرصيد لسبب آخر (رسوم/فائدة/استرداد)، قد يصبح الفرق غامضاً. لذلك يطبّق `polling.service` و`matching.service` منطق **«تغيّرات رصيد متعددة في نفس النافذة»**: يحتفظ بقائمة دلتا (deltas) ويطابق كل دلتا مع المبالغ الديناميكية المعلّقة بشكل فردي، وعند الغموض يُحوِّل الطلب إلى `REVIEW` بدل التأكيد التلقائي.

**Amana Pay تعمل اليوم** مع Balances API المتوفرة حالياً، وستكون أقوى وأدق عند نشر Transactions API (الذي يضيف هوية المرسل الحاسمة).

#### اكتشاف 4: `callbacks: {}` في كل API — نقطة امتداد محتملة

كل الـ 11 API تحتوي على `"callbacks": {}` — وهو كائن **فارغ** ضمن مخطط OpenAPI 3.0.

> [!NOTE]
> **توضيح:** `callbacks: {}` الفارغ لا يُعرّف أي Webhook فعلي (هو غالباً ناتج تلقائي من مولّد المواصفة). وجوده يمثّل **نقطة امتداد محتملة** فقط، وليس دليلاً على جاهزية Push/Real-time. لذلك تعتمد Amana Pay على **Polling كآلية أساسية معلنة**، مع استعداد معماري للانتقال إلى Push إذا فعّلت JoPACC الـ callbacks مستقبلاً.

**التأثير**: بنية Amana Pay تدعم Polling الآن، وقابلة للترقية إلى Push دون إعادة تصميم.

#### اكتشاف 5: Fees API = شفافية رسوم (SSTs اليوم، قابلة للتوسّع لـ CliQ)

`GET /institution/fees/SSTs` ترجع رسوم الخدمات مع حقل `service` الذي يقبل قيمة مثل `"CLIQ"`.

> [!NOTE]
> **الحدود الحالية:** الخدمة **محصورة حالياً بـ SSTs** (أجهزة الخدمة الذاتية/ATM) حسب وصف المواصفة الرسمي: *"currently provides a list of SSTs' fees and will expand ... in the future"*. المثال الفعلي للرسوم هو سحب نقدي من ATM. صحيح أن `service` يقبل `"CLIQ"` كقيمة، لكن **تغطية رسوم تحويلات CliQ غير مضمونة الآن** وستتوفر عند توسّع الخدمة.

**التأثير**: نعرض للتاجر شفافية الرسوم المتاحة (وعند توفّر رسوم CliQ: المبلغ الأصلي + الديناميكي − رسوم CliQ = الصافي المتوقع).

---

## نموذج الربح (Business Model)

عمولة صغيرة **0.5%–1%** على كل معاملة **مؤكدة** فقط، تُحسب آلياً وتُجمَّع وتُخصم **شهرياً** من التاجر (وليست من حركة الأموال — فالأموال لا تمر عبر Amana Pay، بل مباشرة لحساب التاجر). **باقة مجانية** لعدد محدود من المعاملات شهرياً (مثلاً أول 50) لجذب التجار الصغار. *(الحساب الآلي ممكن مباشرة من حقول `confidence_score`/`status='CONFIRMED'` في جدول `payment_requests`.)*

---

## التدفق الكامل في الواقع (Production Flow)

هذا هو التدفق الابتكاري (11 خطوة) الذي يعتمد على SDKs الخاصة بـ JoPACC ليقدم حلاً خاضعاً لقوانين Open Finance. يستخدم **APIs متاحة اليوم** (Accounts, Balances, CAF, IBAN Confirmation) بشكل أساسي، مع **Transactions API كطبقة ترقية** (غير منشورة حالياً — حالة DRAFT v0.4.3) تُفعّل تلقائياً عند توفّرها:

> [!IMPORTANT]
> ### نموذج موافقة العميل (حاسم لتجربة الاستخدام)
> موافقة العميل **ليست لكل عملية دفع**. هي موافقة AIS **لمرة واحدة** تُمنح لـ Amana Pay (بصفتها TPP)، **طويلة الأمد (حتى 90 يوماً)**، وتُعاد استخدامها **صامتة عبر كل المتاجر** طوال صلاحيتها. كما أنها **اختيارية**: المطابقة الأساسية تتم من جهة التاجر بالمبلغ الديناميكي الفريد دون أي تدخّل من العميل.
>
> **مستويان (Tiers):**
> - **Express (افتراضي — صفر احتكاك):** لا OAuth للعميل. يدفع عبر CliQ مباشرة؛ المطابقة بالمبلغ الديناميكي + رصيد/معاملات التاجر.
> - **Verified (موافقة لمرة واحدة):** تُطلب فقط في **أول** تعامل للعميل مع Amana Pay. تفتح: فحص الرصيد المسبق (CAF) + تعبئة مسبقة + أعلى ثقة + ربط Phone↔IBAN لإعادة استخدام صامت لاحقاً.
>
> ملاحظة: لا يوجد Consent API ضمن الـ SDKs المنزّلة؛ إدارة الموافقة وصلاحيتها تخضع لطبقة OAuth وقواعد البنك المركزي (نُحاكيها كـ mock بنموذج AIS طويل الأمد).

#### المسار (أ): العميل لأول مرة — تهيئة لمرة واحدة (اختيارية)

1. **العميل يفتح صفحة الدفع** ويُدخل رقم هاتفه: `0791234567`.

2. **عرض خيار الترقية (Verified) — غير إلزامي**
   - يستطيع المتابعة فوراً عبر **Express** (يقفز للخطوة 6).
   - أو يختار **ربط حسابه مرة واحدة** عبر OAuth Consent للحصول على دفع أسرع وأكثر أماناً مستقبلاً.

3. **بدء Consent Flow (مرة واحدة فقط، عند اختيار Verified)**
   - يُحوَّل العميل إلى بنكه عبر OAuth → يوافق على **قراءة بيانات الحساب (AIS)** لمدة تصل إلى 90 يوماً.
   - ✔ يُصدر `Access Token` + `Consent ID` **يُخزَّنان لإعادة الاستخدام عبر كل المتاجر** طوال الصلاحية.

4. **استرجاع الحسابات المرتبطة** (Verified فقط)
   - `GET /accounts` → `accountId`, `IBAN (mainRoute)`, `routings[]` (IBAN + CLIQ), `accountType.code (CHK.BUS)`, `accountStatus`.
   - اسم العميل من **IBAN Confirmation** (`accountOwner.name`)؛ مخطط `account` لا يحتوي اسماً.
   - يُبنى **Payment Identity** ويُربط: `Phone ↔ accountId ↔ IBAN` (لإعادة الاستخدام الصامت لاحقاً).

5. **التحقق من توفر الرصيد (CAF)** (Verified فقط)
   - `POST /accounts/{accountId}/CAF` → كافٍ: استمرار / غير كافٍ: رفض الجلسة.

#### المسار (ب): العميل العائد — صفر redirect

> العميل الذي سبق وربط حسابه (Verified ساري) **لا يمر بأي OAuth**: يُدخل رقم هاتفه فقط، فيستدعي النظام الرمز المحفوظ صامتاً (CAF + هوية) ويتابع مباشرة. أما عميل Express فيتابع دون أي إدخال إضافي.

6. **إنشاء Payment Session**
   - تحتوي: `Dynamic Amount` (10.024)، `Payment Reference` (AP-1024)، `Merchant CliQ Alias`، `Expiry Time`.
   - `Expected Customer Identity` تُضاف **فقط** في وضع Verified (من الموافقة المحفوظة)؛ في Express تبقى المطابقة بالمبلغ الديناميكي.

7. **عرض تعليمات الدفع للعميل**
   ```
   أحمد محمد — البنك العربي — جاهز للدفع ✅

   ادفع: 10.024 JOD
   إلى: MERCHANT CLIQ
   المرجع: AP-1024
   ```

8. **العميل ينفذ الدفع عبر البنك / CliQ**
   - التحويل يتم مباشرة من البنك إلى التاجر (Amana Pay لا يتدخل في حركة الأموال).

9. **اكتشاف الدفعة عبر Open Finance**
   - **وضع اليوم (أساسي):** Amana Pay يراقب رصيد التاجر عبر `Balances API` (Polling)، ويكتشف الدفعة من تغيّر `availableBalance` + `lastModificationDate`، فيستخرج دلتا الرصيد = المبلغ المستلم.
   - **الوضع الكامل (عند توفّر Transactions API):** يستدعي `Transactions API` (لصالح التاجر) ويحصل على: `debtorAccount` (IBAN المُرسل)، `amount`، `timestamp`، `reference`، `status`.

10. **Smart Matching Engine**
    - **وضع اليوم:** المطابقة عبر تطابق دلتا الرصيد مع المبلغ الديناميكي الفريد + النافذة الزمنية (مع تحويل الحالات الغامضة إلى مراجعة).
    - **الوضع الكامل:** يضيف العوامل الحاسمة (IBAN من الـ Consent مقابل debtorAccount، المرجع، حساب التاجر، حالة المعاملة).

11. **نتيجة المطابقة**
    - **إذا تطابق:** ✔ Payment Confirmed ✔ Order = Paid ✔ Webhook sent ✔ No manual reconciliation.
    - **إذا لم يتطابق:** Pending / Manual review queue.

---

## كيف يعمل البروتوتايب (Demo Flow)

في البروتوتايب، **نحاكي الواقع بالكامل** مع Mock Services:

### تدفق العرض التقديمي:

```
1️⃣ المقدّم يفتح Dashboard → يسجل كتاجر جديد
   يدخل فقط: CliQ Alias + البريد الإلكتروني
   ↓
2️⃣ النظام يسترجع بيانات الحساب تلقائياً عبر Open Finance:
   IBAN, البنك, نوع الحساب, حالة الحساب ← من Accounts API
   اسم صاحب الحساب ← من IBAN Confirmation (accountOwner.name)
   ↓
3️⃣ شاشة OAuth Consent وهمية → يوافق على ربط حسابه البنكي
   ↓
4️⃣ من Dashboard → ينشئ طلب دفع جديد (10 JOD)
   ↓
5️⃣ يفتح رابط صفحة الدفع كأنه العميل.
   يُطلب منه إدخال رقم هاتفه (CliQ Alias العميل).
   ↓
6️⃣ النظام يعرض خيار **Express** (دفع مباشر) أو **Verified** (ربط لمرة واحدة).
   في الديمو نعرض **Verified**: يُوجَّه العميل لشاشة (Mock OAuth Consent) **لأول مرة فقط**.
   العميل يوافق → يُصدر `Access Token` + `Consent ID` يُحفظ 90 يوماً (يُعاد استخدامه صامتاً عبر كل المتاجر).
   ↓
7️⃣ النظام يستدعي Accounts API بالتوكن → يجلب IBAN العميل + نوع الحساب.
   يجلب اسم العميل عبر IBAN Confirmation (accountOwner.name).
   يستدعي CAF → "رصيد كافٍ ✅".
   يعرض النظام صفحة الدفع مع: اسم العميل، المبلغ الديناميكي، المرجع القصير (AP-1024).
   ↓
8️⃣ يضغط زر "محاكاة الدفع عبر CliQ" 🔘
   ↓
9️⃣ النظام يحاكي (وضع المطابقة الكامل عبر محاكاة Transactions API):
   • Transactions API للتاجر: معاملة CliQ واردة، والـ debtorAccount يطابق الـ IBAN المستخرج من الـ Consent!
   • Smart Matching يطابق العوامل (حتى 7 عوامل في الوضع الكامل) بكفاءة تامة.
   ↓
🔟 صفحة الدفع تتحدث تلقائياً → "تم الدفع بنجاح! ✅"
   ↓
1️⃣1️⃣ Dashboard يتحدث → الطلب "مؤكد" + سجل المعاملات يعرض تفاصيل المطابقة (حتى 7 عوامل في الوضع الكامل، وأبرزها IBAN Match).
```

---

## User Review Required

> [!IMPORTANT]
> ### Mock JoPACC SDKs
> جميع JoPACC APIs ستكون Mock كامل يحاكي الاستجابات الحقيقية بناءً على OpenAPI Specs المنزلة. البنية مصممة بحيث عند الانتقال للإنتاج يُستبدل Mock بـ real SDK بدون تغيير أي كود آخر.

> [!TIP]
> ### Transactions API + Balance Change Detection
> البوابة **لا تحتوي على Transactions API منفصل منشور** بعد (الكتالوج يضم 12 إدخالاً، بدون Transactions)، لكن:
> - نماذج البيانات `debtorComplexType`/`creditorComplexType` (مع `debtorAccount`/`creditorAccount`) وروابط **HATEOAS** لـ `/accounts/{accountId}/transactions` موجودة فعلياً داخل مواصفتَي **Accounts** و**IBAN Confirmation** — ما يؤكد وجود المسار في المعيار.
> - **Balances API** (متوفرة) تكفي للكشف عن الدفعات عبر مراقبة تغيّر الرصيد + `lastModificationDate` (مع تنبيه: لا ترجع هوية المرسل، وتحتاج معالجة الدلتا المتعددة).
> - البروتوتايب يدعم **الوضعين**: Balance-Only (يعمل الآن) + Full (يُفعَّل تلقائياً عند نشر Transactions API).

---

## Proposed Changes

### هيكل المشروع النهائي

```
مشروع_بحث/
├── sdks/                              # ✅ تم تنزيلها
│   └── jopacc-open-finance/
│       ├── openapi-specs/             # 13 ملف OpenAPI JSON
│       └── raml-specs/                # 11 ملف RAML
│
├── backend/
│   ├── package.json
│   ├── server.js                      # Express server + WebSocket
│   ├── config/
│   │   └── config.js                  # Environment config
│   │
│   ├── jopacc-sdk/                    # Mock JoPACC SDK Wrapper
│   │   ├── index.js                   # SDK entry - exports all clients
│   │   ├── mock-data/                 # بيانات وهمية واقعية
│   │   │   ├── banks.json             # بنوك أردنية حقيقية (BIC, names, CliQ support)
│   │   │   ├── accounts.json          # حسابات وهمية (IBAN + CliQ Alias routing)
│   │   │   ├── transactions.json      # معاملات وهمية
│   │   │   └── fees.json              # رسوم CliQ من Fees API
│   │   ├── auth-client.js             # API Key + Basic Auth simulation
│   │   ├── consent-client.js          # OAuth Consent flow simulation
│   │   ├── jades-client.js            # JAdES B-B signature mock
│   │   ├── jwe-client.js              # JWE encryption mock
│   │   ├── accounts-client.js         # GET /accounts mock (يدعم IBAN + CLIQ schema)
│   │   ├── balances-client.js         # GET /balances mock (مع lastModificationDate)
│   │   ├── transactions-client.js     # GET /transactions mock
│   │   ├── caf-client.js              # POST /accounts/{id}/CAF mock
│   │   ├── iban-client.js             # GET /institution/ibanConf mock (+ lockedForCredit)
│   │   ├── fees-client.js             # GET /institution/fees/SSTs mock (رسوم CliQ)
│   │   └── institutions-client.js     # GET /institution mock
│   │
│   ├── services/
│   │   ├── payment.service.js         # إنشاء/إدارة طلبات الدفع
│   │   ├── matching.service.js        # Smart Matching Engine (وضعان: Balance-Only + Full حتى 7 عوامل)
│   │   ├── polling.service.js         # Dual Poller: Balances + Transactions
│   │   ├── merchant.service.js        # إدارة التجار (+ CliQ Alias lookup)
│   │   ├── verification.service.js    # Pre-Payment Validation (IBAN + lockedForCredit)
│   │   ├── consent.service.js         # Consent management (موافقة طويلة الأمد + إعادة استخدام صامت)
│   │   ├── webhook.service.js         # Webhook dispatch
│   │   └── demo.service.js            # محاكاة الدفع للعرض
│   │
│   ├── routes/
│   │   ├── api.routes.js              # Merchant REST API /api/v1/*
│   │   ├── payment-page.routes.js     # Payment page API
│   │   ├── dashboard.routes.js        # Dashboard API
│   │   └── demo.routes.js             # Demo simulation endpoints
│   │
│   ├── middleware/
│   │   ├── auth.js                    # API Key auth
│   │   └── error-handler.js
│   │
│   └── database/
│       ├── db.js                      # SQLite connection
│       └── schema.sql                 # Database schema
│
├── frontend/
│   ├── payment-page/                  # صفحة دفع العميل
│   │   ├── index.html                 # صفحة الدفع الرئيسية
│   │   ├── styles.css
│   │   └── app.js
│   │
│   ├── dashboard/                     # لوحة تحكم التاجر
│   │   ├── index.html                 # Dashboard main
│   │   ├── styles.css
│   │   ├── app.js
│   │   ├── pages/
│   │   │   ├── overview.html          # نظرة عامة + إحصائيات
│   │   │   ├── payments.html          # قائمة المدفوعات
│   │   │   ├── new-payment.html       # إنشاء طلب دفع
│   │   │   ├── transactions.html      # سجل المعاملات
│   │   │   └── settings.html          # الإعدادات + Webhooks
│   │   └── components/
│   │       ├── sidebar.js
│   │       ├── stats-cards.js
│   │       ├── payment-table.js
│   │       └── charts.js
│   │
│   └── consent/                       # شاشة الموافقة البنكية
│       ├── index.html                 # OAuth-style consent page
│       ├── styles.css
│       └── app.js
│
└── docs/
    └── API.md                         # Merchant API Documentation
```

---

### المكون 1: Mock JoPACC SDK (`backend/jopacc-sdk/`)

SDK Wrapper كامل يحاكي سلوك JoPACC Open Finance APIs الحقيقي. مبني بناءً على OpenAPI Specs المنزلة.

#### [NEW] `auth-client.js`
- محاكاة API Key authentication (`x-Gateway-APIKey` header)
- محاكاة HTTP Basic Auth
- توليد tokens وهمية
- محاكاة الـ headers الإلزامية: `x-interactions-id`, `x-idempotency-key`

#### [NEW] `consent-client.js`
- محاكاة تدفق OAuth Consent الكامل (للتاجر **وللعميل**):
  1. `initiateConsent(subjectId, permissions, validityDays=90)` → redirect URL
  2. `getConsentStatus(consentId)` → pending/authorized/revoked/expired
  3. `revokeConsent(consentId)`
  4. `findReusableConsent(subjectId)` → يُرجع موافقة سارية محفوظة (إن وُجدت) **دون إعادة توجيه**
- **نموذج الصلاحية:** موافقة AIS **طويلة الأمد (حتى 90 يوماً)**، مرتبطة بالـ subject (التاجر أو العميل) تجاه Amana Pay كـ TPP، **يُعاد استخدامها صامتة عبر كل المتاجر** طوال الصلاحية — ليست لكل عملية ولا لكل متجر.
- Permissions: `AccountInfo`, `Balances`, `Transactions`
- ملاحظة: لا يوجد Consent API ضمن الـ SDKs؛ هذه محاكاة لطبقة OAuth/CBJ بنموذج AIS طويل الأمد.

#### [NEW] `jades-client.js`
- `sign(headers, body)` → detached JWS signature في هيدر `x-jws-signature` (محاكاة **RS256** — مطابقة للمواصفة) — يقابل `POST /generateJAdESBB`
- `verify(headers, body, signature)` → `{digest: "valid", signature: "valid", status: "success"}` — يقابل `POST /verifyJAdESBB`
- `getPublicKey()` → RSA public key structure — يقابل `GET /publicKey`
- يُستخدم تلقائياً في كل طلب SDK (هيدر `x-jws-signature` إلزامي في كل الخدمات)

#### [NEW] `jwe-client.js`
- `encrypt(payload)` → JWE compact serialization string (يقابل `POST /generateJWE`)
- `decrypt(jweToken)` → original payload (يقابل `POST /verifyJWE` في المواصفة)
- محاكاة `RSA-OAEP-256` (alg) + `A256GCM` (enc) — مطابقة لأمثلة المواصفة
- نقاط النهاية الفعلية: `/generateJWE`, `/verifyJWE`, `/publicKey`

#### [NEW] `accounts-client.js`
- `getAccount(accountAddress, schema)` → بيانات حساب واقعية
  - **يدعم نمطي routing مؤكدين**: `schema=IBAN` أو `schema=accountId` (القيمتان الموثّقتان صراحةً في هيدر `accountSchema`)
  - `schema=CLIQ` كقيمة استعلام: **استنتاج معماري** (CLIQ مؤكدة في `routings[].schema` كخرج فقط) — يُدعم في الـ mock مع تنويه أنه يحتاج تأكيد JoPACC للإنتاج
- `listAccounts()` → قائمة حسابات
- يرجع: `accountId`, `mainRoute (IBAN)`, `routings[]` (IBAN + CLIQ), `accountType.code (CHK.BUS)`, `accountStatus`, `lockedForCredit/lockedForDebit`, `institutionBasicInfo` (اسم البنك + BIC)
- ملاحظة: مخطط `account` **لا يتضمن اسم صاحب الحساب** — يُجلب الاسم من IBAN Confirmation
- **بيانات واقعية**: بنوك أردنية حقيقية (البنك العربي، بنك الأردن، البنك الأهلي...)

#### [NEW] `balances-client.js`
- `getBalance(accountId)` → `{availableBalance: {balanceAmount, balancePosition}, currentBalance: {balanceAmount, balancePosition}, balanceCurrency: "JOD", lastModificationDate}` — مطابق لـ `GET /accounts/{accountId}/balances`
- أرصدة ديناميكية تتغير عند محاكاة الدفع
- `lastModificationDate` يتحدث عند كل تغيّر في الرصيد
- **يُستخدم في Balance Change Detection**: مقارنة `availableBalance.balanceAmount` قبل وبعد الدفع

#### [NEW] `transactions-client.js` ⭐ (الأهم)
- `listTransactions(accountId, fromDate, toDate)` → قائمة معاملات
- `getTransaction(accountId, transactionId)` → معاملة واحدة
- كل معاملة تحتوي: `{transactionId, amount, reference, timestamp, debtorName, debtorIBAN, status, type}`
- **يتكامل مع Demo Service**: عند محاكاة الدفع، تُضاف معاملة جديدة تلقائياً

#### [NEW] `caf-client.js`
- `checkFunds(accountId, amount, currency)` → `{fundsAvailable: true, validityDateTime}`
- محاكاة التحقق من الرصيد قبل الدفع

#### [NEW] `iban-client.js` ⭐ (Pre-Payment Validation)
- `confirmIBAN({accountId, accountType, uidType, uidValue})` → استجابة شاملة:
  ```json
  {
    "status": "active",
    "lockedForCredit": false,
    "lockedForDebit": false,
    "currencies": ["JOD", "USD"],
    "accountOwner": {
      "name": {"enName": "...", "arName": "..."},
      "accountHolderType": "individual"
    },
    "institutionBasicInfo": {
      "name": {"enName": "Etihad Bank"},
      "institutionType": "BANK",
      "institutionIdentification": {"address": "ETIHJOAX", "schema": "bicCode"}
    }
  }
  ```
- ملاحظة: `accountType` و`accountId` و`uidType` و`uidValue` كلها **هيدرات إدخال إلزامية**؛ و`accountType` **لا يُرجع في الاستجابة** (نوع الحساب يُجلب من Accounts API).
- **يُستخدم عند**: تسجيل التاجر (التحقق من الحساب + جلب الاسم) + قبل كل طلب دفع (التأكد أن الحساب لا يزال يقبل تحويلات).

#### [NEW] `fees-client.js` 🆕
- `getServiceFees(service)` → رسوم خدمة محددة عبر `GET /institution/fees/SSTs?service=...`
- `getCliQFees()` → يستعلم بـ `service=CLIQ` (مدعوم كقيمة، لكن التغطية الفعلية لرسوم CliQ غير مضمونة حالياً — الخدمة محصورة بـ SSTs)
- يرجع: `{data: [{feeId, service, feeCategory, serviceChannel, fees: [{feeType, feeAmount: {amount, currency}}]}]}`
- **يُستخدم في**: عرض شفافية الرسوم المتاحة للتاجر (عند توفّر رسوم CliQ: المبلغ − الرسوم = الصافي)

#### [NEW] `institutions-client.js`
- `getInstitution()` → `{institutionType: "BANK", name, address, branches}`
- بيانات بنوك أردنية واقعية

#### [NEW] `mock-data/banks.json`
```json
[
  {"bic": "ARABJOAX", "name": {"en": "Arab Bank", "ar": "البنك العربي"}, "cliqSupported": true},
  {"bic": "JONBJOAX", "name": {"en": "Bank of Jordan", "ar": "بنك الأردن"}, "cliqSupported": true},
  {"bic": "UBSIJOAX", "name": {"en": "Jordan Islamic Bank", "ar": "البنك الإسلامي الأردني"}, "cliqSupported": true},
  {"bic": "AHLIJOAX", "name": {"en": "Jordan Ahli Bank", "ar": "البنك الأهلي الأردني"}, "cliqSupported": true},
  {"bic": "ETIHJOAX", "name": {"en": "Etihad Bank", "ar": "بنك الاتحاد"}, "cliqSupported": true},
  {"bic": "CAPIJOAX", "name": {"en": "Capital Bank", "ar": "بنك المال"}, "cliqSupported": true},
  {"bic": "HOUPJOAX", "name": {"en": "Housing Bank", "ar": "بنك الإسكان"}, "cliqSupported": true}
]
```

---

### المكون 2: Smart Matching Engine (`backend/services/matching.service.js`)

#### [NEW] `matching.service.js`

محرك المطابقة الذكي متعدد العوامل — يعمل بوضعين حسب توفّر Transactions API:

```javascript
// خوارزمية المطابقة — وضعان: Balance-Only (اليوم) + Full (عند توفر Transactions)
match(paymentRequest, transaction, balanceChange) {
  let score = 0;
  let factors = [];
  const apisUsed = ['Balances'];

  // ===== الوضع الكامل: يتطلب وجود معاملة من Transactions API =====
  if (transaction) {
    apisUsed.push('Transactions', 'Accounts');

    // ===== العوامل الأساسية (Express): متاحة دون موافقة العميل — مجموعها 100 =====
    // المبلغ الديناميكي الفريد هو حجر الأساس، والمرجع يعزّزه

    // المبلغ الديناميكي (35)
    if (Math.abs(transaction.amount - paymentRequest.dynamicAmount) < 0.001) {
      score += 35;
      factors.push({factor: 'DYNAMIC_AMOUNT', weight: 35, matched: true, source: 'Transactions API'});
    }

    // المرجع (25)
    if (transaction.reference && transaction.reference.includes(paymentRequest.reference)) {
      score += 25;
      factors.push({factor: 'REFERENCE', weight: 25, matched: true, source: 'Transactions API'});
    }

    // نافذة الوقت (15)
    const timeDiff = transaction.timestamp - paymentRequest.createdAt;
    if (timeDiff > 0 && timeDiff < 30 * 60 * 1000) {
      score += 15;
      factors.push({factor: 'TIME_WINDOW', weight: 15, matched: true, source: 'Transactions API'});
    }

    // حساب التاجر (creditorAccount) (10)
    if (transaction.creditorAccount === paymentRequest.merchantIBAN) {
      score += 10;
      factors.push({factor: 'MERCHANT_ACCOUNT', weight: 10, matched: true, source: 'Transactions API'});
    }

    // حالة المعاملة (5)
    if (transaction.status === 'completed') {
      score += 5;
      factors.push({factor: 'STATUS', weight: 5, matched: true, source: 'Transactions API'});
    }

    // تأكيد إضافي بتغيّر الرصيد (10)
    if (balanceChange) {
      const diff = balanceChange.newBalance - balanceChange.oldBalance;
      if (Math.abs(diff - paymentRequest.dynamicAmount) < 0.001) {
        score += 10;
        factors.push({factor: 'BALANCE_CHANGE', weight: 10, matched: true, source: 'Balances API'});
      }
    }

    // ===== هوية المرسل: معزِّز حاسم (Verified فقط) — لا يستهلك من الأساس =====
    // يتوفّر فقط عند ربط العميل لحسابه (موافقة محفوظة). غيابه (Express) لا يمنع التأكيد.
    let senderVerified = false;
    if (paymentRequest.expectedDebtorIBAN && transaction.debtorAccount === paymentRequest.expectedDebtorIBAN) {
      senderVerified = true;
      factors.push({factor: 'SENDER_IDENTITY', weight: 'decisive', matched: true, source: 'Consent (Accounts) + Transactions'});
    }

    return {
      mode: 'FULL',
      tier: senderVerified ? 'VERIFIED' : 'EXPRESS',
      score,
      // التأكيد ممكن عبر العوامل الأساسية وحدها؛ هوية المرسل تخفّض العتبة وترفع الثقة
      decision: (senderVerified && score >= 60) || score >= 75 ? 'CONFIRMED'
              : score >= 50 ? 'REVIEW' : 'UNMATCHED',
      senderVerified,
      factors,
      apisUsed
    };
  }

  // ===== وضع اليوم (Balance-Only): إعادة معايرة الأوزان بدون Transactions =====
  // المصدر الوحيد المتاح هو Balances API، لذا يُعاد توزيع الوزن على:
  // فرق الرصيد = المبلغ الديناميكي الفريد (70%) + النافذة الزمنية (30%)
  if (balanceChange) {
    const diff = balanceChange.newBalance - balanceChange.oldBalance;

    // العامل أ: تطابق دلتا الرصيد مع المبلغ الديناميكي الفريد (70%)
    if (Math.abs(diff - paymentRequest.dynamicAmount) < 0.001) {
      score += 70;
      factors.push({factor: 'BALANCE_DELTA_MATCH', weight: 70, matched: true, source: 'Balances API'});
    }

    // العامل ب: النافذة الزمنية عبر lastModificationDate (30%)
    const tChange = balanceChange.lastModificationDate;
    const timeDiff = tChange - paymentRequest.createdAt;
    if (timeDiff > 0 && timeDiff < 30 * 60 * 1000) {
      score += 30;
      factors.push({factor: 'TIME_WINDOW', weight: 30, matched: true, source: 'Balances API (lastModificationDate)'});
    }
  }

  // معالجة الغموض: إن تطابقت أكثر من دلتا رصيد مع مبالغ معلّقة متعددة في نفس النافذة
  // يُخفَّض القرار إلى REVIEW (لا تأكيد تلقائي) — تُحلّ هذه الحالة في polling.service
  return {
    mode: 'BALANCE_ONLY',
    score,
    decision: balanceChange && balanceChange.ambiguous ? 'REVIEW'
            : score >= 70 ? 'CONFIRMED' : score >= 50 ? 'REVIEW' : 'UNMATCHED',
    factors,
    apisUsed
  };
}
```

> [!IMPORTANT]
> **الوضعان + المستويان:**
> - **حسب توفّر Transactions API:** `BALANCE_ONLY` (اليوم، عبر Balances فقط) ↔ `FULL` (عند نشر Transactions).
> - **حسب موافقة العميل:** `EXPRESS` (بلا موافقة — العوامل الأساسية تكفي للتأكيد، حجرها المبلغ الديناميكي الفريد) ↔ `VERIFIED` (موافقة محفوظة — هوية المرسل معزِّز حاسم يرفع الثقة ويخفّض العتبة).
>
> النقطة الجوهرية: **هوية المرسل لم تَعُد بوابة إلزامية** (كانت 40% تمنع التأكيد بدون موافقة)، بل معزِّز اختياري. هذا يحفظ تجربة الدفع السريع لعملاء Express، ويمنح عملاء Verified أعلى درجة ثقة — دون أن يعيد أيٌّ منهما الموافقة لكل عملية.

---

### المكون 2.5: 🆕 Pre-Payment Verification (`backend/services/verification.service.js`)

#### [NEW] `verification.service.js`

تحقق شامل قبل إنشاء طلب الدفع:

```javascript
async verifyMerchantAccount(merchantId) {
  // 1. IBAN Confirmation — التحقق من حالة الحساب
  //    ملاحظة: accountType هيدر إدخال إلزامي في IBAN Confirmation (وليس حقل خرج)
  const ibanResult = await ibanClient.confirmIBAN({
    accountId: merchant.iban,
    accountType: merchant.accountType,   // هيدر إلزامي (مثل CHK.BUS من Accounts API)
    uidType: 'NID',
    uidValue: merchant.nid
  });

  if (ibanResult.status !== 'active') throw new Error('حساب التاجر غير فعال');
  if (ibanResult.lockedForCredit) throw new Error('حساب التاجر لا يقبل تحويلات واردة');

  // 2. Balances — تسجيل الرصيد الحالي كـ baseline
  const balance = await balancesClient.getBalance(merchant.accountId);

  return {
    verified: true,
    accountStatus: ibanResult.status,
    acceptsCredit: !ibanResult.lockedForCredit,
    accountOwnerName: ibanResult.accountOwner.name,        // enName/arName من IBAN Confirmation
    accountHolderType: ibanResult.accountOwner.accountHolderType,
    currentBalance: balance.availableBalance.balanceAmount, // مسار الحقل الفعلي
    lastModified: balance.lastModificationDate,
    bankName: ibanResult.institutionBasicInfo.name
  };
}
```

---

### المكون 3: Payment Service (`backend/services/payment.service.js`)

#### [NEW] `payment.service.js`

**توليد المبلغ الديناميكي:**
```javascript
// المبلغ الأصلي: 10.000 JOD
// الكسر العشوائي: 0.001 - 0.099
// المبلغ الديناميكي: 10.024 JOD
generateDynamicAmount(originalAmount) {
  const fraction = Math.floor(Math.random() * 99) + 1; // 1-99
  return originalAmount + (fraction / 1000); // يضيف 0.001 - 0.099
}
```

**توليد المرجع الفريد:**
```javascript
// الصيغة: AP-{4 أرقام}-{4 أحرف/أرقام}
// مثال: AP-1024-X7K9
generateReference() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `AP-${num}-${suffix}`;
}
```

---

### المكون 4: Demo/Simulation Service (`backend/services/demo.service.js`)

#### [NEW] `demo.service.js`

هذا المكون مسؤول عن محاكاة الدفع في العرض التقديمي:

```javascript
simulatePayment(paymentRequestId) {
  // 1. جلب طلب الدفع
  const payment = getPaymentRequest(paymentRequestId);

  // 2. إنشاء معاملة وهمية كأنها قادمة من CliQ
  const mockTransaction = {
    transactionId: `TXN-${uuid()}`,
    amount: payment.dynamicAmount,
    reference: payment.reference,
    timestamp: new Date(),
    debtorName: "أحمد محمد الصالح",
    debtorIBAN: "JO94CBJO0010000000000131000302",
    debtorBank: "Arab Bank",
    creditorIBAN: payment.merchantIBAN,
    type: "CliQ_CREDIT",
    status: "completed"
  };

  // 3. حقن المعاملة في Mock Transactions Client
  transactionsClient.injectTransaction(payment.merchantAccountId, mockTransaction);

  // 4. Transaction Poller يلتقطها تلقائياً ← Smart Match ← Confirm
}
```

---

### المكون 5: Consent Flow UI (`frontend/consent/`)

#### [NEW] شاشة الموافقة البنكية (OAuth-style)

محاكاة واقعية لتجربة Open Finance Consent:

```
┌─────────────────────────────────────────┐
│  🏦 البنك العربي - Open Finance        │
│─────────────────────────────────────────│
│                                         │
│  Amana Pay تطلب الوصول إلى:            │
│                                         │
│  ☑️ معلومات الحساب (Account Info)       │
│  ☑️ الأرصدة (Balances)                  │
│  ☑️ المعاملات (Transactions)            │
│                                         │
│  الحساب: JO94CBJO00100000****0302       │
│  صاحب الحساب: Downtown Computers       │
│                                         │
│  مدة الصلاحية: 90 يوم                   │
│                                         │
│  ┌─────────────┐  ┌──────────────┐      │
│  │  ❌ رفض     │  │  ✅ موافقة   │      │
│  └─────────────┘  └──────────────┘      │
│                                         │
│  هذه الخدمة مرخصة من البنك المركزي     │
│  الأردني وتتوافق مع معايير Open Finance │
└─────────────────────────────────────────┘
```

---

### المكون 6: Customer Payment Page (`frontend/payment-page/`)

#### [NEW] صفحة دفع العميل

تصميم متميز ثنائي اللغة (عربي/إنجليزي) مع:
- **تعليمات الدفع الواضحة**: CliQ Alias, اسم البنك, المبلغ, المرجع
- **أزرار نسخ** لكل حقل (CliQ Alias, المبلغ, المرجع)
- **مؤقت عد تنازلي** (30 دقيقة)
- **تحديث حي للحالة** (Polling كل 3 ثوان)
- **زر "محاكاة الدفع"** (مخفي قليلاً، للمقدّم فقط)
- **أنيميشن** عند تأكيد الدفع (confetti + checkmark)
- **Mobile-first** + RTL support

**حالات صفحة الدفع:**
```
PENDING    → عرض التعليمات + المؤقت
PROCESSING → "جاري التحقق من الدفع..." (بعد ضغط محاكاة)
CONFIRMED  → "تم الدفع بنجاح! ✅" + أنيميشن
EXPIRED    → "انتهت صلاحية الطلب" + زر إعادة
```

---

### المكون 7: Merchant Dashboard (`frontend/dashboard/`)

#### [NEW] لوحة تحكم التاجر

**الصفحات:**

1. **نظرة عامة (Overview):**
   - بطاقات إحصائية: إجمالي المدفوعات، المعلقة، الناجحة، الملغاة
   - رسم بياني: المدفوعات خلال 7 أيام
   - آخر المدفوعات
   - حالة الربط مع Open Finance

2. **المدفوعات (Payments):**
   - جدول كامل بجميع طلبات الدفع
   - فلاتر: الحالة، التاريخ، المبلغ
   - تفاصيل كل طلب (المبلغ الأصلي، الديناميكي، المرجع، المطابقة)
   - إنشاء طلب دفع جديد

3. **المعاملات (Transactions):**
   - سجل المعاملات من Open Finance
   - تفاصيل المطابقة: Confidence Score + العوامل
   - المعاملات غير المطابقة

4. **الإعدادات (Settings):**
   - معلومات التاجر (CliQ Alias, بنك, IBAN)
   - Webhook URLs
   - API Keys
   - حالة Consent

---

### المكون 8: Merchant REST API

#### [NEW] API Endpoints

| Method | Path | الوصف |
|--------|------|-------|
| **POST** | `/api/v1/merchants/register` | تسجيل تاجر (IBAN/accountId → auto-lookup؛ CliQ كخيار استنتاجي) |
| **GET** | `/api/v1/merchants/verify` | 🆕 تحقق من حساب التاجر (IBAN Confirmation) |
| **POST** | `/api/v1/merchants/consent/initiate` | بدء تدفق Consent |
| **POST** | `/api/v1/merchants/consent/callback` | Consent callback |
| **POST** | `/api/v1/payments` | إنشاء طلب دفع (مع pre-payment validation) |
| **GET** | `/api/v1/payments/:id` | حالة طلب دفع |
| **GET** | `/api/v1/payments` | قائمة طلبات الدفع |
| **POST** | `/api/v1/payments/:id/cancel` | إلغاء طلب |
| **GET** | `/api/v1/transactions` | قائمة المعاملات |
| **GET** | `/api/v1/fees` | 🆕 رسوم الخدمة (SSTs اليوم؛ CliQ عند توفّره) |
| **GET** | `/api/v1/stats` | إحصائيات |
| **POST** | `/api/v1/demo/simulate-payment/:paymentId` | محاكاة دفع CliQ |
| **GET** | `/api/v1/payment-page/:paymentId` | بيانات صفحة الدفع |
| **GET** | `/api/v1/payment-page/:paymentId/status` | حالة الدفع (polling) |

---

### المكون 9: Database Schema

#### [NEW] `schema.sql`

```sql
-- التجار
CREATE TABLE merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    api_secret TEXT NOT NULL,
    -- معلومات الحساب البنكي (من Open Finance APIs)
    bank_name TEXT,
    bank_name_ar TEXT,
    bank_bic TEXT,
    cliq_alias TEXT,                     -- معرّف CliQ (خيار استنتاجي؛ المعرّف المضمون IBAN/accountId)
    account_name TEXT,
    account_name_ar TEXT,                -- 🆕 من IBAN Confirmation (accountOwner.name.arName)
    iban TEXT,
    jopacc_account_id TEXT,
    account_type_code TEXT,              -- من Accounts API (accountType.code = CHK.BUS)
    account_holder_type TEXT,            -- individual / corporate (Accounts.accountHolderType أو IBANConf.accountOwner.accountHolderType)
    -- حالة الحساب (من IBAN Confirmation + Accounts + Balances)
    account_status TEXT DEFAULT 'active', -- active/inactive (IBANConf.status أو Accounts.accountStatus)
    locked_for_credit BOOLEAN DEFAULT 0, -- من IBAN Confirmation (متوفر أيضاً في Accounts)
    last_known_balance REAL,             -- 🆕 آخر رصيد معروف من Balances API
    last_balance_check DATETIME,         -- 🆕 وقت آخر فحص للرصيد
    -- حالة Consent
    consent_id TEXT,
    consent_status TEXT DEFAULT 'none',
    consent_expires_at DATETIME,
    consent_permissions TEXT,
    -- عام
    webhook_url TEXT,
    webhook_secret TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- طلبات الدفع
CREATE TABLE payment_requests (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    order_id TEXT,
    -- المبالغ
    original_amount REAL NOT NULL,
    dynamic_amount REAL NOT NULL,
    currency TEXT DEFAULT 'JOD',
    estimated_fee REAL,                  -- رسوم متوقعة من Fees API (SST اليوم؛ CliQ عند توفّره)
    estimated_net REAL,                  -- 🆕 الصافي المتوقع للتاجر
    -- المرجع والتعليمات
    reference TEXT UNIQUE NOT NULL,
    cliq_alias TEXT,
    bank_name TEXT,
    account_name TEXT,
    -- هوية العميل المتوقعة (من موافقة محفوظة — Verified فقط؛ تبقى NULL في Express)
    expected_debtor_phone TEXT,
    expected_debtor_account_id TEXT,
    expected_debtor_iban TEXT,           -- يُستخدم كمعزِّز SENDER_IDENTITY (غيابه لا يمنع التأكيد)
    expected_debtor_name TEXT,
    payment_tier TEXT DEFAULT 'EXPRESS', -- EXPRESS / VERIFIED
    -- التحقق قبل الدفع
    pre_check_status TEXT,               -- 🆕 passed/failed (IBAN Confirmation)
    pre_check_locked_for_credit BOOLEAN, -- 🆕 هل الحساب يقبل تحويلات وقت الإنشاء
    balance_before REAL,                 -- 🆕 رصيد التاجر قبل الدفع (Balances API)
    balance_after REAL,                  -- 🆕 رصيد التاجر بعد الدفع
    -- الحالة
    status TEXT DEFAULT 'PENDING',
    -- المطابقة
    matched_transaction_id TEXT,
    confidence_score REAL,
    match_factors TEXT,
    apis_used TEXT,                      -- 🆕 JSON: APIs المستخدمة في المطابقة
    -- الأوقات
    expires_at DATETIME NOT NULL,
    confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT,
    description TEXT
);

-- المعاملات (من Open Finance)
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    bank_transaction_id TEXT,
    payment_request_id TEXT REFERENCES payment_requests(id),
    -- تفاصيل المعاملة
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'JOD',
    reference TEXT,
    transaction_type TEXT, -- CliQ_CREDIT, TRANSFER_CREDIT
    status TEXT, -- completed, pending, failed
    -- المرسل
    debtor_name TEXT,
    debtor_iban TEXT,
    debtor_bank TEXT,
    -- المستقبل
    creditor_iban TEXT,
    creditor_name TEXT,
    -- المطابقة
    match_status TEXT DEFAULT 'UNMATCHED', -- MATCHED, UNMATCHED, REVIEW
    confidence_score REAL,
    match_factors TEXT, -- JSON
    -- أوقات
    bank_timestamp DATETIME,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Deliveries
CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    payment_request_id TEXT,
    event_type TEXT NOT NULL, -- payment.confirmed, payment.expired, payment.failed
    url TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    status_code INTEGER,
    attempts INTEGER DEFAULT 0,
    next_retry_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- سجل التدقيق
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT,
    entity_type TEXT, -- payment, transaction, consent, merchant
    entity_id TEXT,
    action TEXT, -- created, updated, matched, confirmed, expired
    details TEXT, -- JSON
    jopacc_api_called TEXT, -- أي API تم استدعاؤه
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## مراحل التنفيذ

### المرحلة 1: البنية التحتية (1-2 ساعة)
- `[ ]` إعداد مشروع Node.js + Express + WebSocket
- `[ ]` إنشاء SQLite database + schema
- `[ ]` إعداد هيكل المجلدات

### المرحلة 2: Mock JoPACC SDK (2-3 ساعات)
- `[ ]` بيانات وهمية واقعية (بنوك أردنية، حسابات، معاملات، رسوم)
- `[ ]` Auth Client (API Key + Basic Auth)
- `[ ]` JAdES Client (signature mock)
- `[ ]` JWE Client (encryption mock)
- `[ ]` Accounts Client (**يدعم IBAN + CLIQ + accountId routing**)
- `[ ]` Balances Client (**مع lastModificationDate للـ Balance Change Detection**)
- `[ ]` Transactions Client (مع injectTransaction للمحاكاة)
- `[ ]` CAF Client
- `[ ]` IBAN Client (**مع lockedForCredit + accountOwner + accountType**)
- `[ ]` 🆕 Fees Client (رسوم CliQ)
- `[ ]` Consent Client (OAuth flow)
- `[ ]` Institutions Client

### المرحلة 3: Core Services (2-3 ساعات)
- `[ ]` Payment Service (dynamic amount + reference + **estimated fees**)
- `[ ]` Smart Matching Engine (**وضعان**: Balance-Only اليوم + Full حتى 7 عوامل، يعتمد على Consent IBAN)
- `[ ]` 🆕 Verification Service (Pre-Payment: IBAN Confirmation + lockedForCredit + accountType header)
- `[ ]` Dual Poller: **Balances** (الآن) + **Transactions** (مستقبلاً) + معالجة دلتا متعددة في نفس النافذة
- `[ ]` Demo/Simulation Service (يحقن معاملة + يغيّر الرصيد)
- `[ ]` Webhook Service
- `[ ]` Merchant Service (**auto-lookup عبر IBAN/accountId**؛ CliQ كخيار استنتاجي)
- `[ ]` Consent Service

### المرحلة 4: REST API (1-2 ساعة)
- `[ ]` Merchant registration (**IBAN/accountId → auto-fetch account data**؛ CliQ خيار استنتاجي)
- `[ ]` 🆕 Merchant verify endpoint (IBAN Confirmation)
- `[ ]` Payment CRUD endpoints (**مع pre-payment validation**)
- `[ ]` Transaction endpoints
- `[ ]` 🆕 Fees endpoint (رسوم الخدمة — SSTs اليوم، CliQ عند توفّره)
- `[ ]` Demo simulation endpoint
- `[ ]` Payment page data endpoint
- `[ ]` Stats endpoint

### المرحلة 5: صفحة الدفع (2-3 ساعات)
- `[ ]` تصميم مميز (Dark theme + Glassmorphism)
- `[ ]` عرض تعليمات الدفع + أزرار نسخ
- `[ ]` **بيانات البنك والحساب من Open Finance** (ليست مدخلة يدوياً)
- `[ ]` مؤقت عد تنازلي
- `[ ]` تحديث حي للحالة
- `[ ]` زر محاكاة الدفع
- `[ ]` أنيميشن تأكيد الدفع
- `[ ]` ثنائي اللغة (AR/EN)

### المرحلة 6: Dashboard (3-4 ساعات)
- `[ ]` صفحة النظرة العامة + إحصائيات + **حالة Open Finance**
- `[ ]` جدول المدفوعات + فلاتر
- `[ ]` إنشاء طلب دفع جديد (**مع عرض الرسوم والصافي**)
- `[ ]` سجل المعاملات + **تفاصيل المطابقة + APIs المستخدمة**
- `[ ]` صفحة الإعدادات (**حالة الحساب + lockedForCredit**)
- `[ ]` ثنائي اللغة (AR/EN)

### المرحلة 7: Consent Flow + شاشة بنكية (1 ساعة)
- `[ ]` شاشة OAuth Consent وهمية
- `[ ]` تدفق الموافقة الكامل

### المرحلة 8: Integration + Polish (1-2 ساعة)
- `[ ]` ربط جميع المكونات
- `[ ]` اختبار التدفق الكامل
- `[ ]` تحسين UX/UI

---

## Verification Plan

### Manual Verification (سيناريو العرض الكامل)
1. فتح Dashboard → تسجيل تاجر "Downtown Computers" (بـ IBAN/accountId مضمون، أو CliQ Alias كاستنتاج معماري).
2. النظام يسترجع بيانات الحساب تلقائياً (IBAN, البنك, نوع الحساب, الحالة) عبر **Accounts API**، واسم صاحب الحساب عبر **IBAN Confirmation**.
3. **IBAN Confirmation**: الحساب فعال ✅ + يقبل تحويلات (`lockedForCredit=false`) ✅ + اسم صاحب الحساب من البنك.
4. التاجر يربط حسابه البنكي عبر شاشة Consent → موافقة التاجر على الوصول لحسابه.
5. التاجر ينشئ طلب دفع 10 JOD → يتولد 10.024 JOD + AP-1024 + **رسوم متوقعة** (إن توفّرت رسوم الخدمة).
6. **Pre-Payment Check**: حساب التاجر لا يزال فعال ويقبل تحويلات.
7. العميل يفتح صفحة الدفع → **يُدخل رقم هاتفه**.
8. **Customer Consent (لمرة واحدة، اختياري):** يختار العميل Express (دفع مباشر بلا redirect) أو Verified (ربط حسابه مرة واحدة عبر Consent يُحفظ 90 يوماً).
9. النظام يسترجع **IBAN العميل** (Accounts API) + اسمه (IBAN Confirmation) ويتحقق من الرصيد (CAF) — في وضع Verified؛ في Express يتابع مباشرة. ثم يعرض صفحة الدفع النهائية.
10. ضغط "محاكاة الدفع" → **محاكاة Transactions API + Balance Change** تكتشف الدفعة (الوضع الكامل في الديمو).
11. المطابقة التلقائية → **حتى 7 عوامل (أهمها تطابق الـ IBAN المستخرج من الـ Consent مع debtorAccount في المعاملة)** → Confidence عالية.
12. صفحة الدفع تتحدث → "تم الدفع ✅".
13. Dashboard يتحدث → الطلب "مؤكد" + سجل المعاملات يعرض: العوامل المتطابقة + مصدر كل عامل (أي API) + وضع المطابقة (Balance-Only / Full) + المستوى (Express / Verified).
14. **اختبار العميل العائد (صفر احتكاك):** إنشاء طلب دفع ثانٍ لنفس العميل → يُدخل رقم هاتفه فقط → النظام يستخدم الموافقة المحفوظة صامتاً (بلا أي redirect) → دفع وتأكيد مباشر. هذا يثبت أن الموافقة لمرة واحدة لا لكل عملية.
