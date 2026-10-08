const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs'),path=require('path');
const OUT=process.env.OUT||__OUT+'rast/'; fs.mkdirSync(OUT,{recursive:true});
const PJ=process.env.PDFJS||__P.join(__dirname,'../vendor/pdfjs')+'/';
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true}); const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('pdf.worker.min.js'))return r.fulfill({body:fs.readFileSync(PJ+'pdf.worker.js'),contentType:'application/javascript'});
  if(u.includes('pdf.min.js'))return r.fulfill({body:fs.readFileSync(PJ+'pdf.js'),contentType:'application/javascript'});
  if(u.includes('localhost:8765'))return r.fulfill({body:fs.readFileSync(path.join(__dirname,'../src/index.html')),contentType:'text/html; charset=utf-8'});
  return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForFunction(()=>window.docx&&window.JSZip);
 await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
 await pg.evaluate(()=>document.querySelector('#protOn').click());
 const up=async(file,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}).catch(async e=>{console.log('NO DL, msg=',await pg.textContent('#msg'),errs);throw e}),pg.setInputFiles('#protPdfIn',file)]); await d.saveAs(OUT+name); await pg.waitForTimeout(400); return await pg.textContent('#msg');};
 // 1) strong anti-OCR, no password, no print restriction
 await pg.evaluate(()=>{for(const id of ['#protNoPrint','#protNoCopy']){const c=document.querySelector(id);if(c.checked)c.click();}});
 await pg.click('#antiOcrSeg button[data-v="strong"]');
 const t=Date.now(); console.log('strong:', await up(process.env.IN||__FX+'word_export.pdf','strong.pdf'), (Date.now()-t)+'ms');
 // 2) light + password + no print
 await pg.click('#antiOcrSeg button[data-v="light"]'); await pg.fill('#protPw','Bio2026'); await pg.evaluate(()=>document.querySelector('#protNoPrint').click());
 console.log('light+pw:', await up(process.env.IN||__FX+'word_export.pdf','light_pw.pdf'));
 // 3) none -> old encryption path
 await pg.click('#antiOcrSeg button[data-v="none"]');
 console.log('none+pw:', await up(process.env.IN||__FX+'word_export.pdf','none_pw.pdf'));
 console.log('errors',errs); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
