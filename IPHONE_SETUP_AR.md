# تشغيل ورفع مِداد من الآيفون

## أسهل طريقة: GitHub + Render

### 1. جهّز الملفات
حمّل ملف `midad_real_website.zip` على الآيفون، واضغط عليه في تطبيق «الملفات» لفك الضغط.

ستجد:
- package.json
- server.js
- render.yaml
- .env.example
- README.md
- public/index.html

### 2. GitHub
من Safari افتح GitHub وأنشئ حسابًا، ثم أنشئ Repository جديد باسم:
midad-oman

اجعله Private في البداية.

من داخل المستودع استخدم Add file > Upload files. GitHub يسمح برفع ملفات متعددة من المتصفح، لكن إذا لم يسمح Safari باختيار المجلد، ارفع الملفات واحدًا واحدًا أو استخدم github.dev للتحرير في المتصفح.

لا ترفع `.env` ولا أي كلمة مرور أو API key.

### 3. Render
أنشئ حسابًا في Render، ثم:
New > Web Service
اربط حساب GitHub واختر مستودع `midad-oman`.

الإعدادات:
Build Command: npm install
Start Command: npm start

يمكنك أيضًا استخدام ملف `render.yaml` الموجود في المشروع.

### 4. المتغيرات السرية
في Render > Environment أضف:

ADMIN_USERNAME = k617g
ADMIN_PASSWORD = كلمة مرور الأدمن التي اخترتها
OPENAI_API_KEY = مفتاح OpenAI API
OPENAI_MODEL = gpt-5.6-luna

لا تضع كلمة المرور أو مفتاح API داخل الملفات أو GitHub.

### 5. تشغيل
اضغط Deploy وانتظر انتهاء البناء، ثم افتح رابط `onrender.com` الذي يعطيك إياه Render.

### ملاحظة مهمة عن قاعدة البيانات
النسخة الحالية تستخدم SQLite، وهي مناسبة للتجربة. نظام الاستضافة المجاني قد يستخدم تخزينًا مؤقتًا، لذلك قبل فتح الموقع لعدد كبير من الطلاب يجب نقل قاعدة البيانات إلى Postgres أو استخدام تخزين دائم.

### إذا أردت تعديل الموقع
عدّل الملفات في GitHub، ثم اعمل Commit. Render يستطيع إعادة النشر تلقائيًا عند وصول التعديل إلى الفرع المرتبط.
