const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs'),path=require('path');const JSZip=require(__P.join(__dirname,'../vendor/jszip.min.js'));
const OUT=__OUT; fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true}); const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('localhost:8765'))return r.fulfill({body:fs.readFileSync(path.join(__dirname,'../src/index.html')),contentType:'text/html; charset=utf-8'});
  return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForFunction(()=>window.docx&&window.JSZip);
 const dl=async(sel,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click(sel)]); await d.saveAs(OUT+name); await pg.waitForFunction(()=>!document.querySelector('#dlBtn').disabled&&!document.querySelector('#pdfBtn').disabled); return (await pg.textContent('#msg'));};
 const heads=async f=>{const z=await JSZip.loadAsync(fs.readFileSync(OUT+f));const x=await z.file('word/document.xml').async('string');return {h:(x.match(/w:pStyle w:val="Heading[1-4]"/g)||[]).length,box:(x.match(/w:fill="(DEEAF6|FFF2CC|E2F0D9|FDE4E2|EDEDED)"/g)||[]).length};};
 await pg.click('#modeWord');
 await pg.setInputFiles('#docxIn',[process.env.DOC||__FX+'smart_plain.docx']);
 await pg.waitForFunction(()=>/كلمة/.test(document.querySelector('#wordList').textContent),null,{timeout:60000}); await pg.waitForTimeout(400);
 for (const m of ['reskin','rebuild']) {
   await pg.click(`.method[data-m="${m}"]`);
   await pg.evaluate(()=>{const c=document.querySelector('#optWordSmart'); if(c.checked) c.click();}); await pg.waitForFunction(()=>/كلمة/.test(document.querySelector('#wordList').textContent)&&!document.querySelector('#wordList .spin'),null,{timeout:60000});
   console.log(m,'off:', await dl('#dlBtn',m+'_off.docx'), JSON.stringify(await heads(m+'_off.docx')));
   await pg.evaluate(()=>document.querySelector('#optWordSmart').click()); await pg.waitForTimeout(300); await pg.waitForFunction(()=>!document.querySelector('#wordList .spin'),null,{timeout:60000});
   console.log('chips:', (await pg.textContent('#wordList')).match(/✨[^ک]*?(صندوق|إضافات)/)?.[0]);
   console.log(m,'on:', await dl('#dlBtn',m+'_on.docx'), JSON.stringify(await heads(m+'_on.docx')));
   console.log(m,'pdf on:', await dl('#pdfBtn',m+'_on.pdf'));
 }
 await pg.evaluate(()=>document.querySelector('#pvCard').scrollIntoView()); await pg.waitForTimeout(500); await pg.screenshot({path:OUT+'pv.png'});
 console.log('scroll',await pg.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]),'errors',errs); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
