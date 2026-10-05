const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
// يولّد Word و PDF لكل خلفية/إطار لنصّ المحاضرة
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
 await pg.fill('#src', fs.readFileSync(__FX+'sample.md','utf8')); await pg.waitForTimeout(400);
 await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
 await pg.fill('#pfUrl','mohamadalahmad578-cloud.github.io/Word.random');
 const dl=async(sel,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click(sel)]); await d.saveAs(OUT+name); await pg.waitForFunction(()=>!document.querySelector('#dlBtn').disabled);};
 for (const [bg,frame,cov] of [['cream',false,'classic'],['sky',true,'band'],['tint',true,'geo'],['mint',false,'wave']]) {
   await pg.click(`#bgs button[data-k="${bg}"]`); if ((await pg.isChecked('#optFrame'))!==frame) await pg.evaluate(()=>document.querySelector('#optFrame').click());
   await pg.click(`.cov[data-k="${cov}"]`); await pg.waitForTimeout(200);
   await dl('#dlBtn',`${bg}.docx`); await dl('#pdfBtn',`${bg}.pdf`); console.log(bg, await pg.textContent('#msg'));
 }
 const card=await pg.$('#bgs'); await card.screenshot({path:OUT+'bgs-ui.png'});
 await pg.evaluate(()=>document.querySelector('#pvCard').scrollIntoView()); await pg.waitForTimeout(400); await pg.screenshot({path:OUT+'pv.png'});
 console.log('errors',errs); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
