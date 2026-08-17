# ملاحظة صيانة CI — 2026-08-17

أظهر التحقق من مستودع GitHub الرسمي أن `actions/upload-artifact@v6` يعمل على Node.js 24 ويتطلب runner بإصدار `2.327.1` أو أحدث. كان المشروع يستخدم `upload-artifact@v4`، وظهر تحذير لأن هذا المسار يستهدف Node 20 في بيئة GitHub Actions الحالية.

تمت ترقية الاستخدام الوحيد في `.github/workflows/test.yml` إلى `actions/upload-artifact@v6`. لم تتغير أسماء artifacts أو مساراتها أو سياسة `if-no-files-found: ignore`، ولم يتغير runtime أو النشر أو البيانات.

المصادر:

- https://github.com/actions/upload-artifact/releases
- https://github.com/actions/upload-artifact
- https://docs.github.com/en/actions/tutorials/store-and-share-data

يجب مراقبة أول تشغيل CI بعد الترقية للتأكد من توافق runner؛ وفي حال استخدام self-hosted runner يجب التحقق من أنه يساوي أو يتجاوز `2.327.1`.
