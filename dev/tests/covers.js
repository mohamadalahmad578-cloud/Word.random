const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
const pg=await (await b.newContext()).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/*',r=>{const u=r.request().url();
 if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
 if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
 if(u.includes('localhost:8765')){const p=require('path').join(__dirname,'../src',decodeURIComponent(new URL(u).pathname));return require('fs').existsSync(p)?r.fulfill({body:require('fs').readFileSync(p),contentType:p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.png')?'image/png':'application/octet-stream'}):r.fulfill({status:404,body:''});} return r.abort();});
await pg.goto('http://localhost:8765/index.html'); await pg.waitForFunction(()=>window.docx&&window.JSZip);
const src=fs.readFileSync(__FX+'sample.md','utf8'), theme=process.env.TH||'brand';
for(const st of (process.env.STYLES||'classic,block,band,geo,frame,wave,dna,molecule,cycle,peptide').split(',')){
 const b64=await pg.evaluate(async([src,st,theme])=>{
  const S={coverStyle:st,cover:true,toc:true,showSubtitle:true,rights:true,platform:{name:'Random.MEd',url:'mohamadalahmad578-cloud.github.io/Word.random'},subject:'مبادئ الطب الشرعي والقضائي',subtitle:'',theme,sizes:ENGINE.SIZE_DEFAULTS,lineSpacing:1.5,numPos:'right',footBrand:true,logo:true,wm:true,wmOpacity:7,doctor:'د. أحمد الخطيب',coverExtra:'جامعة الشام الخاصة — كلية الطب\nالسنة الثالثة 2026',coverLines:['المحاضرة الرابعة','الوفيات المفاجئة']};
  S.brand=await RMED_brand(S);
  const L=ENGINE.parseLectures(src);
  const blob=await ENGINE.finalize(await docx.Packer.toBlob(ENGINE.build(L,S)),'blob');
  const a=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s);
 },[src,st,theme]);
 fs.writeFileSync(__OUT+`cov_${st}.docx`,Buffer.from(b64,'base64'));
}
console.log('errors',errs); await b.close();})();
