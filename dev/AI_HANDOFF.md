# برومت تسليم — موقع Random.MEd لتحويل المحاضرات إلى Word / PDF

> انسخ هذا الملف كاملاً لأي مساعد ذكاء صناعي (ChatGPT / Gemini / Claude…) واكتب تحته المشكلة بالتفصيل، وأرفق: الملف الذي سبّب المشكلة + لقطة شاشة + أي رسالة ظهرت بالموقع.

---

## 1) دورك وقواعدك
أنت مطوّر تصيّن موقعاً قائماً **يعمل بالفعل** ويستخدمه طالب طب (محمد) لتحويل محاضرات عربية إلى ملفات Word وPDF منسّقة. مهمتك إصلاح المشكلة المحددة فقط بأقل تعديل ممكن، **دون كسر أي ميزة أخرى**.

**القاعدة الذهبية (لا تُكسر أبداً):** لا يُحذف ولا يُعدَّل ولا يُضاف أي حرف من نص المحاضرة الأصلي. كل نص يولّده الموقع (الغلاف، الفهرس، أرقام الشرائح، المسرد…) يُحاط بعلامات `RMEDGEN`/`RMEDEND` حتى يستثنيه «تحقق الكلمات». أي تعديل يجعل تحقق الكلمات يُظهر فرقاً = تعديل مرفوض. الاستثناء الوحيد: خيارات «تنظيف الشرائح» في وضع PowerPoint، تحذف عمداً، ويذكر التقرير ما حُذف.

**قواعد العمل:**
- لا تعدّل `index.html` في جذر المستودع يدوياً. عدّل الملفات في `dev/src/` ثم ابنِ (القسم 4).
- لا تعيد كتابة ملفات كاملة ولا «تحسّن» شيئاً لم يُطلب.
- العربي RTL حساس جداً (القسم 6). لا تغيّر منطق الاتجاه إلا إذا كانت المشكلة فيه.
- اختبر قبل النشر (القسم 5). وإن لم تستطع تشغيل الاختبارات فاذكر ذلك صراحة.
- الواجهة بالعربي وأولويتها الموبايل (عرض 390px، بلا تمرير أفقي).
- ردّ على محمد باللهجة السورية وبوضوح: ماذا كانت المشكلة، ماذا غيّرت، وكيف اختبرت.

## 2) أين الموقع
- المستودع: `github.com/mohamadalahmad578-cloud/Word.random` (فرع `main`).
- النشر: GitHub Pages من جذر الفرع، والملف المنشور هو `index.html` فقط: https://mohamadalahmad578-cloud.github.io/Word.random/
- كل المعالجة تجري داخل المتصفح، بلا خادم. المكتبات من CDN: docx.js 9.7.1 (jsdelivr ثم unpkg) و JSZip 3.10.1 (cdnjs ثم jsdelivr) و docx-preview 0.4.1 للمعاينة الحقيقية فقط.
- نسخ للرجوع: كل نسخة مستقرة محفوظة كفرع باسم `stable-YYYY-MM-DD` (أولها `stable-2026-10-05`). للتراجع عن الموقع المنشور:
  `git fetch origin && git checkout origin/stable-2026-10-05 -- index.html dev/ && git commit -m "rollback" && git push`

## 3) بنية الملفات (`dev/`)
| الملف | المسؤولية |
|---|---|
| `src/src.html` | الواجهة (HTML/CSS) + `ENGINE` (داخل `<script id="engine">`) + منطق الواجهة. فيه أماكن حجز: `__LOGO_B64__ __RESTYLE__ __QR__ __PDF__ __PPTX__` |
| `src/restyle.js` | `RESTYLE`: قراءة ملفات Word الجاهزة: `analyze`, `reskin` (إعادة تلبيس في المكان), `rebuild`, `merge`, `check`, `prune` |
| `src/pdf.js` | `RMED_PDF.build(m, assets, opt)`: محرك PDF يرسم صفحات A4 على Canvas ويكتب ملف PDF بنفسه (صور JPEG للصفحات + روابط). `expectedWords` للتحقق |
| `src/pptx.js` | `RMED_PPTX.parse(buf, opt)`: تحويل .pptx إلى نموذج محاضرة + `pickColors` (ألوان القالب) + خيارات التنظيف والإضافات |
| `src/qr.js` | مولّد رمز QR (`RMED_QR(text)`) |
| `src/build.py` | يدمج كل ما سبق في `dev/src/index.html` |
| `vendor/` | نسخ محلية من docx.js و jszip و docx-preview للاختبار بلا إنترنت |
| `tests/` | اختبارات (القسم 5) + `fixtures/` (عيّنات) + `val.py` (فاحص بنية docx) |

