# يبني dev/src/index.html من الملفات المصدرية (شغّله من أي مكان)
import os
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(H, n), encoding='utf8').read()
s = rd('src.html').replace('__LOGO_B64__', rd('logo.b64').strip()).replace('__RESTYLE__', rd('restyle.js')) \
    .replace('__QR__', rd('qr.js')).replace('__PDF__', rd('pdf.js')).replace('__PPTX__', rd('pptx.js')).replace('__PROTECT__', rd('protect.js')).replace('__SMART__', rd('smart.js'))
open(os.path.join(H, 'index.html'), 'w', encoding='utf8').write(s)
print(len(s) // 1024, 'KB ->', os.path.join(H, 'index.html'))
