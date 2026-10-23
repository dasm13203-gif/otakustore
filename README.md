# متجر أوتاكو

1. أنشئ مشروع في Supabase وشغّل `supabase/schema.sql` في SQL Editor.
2. من Authentication > Users أنشئ حساب، وبعدها شغّل آخر سطر في الملف (مفعّل بالإيميل) عشان تبقى أدمن.
3. انسخ `.env.example` إلى `.env` وحط URL والـ anon key، وشغّل `npm install && npm run dev`.
4. ارفع الكود على GitHub، وضيف السرّين `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` في Settings > Secrets > Actions، وفعّل Pages من Settings > Pages (Source: GitHub Actions).
5. المتجر على الرابط الرئيسي، ولوحة التحكم على `/#/admin`.
