import subprocess,os,re,sys
from collections import Counter
os.environ['TESSDATA_PREFIX']=sys.argv[1]
d=sys.argv[2]
def ocr(png): return subprocess.run(['tesseract',png,'-','-l','ara+eng'],capture_output=True,text=True).stdout
def toks(t): return re.findall(r'[؀-ۿA-Za-z]{3,}',t)
res={}
for dpi in [96,150,220]:
    refs={}
    for lv in ['none','clean','light','strong','max']:
        tot=[];hit=0;n=0
        for pg in [3,5]:
            subprocess.run(['pdftoppm','-r',str(dpi),'-f',str(pg),'-l',str(pg),'-png',f'{d}/{lv}.pdf',f'{d}/r_{lv}_{dpi}'])
            png=[f for f in os.listdir(d) if f.startswith(f'r_{lv}_{dpi}-') and f.endswith(f'{pg}.png')][0]
            t=toks(ocr(f'{d}/{png}'))
            if lv=='none': refs[pg]=t
            c=Counter(t); 
            for w in refs[pg]:
                n+=1
                if c[w]>0: hit+=1; c[w]-=1
        res[(dpi,lv)]=round(hit/max(1,n),3)
for k,v in res.items(): print(k,v)
