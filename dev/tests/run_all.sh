#!/usr/bin/env bash
# يشغّل كل الاختبارات الأساسية. المتوقع: كل سطر فيه ✓ / check=true / errors [] بدون أخطاء.
# المتطلبات: node + playwright + chromium (حدّد المسارات بـ PW و CHROME إن اختلفت)، و python3، و LibreOffice اختياري للرندر.
cd "$(dirname "$0")"; export LANG=C.UTF-8
python3 ../src/build.py || exit 1
echo "== 1) وضع النص (node)";            node test.js | tail -1
echo "== 2) ملفات Word (إعادة تلبيس/بناء)"; node rt.js fixtures/*.docx 2>&1 | grep -E "check=|ERROR"
echo "== 3) التحقق من بنية ملفات Word";     for f in out/*.reskin.docx out/*.rebuild.docx; do r=$(python3 val.py "$f" 2>&1 | grep -E "dangling|dup|missing"); [ -n "$r" ] && echo "$f: $r"; done; echo "(لا شيء أعلاه = سليم)"
echo "== 4) الواجهة: قوالب/دمج/تسمية";      node uinew.js 2>&1 | grep -E "^check|merge check|errors"
echo "== 5) PDF بكل الأوضاع";               node pdft2.js 2>&1 | grep -E "^(text|word|merge) |errors" | cut -c1-120
echo "== 6) خلفيات الصفحات";                node bgt.js 2>&1 | grep -E "^(cream|sky|tint|mint)|errors" | cut -c1-100
echo "== 7) PowerPoint";                     node ppt_t.js 2>&1 | grep -E "check:|errors"; node ppt_t2.js 2>&1 | grep -E "report|docx:|pdf:|errors" | cut -c1-160
echo "== 8) الأغلفة (ملفات في out/cov_*.docx)"; node covers.js 2>&1 | tail -1
echo "== هوية الملف (منصة/دكتور) بكل الأوضاع"; node idt.js 2>&1 | tail -4
echo "== حماية الملفات (Word مشفّر + PDF AES-256)"; node prot_t.js 2>&1 | grep -E "word:|pdf|zip|errors" | cut -c1-120
echo "   تحقق مستقل: python3 verify_agile.py out/text_locked.docx Bio2026 out/text_plain.docx ; qpdf --show-encryption --password=Bio2026 out/text_locked.pdf"
echo "== التنسيق الذكي"; node smart_t.js 2>&1 | grep -E "check:|pdf:|undo|errors"
echo "== فصل هوية المنصة عن هوية الدكتور"; node sep_t.js 2>&1 | grep -E "✓|✗|FAIL"
echo "== زخرفة الصفحات"; node deco_t.js 2>&1 | grep -E "^(hexa|bwave)|errors"
echo "== التنسيق الذكي لملفات Word"; node wsmart_t.js 2>&1 | grep -E "on:|errors"