### المكونات المهمة داخل `src.html`
- **`ENGINE`**:
  - `parseLectures(text)` يحوّل Markdown مبسّط إلى نموذج: محاضرة `{title, titleInl, intro, outro[], blocks[]}`. الكتل: `h, p, li, ol, table, diagram, pre, img, gen`.
  - `build(lectures, S)` يُرجع `docx.Document`، ثم `finalize(blob)` يكمّل الخصائص ويعيد ترقيم المعرّفات.
  - `previewHTML` للمعاينة السريعة.
  - `xmlTokens / inputTokens / compare` لتحقق الكلمات.
  - `splitDir` يقسم النص إلى مقاطع عربية وإنجليزية.
  - `lecNum / fileName` للتسمية التلقائية، و `PAGE_BGS / pageBgColor` لخلفيات الصفحات، و `CALLOUTS` للصناديق الملوّنة: `[هام جداً] [تعريف] [تحذير] [حالة سريرية] [ملاحظة]`.
- **أوضاع الواجهة** (`S.uiMode`):
  - `text`: لصق نص Markdown.
  - `word`: ملفات .docx بطريقة `reskin` أو `rebuild` أو دمج.
  - `ppt`: عروض PowerPoint، ولها إعداداتها الخاصة: `pptIdentity, pptDoctor, pptCourse, pptUni, pptYear, pptFooter, pptLogo, pptCover*, pptWm*`، خيارات التنظيف، والإضافات.
- **الإعدادات** `S`:
  - تُحفظ في `localStorage["randommed.lec2docx.settings.v2"]` وتُنظَّف عند التحميل بـ `cleanSettings`.
  - القوالب المحفوظة في `randommed.lec2docx.presets.v1`، وملفات الدكاترة في `randommed.ppt.profiles`.
  - صور الغلاف والعلامة والشعار الخاص في `randommed.ppt.cover / .wm / .logo`.
- **الهوية المرسومة على Canvas**:
  - `drawCover(style, T, name, scale, logo)` بـ13 نمط: classic, block, band, geo, frame, wave, dna (الشريط يمين), molecule, cycle, peptide, helix (داكن فاخر), protein (كريمي), steroid. أي نمط جديد يلزمه: CS بالمحرك + PFILL أو DARKC + pad المعاينة + CSMAP في pdf.js + المصغّرات.
  - `drawBack` للغلاف الخلفي، و `drawWatermark` للعلامة المائية، و `drawQR`.
  - الغلاف في Word: صورة خلفية عائمة خلف النص، والنصوص داخل جداول مظلّلة بالأبيض حتى تبقى مقروءة في الوضع الداكن لتطبيق Word.

## 4) سير العمل (عدّل ← ابنِ ← اختبر ← انشر)
```bash
git clone https://github.com/mohamadalahmad578-cloud/Word.random && cd Word.random/dev
# 1) عدّل الملفات في src/
python3 src/build.py                 # يُنتج src/index.html
bash tests/run_all.sh                # كل الاختبارات (القسم 5)
cp src/index.html ../index.html      # انشر النسخة المبنية
cd .. && git add -A && git commit -m "وصف الإصلاح" && git push
git push origin HEAD:refs/heads/stable-$(date +%Y-%m-%d)   # نقطة رجوع (فرع)
```
إن لم يكن عندك Node/Playwright: عدّل `src/` وابنِ بـ `build.py` على الأقل، وجرّب `src/index.html` يدوياً في المتصفح (افتحه مباشرة). يحتاج إنترنت أول مرة لتحميل المكتبات.

