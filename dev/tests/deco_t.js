const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs'),path=require('path');
const OUT=__OUT; fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const ctx=await b.newContext({viewport:{width:1366,height:900},acceptDownloads:true}); const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('localhost:8765'))return r.fulfill({body:fs.readFileSync(path.join(__dirname,'../src/index.html')),contentType:'text/html; charset=utf-8'});
  return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForFunction(()=>window.docx&&window.JSZip);
 await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
 const dl=async(sel,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click(sel)]); await d.saveAs(OUT+name); await pg.waitForFunction(()=>!document.querySelector('#dlBtn').disabled&&!document.querySelector('#pdfBtn').disabled); return (await pg.textContent('#msg'));};
 await pg.fill('#src', fs.readFileSync(__FX+'sample.md','utf8')); await pg.waitForTimeout(400);
 await (await pg.$('#decos')).screenshot({path:OUT+'picker.png'});
 for (const k of (process.env.DECOS||'hexa,helix,mols,lattice,amino,bband,bcorner,bwave,bdots').split(',')) {
   await pg.click(`#decos button[data-k="${k}"]`); await pg.waitForTimeout(150);
   const m1=await dl('#dlBtn',`${k}.docx`); const m2=await dl('#pdfBtn',`${k}.pdf`); console.log(k, m2.slice(0,80));
 }
 await pg.evaluate(()=>document.querySelector('#pvCard').scrollIntoView()); await pg.waitForTimeout(500); await pg.screenshot({path:OUT+'pv.png'});
 // doctor identity hides brand group
 await pg.evaluate(()=>document.querySelector('#idSeg button[data-v="doctor"]').click()); await pg.waitForTimeout(200);
 console.log('brand hidden in doctor:', await pg.evaluate(()=>[...document.querySelectorAll('#decos [data-g="brand"]')].every(e=>e.hidden)));
 console.log('errors',errs); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
