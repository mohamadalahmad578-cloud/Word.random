// خيار «حذف كل ما بين [ ]» + فك المائل داخل الغامق (**دواء (*Drug*)**) — ولا نجمة تضل بالملف
const { chromium } = require(process.env.PW||'/opt/node-tools/node_modules/playwright');const fs=require('fs'),path=require('path');
const HTML=path.join(__dirname,'../src/index.html'), VEN=path.join(__dirname,'../vendor'), RAW=fs.readFileSync(path.join(__dirname,'fixtures/pharm_brackets.md'),'utf8');
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')});
 const pg=await (await b.newContext()).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('docx@'))return r.fulfill({body:fs.readFileSync(path.join(VEN,'docx.iife.js')),contentType:'application/javascript'});
  if(u.includes('jszip'))return r.fulfill({body:fs.readFileSync(path.join(VEN,'jszip.min.js')),contentType:'application/javascript'});
  if(u.includes('localhost:8765'))return r.fulfill({body:fs.readFileSync(HTML),contentType:'text/html; charset=utf-8'});
  return r.abort();});
 await pg.goto('http://localhost:8765/index.html'); await pg.waitForFunction(()=>window.docx&&window.JSZip);
 const r=await pg.evaluate(async(t0)=>{const out={};
  const U=[["* **[هام جداً] يُمنع (*IM*)؛** والسبب",true,"* **{{هام جداً}} يُمنع (*IM*)؛** والسبب"],["نص [مرجع 1] بعده.",false,"نص بعده."],["الدواء [x] **مهم [y]** و (كذا [z])",false,"الدواء **مهم** و (كذا)"],["* [حذف]",false,""],["نص [ا [متداخل] ب] بعد",false,"نص بعد"],["| a [هام جداً] | b |",true,"| a | b |"]];
  out.unit=U.map(u=>{const g=ENGINE.stripBrackets(u[0],u[1]).text;return g===u[2]?'ok':'BAD «'+g+'»';}).join(' ');
  for(const mode of ['off','box','all']){const t=mode==='off'?t0:ENGINE.stripBrackets(t0,mode==='box').text;
   const S={cover:true,toc:true,sizes:ENGINE.SIZE_DEFAULTS,subject:"x",backCover:false,brand:{},lineSpacing:1.5,theme:"brand"};
   const blob=await ENGINE.finalize(await docx.Packer.toBlob(ENGINE.build(ENGINE.parseLectures(t),S)),'blob');const x=await (await JSZip.loadAsync(blob)).file('word/document.xml').async('string');
   const txt=[...x.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m=>m[1]).join('');
   out[mode]={check:ENGINE.compare(ENGINE.inputTokens(t),ENGINE.xmlTokens(x)).ok,stars:(txt.match(/\*/g)||[]).length,brackets:(txt.match(/[\[\]{}]/g)||[]).length,boxes:(x.match(/FFF2CC/g)||[]).length};}
  return out;},RAW);
 console.log('unit:',r.unit); ['off','box','all'].forEach(m=>console.log(m+':',JSON.stringify(r[m])));
 console.log('errors',errs); await b.close();})();
