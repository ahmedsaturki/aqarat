# Baseline مرئي وأدائي — 2026-08-17

تم فتح لوحة التحكم المنشورة على `https://aqarat-eg.vercel.app/dashboard/` باستخدام Playwright في جلسة مستقلة غيرتسجيلية.

## الملاحظات الأولية

- عنوان الصفحة: `Aqarat OS — Control Plane`.
- الصفحة متاحة بدون تنفيذ تسجيل دخول أو إجراء تغييري.
- تم التقاط شجرة وصولية كاملة مع bounding boxes.
- تم التقاط لقطة PNG كاملة للصفحة.
- ملفات مرجع Playwright الناتجة: `aqarat-dashboard-baseline.yml` و`aqarat-dashboard-baseline.png` في مجلد مخرجات جلسة Playwright.

## نطاق الاختبارات التالية

سيتم تحويل هذه الملاحظات إلى اختبارات قابلة للتكرار داخل المشروع تشمل: وجود العنوان والتنقل الدلالي، وجود skip link، حالات تسجيل الدخول، focus عبر لوحة المفاتيح، عدم وجود أخطاء console، وسلوك التخطيط عند أحجام سطح المكتب والهاتف.

وسيتم قياس أداء التحميل من `performance.getEntriesByType('navigation')` وموارد الصفحة، مع إبقاء القياسات إرشادية bounded وعدم جعلها flaky في CI. ستتم مراجعة كل `fetch` خارجي في عقد API قبل تطبيق `timedFetch`، مع استثناء `verify-release` والـhealth checks التي لها عقود مستقلة.

## نتائج التشغيل الفعلي

في تشغيل `npm run test:visual` على الإنتاج، نجحت الاختبارات الستة على Firefox لسطح المكتب والهاتف، بما يشمل العقد الدلالي، غياب أخطاء console، عدم وجود overflow، focus المرئي، ولقطات المظهر.

في تشغيل `npm run performance:smoke` باستخدام خمس عينات لكل endpoint، نجح `/api/healthz` و`/api/public-config` بنسبة حالة 5/5، وبميزانية p95 مقدارها 2500ms. بلغ p50/p95 لـ`/api/healthz` مقدار `264.43ms / 393.78ms`، وبلغ p50/p95 لـ`/api/public-config` مقدار `258.12ms / 403.31ms`.

تم توسيع `timedFetch` إلى Supabase وTelegram وGemini وintake وdashboard وdiscovery worker وSheets worker وVercel handler. بقي `discovery/http-adapter.mjs` بمهلة متخصصة لأنه يدير SSRF وDNS وredirects وstreaming response limits، وبقي `deep-health.mjs` و`verify-release.mjs` و`performance-smoke.mjs` بحدود مستقلة لأن لها عقود probe وقياس مختلفة.