## 5) الاختبارات (`dev/tests/`)
- المتطلبات: Node 18+ وحزمة `playwright` و Chromium (`PW=/path/to/playwright CHROME=/path/to/chrome`) و Python 3. LibreOffice اختياري لتحويل الناتج إلى PDF والنظر إليه (`timeout 180 soffice --headless --convert-to pdf file.docx`).
- الاختبارات تخدم `src/index.html` والمكتبات من `vendor/` عبر `page.route`، فلا تحتاج خادماً.
- `run_all.sh` يشغّل كل ما يلي. النتيجة السليمة:

| الاختبار | النتيجة السليمة |
|---|---|
| `test.js` (نص) | `check true 1542 1542` |
| `rt.js fixtures/*.docx` | كل سطر `check=true`، ولا أسطر `ERROR` |
| `val.py` | لا `dangling` ولا `dup` |
| `uinew.js` | مطابقة تامة + دمج بلا فرق + `scroll [390,390]` على الموبايل (`VP=m`) |
| `pdft2.js` | 4 ملفات PDF وكل رسالة «تحقق الكلمات … بدون أي فرق» |
| `bgt.js` | 4 خلفيات بلا أخطاء |
| `ppt_t.js` / `ppt_t2.js` | «صفر فروق» + تقرير التنظيف + اسم ملف فيه اسم الدكتورة |
| `covers.js` | يولّد `out/cov_*.docx` للأنماط العشرة (افتحها بعينك) |

- **انظر بعينك** دائماً لأي تغيير شكلي: حوّل الناتج إلى PNG (`pdftoppm -r 50 -png file.pdf out`) وافحصه.

## 6) قواعد العربي والاتجاه في Word (لا تكسرها)
- كل فقرة عربية `bidi`. محاذاة RTL الافتراضية لليمين: لا تضع `jc=left/start` لفقرة عربية، لأن البرامج تعكسها.
- المقاطع اللاتينية والأرقام تُكتب كـ runs منفصلة. كل run لاتيني فيه `rightToLeft:false` وخط cs = Times New Roman.
- `splitDir` يحيط الأرقام المركّبة بعلامات LRM (مثل `24-48` و `80%` و `1.5 mg`). ويضمّ «لاتيني + فراغ + لاتيني» في run واحد، ويضمّ الأقواس المحيطة بالإنجليزي.
- رقم البند في أول السطر (`1.`) كتلة LTR واحدة.
- ترتيب عناصر `pPr/rPr/sectPr/tblPr` يجب أن يطابق مخطط OOXML (`ORD` و `sortPr` في restyle.js). المخالفة تجعل Word يرفض الملف. افحص بـ `val.py`.
- محرك PDF يستخدم `ENGINE.splitDir` نفسه لترتيب الكلمات، فأي تغيير هناك يؤثر على Word وPDF معاً.

## 7) دليل الأعطال: العَرَض ← أين تبحث
| العَرَض | المكان الأرجح |
|---|---|
| «تحقق الكلمات» يُظهر فرقاً في وضع النص | `ENGINE.inputTokens` (المدخل) أو `parseLectures/parseInline` (فُقد نص) أو نص مولّد خارج `GS()/GE()` |
| فرق في وضع Word | `RESTYLE.analyze` (`origTokens`، اكتشاف الغلاف/الفهرس، `it.gen`) أو `rebuildModel` (`inlOf`, `cellInl`) |
| فرق في PowerPoint | `pptx.js`: `paraInl`/`modelTokens`، أو كتلة جديدة غير مستثناة (`t:"gen"`) |
| فرق في PDF | `pdf.js`: `words/layout/drawLine` (تسجيل `drawn`) أو `expectedWords` |
| العربي/الإنجليزي بترتيب خاطئ | `ENGINE.splitDir` و `mkRun/runs` (Word)، و `drawLine` (PDF) |
| الملف لا يفتح في Word أو «محتوى غير مقروء» | شغّل `val.py`: ترتيب العناصر، معرّفات مكررة، علاقات ناقصة (`transplant`/`prune` في restyle.js) |
| الغلاف على صفحتين | `DENSE` و `coverRows` في `ENGINE.build` (Word)، و `plan/f` في `pdf.js cover()` |
| نص الغلاف باهت في Word على الموبايل | الوضع الداكن لـ Word، والحل الموجود: `panel()` بتظليل أبيض حول النص |
| الصفحات تزيد كثيراً عن الأصل (Word) | خيار `origLine` (يحافظ على التباعد والحجم الأصليين في reskin) و `keepParas` |
| صفحات فارغة أو تكرار ترويسة في PDF | `pass()`، `newPage()`، تقسيم الجداول `table()` في pdf.js |
| شريحة/نص ناقص من PowerPoint | `collect()`/الترتيب حسب الموقع، أو خيارات التنظيف (`cleanup`): جرّبها مطفأة أولاً |
| المكتبات لا تتحمّل | `loadScript([...])` في src.html: روابط CDN بديلة |
| إعدادات غريبة بعد استيراد قالب | `cleanSettings` (أنواع وقيم مسموحة) |
| خطأ JavaScript | افتح الموقع، Console في أدوات المطوّر، وأرفق الرسالة |

