const __P=require('path'),__FX=__P.join(__dirname,'fixtures')+'/',__OUT=__P.join(__dirname,'out')+'/';require('fs').mkdirSync(__OUT,{recursive:true});
const fs=require('fs'), vm=require('vm');
global.window=global; global.atob=s=>Buffer.from(s,'base64').toString('binary');
global.docx=require(process.env.DOCX||'/opt/node-tools/node_modules/docx'); global.JSZip=require(process.env.JSZIP||'/opt/node-tools/node_modules/jszip');
const html=fs.readFileSync(__P.join(__dirname,'../src/index.html'),'utf8');
vm.runInThisContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);
const [,, inFile=__FX+'sample.md', theme='brand', outFile='out.docx', extra='{}']=process.argv;
(async()=>{
 const src=fs.readFileSync(inFile,'utf8');
 const L=ENGINE.parseLectures(src);
 const S=Object.assign({subject:ENGINE.detectSubject(src)||'المحاضرات',subtitle:'',theme,sizes:ENGINE.SIZE_DEFAULTS,lineSpacing:1.5,cover:true,toc:true,numPos:'right',footBrand:true,
   brand:{logo:{data:fs.readFileSync(__P.join(__dirname,'../src/logo.png')),w:214,h:180},wm:{data:fs.readFileSync(__P.join(__dirname,'../src/logo.png')),w:380,h:320}}},JSON.parse(extra));
 const buf=await ENGINE.finalize(await docx.Packer.toBuffer(ENGINE.build(L,S)),'nodebuffer');
 fs.writeFileSync(outFile,buf);
 const xml=await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
 const r=ENGINE.compare(ENGINE.inputTokens(src),ENGINE.xmlTokens(xml));
 console.log('lectures',L.length,'check',r.ok,r.inCount,r.outCount,JSON.stringify(r.missing).slice(0,300),JSON.stringify(r.extra).slice(0,300));
})().catch(e=>{console.error(e);process.exit(1)});
