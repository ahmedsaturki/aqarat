# سجل تحقق خارجي — 2026-08-17

## GitHub

- PR #15: https://github.com/ahmedsaturki/aqarat/pull/15
- تم دمج PR #15 بعد نجاح test وVercel Preview.
- commit الإنتاج الحالي: `37faa156505d77f00db08582f12003ad1d703ac0`
- verify-production Run #55: https://github.com/ahmedsaturki/aqarat/actions/runs/31995279314
- النتيجة: `success`، trigger: `push`، head SHA مطابق لـ`37faa156505d77f00db08582f12003ad1d703ac0`.

## Vercel production

- URL: https://aqarat-eg.vercel.app
- `verify-release.mjs`: نجح.
- الإصدار الظاهر من `/healthz`: `37faa156505d77f00db08582f12003ad1d703ac0`.
- `/api/healthz`: 200.
- `/api/public-config`: 200 دون مفاتيح سرية.
- `/api/healthz/deep` دون السر: 401.
- رؤوس الأمان ظهرت فعليًا: `cache-control: no-store`, CSP، HSTS، `referrer-policy`, `x-content-type-options`, `x-frame-options`, correlation ID، وقياسات response time.
- `npm run check`: 103 tests passed وsyntax checks passed.

## التغييرات المدمجة في PR #15

- تحسين وصولية لوحة التشغيل والتنقل الدلالي وskip link وARIA وfocus states ودعم reduced motion.
- تحسين حالة تسجيل الدخول: loading state، مسح كلمة المرور بعد النجاح، ورسالة اتصال آمنة.
- إضافة `src/runtime/http.mjs` لتوحيد timeout للاستدعاءات الخارجية وتطبيقه على قراءات dashboard من Supabase.
- إضافة اختبارين لطبقة timeout.
