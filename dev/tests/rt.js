const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
// اختبار شامل لتنسيق ملفات Word: node rt.js file1.docx file2.docx ...
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');
const fs=require('fs'), path=require('path');
(async()=>{
 const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const pg=await (await b.newContext()).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
   if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
   if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
   if(u.includes('localhost:8765')){const p=require('path').join(__dirname,'../src',decodeURIComponent(new URL(u).pathname));return require('fs').existsSync(p)?r.fulfill({body:require('fs').readFileSync(p),contentType:p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.png')?'image/png':'application/octet-stream'}):r.fulfill({status:404,body:''});} return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.waitForFunction(()=>window.docx&&window.JSZip&&window.RESTYLE);
 const extra=JSON.parse(process.env.S||'{}');
 for(const f of process.argv.slice(2)){
  const b64=fs.readFileSync(f).toString('base64'), base=path.basename(f,'.docx');
  const res=await pg.evaluate(async([b64,extra])=>{
    const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const S=Object.assign({coverStyle:'classic',rights:true,showSubtitle:true,platform:{name:'Random.MEd',url:'random.med'},subject:'',subtitle:'',theme:'brand',sizes:ENGINE.SIZE_DEFAULTS,lineSpacing:1.5,cover:true,toc:true,numPos:'right',footBrand:true},extra);
    
    const brand=await RMED_brand(Object.assign({logo:true,wm:true,wmOpacity:7,coverStyle:'classic',rights:true,platform:{name:'Random.MEd',url:''}},S));
    const out={};
    const toB64=async bl=>{const a=new Uint8Array(await bl.arrayBuffer());let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s);};
    for(const mode of ['reskin','rebuild']){
      try{
        const an=await RESTYLE.analyze(u.buffer.slice(0));
        const ht=await RESTYLE.headerTextOf(an);
        const s2=Object.assign({},S,{subject:S.subject||ht||an.title||'مستند'});
        const r=await RESTYLE[mode](an,s2,brand);
        const c=await RESTYLE.check(an,r.blob);
        out[mode]={b64:await toB64(r.blob),report:r.report,check:{ok:c.ok,in:c.inCount,out:c.outCount,missing:c.missing.slice(0,15),extra:c.extra.slice(0,15)},stats:an.stats,cover:an.coverLines,title:an.title,header:ht};
      }catch(e){out[mode]={error:String(e&&e.stack||e)};}
    }
    return out;
  },[b64,extra]);
  for(const mode of ['reskin','rebuild']){
    const r=res[mode]; if(r.error){console.log(base,mode,'ERROR',r.error.slice(0,400));continue;}
    fs.writeFileSync(`${__OUT}${base}.${mode}.docx`,Buffer.from(r.b64,'base64'));
    console.log(`${base} ${mode}: check=${r.check.ok} ${r.check.in}/${r.check.out} miss=${JSON.stringify(r.check.missing)} extra=${JSON.stringify(r.check.extra)}`);
    if(mode==='reskin') console.log('   stats',JSON.stringify(r.stats),'\n   cover',JSON.stringify(r.cover).slice(0,200),'| header:',r.header,'\n   report',JSON.stringify(r.report));
    else console.log('   report',JSON.stringify(r.report));
  }
 }
 if(errs.length)console.log('page errors',errs);
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
