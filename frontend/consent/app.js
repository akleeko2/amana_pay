/* Amana Pay — Standalone Consent screen logic */
(function () {
  'use strict';

  const API = '/api/v1';
  const qs = new URLSearchParams(location.search);
  const consentId = qs.get('consentId') || qs.get('consent');
  const phone = qs.get('subject') || qs.get('phone');
  const bankName = qs.get('bank');
  const returnUrl = qs.get('return'); // اختياري: العودة لصفحة الدفع
  const paymentId = qs.get('paymentId'); // اختياري: لتفعيل Verified على الطلب مباشرة

  let lang = localStorage.getItem('ap_lang') || 'ar';

  const TXT = {
    ar: {
      EN: 'EN', secure: 'آمن', of: 'Open Finance',
      ask: 'تطلب الوصول إلى حسابك:', account: 'معلومات الحساب', balance: 'الأرصدة', tx: 'المعاملات',
      lblAccount: 'الحساب', lblValidity: 'مدة الصلاحية', validity: '90 يوماً', lblReuse: 'إعادة الاستخدام', reuse: 'عبر كل المتاجر',
      deny: 'رفض', approve: 'موافقة', cbj: 'هذه الخدمة مرخّصة من البنك المركزي الأردني وتتوافق مع معايير Open Finance.',
      processing: 'جارٍ المعالجة…', okTitle: 'تم ربط حسابك', okSub: 'يمكنك العودة لإتمام الدفع.',
      deniedTitle: 'تم رفض الموافقة', deniedSub: 'لن يتم الوصول لبياناتك.', errText: 'رابط الموافقة غير صالح.',
      powered: 'مؤمّن عبر JoPACC Open Finance', bank: 'بنكك', redirecting: 'إعادة التوجيه…',
    },
    en: {
      EN: 'ع', secure: 'Secure', of: 'Open Finance',
      ask: 'requests access to your account:', account: 'Account information', balance: 'Balances', tx: 'Transactions',
      lblAccount: 'Account', lblValidity: 'Validity', validity: '90 days', lblReuse: 'Reuse', reuse: 'Across all merchants',
      deny: 'Deny', approve: 'Approve', cbj: 'Licensed by the Central Bank of Jordan and compliant with Open Finance standards.',
      processing: 'Processing…', okTitle: 'Account linked', okSub: 'You can return to complete the payment.',
      deniedTitle: 'Consent denied', deniedSub: 'Your data will not be accessed.', errText: 'Invalid consent link.',
      powered: 'Secured by JoPACC Open Finance', bank: 'Your bank', redirecting: 'Redirecting…',
    },
  };
  const $ = (id) => document.getElementById(id);
  const t = (k) => TXT[lang][k];

  function applyLang() {
    document.documentElement.lang = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('langToggle').textContent = t('EN');
    $('secure-text').textContent = t('secure');
    $('of-tag').textContent = t('of');
    $('ask-text').textContent = t('ask');
    $('perm-account').textContent = t('account');
    $('perm-balance').textContent = t('balance');
    $('perm-tx').textContent = t('tx');
    $('lbl-account').textContent = t('lblAccount');
    $('lbl-validity').textContent = t('lblValidity');
    $('val-validity').textContent = t('validity');
    $('lbl-reuse').textContent = t('lblReuse');
    $('val-reuse').textContent = t('reuse');
    $('deny-btn').textContent = t('deny');
    $('approve-btn').textContent = t('approve');
    $('cbj-note').textContent = t('cbj');
    $('processing-text').textContent = t('processing');
    $('success-title').textContent = t('okTitle');
    $('success-sub').textContent = t('okSub');
    $('denied-title').textContent = t('deniedTitle');
    $('denied-sub').textContent = t('deniedSub');
    $('error-text').textContent = t('errText');
    $('powered').textContent = t('powered');
    $('bank-name').textContent = bankName || t('bank');
    $('val-account').textContent = phone ? maskPhone(phone) : '—';
  }

  function maskPhone(p) {
    if (p.length < 6) return p;
    return p.slice(0, 3) + '****' + p.slice(-2);
  }

  $('langToggle').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('ap_lang', lang);
    applyLang();
  });

  const STATES = ['consent', 'loading', 'success', 'denied', 'error'];
  const show = (s) => STATES.forEach((x) => $('state-' + x).classList.toggle('hidden', x !== s));

  $('deny-btn').addEventListener('click', () => {
    show('denied');
    if (returnUrl) setTimeout(() => (location.href = appendParam(returnUrl, 'consent', 'denied')), 1500);
  });

  $('approve-btn').addEventListener('click', async () => {
    if (!consentId || !phone) return show('error');
    show('loading');
    try {
      // توثيق الموافقة (يُنشئ سجلاً طويل الأمد قابلاً لإعادة الاستخدام)
      await fetch(`${API}/merchants/consent/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId, phone }),
      });
      // إن كان هناك طلب دفع محدد، فعّل Verified عليه مباشرة
      if (paymentId) {
        await fetch(`${API}/payment-page/${paymentId}/identify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        }).catch(() => {});
      }
      show('success');
      if (returnUrl) {
        $('redirect-note').textContent = t('redirecting');
        setTimeout(() => (location.href = appendParam(returnUrl, 'consent', 'granted')), 1600);
      }
    } catch {
      show('error');
    }
  });

  function appendParam(url, key, val) {
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set(key, val);
      return u.toString();
    } catch {
      return url + (url.includes('?') ? '&' : '?') + key + '=' + val;
    }
  }

  // boot
  applyLang();
  if (!consentId || !phone) show('error');
  else show('consent');
})();
