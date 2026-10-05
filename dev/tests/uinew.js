const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs');
const OUT=__OUT; fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const vp = process.env.VP==='m'?{width:390,height:844}:{width:1366,height:900};
 const ctx=await b.newContext({viewport:vp,acceptDownloads:true}); const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('docx-preview'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/docx-preview.min.js')),contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(__P.join(__dirname,'../vendor/jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('localhost:8765')){const p=require('path').join(__dirname,'../src',decodeURIComponent(new URL(u).pathname));return require('fs').existsSync(p)?r.fulfill({body:require('fs').readFileSync(p),contentType:p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.png')?'image/png':'application/octet-stream'}):r.fulfill({status:404,body:''});} return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload();
 await pg.waitForFunction(()=>window.docx&&window.JSZip);
 const dl=async(sel,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click(sel)]); const fn=d.suggestedFilename(); await d.saveAs(OUT+(name||fn)); return fn;};
 // --- text mode
 await pg.fill('#src', fs.readFileSync(__FX+'sample.md','utf8')); await pg.waitForTimeout(600);
 await pg.fill('#subj','باثولوجي'); await pg.fill('#doctor','د. أحمد الخطيب'); await pg.fill('#coverExtra','جامعة دمشق — كلية الطب\nالسنة الثالثة 2026');
 await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
 await pg.fill('#pfUrl','mohamadalahmad578-cloud.github.io/Word.random'); await pg.fill('#backText','ملخصات وتفريغات طبية منظمة'); await pg.fill('#social','Telegram: @RandomMEd\nInstagram: @random.med');
 console.log('nameEx:', await pg.textContent('#nameEx'));
 console.log('qrHint:', await pg.textContent('#qrHint'));
 console.log('download1:', await dl('#dlBtn','text.docx'));
 await pg.click('#checkBtn'); await pg.waitForFunction(()=>/مطابقة|اختلاف/.test(document.querySelector('#report').textContent),{timeout:60000});
 console.log('check:', (await pg.textContent('#report .rh')));
 // presets
 await pg.click('#psSave'); console.log('preset saved msg:', await pg.textContent('#msg'), 'count', await pg.textContent('#psCount'));
 await pg.fill('#subj','فارما'); await pg.fill('#doctor',''); await pg.click('.theme-opt[data-k="green"]');
 await pg.fill('#psName','فارما'); await pg.click('#psSave');
 await pg.selectOption('#psSel','باثولوجي'); await pg.waitForTimeout(200);
 console.log('after apply: subj=',await pg.inputValue('#subj'),'doctor=',await pg.inputValue('#doctor'),'theme sel=',await pg.$eval('.theme-opt.sel',e=>e.dataset.k));
 const exp=await dl('#psExport','presets.json'); const ej=JSON.parse(fs.readFileSync(OUT+'presets.json','utf8')); console.log('export:',exp,Object.keys(ej.presets));
 await pg.click('#psDel'); console.log('after delete count', await pg.textContent('#psCount'));
 await pg.setInputFiles('#psImport', OUT+'presets.json'); await pg.waitForTimeout(400); console.log('after import count', await pg.textContent('#psCount'), await pg.textContent('#msg'));
 // split naming
 await pg.selectOption('#psSel','باثولوجي'); await pg.waitForTimeout(200);
 await pg.click('#modeSeg button[data-v="split"]');
 await pg.fill('#src', fs.readFileSync(__FX+'sample.md','utf8').replace(/المحاضرة الرابعة/g,'المحاضرة الرابعة') + '\n\n# المحاضرة 5: الكبد\n\n## مقدمة\nنص قصير عن الكبد.\n'); await pg.waitForTimeout(600);
 console.log('split nameEx:', await pg.textContent('#nameEx'));
 const zn=await dl('#dlBtn','split.zip'); console.log('zip:',zn); 
 const JSZip=require(process.env.JSZIP||'/opt/node-tools/node_modules/jszip'); const z=await JSZip.loadAsync(fs.readFileSync(OUT+'split.zip')); console.log('zip entries:',Object.keys(z.files));
 await pg.click('#modeSeg button[data-v="single"]');
 // fast preview screenshot (cover+back)
 await pg.evaluate(()=>document.querySelector('#pvCard').scrollIntoView()); await pg.waitForTimeout(400);
 await pg.screenshot({path:OUT+'pv-fast.png',fullPage:false});
 const back=await pg.$('.pv-back'); if(back){await back.scrollIntoViewIfNeeded(); await back.screenshot({path:OUT+'pv-back.png'});} else console.log('NO pv-back');
 // real preview
 await pg.click('#pvSeg button[data-v="real"]');
 await pg.waitForFunction(()=>/عرض لمحتوى|تعذّر/.test(document.querySelector('#pvStatus').textContent),{timeout:90000});
 console.log('real status:', await pg.textContent('#pvStatus'));
 await pg.evaluate(()=>document.querySelector('#pvCard').scrollIntoView()); await pg.waitForTimeout(300);
 await pg.screenshot({path:OUT+'pv-real.png'});
 const secs=await pg.$$('#pvReal section.docx'); console.log('real pages',secs.length);
 if(secs.length){ await secs[0].screenshot({path:OUT+'real-1.png'}); await secs[secs.length-1].screenshot({path:OUT+'real-last.png'}); }
 await pg.click('#pvSeg button[data-v="fast"]');
 // --- word mode merge
 await pg.click('#modeWord');
 await pg.setInputFiles('#docxIn',[__FX+'t7_cover_nobreak.docx',__FX+'t3_lists.docx',__FX+'resp_pandoc.docx']);
 await pg.waitForFunction(()=>document.querySelectorAll('.wfile .chips').length===3,{timeout:60000});
 await pg.click('#optMerge',{force:true}).catch(async()=>{await pg.evaluate(()=>{const c=document.querySelector('#optMerge');c.click();})});
 console.log('merge checked', await pg.isChecked('#optMerge'), 'nameEx', await pg.textContent('#nameEx'));
 await pg.click('#checkBtn'); await pg.waitForFunction(()=>/تحقق الكلمات/.test(document.querySelector('#msg').textContent)||/خطأ/.test(document.querySelector('#msg').textContent),{timeout:120000});
 console.log('merge check msg:', await pg.textContent('#msg'));
 console.log('merge report:', (await pg.textContent('#wordList')).slice(0,400));
 console.log('merged download:', await dl('#dlBtn','merged.docx'));
 await pg.evaluate(()=>document.querySelector('#wordList').scrollIntoView()); await pg.screenshot({path:OUT+'merge.png'});
 // word mode single reskin with back cover
 await pg.evaluate(()=>{const c=document.querySelector('#optMerge'); if(c.checked) c.click();});
 console.log('reskin zip:', await dl('#dlBtn','reskin3.zip'));
 console.log('reskin msg:', await pg.textContent('#msg'));
 const sw=await pg.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]); console.log('scroll',sw,'errors',errs.filter(e=>!/ERR_FAILED|net::/.test(e)));
 await ctx.close(); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
