var RESTYLE = (function () {
  "use strict";
  var W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  var PREL = "http://schemas.openxmlformats.org/package/2006/relationships";
  var CTNS = "http://schemas.openxmlformats.org/package/2006/content-types";
  var WPNS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  var ANS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  var AR = ENGINE.AR_RE, IMP = ENGINE.IMP;
  var XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var TOC_RE = /^\s*(contents|table of contents|index|المحتويات|الفهرس|فهرس المحتويات|فهرس المحاضرات(\s+ومحاورها)?|فهرس)\s*:?\s*$/i;
  var LAT_RE = /[A-Za-z]/;
  var CAP_RE = /^\s*(fig(ure)?\.?|table|الشكل|شكل|جدول|صورة)\s*[\d٠-٩]/i;
  function toXml(d) { return XMLDECL + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, ""); }

  /* ترتيب العناصر حسب مخطط OOXML (Word صارم بالترتيب) */
  var ORD = {
    pPr: ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
    rPr: ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath", "rPrChange"],
    tblPr: ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription", "tblPrChange"],
    tcPr: ["cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd", "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark", "headers", "cellIns", "cellDel", "cellMerge", "tcPrChange"],
    trPr: ["cnfStyle", "divId", "gridBefore", "gridAfter", "wBefore", "wAfter", "cantSplit", "trHeight", "tblHeader", "tblCellSpacing", "jc", "hidden", "ins", "del", "trPrChange"],
    sectPr: ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings", "sectPrChange"]
  };

  /* ---------- أدوات DOM ---------- */
  function isW(n, name) { return n && n.nodeType === 1 && n.namespaceURI === W && (!name || n.localName === name); }
  function kids(el, name) { var o = []; if (!el) return o; for (var c = el.firstChild; c; c = c.nextSibling) if (isW(c, name)) o.push(c); return o; }
  function kid(el, name) { if (!el) return null; for (var c = el.firstChild; c; c = c.nextSibling) if (isW(c, name)) return c; return null; }
  function wa(el, name) { if (!el) return null; var v = el.getAttributeNS(W, name); return v === "" && !el.hasAttributeNS(W, name) ? null : v; }
  function setA(el, name, val) { el.setAttributeNS(W, "w:" + name, String(val)); return el; }
  function mk(doc, name, attrs) { var e = doc.createElementNS(W, "w:" + name); if (attrs) for (var k in attrs) setA(e, k, attrs[k]); return e; }
  function place(parent, el, order) {
    var name = el.localName, idx = order.indexOf(name);
    kids(parent, name).forEach(function (o) { parent.removeChild(o); });
    for (var c = parent.firstChild; c; c = c.nextSibling) {
      if (isW(c) && order.indexOf(c.localName) > idx) { parent.insertBefore(el, c); return el; }
    }
    parent.appendChild(el); return el;
  }
  function sortPr(pr, order) { // ترتيب ثابت حسب المخطط؛ العناصر غير المعروفة (w14:…) في النهاية
    var a = [];
    for (var c = pr.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) a.push(c);
    a.forEach(function (c, i) { c.__k = isW(c) && order.indexOf(c.localName) >= 0 ? order.indexOf(c.localName) : 1000 + i; });
    a.sort(function (x, y) { return x.__k - y.__k; }).forEach(function (c) { pr.appendChild(c); });
  }
  function ensurePr(el, prName) {
    var pr = kid(el, prName);
    if (!pr) { pr = mk(el.ownerDocument, prName); el.insertBefore(pr, el.firstChild); }
    return pr;
  }
  function removeKids(parent, names) { names.forEach(function (n) { kids(parent, n).forEach(function (o) { parent.removeChild(o); }); }); }
  function truthy(el) { if (!el) return false; var v = wa(el, "val"); return v === null || !/^(0|false|off|none)$/i.test(v); }
  function ownerPara(n) { for (var p = n.parentNode; p; p = p.parentNode) if (isW(p, "p")) return p; return null; }
  function inside(n, name, stop) { for (var p = n.parentNode; p && p !== stop; p = p.parentNode) if (isW(p, name)) return true; return false; }
  function allW(el, name) { return Array.prototype.slice.call(el.getElementsByTagNameNS(W, name)); }

  /* نص الفقرة (بدون النصوص المتداخلة في مربعات النص) */
  function paraText(p) {
    var out = "";
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        if (isW(c, "txbxContent") || isW(c, "pPr") || isW(c, "rPr") || isW(c, "del") || isW(c, "delText") || isW(c, "instrText")) continue;
        if (c.localName === "Fallback") continue;
        if (isW(c, "t")) out += c.textContent;
        else if (isW(c, "tab") || isW(c, "br") || isW(c, "cr")) out += " ";
        else walk(c);
      }
    })(p);
    return out;
  }
  function nodeText(n) { // كل النص داخل عنصر (فقرات/جداول) مع فاصل بين الفقرات
    if (isW(n, "p")) return paraText(n) + "\n";
    var s = "";
    allW(n, "p").forEach(function (p) { if (!inside(p, "txbxContent", n) || true) s += paraText(p) + "\n"; });
    return s;
  }
  function tokensOfNodes(nodes) { var s = ""; nodes.forEach(function (n) { s += nodeText(n) + " "; }); return ENGINE.tokens(s); }

  /* ---------- الأنماط والترقيم ---------- */
  function parseStyles(xml) {
    var map = {}, def = { sz: null };
    if (!xml) return { map: map, def: def };
    var d = new DOMParser().parseFromString(xml, "application/xml");
    var dd = d.getElementsByTagNameNS(W, "docDefaults")[0];
    if (dd) { var sz = dd.getElementsByTagNameNS(W, "sz")[0]; if (sz) def.sz = +wa(sz, "val"); }
    Array.prototype.forEach.call(d.getElementsByTagNameNS(W, "style"), function (s) {
      var id = wa(s, "styleId"), nm = kid(s, "name"), bo = kid(s, "basedOn"), pPr = kid(s, "pPr"), rPr = kid(s, "rPr");
      var o = { id: id, type: wa(s, "type"), name: nm ? (wa(nm, "val") || "") : "", basedOn: bo ? wa(bo, "val") : null };
      var ol = pPr && kid(pPr, "outlineLvl"); if (ol) o.outline = +wa(ol, "val");
      if (rPr) { var b = kid(rPr, "b"); if (b) o.bold = truthy(b); var z = kid(rPr, "sz"); if (z) o.sz = +wa(z, "val"); }
      var np = pPr && kid(pPr, "numPr");
      if (np) { o.numPr = true; var ni = kid(np, "numId"), il = kid(np, "ilvl"); o.numId = ni ? wa(ni, "val") : null; o.ilvl = il ? wa(il, "val") : "0"; }
      map[id] = o;
    });
    Object.keys(map).forEach(function (id) { var s = map[id], d = 0, b = s; while (b && !b.numPr && b.basedOn && d++ < 10) b = map[b.basedOn]; if (b && b.numPr && !s.numPr) { s.numPr = true; s.numId = b.numId; s.ilvl = b.ilvl; } });
    function res(id, key, depth) { var s = map[id]; if (!s || depth > 10) return undefined; if (s[key] !== undefined) return s[key]; return s.basedOn ? res(s.basedOn, key, depth + 1) : undefined; }
    Object.keys(map).forEach(function (id) {
      var s = map[id], m = /^heading\s*(\d)/i.exec(s.name) || /^Heading(\d)$/.exec(id);
      s.level = m ? +m[1] : (res(id, "outline", 0) !== undefined && res(id, "outline", 0) < 9 ? res(id, "outline", 0) + 1 : 0);
      s.isTitle = /^title$/i.test(s.name) || id === "Title";
      s.isSubtitle = /^subtitle$/i.test(s.name);
      s.rBold = !!res(id, "bold", 0); s.rSz = res(id, "sz", 0) || null;
      s.isTocStyle = /^toc\s*\d|^toc heading/i.test(s.name);
    });
    return { map: map, def: def, doc: d };
  }
  function parseNumbering(xml) {
    var nums = {}, abs = {};
    if (!xml) return function () { return null; };
    var d = new DOMParser().parseFromString(xml, "application/xml");
    Array.prototype.forEach.call(d.getElementsByTagNameNS(W, "abstractNum"), function (a) {
      var lv = {};
      kids(a, "lvl").forEach(function (l) { var f = kid(l, "numFmt"), t = kid(l, "lvlText"), st = kid(l, "start"); lv[wa(l, "ilvl")] = { fmt: f ? wa(f, "val") : "decimal", text: t ? wa(t, "val") : "%1.", start: st ? +wa(st, "val") : 1 }; });
      abs[wa(a, "abstractNumId")] = lv;
    });
    var meta = {};
    Array.prototype.forEach.call(d.getElementsByTagNameNS(W, "num"), function (n) {
      var a = kid(n, "abstractNumId"); if (!a) return;
      var id = wa(n, "numId"), ov = {};
      kids(n, "lvlOverride").forEach(function (o) { var so = kid(o, "startOverride"); if (so) ov[wa(o, "ilvl")] = +wa(so, "val"); });
      nums[id] = abs[wa(a, "val")]; meta[id] = { abs: wa(a, "val"), ov: ov };
    });
    var f = function (numId, ilvl) { var a = nums[numId]; return a ? (a[ilvl] || a["0"] || null) : null; };
    f.meta = function (numId) { return meta[numId] || { abs: numId, ov: {} }; };
    return f;
  }

  /* ---------- قراءة خصائص الفقرة ---------- */
  function pStyleId(p) { var pPr = kid(p, "pPr"), ps = pPr && kid(pPr, "pStyle"); return ps ? wa(ps, "val") : null; }
  function runsOf(p) { // runs على مستوى الفقرة (مع الروابط والإدراجات)
    var o = [];
    (function walk(n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (!isW(c)) { if (c.nodeType === 1 && c.localName !== "Fallback" && c.localName !== "Choice") walk(c); continue; } if (c.localName === "r") o.push(c); else if (/^(hyperlink|ins|smartTag|sdt|sdtContent|fldSimple|customXml|bdo|dir)$/.test(c.localName)) walk(c); } })(p);
    return o;
  }
  function runText(r) { var s = ""; for (var c = r.firstChild; c; c = c.nextSibling) { if (isW(c, "t")) s += c.textContent; else if (isW(c, "tab") || isW(c, "br") || isW(c, "cr")) s += " "; } return s; }
  function runBold(r, st, pst) {
    var rPr = kid(r, "rPr"), b = rPr && (kid(rPr, "b") || kid(rPr, "bCs"));
    if (b) return truthy(b);
    var rs = rPr && kid(rPr, "rStyle"); if (rs && st.map[wa(rs, "val")]) return !!st.map[wa(rs, "val")].rBold || /strong/i.test(wa(rs, "val"));
    return !!(pst && pst.rBold);
  }
  function runItalic(r) { var rPr = kid(r, "rPr"), i = rPr && (kid(rPr, "i") || kid(rPr, "iCs")); return !!(i && truthy(i)); }
  function runSize(r, st, pst) { var rPr = kid(r, "rPr"), z = rPr && (kid(rPr, "sz") || kid(rPr, "szCs")); if (z) return +wa(z, "val"); return (pst && pst.rSz) || st.normSz || st.def.sz || 22; }
  function hasDrawing(n) { return n.getElementsByTagNameNS(W, "drawing").length > 0 || n.getElementsByTagNameNS("urn:schemas-microsoft-com:vml", "imagedata").length > 0 || n.getElementsByTagNameNS(W, "pict").length > 0; }

  /* ---------- التحليل ---------- */
  function analyze(buf) {
    return JSZip.loadAsync(buf).then(function (zip) {
      if (!zip.file("word/document.xml")) throw new Error("هذا ليس ملف Word ‎.docx صالحاً (لا يحوي word/document.xml). ملفات ‎.doc القديمة غير مدعومة — احفظها بصيغة ‎.docx أولاً.");
      var get = function (n) { var f = zip.file(n); return f ? f.async("string") : Promise.resolve(null); };
      return Promise.all([get("word/document.xml"), get("word/styles.xml"), get("word/numbering.xml"), get("word/_rels/document.xml.rels"), get("[Content_Types].xml"), get("word/settings.xml"), get("docProps/core.xml")]).then(function (x) {
        var doc = new DOMParser().parseFromString(x[0], "application/xml");
        if (!doc.getElementsByTagNameNS(W, "body")[0]) throw new Error("صيغة Word «Strict OOXML» غير مدعومة — افتح الملف في Word واحفظه بصيغة «مستند Word ‎(*.docx)» العادية.");
        if (doc.getElementsByTagName("parsererror").length) throw new Error("تعذّرت قراءة محتوى الملف (XML تالف).");
        var an = { zip: zip, doc: doc, stylesXml: x[1], numberingXml: x[2], relsXml: x[3], ctXml: x[4], settingsXml: x[5] };
        an.st = parseStyles(x[1]); an.num = parseNumbering(x[2]);
        var nst = an.st.map.Normal || Object.keys(an.st.map).map(function (k) { return an.st.map[k]; }).filter(function (s) { return /^normal$/i.test(s.name); })[0];
        an.st.normSz = nst && nst.rSz ? nst.rSz : (an.st.def.sz || 22);
        an.rels = parseRels(x[3]);
        an.body = doc.getElementsByTagNameNS(W, "body")[0];
        classify(an);
        // ملف سبق توليده بالموقع: اسم المادة كان داخل الغلاف المولّد — نسترجعه من خصائص الملف
        if (an.items.some(function (it) { return it.gen; }) && x[6]) {
          var mt = x[6].match(/<dc:title>([^<]*)<\/dc:title>/);
          if (mt) { var tt = mt[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim(); if (tt) an.genTitle = tt; }
        }
        return an;
      });
    });
  }
  function parseRels(xml) {
    var m = {};
    if (!xml) return m;
    var d = new DOMParser().parseFromString(xml, "application/xml");
    Array.prototype.forEach.call(d.getElementsByTagName("Relationship"), function (r) { m[r.getAttribute("Id")] = { type: r.getAttribute("Type"), target: r.getAttribute("Target"), mode: r.getAttribute("TargetMode") }; });
    return m;
  }

  function classify(an) {
    var st = an.st, body = an.body, items = [];
    // عناصر المستوى الأعلى (نفتح حاويات sdt العامة)
    (function collect(parent, container) {
      for (var c = parent.firstChild; c; c = c.nextSibling) {
        if (!isW(c)) continue;
        if (c.localName === "p" || c.localName === "tbl") items.push({ node: c, kind: c.localName, container: container });
        else if (c.localName === "sdt") {
          var gal = c.getElementsByTagNameNS(W, "docPartGallery")[0], content = kid(c, "sdtContent");
          if (gal && /table of contents/i.test(wa(gal, "val") || "")) items.push({ node: c, kind: "tocsdt", container: container });
          else if (content) collect(content, c);
        } else if (c.localName === "customXml") collect(c, container);
      }
    })(body, null);
    // نصوص وخصائص
    var sizes = [];
    items.forEach(function (it) {
      it.text = it.kind === "p" ? paraText(it.node) : nodeText(it.node);
      if (it.kind !== "p") return;
      var p = it.node, sid = pStyleId(p), s = sid ? st.map[sid] : null;
      it.style = s; it.drawing = hasDrawing(p);
      var pPr = kid(p, "pPr"); it.numPr = pPr && kid(pPr, "numPr");
      var ol = pPr && kid(pPr, "outlineLvl"); if (ol && +wa(ol, "val") < 9) it.outline = +wa(ol, "val") + 1;
      var rs = runsOf(p).filter(function (r) { return runText(r).trim(); });
      it.allBold = rs.length > 0 && rs.every(function (r) { return runBold(r, st, s); });
      it.maxSz = rs.reduce(function (m, r) { return Math.max(m, runSize(r, st, s)); }, 0);
      if (!it.allBold && it.text.trim().length > 40) rs.forEach(function (r) { sizes.push(runSize(r, st, s)); });
    });
    sizes.sort(function (a, b) { return a - b; });
    var bodySz = sizes.length ? sizes[Math.floor(sizes.length / 2)] : st.normSz;
    an.bodySz = bodySz;
    // العناوين
    var heurSizes = [];
    items.forEach(function (it) {
      if (it.kind !== "p") return;
      var t = it.text.trim(), s = it.style;
      if (s && s.isTocStyle) { it.tocLine = true; return; }
      if (s && s.isTitle) { it.title = true; return; }
      if (s && s.isSubtitle) { it.subtitle = true; return; }
      var lv = (s && s.level) || it.outline || 0;
      if (lv && t) { it.level = Math.min(lv, 4); it.styled = true; return; }
      // تقدير: فقرة قصيرة غامقة بالكامل وأكبر من خط المتن
      if (t && t.length <= 160 && it.allBold && !it.drawing && !(it.numPr && !/^\d/.test(t)) && it.maxSz >= bodySz + 2 && !TOC_RE.test(t) && !CAP_RE.test(t) && !(s && /caption/i.test(s.name))) { it.heur = true; heurSizes.push(it.maxSz); }
    });
    var hs = heurSizes.filter(function (v, i) { return heurSizes.indexOf(v) === i; }).sort(function (a, b) { return b - a; });
    var styledAny = items.some(function (it) { return it.styled; });
    items.forEach(function (it) { if (it.heur) it.level = Math.min(4, hs.indexOf(it.maxSz) + (styledAny ? 2 : 1)); });
    // مناطق مولّدة سابقاً (ملف من Random.MEd)
    var gen = false;
    items.forEach(function (it) {
      var bms = Array.prototype.map.call(it.node.getElementsByTagNameNS(W, "bookmarkStart"), function (b) { return wa(b, "name") || ""; });
      var startG = bms.some(function (n) { return /^RMEDGEN/.test(n); }), endG = bms.some(function (n) { return /^RMEDEND/.test(n); });
      if (startG) gen = true;
      if (gen) it.gen = true;
      if (endG) gen = false;
    });
    // الفهرس
    var tocStart = -1, tocEnd = -1, i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === "tocsdt") { it.toc = true; continue; }
      if (it.kind === "p" && /\bTOC\b/.test(Array.prototype.map.call(it.node.getElementsByTagNameNS(W, "instrText"), function (n) { return n.textContent; }).join(" "))) {
        var depth = 0, j = i;
        for (; j < items.length; j++) {
          var fcs = items[j].node.getElementsByTagNameNS(W, "fldChar");
          Array.prototype.forEach.call(fcs, function (f) { var t = wa(f, "fldCharType"); if (t === "begin") depth++; else if (t === "end") depth--; });
          items[j].toc = true;
          if (depth <= 0) break;
        }
        i = j; continue;
      }
      if (it.tocLine) { it.toc = true; continue; }
      if (tocStart < 0 && it.kind === "p" && TOC_RE.test(it.text) && it.text.trim().length < 40) {
        // من عنوان «المحتويات» حتى أول عنوان حقيقي (بحد أقصى 120 عنصراً)
        for (var k = i + 1; k < items.length && k < i + 120; k++) {
          var x = items[k];
          if (x.kind === "p" && x.level && !TOC_RE.test(x.text)) break;
        }
        if (k < items.length && k < i + 120) { tocStart = i; tocEnd = k; for (var q = i; q < k; q++) items[q].toc = true; }
      }
    }
    // الغلاف: ما قبل الفهرس أو أول عنوان حقيقي (أو أول فاصل صفحة) إن كان قصيراً
    var firstMain = -1, firstToc = -1, firstStyled = -1, firstHeur = -1, firstBreak = -1;
    for (i = 0; i < items.length; i++) {
      var y = items[i];
      if (firstToc < 0 && y.toc && i > 0 && !items.slice(0, i).every(function (z) { return z.toc; })) firstToc = i;
      if (firstStyled < 0 && y.styled) firstStyled = i;
      if (firstHeur < 0 && y.heur) firstHeur = i;
      if (firstBreak < 0 && i < 25 && (Array.prototype.some.call(y.node.getElementsByTagNameNS(W, "br"), function (b) { return wa(b, "type") === "page"; }) || (y.kind === "p" && kid(kid(y.node, "pPr") || y.node, "sectPr")))) firstBreak = i + 1;
    }
    var cands = [firstToc, firstStyled].filter(function (v) { return v >= 0; });
    if (cands.length) firstMain = Math.min.apply(null, cands);
    else if (firstBreak > 0) firstMain = firstBreak;
    else {
      // بلا فهرس/عناوين حقيقية/فاصل صفحة: الغلاف = ما قبل آخر عنوان تقديري يسبق أول فقرة طويلة
      var firstLong = -1; for (i = 0; i < items.length; i++) if (items[i].kind === "p" && items[i].text.trim().length > 100) { firstLong = i; break; }
      var lastH = -1; for (i = 0; i < (firstLong < 0 ? items.length : firstLong); i++) if (items[i].heur) lastH = i;
      firstMain = lastH >= 2 ? lastH : firstHeur;
    }
    if (firstBreak > 0 && firstBreak < firstMain && firstMain - firstBreak > 3) firstMain = firstBreak;
    an.cover = [];
    if (firstMain > 0) {
      var region = items.slice(0, firstMain).filter(function (it) { return !it.gen && !it.toc; });
      var txt = region.map(function (it) { return it.text; }).join(" ");
      var longP = region.some(function (it) { return it.kind === "p" && it.text.trim().length > 220; });
      if (region.length <= 45 && txt.length < 1600 && !longP) { items.slice(0, firstMain).forEach(function (it) { if (it.toc) return; it.cover = true; it.level = 0; it.heur = false; }); an.cover = region; }
    } else if (firstMain < 0) { /* لا عناوين: لا غلاف */ }
    // مستويات العناوين التقديرية بعد استبعاد الغلاف
    var hs2 = items.filter(function (it) { return it.heur && !it.cover; }).map(function (it) { return it.maxSz; });
    hs2 = hs2.filter(function (v, i) { return hs2.indexOf(v) === i; }).sort(function (a, b) { return b - a; });
    var styledBody = items.some(function (it) { return it.styled && !it.cover; });
    items.forEach(function (it) { if (it.heur && !it.cover) it.level = Math.min(4, hs2.indexOf(it.maxSz) + (styledBody ? 2 : 1)); });
    items.forEach(function (it) { if (it.title && !it.cover) it.level = 1; });
    // «توأم» العنوان: سطر غامق قصير مباشرة بعد عنوان، بلغة أخرى (عنوان ثنائي اللغة) — ينسّق بنفس المستوى
    var arD = function (t) { return (t.match(/[\u0600-\u06FF]/g) || []).length; }, laD = function (t) { return (t.match(/[A-Za-z]/g) || []).length; };
    for (var ti = 0; ti + 1 < items.length; ti++) {
      var hd = items[ti]; if (!hd.level || hd.cover || hd.toc || hd.kind !== "p") continue;
      var nx = items[ti + 1]; if (!nx || nx.kind !== "p" || nx.level || nx.cover || nx.toc || nx.numPr || nx.drawing) continue;
      var t1 = hd.text, t2 = nx.text.trim();
      if (!t2 || t2.length > 160 || !nx.allBold || CAP_RE.test(t2)) continue;
      var hAr = arD(t1) > laD(t1), nAr = arD(t2) > laD(t2);
      if (hAr !== nAr) { nx.level = hd.level; nx.twin = true; ti++; }
    }
    an.items = items;
    // سطور الغلاف
    an.coverLines = [];
    an.cover.forEach(function (it) {
      if (it.kind === "p") { var t = it.text.replace(/\s+/g, " ").trim(); if (t) an.coverLines.push(t); }
      else allW(it.node, "p").forEach(function (p) { var t = paraText(p).replace(/\s+/g, " ").trim(); if (t) an.coverLines.push(t); });
    });
    // أكبر سطر في الغلاف = عنوان المستند (يُعرض كعنوان الغلاف الكبير بدل تكراره)
    var best = -1, bestSz = 0, li = 0;
    an.cover.forEach(function (it) { if (it.kind !== "p") { li += allW(it.node, "p").filter(function (p) { return paraText(p).trim(); }).length; return; } if (!it.text.trim()) return; var sz = (it.maxSz || 0) + (it.allBold ? 1 : 0) + (it.title ? 100 : 0); if (sz > bestSz) { bestSz = sz; best = li; } li++; });
    an.coverTitleIdx = best;
    an.coverImages = an.cover.reduce(function (n, it) { return n + it.node.getElementsByTagNameNS(W, "drawing").length; }, 0);
    // عنوان المستند
    var tItem = items.filter(function (it) { return it.title; })[0];
    an.title = tItem ? tItem.text.trim() : (an.coverLines[0] || "");
    // إحصاءات
    var heads = [0, 0, 0, 0, 0];
    items.forEach(function (it) { if (it.level && !it.cover && !it.toc && !it.gen) heads[it.level]++; });
    an.stats = {
      paragraphs: items.filter(function (it) { return it.kind === "p"; }).length,
      headings: heads, heurHeadings: items.filter(function (it) { return it.heur && !it.cover && !it.toc; }).length,
      tables: allW(an.body, "tbl").length,
      images: an.body.getElementsByTagNameNS(ANS, "blip").length,
      textboxes: allW(an.body, "txbxContent").length,
      math: an.body.getElementsByTagNameNS("http://schemas.openxmlformats.org/officeDocument/2006/math", "oMath").length,
      lists: items.filter(function (it) { return it.numPr; }).length,
      imp: items.filter(function (it) { return !!ENGINE.calloutOf(it.text); }).length,
      arabic: AR.test(items.map(function (it) { return it.text; }).join(" ").slice(0, 20000)),
      cover: an.cover.length > 0, toc: items.some(function (it) { return it.toc; }),
      charts: an.body.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/chart", "chart").length
    };
    // رموز المقارنة: كل النص ما عدا الفهرس القديم والمحتوى المولّد سابقاً
    var ser = new XMLSerializer(), xs = function (f) { return items.filter(f).map(function (it) { return ser.serializeToString(it.node); }).join(""); };
    an.origTokens = ENGINE.xmlTokens(xs(function (it) { return !it.toc && !it.gen; }), { all: true });
    an.tocTokens = ENGINE.xmlTokens(xs(function (it) { return it.toc; }), { all: true }).length;
    // ترويسة الأصل كاسم للمادة
    an.headerText = "";
  }
  function headerTextOf(an) {
    var tgt = null;
    var sp = an.body.getElementsByTagNameNS(W, "sectPr");
    for (var i = sp.length - 1; i >= 0 && !tgt; i--) {
      kids(sp[i], "headerReference").forEach(function (h) { if (!tgt && (wa(h, "type") || "default") === "default") { var rel = an.rels[h.getAttributeNS(RNS, "id")]; if (rel) tgt = "word/" + rel.target.replace(/^\/?word\//, ""); } });
    }
    if (!tgt || !an.zip.file(tgt)) return Promise.resolve("");
    return an.zip.file(tgt).async("string").then(function (x) {
      var d = new DOMParser().parseFromString(x, "application/xml");
      return Array.prototype.map.call(d.getElementsByTagNameNS(W, "p"), paraText).join(" ").replace(/\s+/g, " ").trim();
    });
  }

  /* ---------- أداة: لغة الأعمدة في جدول ---------- */
  function tableDirection(tbl) {
    var rows = kids(tbl, "tr"), cols = [];
    rows.forEach(function (tr, ri) {
      kids(tr, "tc").forEach(function (tc, ci) {
        var t = nodeText(tc); cols[ci] = cols[ci] || { ar: 0, la: 0 };
        cols[ci].ar += (t.match(/[؀-ۿ]/g) || []).length; cols[ci].la += (t.match(/[A-Za-z]/g) || []).length;
      });
    });
    var arCols = [], laCols = [];
    cols.forEach(function (c, i) { if (!c) return; if (c.ar > c.la * 1.2 && c.ar > 2) arCols.push(i); else if (c.la > c.ar * 1.2 && c.la > 2) laCols.push(i); });
    if (arCols.length && laCols.length) return { bilingual: true, rtl: Math.max.apply(null, arCols) < Math.max.apply(null, laCols) };
    if (arCols.length) return { rtl: true };
    if (laCols.length) return { rtl: false };
    var all = nodeText(tbl); return { rtl: AR.test(all) };
  }

  /* ---------- إعادة التلبيس ---------- */
  function reskin(an, S, brand) {
    var doc = an.doc, body = an.body, st = an.st, T = ENGINE.resolveTheme(S);
    var Z = Object.assign({}, ENGINE.SIZE_DEFAULTS, S.sizes || {});
    var hp = function (pt) { return String(Math.round(pt * 2)); };
    var LINE = String(Math.round(240 * (S.lineSpacing || 1.5))), TLINE = String(Math.round(240 * Math.min(1.15, S.lineSpacing || 1.5)));
    if (S.origLine !== false) { LINE = null; TLINE = null; } // الحفاظ على تباعد الأسطر كما في الملف الأصلي (نفس عدد الصفحات تقريباً)
    var FA = "Simplified Arabic", FE = "Times New Roman";
    var rep = { coverImages: S.cover ? an.coverImages : 0, headings: [0, 0, 0, 0, 0], paragraphs: 0, tables: 0, bilingual: 0, runsSplit: 0, imp: 0, bidiFixed: 0, ltrFixed: 0, images: an.stats.images, removedToc: 0, coverLines: an.coverLines.length };

    function fonts(rPr, ltr) {
      var f = mk(doc, "rFonts", ltr ? { ascii: FE, hAnsi: FE, cs: FE, eastAsia: FE } : { ascii: FE, hAnsi: FE, cs: FA, eastAsia: FA });
      place(rPr, f, ORD.rPr);
    }
    function styleRun(r, o) {
      var rPr = ensurePr(r, "rPr"), t = runText(r), ltr = !!o.ltrRun;
      fonts(rPr, ltr);
      if (o.size) { place(rPr, mk(doc, "sz", { val: o.size }), ORD.rPr); place(rPr, mk(doc, "szCs", { val: o.size }), ORD.rPr); }
      var bold = o.forceBold || runBold(r, st, o.pst);
      if (o.forceBold) { place(rPr, mk(doc, "b"), ORD.rPr); place(rPr, mk(doc, "bCs"), ORD.rPr); }
      var col = kid(rPr, "color"), cv = col ? (wa(col, "val") || "").toUpperCase() : "";
      if (o.color) place(rPr, mk(doc, "color", { val: o.color }), ORD.rPr);
      else if (bold) place(rPr, mk(doc, "color", { val: T.bold }), ORD.rPr);
      else if (col && (cv === "AUTO" || cv === "000000" || /^(1|2|3)[0-9A-F]{5}$/.test(cv) && isDarkBlueish(cv))) rPr.removeChild(col);
      removeKids(rPr, ["rtl"]);
      place(rPr, mk(doc, "rtl", { val: ltr ? "0" : "1" }), ORD.rPr);
      place(rPr, mk(doc, "lang", ltr ? { val: "en-US", bidi: "ar-SA" } : { val: "ar-SA", bidi: "ar-SA" }), ORD.rPr);
      sortPr(rPr, ORD.rPr);
    }
    function isDarkBlueish(hex) { var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16); return r + g + b < 260; }
    // تقسيم runs نصية بسيطة إلى مقاطع عربية/لاتينية
    function splitRuns(p, rtlPara, o) {
      runsOf(p).forEach(function (r) {
        var simple = true, ts = [];
        for (var c = r.firstChild; c; c = c.nextSibling) { if (!isW(c)) continue; if (c.localName === "rPr") continue; if (c.localName === "t") ts.push(c); else { simple = false; break; } }
        if (!rtlPara) { styleRun(r, Object.assign({}, o, { ltrRun: true })); return; }
        if (!simple || ts.length !== 1) { styleRun(r, Object.assign({}, o, { ltrRun: !AR.test(runText(r)) && LAT_RE.test(runText(r)) })); return; }
        var text = ts[0].textContent, segs = ENGINE.splitDir(text);
        if (o.impTag && ENGINE.calloutOf(text)) segs = splitTag(segs);
        if (segs.length <= 1) { styleRun(r, Object.assign({}, o, { ltrRun: segs[0] ? !segs[0].rtl : false, tag: segs[0] && segs[0].tag })); if (segs[0]) ts[0].textContent = segs[0].t; if (segs[0] && segs[0].tag) tagStyle(r, segs[0].tag); return; }
        rep.runsSplit++;
        segs.forEach(function (sg) {
          var nr = r.cloneNode(true), nt = kid(nr, "t");
          nt.textContent = sg.t; nt.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          styleRun(nr, Object.assign({}, o, { ltrRun: !sg.rtl }));
          if (sg.tag) tagStyle(nr, sg.tag);
          r.parentNode.insertBefore(nr, r);
        });
        r.parentNode.removeChild(r);
      });
    }
    function splitTag(segs) {
      var out = [];
      segs.forEach(function (sg) {
        if (!ENGINE.CO_RE.test(sg.t)) { out.push(sg); return; }
        sg.t.split(ENGINE.CO_RE).forEach(function (part) { if (!part) return; var co = ENGINE.coByTag(part); if (co) out.push({ t: part, rtl: true, tag: co }); else out.push({ t: part, rtl: sg.rtl }); });
      });
      return out;
    }
    function tagStyle(r, co) {
      var rPr = ensurePr(r, "rPr");
      place(rPr, mk(doc, "b"), ORD.rPr); place(rPr, mk(doc, "bCs"), ORD.rPr);
      place(rPr, mk(doc, "color", { val: "FFFFFF" }), ORD.rPr);
      place(rPr, mk(doc, "shd", { val: "clear", color: "auto", fill: (co && co.tagFill) || "C00000" }), ORD.rPr);
    }
    function border(name, val, sz, color, space) { return mk(doc, name, { val: val, sz: sz, space: space || 1, color: color }); }
    function pBox(pPr, color, sz, space, val) {
      var b = mk(doc, "pBdr");
      ["top", "left", "bottom", "right"].forEach(function (s) { b.appendChild(border(s, val || "single", sz, color, space)); });
      place(pPr, b, ORD.pPr);
    }
    function setSpacing(pPr, line, before, after, keep) {
      var sp = kid(pPr, "spacing"), o = {};
      if (line !== null) { o.line = line; o.lineRule = "auto"; }
      else if (sp && wa(sp, "line")) { o.line = wa(sp, "line"); if (wa(sp, "lineRule")) o.lineRule = wa(sp, "lineRule"); } // تباعد الأسطر الأصلي
      if (before !== null && before !== undefined) o.before = before; else if (sp && wa(sp, "before")) o.before = wa(sp, "before");
      if (after !== null && after !== undefined) o.after = after; else if (sp && wa(sp, "after")) o.after = wa(sp, "after"); else o.after = keep || "100";
      var e = mk(doc, "spacing", o); place(pPr, e, ORD.pPr); sortPr(pPr, ORD.pPr);
    }
    function setDir(pPr, rtl) {
      if (rtl) { place(pPr, mk(doc, "bidi"), ORD.pPr); }
      else { removeKids(pPr, ["bidi"]); }
    }
    function cleanParaDeco(pPr) { removeKids(pPr, ["pBdr", "shd"]); }

    // 1) حذف الغلاف والفهرس القديمين والمحتوى المولّد سابقاً (مع حفظ نص الغلاف في الغلاف الجديد)
    var lastSect = kid(body, "sectPr");
    an.items.forEach(function (it) {
      if (!(it.toc || it.gen || (it.cover && S.cover))) return;
      if (it.toc) rep.removedToc++;
      var n = it.node, pPr = isW(n, "p") && kid(n, "pPr"), sp = pPr && kid(pPr, "sectPr");
      if (sp && n.parentNode) { /* فاصل قسم داخل الغلاف: نحذفه — قسم الغلاف الجديد يحل مكانه */ }
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    // إن صار الجسم يبدأ بفقرة فارغة/فاصل صفحة نتركه كما هو

    // 2) العناوين والفقرات
    var bodyItems = an.items.filter(function (it) { return !(it.toc || it.gen || (it.cover && S.cover)); });
    bodyItems.forEach(function (it) {
      if (it.kind !== "p") return;
      var p = it.node, pPr = ensurePr(p, "pPr"), txt = it.text, rtl = AR.test(txt);
      if (S.keepParas && txt.trim()) place(pPr, mk(doc, "keepLines"), ORD.pPr); // الفقرة كاملة بصفحة وحدة
      if (it.level) {
        var lv = it.level; rep.headings[lv]++;
        place(pPr, mk(doc, "pStyle", { val: "Heading" + lv }), ORD.pPr);
        place(pPr, mk(doc, "keepNext"), ORD.pPr);
        setDir(pPr, rtl || !txt.trim());
        cleanParaDeco(pPr);
        removeKids(pPr, ["jc", "ind"]);
        var size = hp(Z["h" + lv]), color = lv === 1 ? "FFFFFF" : lv === 2 ? T.h2t : lv === 3 ? T.h3 : T.h4;
        if (lv === 1) { place(pPr, mk(doc, "shd", { val: "clear", color: "auto", fill: T.h1 }), ORD.pPr); pBox(pPr, T.h1, 6, 6); place(pPr, mk(doc, "jc", { val: "center" }), ORD.pPr); setSpacing(pPr, "320", "240", "200"); }
        else if (lv === 2) {
          place(pPr, mk(doc, "shd", { val: "clear", color: "auto", fill: T.h2bg }), ORD.pPr);
          var b = mk(doc, "pBdr"); b.appendChild(border("top", "single", 4, T.h2bg, 1)); b.appendChild(border("left", "single", 4, T.h2bg, 1)); b.appendChild(border("bottom", "thick", 18, T.h2line, 2)); b.appendChild(border("right", "single", 4, T.h2bg, 1)); place(pPr, b, ORD.pPr);
          setSpacing(pPr, "300", "320", "160");
        } else if (lv === 3) { var b3 = mk(doc, "pBdr"); b3.appendChild(border("bottom", "dotted", 6, T.h3, 1)); place(pPr, b3, ORD.pPr); setSpacing(pPr, "300", "240", "120"); }
        else setSpacing(pPr, "300", "200", "80");
        if (!rtl && lv !== 1) removeKids(pPr, ["jc"]);
        splitRuns(p, rtl, { size: size, color: color, forceBold: true, pst: it.style });
        return;
      }
      rep.paragraphs++;
      var hadBidi = !!kid(pPr, "bidi");
      if (rtl && !hadBidi) rep.bidiFixed++;
      if (!rtl && hadBidi && LAT_RE.test(txt)) rep.ltrFixed++;
      var imgOnly = it.drawing && !txt.trim();
      setDir(pPr, rtl || imgOnly || (!LAT_RE.test(txt) && hadBidi));
      var jc = kid(pPr, "jc"), jv = jc ? wa(jc, "val") : null;
      if (imgOnly) { removeKids(pPr, ["jc"]); jv = null; } // الصور على اليمين
      if (jv !== "center") { removeKids(pPr, ["jc"]); if (txt.trim().length > 60 && !it.drawing && !/\*\*/.test(txt)) place(pPr, mk(doc, "jc", { val: "both" }), ORD.pPr); }
      setSpacing(pPr, LINE);
      var imp = ENGINE.calloutOf(txt);
      if (imp) { rep.imp++; place(pPr, mk(doc, "shd", { val: "clear", color: "auto", fill: imp.fill }), ORD.pPr); pBox(pPr, imp.border, 8, 4); }
      splitRuns(p, rtl, { size: S.origLine !== false ? null : hp(Z.body), pst: it.style, impTag: imp });
    });
    // فقرات داخل مربعات النص: خطوط واتجاه فقط
    allW(body, "txbxContent").forEach(function (tx) { kids(tx, "p").forEach(function (p) { var pPr = ensurePr(p, "pPr"), rtl = AR.test(paraText(p)); setDir(pPr, rtl); splitRuns(p, rtl, { size: hp(Z.body) }); }); });

    // 3) الجداول
    allW(body, "tbl").forEach(function (tbl) {
      if (!tbl.parentNode) return;
      if (!kids(tbl, "tr").length) { var tp0 = kid(tbl, "tblPr"); if (tp0) sortPr(tp0, ORD.tblPr); return; }
      rep.tables++;
      var tblPr = ensurePr(tbl, "tblPr"), dir = tableDirection(tbl), rows = kids(tbl, "tr"), figure = hasDrawing(tbl);
      if (dir.bilingual) rep.bilingual++;
      removeKids(tblPr, ["tblStyle", "tblLook"]);
      if (dir.rtl) place(tblPr, mk(doc, "bidiVisual"), ORD.tblPr); else removeKids(tblPr, ["bidiVisual"]);
      // الجدول نفسه على يمين الصفحة دائماً (حتى الجداول ثنائية اللغة اليسارية الأعمدة)
      if (!kid(tblPr, "tblpPr")) { removeKids(tblPr, ["tblInd", "jc"]); if (!dir.rtl) place(tblPr, mk(doc, "jc", { val: "right" }), ORD.tblPr); }
      var firstRow = rows[0], headRow = false;
      if (rows.length >= 2 && firstRow) {
        var trPr0 = kid(firstRow, "trPr"), hdr = trPr0 && kid(trPr0, "tblHeader");
        var fr = allW(firstRow, "r").filter(function (r) { return runText(r).trim(); });
        headRow = !!hdr || (fr.length > 0 && fr.every(function (r) { return runBold(r, st, null); }));
      }
      if (!figure) {
        var bd = mk(doc, "tblBorders");
        ["top", "left", "bottom", "right"].forEach(function (s) { bd.appendChild(mk(doc, s, { val: "single", sz: 6, space: 0, color: T.border })); });
        ["insideH", "insideV"].forEach(function (s) { bd.appendChild(mk(doc, s, { val: "single", sz: 4, space: 0, color: T.border })); });
        place(tblPr, bd, ORD.tblPr);
        var cm = mk(doc, "tblCellMar"); cm.appendChild(mk(doc, "top", { w: 60, type: "dxa" })); cm.appendChild(mk(doc, "left", { w: 100, type: "dxa" })); cm.appendChild(mk(doc, "bottom", { w: 60, type: "dxa" })); cm.appendChild(mk(doc, "right", { w: 100, type: "dxa" }));
        place(tblPr, cm, ORD.tblPr);
      }
      var ncol = Math.max.apply(null, rows.map(function (r) { return kids(r, "tc").length; }).concat([1]));
      rows.forEach(function (tr, ri) {
        var trPr = ensurePr(tr, "trPr");
        if (S.keepParas !== false) place(trPr, mk(doc, "cantSplit"), ORD.trPr);
        if (ri === 0 && headRow) place(trPr, mk(doc, "tblHeader"), ORD.trPr);
        if (!kid(trPr, "cantSplit") && !kid(trPr, "tblHeader") && !trPr.firstChild) tr.removeChild(trPr);
        kids(tr, "tc").forEach(function (tc, ci) {
          var tcPr = ensurePr(tc, "tcPr"), head = ri === 0 && headRow;
          if (!figure) {
            removeKids(tcPr, ["tcBorders"]);
            var fill = head ? T.thead : (ci === 0 && ncol >= 3 && !dir.bilingual ? T.fc : (ri % 2 === 0 && ri > 0 ? T.alt : (ri % 2 === 1 || !headRow ? "FFFFFF" : T.alt)));
            if (!headRow && ri % 2 === 1) fill = (ci === 0 && ncol >= 3 && !dir.bilingual) ? T.fc : T.alt;
            place(tcPr, mk(doc, "shd", { val: "clear", color: "auto", fill: fill }), ORD.tcPr);
            place(tcPr, mk(doc, "vAlign", { val: "center" }), ORD.tcPr);
          }
          kids(tc, "p").forEach(function (p) {
            var pPr = ensurePr(p, "pPr"), t = paraText(p), rtl = AR.test(t) || (hasDrawing(p) && !t.trim());
            setDir(pPr, rtl);
            cleanParaDeco(pPr);
            var jc = kid(pPr, "jc"); if (head) place(pPr, mk(doc, "jc", { val: "center" }), ORD.pPr); else if (jc && wa(jc, "val") !== "center") pPr.removeChild(jc);
            setSpacing(pPr, TLINE, "0", "0");
            var imp = !!ENGINE.calloutOf(t); if (imp) rep.imp++;
            splitRuns(p, rtl, { size: hp(Z.table), color: head ? "FFFFFF" : null, forceBold: head, pst: null, impTag: imp });
          });
        });
      });
    });

    // 4) الأنماط: عناوين حقيقية تظهر في لوحة التنقل
    var sdoc = an.st.doc || new DOMParser().parseFromString('<w:styles xmlns:w="' + W + '"/>', "application/xml");
    var stylesRoot = sdoc.documentElement;
    [1, 2, 3, 4].forEach(function (lv) {
      var id = "Heading" + lv, ex = null;
      Array.prototype.forEach.call(sdoc.getElementsByTagNameNS(W, "style"), function (s) { if (wa(s, "styleId") === id) ex = s; });
      if (ex) ex.parentNode.removeChild(ex);
      var s = mk(sdoc, "style", { type: "paragraph", styleId: id });
      s.appendChild(mk(sdoc, "name", { val: "heading " + lv }));
      s.appendChild(mk(sdoc, "basedOn", { val: "Normal" })); s.appendChild(mk(sdoc, "next", { val: "Normal" })); s.appendChild(mk(sdoc, "uiPriority", { val: 9 })); s.appendChild(mk(sdoc, "qFormat"));
      var pp = mk(sdoc, "pPr"); pp.appendChild(mk(sdoc, "keepNext")); pp.appendChild(mk(sdoc, "keepLines")); pp.appendChild(mk(sdoc, "outlineLvl", { val: lv - 1 })); s.appendChild(pp);
      var rp = mk(sdoc, "rPr"); rp.appendChild(mk(sdoc, "rFonts", { ascii: FE, hAnsi: FE, cs: FA })); rp.appendChild(mk(sdoc, "b")); rp.appendChild(mk(sdoc, "bCs"));
      rp.appendChild(mk(sdoc, "sz", { val: hp(Z["h" + lv]) })); rp.appendChild(mk(sdoc, "szCs", { val: hp(Z["h" + lv]) })); s.appendChild(rp);
      stylesRoot.appendChild(s);
    });
    an.zip.file("word/styles.xml", toXml(sdoc));

    // 5) غلاف وفهرس وترويسة/تذييل الهوية من «مستند مانح» يولّده المحرك
    var toc = buildTocItems(an);
    var S2 = Object.assign({}, S, coverOpts(an, S), { tocItems: toc, tocNoNumbering: true,
      tocLabels: { title: "فهرس المحتويات", c1: "القسم", c2: "العناوين الفرعية", count: "عدد الأقسام: " }, brand: brand });
    if (!toc.length) S2.toc = false;
    return docx.Packer.toBlob(ENGINE.build([], S2)).then(function (b) { return JSZip.loadAsync(b); }).then(function (donor) {
      return transplant(an, donor, S2, rep);
    }).then(function () {
      return renumberIds(an, doc);
    }).then(function () {
      an.zip.file("word/document.xml", toXml(doc));
      return prune(an.zip);
    }).then(function () {
      return an.zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
    }).then(function (blob) { return { blob: blob, report: rep }; });
  }

  /* حذف أجزاء لم يعد يستخدمها المستند (ترويسات/تذييلات/صور/روابط من تنسيق سابق) حتى لا يكبر الملف مع كل إعادة تنسيق */
  function prune(zip) {
    var relsF = "word/_rels/document.xml.rels";
    if (!zip.file(relsF)) return Promise.resolve();
    return Promise.all([zip.file("word/document.xml").async("string"), zip.file(relsF).async("string"), zip.file("[Content_Types].xml").async("string")]).then(function (x) {
      var used = {}; x[0].replace(/="([^"]+)"/g, function (_, v) { used[v] = 1; return _; });
      var rd = new DOMParser().parseFromString(x[1], "application/xml"), dropped = [];
      Array.prototype.slice.call(rd.getElementsByTagName("Relationship")).forEach(function (rel) {
        var ty = rel.getAttribute("Type") || "", id = rel.getAttribute("Id");
        if (!/\/(header|footer|image|hyperlink)$/.test(ty) || used[id]) return;
        rel.parentNode.removeChild(rel);
        if (rel.getAttribute("TargetMode") !== "External") dropped.push("word/" + String(rel.getAttribute("Target")).replace(/^\/?word\//, ""));
      });
      zip.file(relsF, toXml(rd));
      // ترويسات/تذييلات محذوفة: نحذف ملفاتها وعلاقاتها، ثم الصور التي لم يعد أحد يشير إليها
      var gone = {};
      dropped.forEach(function (p) { if (/^word\/[^/]+\.xml$/.test(p) && /(header|footer)/i.test(p) && zip.file(p)) { zip.remove(p); var rp = p.replace(/^word\//, "word/_rels/") + ".rels"; if (zip.file(rp)) zip.remove(rp); gone["/" + p] = 1; } });
      var relFiles = Object.keys(zip.files).filter(function (n) { return /\.rels$/.test(n) && !zip.files[n].dir; });
      return Promise.all(relFiles.map(function (n) { return zip.file(n).async("string").then(function (t) { return [n, t]; }); })).then(function (all) {
        var refd = {};
        all.forEach(function (pr) { var base = pr[0].replace(/_rels\/[^/]+\.rels$/, ""); pr[1].replace(/Target="([^"]+)"/g, function (_, t) { if (!/^https?:/i.test(t)) { var full = /^\//.test(t) ? t.slice(1) : base + t; refd[full.replace(/\/[^/]+\/\.\.\//g, "/")] = 1; } return _; }); });
        Object.keys(zip.files).forEach(function (n) { if (/^word\/media\//.test(n) && !zip.files[n].dir && !refd[n]) { zip.remove(n); gone["/" + n] = 1; } });
        var ct = new DOMParser().parseFromString(x[2], "application/xml");
        Array.prototype.slice.call(ct.getElementsByTagName("Override")).forEach(function (o) { if (gone[o.getAttribute("PartName")]) o.parentNode.removeChild(o); });
        zip.file("[Content_Types].xml", toXml(ct));
      });
    });
  }
  /* معرّفات wp:docPr فريدة عبر المستند والترويسات/التذييلات، ومعرّفات إشارات مرجعية فريدة */
  function renumberIds(an, doc) {
    var names = Object.keys(an.zip.files).filter(function (n) { return /^word\/(header|footer|rmedHeader|rmedFooter)\w*\.xml$/.test(n); });
    return Promise.all(names.map(function (n) { return an.zip.file(n).async("string").then(function (x) { return [n, x]; }); })).then(function (parts) {
      var next = 1;
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(WPNS, "docPr"), function (e) { e.setAttribute("id", String(next++)); });
      parts.forEach(function (p) {
        var d = new DOMParser().parseFromString(p[1], "application/xml"), dp = d.getElementsByTagNameNS(WPNS, "docPr");
        if (!dp.length) return;
        Array.prototype.forEach.call(dp, function (e) { e.setAttribute("id", String(next++)); });
        an.zip.file(p[0], toXml(d));
      });
      // الإشارات المرجعية: كل bookmarkStart يحصل على معرّف جديد ويُربط bookmarkEnd التالي المطابق له
      var map = {}, nid = 1;
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, "*"), function (e) {
        if (e.localName === "bookmarkStart") { var o = wa(e, "id"); (map[o] = map[o] || []).push(String(nid)); setA(e, "id", nid++); }
        else if (e.localName === "bookmarkEnd") { var q = map[wa(e, "id")]; if (q && q.length) setA(e, "id", q.shift()); }
      });
    });
  }
  // إن لم يكتب المستخدم اسم المادة: سطر العنوان الأصلي يصبح عنوان الغلاف (نص أصلي غير مولّد)
  function coverOpts(an, S) {
    var lines = an.coverLines.slice();
    if (!S.userSubject && an.coverTitleIdx >= 0 && lines[an.coverTitleIdx]) {
      var t = lines.splice(an.coverTitleIdx, 1)[0];
      return { coverLines: lines, coverTitle: t, subject: S.subject || t };
    }
    return { coverLines: lines };
  }
  function buildTocItems(an) {
    var out = [], cur = null, items = an.items.filter(function (it) { return !(it.cover || it.toc || it.gen) && it.level && !it.twin; });
    if (!items.length) return out;
    var top = Math.min.apply(null, items.map(function (it) { return it.level; }));
    items.forEach(function (it) {
      var t = it.text.replace(/\s+/g, " ").trim(); if (!t) return;
      if (it.level === top) { cur = { label: t, topics: [] }; out.push(cur); }
      else if (it.level === top + 1 && cur) cur.topics.push(t);
    });
    return out.slice(0, 200);
  }

  /* نقل الغلاف/الفهرس والترويسة/التذييل من المستند المانح */
  function transplant(an, donor, S2, rep) {
    var zip = an.zip, doc = an.doc, body = an.body;
    return Promise.all([donor.file("word/document.xml").async("string"), donor.file("word/_rels/document.xml.rels").async("string"), (zip.file("word/_rels/document.xml.rels") ? zip.file("word/_rels/document.xml.rels").async("string") : Promise.resolve('<Relationships xmlns="' + PREL + '"/>')), zip.file("[Content_Types].xml").async("string")]).then(function (x) {
      var ddoc = new DOMParser().parseFromString(x[0], "application/xml"), drels = parseRels(x[1]);
      var relsDoc = new DOMParser().parseFromString(x[2], "application/xml"), ctDoc = new DOMParser().parseFromString(x[3], "application/xml");
      var relsRoot = relsDoc.documentElement, ctRoot = ctDoc.documentElement, used = {};
      Array.prototype.forEach.call(relsRoot.getElementsByTagName("Relationship"), function (r) { used[r.getAttribute("Id")] = 1; });
      var n = 0; function newId() { var id; do { id = "rIdRmed" + (++n); } while (used[id]); used[id] = 1; return id; }
      function addRel(type, target) { var id = newId(), r = relsDoc.createElementNS(PREL, "Relationship"); r.setAttribute("Id", id); r.setAttribute("Type", type); r.setAttribute("Target", target); relsRoot.appendChild(r); return id; }
      function ensureDefault(ext, type) {
        var has = Array.prototype.some.call(ctRoot.getElementsByTagName("Default"), function (d) { return (d.getAttribute("Extension") || "").toLowerCase() === ext; });
        if (!has) { var d = ctDoc.createElementNS(CTNS, "Default"); d.setAttribute("Extension", ext); d.setAttribute("ContentType", type); ctRoot.insertBefore(d, ctRoot.firstChild); }
      }
      function addOverride(part, type) { Array.prototype.slice.call(ctRoot.getElementsByTagName("Override")).forEach(function (x) { if (x.getAttribute("PartName") === part) ctRoot.removeChild(x); }); var o = ctDoc.createElementNS(CTNS, "Override"); o.setAttribute("PartName", part); o.setAttribute("ContentType", type); ctRoot.appendChild(o); }
      ensureDefault("png", "image/png");
      if (!Object.keys(an.rels).some(function (k) { return /\/styles$/.test(an.rels[k].type); })) {
        addRel("http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles", "styles.xml");
        if (!Array.prototype.some.call(ctRoot.getElementsByTagName("Override"), function (o) { return o.getAttribute("PartName") === "/word/styles.xml"; })) addOverride("/word/styles.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml");
      }
      var jobs = [], mediaN = 0;
      function copyMedia(srcPath) { var ext = (srcPath.split(".").pop() || "png").toLowerCase(), dst = "media/rmed_" + (++mediaN) + "_" + Date.now().toString(36) + "." + ext; jobs.push(donor.file("word/" + srcPath.replace(/^\/?word\//, "")).async("uint8array").then(function (u) { zip.file("word/" + dst, u); })); return dst; }
      // الجسم المانح: كل الأقسام قبل قسم المتن (الغلاف + الفهرس)
      var dbody = ddoc.getElementsByTagNameNS(W, "body")[0], all = [], sects = [], front = [], back = [];
      for (var c = dbody.firstChild; c; c = c.nextSibling) if (isW(c) && !isW(c, "sectPr")) all.push(c);
      all.forEach(function (c2, i) { if (isW(c2, "p")) { var pp0 = kid(c2, "pPr"); if (pp0 && kid(pp0, "sectPr")) sects.push(i); } });
      // أقسام المانح بالترتيب: [غلاف] [فهرس] متن(فارغ) [غلاف خلفي]
      var nFront = (S2.cover ? 1 : 0) + (S2.toc ? 1 : 0), hasBack = !!S2.backCover && sects.length > nFront;
      if (nFront && sects.length >= nFront) front = all.slice(0, sects[nFront - 1] + 1);
      if (hasBack) back = all.slice(sects[nFront] + 1);
      var bodySp = hasBack ? kid(kid(all[sects[nFront]], "pPr"), "sectPr") : kid(dbody, "sectPr");
      // إعادة ربط صور الغلاف (الأمامي والخلفي)
      front.concat(back).forEach(function (node) {
        Array.prototype.forEach.call(node.getElementsByTagNameNS(ANS, "blip"), function (bl) {
          var rid = bl.getAttributeNS(RNS, "embed"), rel = drels[rid]; if (!rel) return;
          var dst = copyMedia(rel.target);
          bl.setAttributeNS(RNS, "r:embed", addRel(rel.type, dst));
        });
        // روابط خارجية (رابط المنصة)
        Array.prototype.forEach.call(node.getElementsByTagNameNS(W, "hyperlink"), function (hl) {
          var rid = hl.getAttributeNS(RNS, "id"), rel = rid && drels[rid]; if (!rel) return;
          var nid = addRel(rel.type, rel.target); if (rel.mode) relsRoot.lastChild.setAttribute("TargetMode", rel.mode);
          hl.setAttributeNS(RNS, "r:id", nid);
        });
      });
      // كل ترويسات/تذييلات المانح (غلاف بخلفيته، فهرس فارغ، متن بالهوية)
      var partN = 0, relMap = {};
      function copyPart(rel, kind) {
        var src = "word/" + rel.target.replace(/^\/?word\//, ""), name; do { name = "rmed" + kind + (++partN) + ".xml"; } while (zip.file("word/" + name));
        var relsSrc = src.replace(/word\//, "word/_rels/") + ".rels";
        jobs.push(donor.file(src).async("string").then(function (xml) {
          var rf = donor.file(relsSrc);
          var p = rf ? rf.async("string").then(function (rx) {
            var rd = new DOMParser().parseFromString(rx, "application/xml"), inner = [];
            Array.prototype.forEach.call(rd.getElementsByTagName("Relationship"), function (r) {
              if (/\/image$/.test(r.getAttribute("Type"))) { var before = jobs.length; r.setAttribute("Target", copyMedia(r.getAttribute("Target"))); inner = inner.concat(jobs.slice(before)); }
            });
            zip.file("word/_rels/" + name + ".rels", toXml(rd));
            return Promise.all(inner);
          }) : Promise.resolve();
          zip.file("word/" + name, xml);
          return p;
        }));
        addOverride("/word/" + name, "application/vnd.openxmlformats-officedocument.wordprocessingml." + (kind === "Header" ? "header" : "footer") + "+xml");
        return addRel(rel.type, name);
      }
      Object.keys(drels).forEach(function (id) {
        var rel = drels[id];
        if (/\/header$/.test(rel.type)) relMap[id] = copyPart(rel, "Header");
        else if (/\/footer$/.test(rel.type)) relMap[id] = copyPart(rel, "Footer");
      });
      var dsp = bodySp, hdrId = null, ftrId = null;
      kids(dsp, "headerReference").forEach(function (h) { if ((wa(h, "type") || "default") === "default") hdrId = relMap[h.getAttributeNS(RNS, "id")]; });
      kids(dsp, "footerReference").forEach(function (f) { if ((wa(f, "type") || "default") === "default") ftrId = relMap[f.getAttributeNS(RNS, "id")]; });
      // إدراج الغلاف والفهرس في بداية المستند مع إعادة ربط ترويساتهما
      var first = body.firstChild, imported = [];
      front.forEach(function (node) {
        var nn = doc.importNode(node, true);
        Array.prototype.forEach.call(nn.getElementsByTagNameNS(W, "headerReference"), function (r) { var m = relMap[r.getAttributeNS(RNS, "id")]; if (m) r.setAttributeNS(RNS, "r:id", m); });
        Array.prototype.forEach.call(nn.getElementsByTagNameNS(W, "footerReference"), function (r) { var m = relMap[r.getAttributeNS(RNS, "id")]; if (m) r.setAttributeNS(RNS, "r:id", m); });
        body.insertBefore(nn, first); imported.push(nn);
      });
      // ربط أقسام المستند الأصلية بترويسة/تذييل المتن
      Array.prototype.forEach.call(body.getElementsByTagNameNS(W, "sectPr"), function (sp) {
        for (var q = sp.parentNode; q && q !== body; q = q.parentNode) if (imported.indexOf(q) >= 0) return;
        removeKids(sp, ["headerReference", "footerReference", "titlePg"]);
        if (ftrId) { var f = mk(doc, "footerReference", { type: "default" }); f.setAttributeNS(RNS, "r:id", ftrId); sp.insertBefore(f, sp.firstChild); }
        if (hdrId) { var h = mk(doc, "headerReference", { type: "default" }); h.setAttributeNS(RNS, "r:id", hdrId); sp.insertBefore(h, sp.firstChild); }
        // إطار الصفحات (اختياري)
        removeKids(sp, ["pgBorders"]);
        if (S2.pageFrame) {
          var Tf = ENGINE.resolveTheme(S2), pb = mk(doc, "pgBorders", { offsetFrom: "page" });
          ["top", "left", "bottom", "right"].forEach(function (sd) { pb.appendChild(mk(doc, sd, { val: "double", sz: "6", space: "22", color: Tf.h2line })); });
          var after = kid(sp, "paperSrc") || kid(sp, "pgMar") || kid(sp, "pgSz") || kid(sp, "type");
          if (!after) { for (var cc = sp.firstChild; cc; cc = cc.nextSibling) if (isW(cc) && /^(headerReference|footerReference|footnotePr|endnotePr)$/.test(cc.localName)) after = cc; }
          sp.insertBefore(pb, after ? after.nextSibling : sp.firstChild);
        }
      });
      // لون خلفية الصفحات (لون صفحة Word — يتكيّف مع الوضع الداكن)
      var root = doc.documentElement, pbg = ENGINE.pageBgColor(S2);
      kids(root, "background").forEach(function (b) { root.removeChild(b); });
      if (pbg) root.insertBefore(mk(doc, "background", { color: pbg }), root.firstChild);
      // الغلاف الخلفي في نهاية المستند: فاصل قسم يحمل خصائص القسم الأصلي الأخير، ثم صفحة الغلاف الخلفي بقسمها
      if (back.length) {
        var remap = function (nn) {
          Array.prototype.forEach.call(nn.getElementsByTagNameNS(W, "headerReference"), function (r) { var m = relMap[r.getAttributeNS(RNS, "id")]; if (m) r.setAttributeNS(RNS, "r:id", m); });
          Array.prototype.forEach.call(nn.getElementsByTagNameNS(W, "footerReference"), function (r) { var m = relMap[r.getAttributeNS(RNS, "id")]; if (m) r.setAttributeNS(RNS, "r:id", m); });
          return nn;
        };
        var osp = kid(body, "sectPr");
        // إن كان آخر عنصر فقرة فارغة تحمل فاصل قسم (ملف سبق تنسيقه) نستخدمها بدل إضافة فاصل جديد يولّد صفحة فارغة
        var prev = osp ? osp.previousSibling : body.lastChild; while (prev && !isW(prev)) prev = prev.previousSibling;
        var prevSp = prev && isW(prev, "p") && kid(kid(prev, "pPr"), "sectPr");
        if (!(prevSp && !paraText(prev).trim() && !hasDrawing(prev))) {
          var brk = mk(doc, "p"), bpp = mk(doc, "pPr");
          var bs = mk(doc, "bookmarkStart", { id: "0", name: "RMEDGEN900" }), be = mk(doc, "bookmarkEnd", { id: "0" });
          bpp.appendChild(mk(doc, "spacing", { before: "0", after: "0", line: "20", lineRule: "exact" }));
          if (osp) bpp.appendChild(osp.cloneNode(true));
          brk.appendChild(bpp); brk.appendChild(bs); brk.appendChild(be);
          if (osp) body.insertBefore(brk, osp); else body.appendChild(brk);
        }
        back.forEach(function (node) { var nn = remap(doc.importNode(node, true)); if (osp) body.insertBefore(nn, osp); else body.appendChild(nn); });
        var nsp = remap(doc.importNode(kid(dbody, "sectPr"), true));
        if (osp) body.replaceChild(nsp, osp); else body.appendChild(nsp);
        rep.backCover = true;
      }
      zip.file("word/_rels/document.xml.rels", toXml(relsDoc));
      zip.file("[Content_Types].xml", toXml(ctDoc));
      // إلغاء ترويسات الصفحات الزوجية حتى تظهر ترويستنا في كل الصفحات
      var setF = zip.file("word/settings.xml");
      if (setF) jobs.push(setF.async("string").then(function (sx) {
        sx = sx.replace(/<w:evenAndOddHeaders[^>]*\/>/g, "");
        sx = sx.replace(/<w:displayBackgroundShape\b[^>]*\/>/g, "");
        if (pbg) { // ترتيب المخطط: بعد writeProtection/view/zoom/removePersonalInformation/removeDateAndTime/doNotDisplayPageBoundaries
          var lastPos = -1, m2, reP = /<w:(writeProtection|view|zoom|removePersonalInformation|removeDateAndTime|doNotDisplayPageBoundaries)\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:\1>)/g;
          while ((m2 = reP.exec(sx))) lastPos = reP.lastIndex;
          if (lastPos < 0) { var op = sx.match(/<w:settings\b[^>]*>/); lastPos = op ? op.index + op[0].length : -1; }
          if (lastPos >= 0) sx = sx.slice(0, lastPos) + "<w:displayBackgroundShape/>" + sx.slice(lastPos);
        }
        zip.file("word/settings.xml", sx);
      }));
      return Promise.all(jobs);
    });
  }

  /* ---------- إعادة البناء: تحويل المستند إلى نموذج المحرك ---------- */
  function rebuildModel(an) {
    var st = an.st, warn = { droppedImages: 0, math: an.stats.math, charts: an.stats.charts, footnotes: an.body.getElementsByTagNameNS(W, "footnoteReference").length + an.body.getElementsByTagNameNS(W, "endnoteReference").length }, imgJobs = [];
    var counters = {}, usedOv = {};
    function tagSplit(inl) {
      var out = [];
      inl.forEach(function (sg) {
        if (!sg.text || !ENGINE.CO_RE.test(sg.text)) { out.push(sg); return; }
        sg.text.split(ENGINE.CO_RE).forEach(function (part) { if (!part) return; var co = ENGINE.coByTag(part); if (co) out.push({ text: part, b: true, tag: co }); else out.push({ text: part, b: sg.b, i: sg.i, sup: sg.sup, sub: sg.sub }); });
      });
      return out;
    }
    function inlOf(p, pst, forceNoBold) { return tagSplit(inlOf0(p, pst, forceNoBold)); }
    function inlOf0(p, pst, forceNoBold) {
      var out = [];
      runsOf(p).forEach(function (r) {
        var t = runText(r); if (!t) return;
        var seg = { text: t }; if (!forceNoBold && runBold(r, st, pst)) seg.b = true; if (runItalic(r)) seg.i = true;
        var va = kid(kid(r, "rPr"), "vertAlign"), vv = va && wa(va, "val"); if (vv === "superscript") seg.sup = true; else if (vv === "subscript") seg.sub = true;
        var last = out[out.length - 1];
        if (last && !!last.b === !!seg.b && !!last.i === !!seg.i && !!last.sup === !!seg.sup && !!last.sub === !!seg.sub) last.text += t; else out.push(seg);
      });
      return out;
    }
    function imagesOf(node) {
      var imgs = [];
      Array.prototype.forEach.call(node.getElementsByTagNameNS(W, "drawing"), function (dr) {
        if (inside(dr, "txbxContent", node)) return;
        var bl = dr.getElementsByTagNameNS(ANS, "blip")[0], ext = dr.getElementsByTagNameNS(WPNS, "extent")[0];
        if (!bl) { if (!dr.getElementsByTagNameNS(W, "txbxContent").length) warn.droppedImages++; return; }
        var rel = an.rels[bl.getAttributeNS(RNS, "embed")]; if (!rel) { warn.droppedImages++; return; }
        var path = "word/" + rel.target.replace(/^\/?word\//, "").replace(/^\.\.\//, ""), e = (path.split(".").pop() || "").toLowerCase();
        var type = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", bmp: "bmp" }[e];
        if (!type || !an.zip.file(path)) { warn.droppedImages++; return; }
        var im = { type: type, w: ext ? Math.round(+ext.getAttribute("cx") / 9525) : 300, h: ext ? Math.round(+ext.getAttribute("cy") / 9525) : 200 };
        imgJobs.push(an.zip.file(path).async("uint8array").then(function (u) { im.data = u; }));
        imgs.push(im);
      });
      Array.prototype.forEach.call(node.getElementsByTagNameNS("urn:schemas-microsoft-com:vml", "imagedata"), function (v) { if (!inside(v, "Fallback", node) && !(function () { for (var q = v.parentNode; q && q !== node; q = q.parentNode) if (q.localName === "Fallback") return true; return false; })()) warn.droppedImages++; });
      return imgs;
    }
    function txbxParas(node) { var o = []; allW(node, "txbxContent").filter(function (tx) { for (var q = tx.parentNode; q && q !== node; q = q.parentNode) if (q.localName === "Fallback") return false; return true; }).forEach(function (tx) { kids(tx, "p").forEach(function (p) { var t = paraText(p); if (t.trim()) o.push({ t: "p", inl: inlOf(p, null), imp: ENGINE.calloutOf(t) }); }); }); return o; }
    function cellInl(tc) {
      var segs = [];
      kids(tc, "p").forEach(function (p, k) { var inl = inlOf(p, null); if (k > 0 && segs.length && inl.length) segs.push({ text: " " }); segs = segs.concat(inl); imagesOf(p).forEach(function (im) { segs.push({ img: im }); }); });
      kids(tc, "tbl").forEach(function (t) { segs.push({ text: " " + nodeText(t).replace(/\s+/g, " ") }); });
      return segs;
    }
    var lectures = [], cur = null, top = 99;
    an.items.forEach(function (it) { if (!(it.cover || it.toc || it.gen) && it.level && !it.twin) top = Math.min(top, it.level); });
    function ensureLec() { if (!cur) { cur = { title: null, titleInl: null, intro: null, outro: [], blocks: [] }; lectures.push(cur); } return cur; }
    var olOpen = null;
    var keepCover = an._keepCover;
    an.items.forEach(function (it) {
      if ((it.cover && !keepCover) || it.toc || it.gen) return;
      if (it.kind === "tbl") {
        olOpen = null;
        var dir = tableDirection(it.node), rows = kids(it.node, "tr").map(function (tr) { return kids(tr, "tc").map(function (tc) { var c = cellInl(tc), tp = kid(tc, "tcPr"), gs = tp && kid(tp, "gridSpan"); if (gs && +wa(gs, "val") > 1) c.span = +wa(gs, "val"); return c; }); });
        rows = rows.filter(function (r) { return r.length; });
        if (!rows.length) return;
        var fr = allW(kids(it.node, "tr")[0] || it.node, "r").filter(function (r) { return runText(r).trim(); });
        var head = rows.length >= 2 && fr.length > 0 && fr.every(function (r) { return runBold(r, st, null); });
        ensureLec().blocks.push({ t: "table", rows: rows, noHead: !head, ltrTable: !dir.rtl });
        return;
      }
      var p = it.node, t = it.text;
      if (it.level) {
        olOpen = null;
        var lv = Math.min(4, it.level - top + 1);
        if (it.twin && lv <= 1) lv = 2;
        if (lv <= 1) { cur = { title: t.trim(), titleInl: inlOf(p, it.style, true), intro: null, outro: [], blocks: [] }; lectures.push(cur); }
        else ensureLec().blocks.push({ t: "h", level: lv, inl: inlOf(p, it.style, true), twin: !!it.twin });
        imagesOf(p).forEach(function (im) { ensureLec().blocks.push({ t: "img", img: im }); });
        return;
      }
      var L = ensureLec(), inl = inlOf(p, it.style), imgs = imagesOf(p), imp = ENGINE.calloutOf(t);
      var styleList = !it.numPr && it.style && it.style.numPr && it.style.numId && it.style.numId !== "0";
      if ((it.numPr || styleList) && t.trim()) {
        var ilvl = it.numPr && kid(it.numPr, "ilvl"), nid = it.numPr && kid(it.numPr, "numId");
        var lvN = ilvl ? +wa(ilvl, "val") : (styleList ? +(it.style.ilvl || 0) : 0), numId = nid ? wa(nid, "val") : (styleList ? it.style.numId : "0");
        var def = an.num(numId, String(lvN)) || (it.style && it.style.numPr ? { fmt: /number/i.test(it.style.name) ? "decimal" : "bullet", text: "%1." } : null);
        if (def && def.fmt !== "bullet" && def.fmt !== "none" && numId !== "0") {
          var mt = an.num.meta ? an.num.meta(numId) : { abs: numId, ov: {} }, absId = mt.abs, key = absId + ":" + lvN;
          if (mt.ov[lvN] !== undefined && !usedOv[numId + ":" + lvN]) { usedOv[numId + ":" + lvN] = 1; counters[key] = mt.ov[lvN] - 1; }
          counters[key] = (counters[key] !== undefined ? counters[key] : (def.start || 1) - 1) + 1;
          Object.keys(counters).forEach(function (k) { var a = k.split(":"); if (a[0] === absId && +a[1] > lvN) delete counters[k]; });
          var label = (def.text || "%1.").replace(/%(\d)/g, function (_, d) { var c = counters[absId + ":" + (d - 1)] || 1, ld = an.num(numId, String(d - 1)) || def; return fmtNum(c, ld.fmt); });
          var item = { num: label, inl: inl, imp: imp, children: [], gen: true };
          if (olOpen && olOpen.numId === numId && olOpen.lvl === lvN && L.blocks[L.blocks.length - 1] === olOpen.block) olOpen.block.items.push(item);
          else { var blk = { t: "ol", items: [item], nested: lvN > 0, indentLevel: lvN }; L.blocks.push(blk); olOpen = { numId: numId, lvl: lvN, block: blk }; }
        } else { olOpen = null; L.blocks.push({ t: "li", level: Math.min(3, lvN), inl: inl, imp: imp }); }
      } else if (t.trim()) {
        olOpen = null;
        if (/^💡/.test(t.trim())) L.outro.push(inl); else L.blocks.push({ t: "p", inl: inl, imp: imp });
      }
      imgs.forEach(function (im) { L.blocks.push({ t: "img", img: im }); });
      txbxParas(p).forEach(function (b) { L.blocks.push(b); });
    });
    return Promise.all(imgJobs).then(function () { return { lectures: lectures, warn: warn }; });
  }
  function fmtNum(n, fmt) {
    if (fmt === "lowerLetter") return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    if (fmt === "upperLetter") return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    if (fmt === "lowerRoman" || fmt === "upperRoman") { var r = roman(n); return fmt === "lowerRoman" ? r.toLowerCase() : r; }
    if (fmt === "arabicAlpha" || fmt === "arabicAbjad") return "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ".charAt((n - 1) % 28);
    return String(n);
  }
  function roman(n) { var v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], s = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"], o = ""; for (var i = 0; i < v.length; i++) while (n >= v[i]) { o += s[i]; n -= v[i]; } return o; }

  function rebuild(an, S, brand) {
    an._keepCover = !S.cover;
    return rebuildModel(an).then(function (m) {
      var S2 = Object.assign({}, S, coverOpts(an, S), { brand: brand, tocLabels: { title: "فهرس المحتويات", c1: "القسم", c2: "العناوين الفرعية", count: "عدد الأقسام: " } });
      var lecs = m.lectures.length ? m.lectures : [{ title: null, titleInl: null, intro: null, outro: [], blocks: [] }];
      return docx.Packer.toBlob(ENGINE.build(lecs, S2)).then(function (b) { return ENGINE.finalize(b, "blob"); }).then(function (blob) {
        var rep = { coverImages: S.cover ? an.coverImages : 0, lectures: lecs.length, warn: m.warn, images: an.stats.images - m.warn.droppedImages, coverLines: an.coverLines.length, removedToc: an.items.filter(function (it) { return it.toc; }).length };
        return { blob: blob, report: rep, model: lecs };
      });
    });
  }

  /* ---------- دمج عدة ملفات في كتاب واحد (عبر نموذج إعادة البناء) ---------- */
  function merge(ans, S, brand) {
    var lecs = [], toks = [], rep = { coverImages: 0, lectures: 0, files: ans.length, warn: { droppedImages: 0, math: 0, charts: 0, footnotes: 0 }, images: 0, coverLines: 0, removedToc: 0 };
    var chain = Promise.resolve();
    ans.forEach(function (an) {
      chain = chain.then(function () {
        an._keepCover = false;
        return rebuildModel(an).then(function (m) {
          var L = m.lectures.slice(), cl = an.coverLines.slice();
          if (cl.length) { // سطور غلاف كل ملف لا تضيع: تصير أول فقرات قسمه
            if (!L.length) L.push({ title: null, titleInl: null, intro: null, outro: [], blocks: [] });
            L[0].blocks = cl.map(function (t) { return { t: "p", inl: [{ text: t, b: true }], imp: ENGINE.calloutOf(t) }; }).concat(L[0].blocks);
          }
          lecs = lecs.concat(L); toks = toks.concat(an.origTokens);
          Object.keys(rep.warn).forEach(function (k) { rep.warn[k] += m.warn[k] || 0; });
          rep.coverImages += S.cover ? an.coverImages : 0; rep.coverLines += cl.length; rep.images += an.stats.images - m.warn.droppedImages;
          rep.removedToc += an.items.filter(function (it) { return it.toc; }).length;
        });
      });
    });
    return chain.then(function () {
      if (!lecs.length) lecs = [{ title: null, titleInl: null, intro: null, outro: [], blocks: [] }];
      rep.lectures = lecs.length;
      var S2 = Object.assign({}, S, { coverLines: [], coverTitle: null, brand: brand, tocLabels: { title: "فهرس المحتويات", c1: "القسم", c2: "العناوين الفرعية", count: "عدد الأقسام: " } });
      return docx.Packer.toBlob(ENGINE.build(lecs, S2)).then(function (b) { return ENGINE.finalize(b, "blob"); }).then(function (blob) {
        return JSZip.loadAsync(blob).then(function (z) { return z.file("word/document.xml").async("string"); }).then(function (xml) {
          return { blob: blob, report: rep, model: lecs, check: ENGINE.compare(toks, ENGINE.xmlTokens(xml, { all: true })) };
        });
      });
    });
  }

  /* ---------- التحقق: قبل/بعد ---------- */
  function check(an, blob) {
    return JSZip.loadAsync(blob).then(function (z) { return z.file("word/document.xml").async("string"); }).then(function (xml) {
      return ENGINE.compare(an.origTokens, ENGINE.xmlTokens(xml, { all: true }));
    });
  }

  /* نموذج للمعاينة (يُستخدم لكلا الطريقتين) */
  function previewModel(an) { return rebuildModel(an).then(function (m) { return m.lectures; }); }

  return { merge: merge, analyze: analyze, reskin: reskin, rebuild: rebuild, check: check, previewModel: previewModel, headerTextOf: headerTextOf };
})();