## 8) قرارات متعمّدة (ليست أخطاء)
- **صفحات PDF صور** عالية الدقة: النص لا يُنسخ، لكن الناتج متطابق على الآيفون والكمبيوتر.
- **ما لا يُنقل من PowerPoint**: الرسوم البيانية (Charts) والصور بصيغة EMF/SVG. الموقع ينبّه بعددها.
- **لون خلفية الصفحة**: من Word نفسه (`w:background`). Word على الكمبيوتر لا يطبعه إلا بتفعيل «طباعة ألوان الخلفية».
- **«إعادة البناء» والدمج**: لا ينقلان المعادلات ولا الحواشي. «إعادة التلبيس» تنقلهما.
- **وضع PowerPoint بهوية الدكتور** (افتراضي): لا اسم منصة ولا رابطها ولا شعارها. العلامة المائية الافتراضية اسم الدكتور مائلاً.
- **هوية الملف بكل الأوضاع** (قسم `#idSec` بالإعدادات): لكل وضع اختياره المستقل — النص `S.idText`، ملف Word `S.idWord` (القيم `"platform"|"doctor"`)، العروض `S.pptIdentity` (true = دكتور). الدالة `applyIdentity(s, mode)` تطبّق حقول الدكتور (`pptDoctor/pptUni/pptCourse/pptYear/pptFooter/pptLogo/pptWm*`) وتضع `s._doctorId`، و`brandFor(s)` تولّد الشعار والعلامة المائية والغلاف حسبها (تُستعمل بدل `brandAssets` في كل مكان). في وضع Word يبقى عنوان الغلاف الأصلي كما هو (القاعدة الذهبية). الاختبار: `tests/idt.js`.

---
**اكتب المشكلة هنا:**
- ماذا فعلت (الوضع: نص / Word / PowerPoint، والإعدادات):
- ماذا توقعت:
- ماذا ظهر (رسالة الموقع / لقطة شاشة / الملف):


## حماية الملفات (protect.js → `RMED_PROTECT`)
- قسم «حماية الملفات 🔒» بالإعدادات: `S.protOn, protWord, protPdf, protNoPrint, protNoCopy`. كلمات السر (`protPw`, `protOwner`) بالذاكرة فقط ولا تُحفظ أبداً.
- Word: `encryptDocx(blob, pw)` = تشفير ECMA-376 Agile (AES-256-CBC + SHA-512، spinCount 100000) داخل حاوية CFB مكتوبة يدوياً (`_cfb`) مع `\x06DataSpaces`. يُطبَّق عند الحفظ فقط عبر `guardDocx` و`saveBlob` (التحقق من الكلمات يتم على النسخة غير المشفّرة).
- PDF: `pdfSecurity({userPw, ownerPw, noPrint, noCopy})` = معالج Standard R6/AESV3. `writePdf(pages, title, sec)` يشفّر كل المجاري والنصوص ويضيف `/Encrypt` و`/ID`.
- ملف Word لا يمكن منع طباعته/نسخه (لا يدعمه Word بدون خادم IRM) — المنع فقط بالـ PDF، وصفحات الـ PDF صور أصلاً.
- الاختبار: `tests/prot_t.js` ثم `tests/verify_agile.py` (يفك التشفير ويتحقق من HMAC والمحتوى) و`qpdf --show-encryption`. وLibreOffice يفتح ملف Word المقفل بكلمة السر.
