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
for(const st of (process.env.STYLES||'classic,block,band,geo,frame,wave,dna,molecule,cycle,peptide,helix,protein,steroid,cell,ecg,pills,lab,blood,virus,neuron,night,artdeco,marble,botanical,minimal,ribbon,crystal,watercolor').split(',')){
 const b64=await pg.evaluate(async([src,st,theme])=>{
  const S={coverStyle:st,cover:true,toc:true,showSubtitle:true,rights:true,platform:{name:'Random.MEd',url:'mohamadalahmad578-cloud.github.io/Word.random'},subject:'مبادئ الطب الشرعي والقضائي',subtitle:'',theme,sizes:ENGINE.SIZE_DEFAULTS,lineSpacing:1.5,numPos:'right',footBrand:true,logo:true,wm:true,wmOpacity:7,doctor:'د. أحمد الخطيب',coverExtra:'جامعة الشام الخاصة — كلية الطب\nالسنة الثالثة 2026',coverLines:['المحاضرة الرابعة','الوفيات المفاجئة']};
  S.brand=await RMED_brand(S);
  const L=ENGINE.parseLectures(src);
  const blob=await ENGINE.finalize(await docx.Packer.toBlob(ENGINE.build(L,S)),'blob');
  // صورة الغلاف لازم تكون بترويسة قسم الغلاف (مو بالمتن) حتى ما تغطي اسم المنصة بالتذييل في Word
  const z=await JSZip.loadAsync(blob), names=Object.keys(z.files);
  const docHas=(await z.file('word/document.xml').async('string')).includes('coverbg');
  let hdrHas=false, ftrName=false; for(const n of names){ if(/word\/header\d*\.xml$/.test(n)&&(await z.file(n).async('string')).includes('coverbg'))hdrHas=true; if(/word\/footer\d*\.xml$/.test(n)&&(await z.file(n).async('string')).includes('Random.MEd'))ftrName=true; }
  window.__covChk=(window.__covChk||[]); window.__covChk.push(st+':'+(!docHas&&hdrHas&&ftrName?'ok':'BAD doc='+docHas+' hdr='+hdrHas+' ftr='+ftrName));
  const a=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s);
 },[src,st,theme]);
 fs.writeFileSync(__OUT+`cov_${st}.docx`,Buffer.from(b64,'base64'));
}
console.log((await pg.evaluate(()=>window.__covChk)).join(' '));
 const wr=await pg.evaluate(async(src)=>{const S={coverStyle:'classic',cover:true,toc:true,wm:true,wmRepeat:true,wmOpacity:7,platform:{name:'Random.MEd',url:''},subject:'x',theme:'brand',sizes:ENGINE.SIZE_DEFAULTS,lineSpacing:1.5,logo:true};
  S.brand=await RMED_brand(S); const blob=await ENGINE.finalize(await docx.Packer.toBlob(ENGINE.build(ENGINE.parseLectures(src),S)),'blob'); const z=await JSZip.loadAsync(blob); let rep=0,wm=0;
  for(const n of Object.keys(z.files)) if(/word\/header\d*\.xml$/.test(n)){const x=await z.file(n).async('string'); if(x.includes('name="wmrep"'))rep++; if(x.includes('name="watermark"'))wm++;} return 'wmRepeat: headers with repeat='+rep+' with original='+wm;},src);
 console.log(wr); console.log('errors',errs); await b.close();})();
