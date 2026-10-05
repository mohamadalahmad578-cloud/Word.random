// تدقيق فصل هوية المنصة عن هوية الدكتور في كل الأوضاع (Word + PDF + الصور المرسومة)
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs'),path=require('path'),crypto=require('crypto');
const JSZip=require(process.env.JSZIP||require('path').join(__dirname,'../vendor/jszip.min.js'));
const HTML=process.env.HTML||path.join(__dirname,'../src/index.html'), VEN=process.env.VEN||path.join(__dirname,'../vendor'), FX=process.env.FX||path.join(__dirname,'fixtures')+'/';
const OUT=process.env.OUT||path.join(__dirname,'out/sep/'); fs.mkdirSync(OUT,{recursive:true});
const LOGO_MD5=crypto.createHash('md5').update(Buffer.from(fs.readFileSync(path.join(__dirname,'../src/logo.b64'),'utf8').trim(),'base64')).digest('hex');
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const ctx=await b.newContext({viewport:{width:1366,height:900},acceptDownloads:true}); const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(e.message)); pg.on('dialog',d=>d.accept());
 await pg.addInitScript(()=>{window.__ft=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t){window.__ft.push(String(t));return f.apply(this,arguments)};});
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(path.join(VEN,'docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(path.join(VEN,'jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('localhost:8765'))return r.fulfill({body:fs.readFileSync(HTML),contentType:'text/html; charset=utf-8'});
  return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForFunction(()=>window.docx&&window.JSZip);
 await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
 const clk=sel=>pg.evaluate(s=>document.querySelector(s).click(),sel);
 const setChk=async(sel,v)=>{if((await pg.isChecked(sel))!==v)await clk(sel);};
 // قيم المنصة (حرّاس)
 await pg.fill('#pfName','PLATNAME'); await pg.fill('#pfUrl','platsite.example'); await pg.fill('#backText','PLATBACK'); await pg.fill('#social','PLATSOCIAL');
 await pg.fill('#doctor','PLATDOC'); await pg.fill('#coverExtra','PLATEXTRA'); await setChk('#optBack',true);
 // قيم الدكتور
 await clk('#idSeg button[data-v="doctor"]');
 await pg.fill('#pptDoctor','DOCNAME'); await pg.fill('#pptUni','DOCUNI'); await pg.fill('#pptCourse','DOCCOURSE'); await pg.fill('#pptYear','DOCYEAR'); await pg.fill('#pptFooter','DOCFOOT');
 await setChk('#pptBack',true); await setChk('#pptRights',true); await setChk('#pptLogo',true);
 await pg.setInputFiles('#pptOwnLogo',FX+'pptin/mywm.png'); await pg.waitForTimeout(800);
 const ownMd5=await pg.evaluate(()=>{const d=localStorage.getItem('randommed.ppt.logo')||'';return d.length});
 await clk('#idSeg button[data-v="platform"]');
 const dl=async(sel,name)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click(sel)]); await d.saveAs(OUT+name); await pg.waitForFunction(()=>!document.querySelector('#dlBtn').disabled&&!document.querySelector('#pdfBtn').disabled); return OUT+name;};
 const PLAT=/PLAT(NAME|BACK|SOCIAL|DOC|EXTRA)|platsite|Random|R\.?MEd/i, DOC=/DOC(NAME|UNI|COURSE|YEAR|FOOT)/;
 async function scanDocx(f){const z=await JSZip.loadAsync(fs.readFileSync(f));let txt='',media=[],bm=[];for(const n of Object.keys(z.files)){if(z.files[n].dir)continue;if(/\.(xml|rels)$/.test(n)){const x=await z.file(n).async('string');txt+='\n'+x;(x.match(/w:name="[^"]*"/g)||[]).forEach(m=>bm.push(m));}else{const buf=await z.file(n).async('nodebuffer');media.push({n,md5:crypto.createHash('md5').update(buf).digest('hex'),len:buf.length});}}return {txt,media,bm};}
 const results=[]; let fail=0;
 async function run(mode,idv,prep){
   await clk('#mode'+mode); await prep(); await clk(`#idSeg button[data-v="${idv}"]`); await pg.waitForTimeout(300);
   await pg.evaluate(()=>window.__ft=[]);
   const docx=await dl('#dlBtn',`${mode}_${idv}.docx`); const ftDocx=await pg.evaluate(()=>window.__ft.slice()); await pg.evaluate(()=>window.__ft=[]);
   const pdf=await dl('#pdfBtn',`${mode}_${idv}.pdf`); const ftPdf=await pg.evaluate(()=>window.__ft.slice());
   const D=await scanDocx(docx); const pdfRaw=fs.readFileSync(pdf).toString('latin1'); const pdfMeta=(pdfRaw.match(/\/(Creator|Producer|Title|Author) [^\n>]*/g)||[]).join(' ');
   const decodeHex=s=>s.replace(/<FEFF([0-9A-F]+)>/g,(m,h)=>{let o='';for(let i=0;i<h.length;i+=4)o+=String.fromCharCode(parseInt(h.substr(i,4),16));return o});
   const meta=decodeHex(pdfMeta), ft=ftDocx.concat(ftPdf).join(' | ');
   const forbidden=idv==='doctor'?PLAT:DOC, expect=idv==='doctor'?/DOCNAME|DOCUNI/:/PLATNAME/;
   const probs=[];
   const tx=D.txt.replace(/<[^>]+>/g,' ');
   const m1=tx.match(forbidden); if(m1)probs.push('docx text: '+m1[0]+' …'+tx.slice(Math.max(0,tx.search(forbidden)-60),tx.search(forbidden)+60).replace(/\s+/g,' '));
   const attr=(D.txt.match(/(descr|title|name)="[^"]*"/g)||[]).filter(a=>forbidden.test(a)); if(attr.length)probs.push('docx attrs: '+attr.slice(0,5).join(','));
   if(idv==='doctor'&&D.media.some(m=>m.md5===LOGO_MD5))probs.push('platform logo image inside doctor docx');
   if(D.bm.some(x=>/w:name="RMED|w:name="BODY_START/.test(x)))probs.push('visible internal bookmark');
   if(forbidden.test(meta))probs.push('pdf metadata: '+meta);
   const ftBad=ftDocx.concat(ftPdf).filter(t=>forbidden.test(t)); if(ftBad.length)probs.push('drawn text: '+[...new Set(ftBad)].slice(0,6).join(' / '));
   const okExpect=expect.test(tx)||expect.test(ft);
   if(!okExpect)probs.push('sanity: expected identity text not found');
   fail+=probs.length; results.push({mode,idv,probs,media:D.media.length});
   console.log(`${mode.padEnd(5)} ${idv.padEnd(8)} ${probs.length?'✗ '+probs.join(' || '):'✓ نظيف'}`);
 }
 const SRC=fs.readFileSync(path.join(FX,'smartin/raw1.txt'),'utf8');
 for(const idv of ['platform','doctor']) await run('Text',idv,async()=>{await pg.fill('#src',SRC);await pg.waitForTimeout(300);});
 let wordLoaded=false; for(const idv of ['platform','doctor']) await run('Word',idv,async()=>{if(!wordLoaded){await pg.setInputFiles('#docxIn',[FX+'qaB/in/t3_lists.docx']);await pg.waitForFunction(()=>/كلمة/.test(document.querySelector('#wordList').textContent),null,{timeout:60000});await pg.waitForTimeout(500);wordLoaded=true;}});
 let pptLoaded=false; for(const idv of ['platform','doctor']) await run('Ppt',idv,async()=>{if(!pptLoaded){await pg.setInputFiles('#pptIn',[FX+'pptin/deck1.pptx']);await pg.waitForFunction(()=>document.querySelectorAll('#pptList .wfile .chips').length===1,null,{timeout:60000});pptLoaded=true;}});
 // فصل الألوان/الخلفية/الغلاف بين الهويتين
 await clk('#modeText'); await clk('#idSeg button[data-v="platform"]');
 const themes=await pg.$$eval('#themes > *',a=>a.map(x=>x.dataset.k).filter(Boolean));
 await clk(`#themes > [data-k="${themes[1]}"]`); await clk('#bgs button[data-k="cream"]'); await clk('.cov[data-k="geo"]');
 await clk('#idSeg button[data-v="doctor"]'); await clk(`#themes > [data-k="${themes[3]}"]`); await clk('#bgs button[data-k="mint"]'); await clk('.cov[data-k="helix"]');
 await clk('#idSeg button[data-v="platform"]'); const p1=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('randommed.lec2docx.settings.v2'));return [s.theme,s.pageBg,s.coverStyle]});
 await clk('#idSeg button[data-v="doctor"]'); const d1=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('randommed.lec2docx.settings.v2'));return [s.theme,s.pageBg,s.coverStyle]});
 await clk('#modeWord'); await clk('#idSeg button[data-v="platform"]'); const w1=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('randommed.lec2docx.settings.v2'));return [s.theme,s.pageBg,s.coverStyle,s.activeSlot]});
 await clk('#idSeg button[data-v="doctor"]'); const w2=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('randommed.lec2docx.settings.v2'));return [s.theme,s.pageBg,s.coverStyle,s.activeSlot]});
 await pg.reload(); await pg.waitForFunction(()=>window.docx&&window.JSZip); const r1=await pg.evaluate(()=>[document.querySelector('#themes > .sel')&&document.querySelector('#themes > .sel').dataset.k]);
 const slotOk=p1.join()===[themes[1],'cream','geo'].join() && d1.join()===[themes[3],'mint','helix'].join() && w1.slice(0,4).join()===[themes[1],'cream','geo','platform'].join() && w2.slice(0,4).join()===[themes[3],'mint','helix','doctor'].join() && r1[0]===themes[3];
 console.log('word platform',w1,'word doctor',w2,'after reload',r1);
 console.log('slots platform',p1,'doctor',d1,'word(platform id)',w1, slotOk?'✓ منفصلة':'✗'); if(!slotOk)fail++;
 console.log('errors',errs,'FAIL',fail); await b.close(); process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1)});
