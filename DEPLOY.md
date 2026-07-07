# نشر Amana Pay + المتجر على Render (مجاناً)

النظام صار جاهز للنشر: البوابة (`backend`) والمتجر التجريبي (`nova-gadgets-store`) عبر ملف
`render.yaml` (Blueprint) الذي ينشئ الخدمتين دفعة واحدة ويربطهما تلقائياً.

## الخطوات (≈ 10 دقائق)

### 1) ارفع المشروع إلى GitHub
من جذر المشروع (`مشروع_بحث`)، شغّل:

```bash
git init
git add .
git commit -m "Amana Pay — deploy ready"
git branch -M main
git remote add origin https://github.com/<اسمك>/amana-pay.git
git push -u origin main
```
> `node_modules` وملفات قاعدة البيانات مستثناة تلقائياً عبر `.gitignore`.

### 2) أنشئ الخدمتين على Render
1. سجّل الدخول على https://render.com (مجاني، عبر GitHub).
2. اضغط **New +** → **Blueprint**.
3. اختر مستودع GitHub الذي رفعته.
4. Render يقرأ `render.yaml` تلقائياً ويعرض خدمتين:
   - `amana-pay-backend`
   - `nova-gadgets-store`
5. اضغط **Apply**. انتظر انتهاء البناء (أول مرة ~2–4 دقائق لكل خدمة).

### 3) الروابط النهائية
بعد النشر بتحصل على رابطين (شكلهم):
- البوابة/الداش بورد:  `https://amana-pay-backend.onrender.com`
  - الداش بورد:  `…/dashboard/index.html`
  - الصفحة الرئيسية:  `…/index.html`
- المتجر التجريبي:  `https://nova-gadgets-store.onrender.com`

> `AMANA_PAY_URL` للمتجر يُحقن تلقائياً من البوابة عبر الـ Blueprint (`fromService`).

## ⚠️ مهم: عنوان البوابة (AMANA_PAY_URL)
المتجر يتصل بالبوابة عبر `AMANA_PAY_URL`. لا تعتمد على `fromService property: host`
لأنه يعطي **اسم الخدمة فقط** (`amana-pay-backend`) بدون `.onrender.com` → يفشل الـ DNS
(`ENOTFOUND`). لذلك في `render.yaml` نضع الرابط **الكامل** صراحةً:
```
AMANA_PAY_URL = https://amana-pay-backend.onrender.com
```
- تأكّد أنه يطابق رابط خدمة البوابة الفعلي (افتح صفحة البوابة على Render وانسخ الـ URL).
- للتحقق: افتح `https://amana-pay-backend.onrender.com/health` → يجب أن يُرجع `{"status":"ok"}`.
- إذا كان رابط بوابتك مختلفاً (لاحقة عشوائية)، عدّل القيمة في خدمة المتجر → Environment.

## ملاحظات مهمة للتجربة
- **الباقة المجانية بتنام** بعد ~15 دقيقة خمول؛ أول طلب بعد النوم بياخد ~30–50 ثانية (cold start).
  - المتجر يعيد محاولة الاتصال بالبوابة تلقائياً عند الإقلاع (لا يتعطّل).
- **قاعدة البيانات مؤقتة** (تُصفّر عند إعادة تشغيل/نشر البوابة) — مناسب للتجربة والعرض.
  - تسجيل المتجر **idempotent** في وضع mock، فيتعافى تلقائياً بعد أي restart.
- **قبل العرض بدقيقة:** افتح رابط البوابة ورابط المتجر لتوقظ الخدمتين من النوم.

## تشغيل محلي (للمقارنة)
```bash
# طرفية 1 — البوابة
cd backend && npm install && npm start        # http://localhost:4000
# طرفية 2 — المتجر
cd nova-gadgets-store && npm install && npm start   # http://localhost:5050
```

## بديل أسرع (بدون حساب سحابي) — نفق مؤقت
لو بدك رابط عام فوراً بدون نشر (جهازك يظل شغّال):
```bash
# بعد تشغيل الخدمتين محلياً، ثبّت cloudflared ثم:
cloudflared tunnel --url http://localhost:4000     # رابط للبوابة
cloudflared tunnel --url http://localhost:5050     # رابط للمتجر
```
> عند استخدام النفق، شغّل المتجر مع عنوان البوابة العام:
> `set AMANA_PAY_URL=https://<backend-tunnel>.trycloudflare.com` (ويندوز) قبل `npm start`.
