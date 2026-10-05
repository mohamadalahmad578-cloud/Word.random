/* Random.MEd — قراءة عروض PowerPoint (.pptx) وتحويلها إلى نموذج المحرك (محاضرة: عناوين الشرائح، نقاط، جداول، صور، ملاحظات) */
var RMED_PPTX = (function () {
  "use strict";
  var NA = "http://schemas.openxmlformats.org/drawingml/2006/main", NP = "http://schemas.openxmlformats.org/presentationml/2006/main",
    NR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", NPR = "http://schemas.openxmlformats.org/package/2006/relationships";
  var AR = /[؀-ۿ]/;
  function parse(x) { var d = new DOMParser().parseFromString(x, "application/xml"); if (d.getElementsByTagName("parsererror").length) throw new Error("xml"); return d; }
  function kids(el, ns, name) { var o = []; if (!el) return o; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.namespaceURI === ns && (!name || c.localName === name)) o.push(c); return o; }
  function kid(el, ns, name) { return kids(el, ns, name)[0] || null; }
  function all(el, ns, name) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS(ns, name)) : []; }
  function dir(p) { return p.replace(/[^/]+$/, ""); }
  function resolve(base, t) { if (/^\//.test(t)) return t.slice(1); var parts = (base + t).split("/"), out = []; parts.forEach(function (s) { if (s === "..") out.pop(); else if (s !== ".") out.push(s); }); return out.join("/"); }
  function rels(zip, part) {
    var rp = dir(part) + "_rels/" + part.split("/").pop() + ".rels", f = zip.file(rp);
    if (!f) return Promise.resolve({});
    return f.async("string").then(function (x) {
      var m = {}; Array.prototype.forEach.call(parse(x).getElementsByTagNameNS(NPR, "Relationship"), function (r) {
        m[r.getAttribute("Id")] = { type: r.getAttribute("Type") || "", target: r.getAttribute("TargetMode") === "External" ? r.getAttribute("Target") : resolve(dir(part), r.getAttribute("Target")), ext: r.getAttribute("TargetMode") === "External" };
      }); return m;
    });
  }
  // نص فقرة a:p → مقاطع بأنماط
  function paraInl(p) {
    var segs = [];
    for (var c = p.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1 || c.namespaceURI !== NA) continue;
      if (c.localName === "r" || c.localName === "fld") {
        var t = kid(c, NA, "t"); if (!t) continue; var txt = t.textContent; if (!txt) continue;
        var rp = kid(c, NA, "rPr"), b = rp && /^(1|true)$/.test(rp.getAttribute("b") || ""), i = rp && /^(1|true)$/.test(rp.getAttribute("i") || ""), bl = rp ? +(rp.getAttribute("baseline") || 0) : 0;
        var sg = { text: txt }; if (b) sg.b = true; if (i) sg.i = true; if (bl > 0) sg.sup = true; else if (bl < 0) sg.sub = true;
        var last = segs[segs.length - 1];
        if (last && !!last.b === !!sg.b && !!last.i === !!sg.i && !!last.sup === !!sg.sup && !!last.sub === !!sg.sub) last.text += txt; else segs.push(sg);
      } else if (c.localName === "br") { if (segs.length) segs[segs.length - 1].text += " "; }
    }
    return tagSplit(segs);
  }
  function tagSplit(inl) { // [هام جداً] وأخواتها كوسوم ملوّنة كما في بقية الموقع
    var out = [];
    inl.forEach(function (sg) {
      if (!ENGINE.CO_RE.test(sg.text)) { out.push(sg); return; }
      sg.text.split(ENGINE.CO_RE).forEach(function (part) { if (!part) return; var co = ENGINE.coByTag(part); if (co) out.push({ text: part, b: true, tag: co }); else out.push({ text: part, b: sg.b, i: sg.i, sup: sg.sup, sub: sg.sub }); });
    });
    return out;
  }
  function plainOf(inl) { return inl.map(function (s) { return s.text || ""; }).join(""); }
  function fmtNum(n, type) {
    var roman = function (k) { var v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], s = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"], o = ""; for (var i = 0; i < v.length; i++) while (k >= v[i]) { o += s[i]; k -= v[i]; } return o; };
    var core = /alphaLc/.test(type) ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : /alphaUc/.test(type) ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : /romanLc/.test(type) ? roman(n).toLowerCase() : /romanUc/.test(type) ? roman(n) : /arabicAbjad|arabicAlpha|hebrew/.test(type) ? "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ".charAt((n - 1) % 28) : String(n);
    return /ParenBoth/.test(type) ? "(" + core + ")" : /ParenR/.test(type) ? core + ")" : /Plain/.test(type) ? core : core + ".";
  }
  function xfrmOf(el) { // موقع العنصر (EMU) لترتيب القراءة
    var sp = kid(el, NP, "spPr") || kid(el, NP, "grpSpPr"), xf = sp && kid(sp, NA, "xfrm");
    if (!xf) { var gx = kid(el, NP, "xfrm"); xf = gx; }
    var off = xf && kid(xf, NA, "off"), ext = xf && kid(xf, NA, "ext");
    return off ? { x: +off.getAttribute("x"), y: +off.getAttribute("y"), w: ext ? +ext.getAttribute("cx") : 0, h: ext ? +ext.getAttribute("cy") : 0 } : null;
  }
  function phOf(sp) { var nv = kid(sp, NP, "nvSpPr") || kid(sp, NP, "nvPicPr") || kid(sp, NP, "nvGraphicFramePr"), nvPr = nv && kid(nv, NP, "nvPr"), ph = nvPr && kid(nvPr, NP, "ph"); return ph ? { type: ph.getAttribute("type") || "body", idx: ph.getAttribute("idx") } : null; }

  function parseDeck(buf, opt) {
    opt = opt || {};
    return JSZip.loadAsync(buf).then(function (zip) {
      var pf = zip.file("ppt/presentation.xml");
      if (!pf) throw new Error("هذا ليس عرض PowerPoint ‎.pptx صالحاً (لا يحوي ppt/presentation.xml). ملفات ‎.ppt القديمة غير مدعومة — احفظها بصيغة ‎.pptx أولاً.");
      return Promise.all([pf.async("string"), rels(zip, "ppt/presentation.xml")]).then(function (x) {
        var pres = parse(x[0]), prels = x[1];
        var ids = all(pres, NP, "sldId").map(function (s) { return s.getAttributeNS(NR, "id"); });
        var slidePaths = ids.map(function (id) { return prels[id] && prels[id].target; }).filter(Boolean);
        var stats = { slides: 0, hidden: 0, words: 0, images: 0, tables: 0, notes: 0, smartart: 0, charts: 0, droppedImages: 0 };
        var texts = [], imgJobs = [], lecture = { title: null, titleInl: null, intro: null, outro: [], blocks: [] }, slides = [];
        function rec(inl) { texts.push(plainOf(inl)); }
        var chain = Promise.resolve();
        slidePaths.forEach(function (path, si) {
          chain = chain.then(function () {
            var f = zip.file(path); if (!f) return;
            return Promise.all([f.async("string"), rels(zip, path)]).then(function (y) {
              var sd = parse(y[0]), srels = y[1], root = sd.documentElement;
              if (root.getAttribute("show") === "0" && !opt.hidden) { stats.hidden++; return; }
              stats.slides++;
              var spTree = all(sd, NP, "spTree")[0]; if (!spTree) return;
              var slideAr = AR.test(Array.prototype.map.call(sd.getElementsByTagNameNS(NA, "t"), function (t) { return t.textContent; }).join(" "));
              // جمع العناصر مع مواقعها
              function collect(tree) {
                var items = [];
                for (var c = tree.firstChild; c; c = c.nextSibling) {
                  if (c.nodeType !== 1 || c.namespaceURI !== NP) continue;
                  var pos = xfrmOf(c), ph = phOf(c);
                  if (c.localName === "grpSp") { var sub = collect(c); if (sub.length) items.push({ kind: "group", pos: pos, items: sub }); continue; }
                  if (c.localName === "sp" || c.localName === "pic" || c.localName === "graphicFrame") items.push({ kind: c.localName, el: c, pos: pos, ph: ph });
                }
                // العنوان أولاً، ثم من الأعلى للأسفل، وفي نفس الصف حسب اتجاه الشريحة
                var rank = function (it) { return it.ph && /title/i.test(it.ph.type) && !/sub/i.test(it.ph.type) ? 0 : 1; };
                items.sort(function (a, b) {
                  var ra = rank(a), rb = rank(b); if (ra !== rb) return ra - rb;
                  var pa = a.pos || { x: 0, y: a.ph ? 1e5 : 1e9 }, pb = b.pos || { x: 0, y: b.ph ? 1e5 : 1e9 };
                  if (Math.abs(pa.y - pb.y) > 274320) return pa.y - pb.y;
                  return slideAr ? pb.x - pa.x : pa.x - pb.x;
                });
                return items;
              }
              var items = collect(spTree), blocks = [], title = null, olOpen = null, counters = {};
              function flat(list, out) { list.forEach(function (it) { if (it.kind === "group") flat(it.items, out); else out.push(it); }); return out; }
              flat(items, []).forEach(function (it) {
                var ph = it.ph, type = ph ? ph.type : null;
                if (type && /^(dt|ftr|sldNum|hdr)$/.test(type)) return; // ترويسات الشريحة الآلية
                if (it.kind === "sp") {
                  var tx = kid(it.el, NP, "txBody"); if (!tx) return;
                  var isTitle = type && /title/i.test(type) && !/sub/i.test(type), isBody = !!ph && !isTitle && !/subTitle/i.test(type);
                  kids(tx, NA, "p").forEach(function (p) {
                    var inl = paraInl(p), t = plainOf(inl); if (!t.trim()) return;
                    rec(inl);
                    if (isTitle && title === null) { title = inl; return; }
                    if (isTitle) { blocks.push({ t: "h", level: 3, inl: inl }); olOpen = null; return; }
                    var pPr = kid(p, NA, "pPr"), lvl = pPr ? Math.min(3, +(pPr.getAttribute("lvl") || 0)) : 0;
                    var buNone = pPr && kid(pPr, NA, "buNone"), buAuto = pPr && kid(pPr, NA, "buAutoNum"), buChar = pPr && kid(pPr, NA, "buChar");
                    var imp = ENGINE.calloutOf(t);
                    if (buAuto && !buNone) {
                      var ty = buAuto.getAttribute("type") || "arabicPeriod", key = lvl;
                      Object.keys(counters).forEach(function (k) { if (+k > lvl) delete counters[k]; });
                      counters[key] = (counters[key] || (+(buAuto.getAttribute("startAt") || 1)) - 1) + 1;
                      var item = { num: fmtNum(counters[key], ty), inl: inl, imp: imp, children: [], gen: true };
                      if (olOpen && olOpen.lvl === lvl && blocks[blocks.length - 1] === olOpen.block) olOpen.block.items.push(item);
                      else { var blk = { t: "ol", items: [item], nested: lvl > 0, indentLevel: lvl }; blocks.push(blk); olOpen = { lvl: lvl, block: blk }; }
                      return;
                    }
                    olOpen = null; counters = {};
                    if (!buNone && (buChar || (isBody && (lvl > 0 || kids(tx, NA, "p").filter(function (q) { return plainOf(paraInl(q)).trim(); }).length > 1)))) blocks.push({ t: "li", level: lvl, inl: inl, imp: imp, src: ph ? "body" : "box" });
                    else blocks.push({ t: "p", inl: inl, imp: imp, level: 0, src: ph ? "body" : "box" });
                  });
                } else if (it.kind === "pic") {
                  olOpen = null;
                  var bl = all(it.el, NA, "blip")[0], rid = bl && bl.getAttributeNS(NR, "embed"), r = rid && srels[rid];
                  if (!r || r.ext) { stats.droppedImages++; return; }
                  var ext = (r.target.split(".").pop() || "").toLowerCase(), ty2 = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", bmp: "bmp" }[ext], mf = zip.file(r.target);
                  if (!ty2 || !mf) { stats.droppedImages++; return; }
                  var im = { type: ty2, w: it.pos && it.pos.w ? Math.round(it.pos.w / 9525) : 400, h: it.pos && it.pos.h ? Math.round(it.pos.h / 9525) : 300 };
                  imgJobs.push(mf.async("uint8array").then(function (u) { im.data = u; }));
                  blocks.push({ t: "img", img: im }); stats.images++;
                } else if (it.kind === "graphicFrame") {
                  olOpen = null;
                  var tbl = all(it.el, NA, "tbl")[0];
                  if (tbl) {
                    var rows = all(tbl, NA, "tr").map(function (tr) {
                      var row = [];
                      kids(tr, NA, "tc").forEach(function (tc) {
                        if (/^(1|true)$/.test(tc.getAttribute("hMerge") || "")) return;
                        var segs = [];
                        all(tc, NA, "p").forEach(function (p) { var inl = paraInl(p); if (!plainOf(inl).trim()) return; if (segs.length) segs.push({ text: " " }); segs = segs.concat(inl); });
                        if (segs.length) rec(segs);
                        var gs = +(tc.getAttribute("gridSpan") || 1); if (gs > 1) segs.span = gs;
                        row.push(segs);
                      });
                      return row;
                    }).filter(function (r2) { return r2.length; });
                    if (rows.length) { var hdr = rows.length > 1 && rows[0].every(function (c) { return !c.length || c.every(function (s) { return s.b || !s.text.trim(); }); }); blocks.push({ t: "table", rows: rows, noHead: false, ltrTable: !AR.test(rows.map(function (r3) { return r3.map(plainOf).join(" "); }).join(" ")) }); stats.tables++; }
                    return;
                  }
                  var gd = all(it.el, NA, "graphicData")[0], uri = gd ? gd.getAttribute("uri") || "" : "";
                  if (/diagram/.test(uri)) {
                    stats.smartart++;
                    var relIds = gd.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/diagram", "relIds")[0], dm = relIds && relIds.getAttributeNS(NR, "dm"), dr = dm && srels[dm];
                    if (dr && zip.file(dr.target)) blocks.push({ t: "_smart", path: dr.target });
                  } else if (/chart/.test(uri)) stats.charts++;
                }
              });
              // ملاحظات المتحدث
              var notesRel = Object.keys(srels).map(function (k) { return srels[k]; }).filter(function (r) { return /notesSlide$/.test(r.type); })[0];
              var notesP = opt.notes && notesRel && zip.file(notesRel.target) ? zip.file(notesRel.target).async("string").then(function (nx) {
                var nd = parse(nx), nts = [];
                all(nd, NP, "sp").forEach(function (sp) { var ph = phOf(sp); if (!ph || ph.type !== "body") return; var tx = kid(sp, NP, "txBody"); kids(tx, NA, "p").forEach(function (p) { var inl = paraInl(p); if (plainOf(inl).trim()) nts.push(inl); }); });
                return nts;
              }) : Promise.resolve([]);
              // SmartArt: نصوص البيانات كنقاط
              var smartJobs = blocks.filter(function (b) { return b.t === "_smart"; }).map(function (b) {
                return zip.file(b.path).async("string").then(function (dx) {
                  var dd = parse(dx); b.t = "smart"; b.items = [];
                  all(dd, "http://schemas.openxmlformats.org/drawingml/2006/diagram", "pt").forEach(function (pt) { var tb = all(pt, "http://schemas.openxmlformats.org/drawingml/2006/diagram", "t")[0]; if (!tb) return; kids(tb, NA, "p").forEach(function (p) { var inl = paraInl(p); if (plainOf(inl).trim()) { rec(inl); b.items.push(inl); } }); });
                });
              });
              return Promise.all([notesP].concat(smartJobs)).then(function (z) {
                var nts = z[0] || [];
                var out = [];
                blocks.forEach(function (b) { if (b.t === "smart") b.items.forEach(function (inl) { out.push({ t: "li", level: 0, inl: inl, imp: ENGINE.calloutOf(plainOf(inl)) }); }); else if (b.t !== "_smart") out.push(b); });
                if (nts.length) { stats.notes++; var co = ENGINE.coByTag("[ملاحظة]"); nts.forEach(function (inl) { rec(inl); out.push({ t: "p", inl: inl, imp: co, level: 0 }); }); }
                slides.push({ n: si + 1, title: title, blocks: out });
              });
            });
          });
        });
        var themeP = themeColors(zip);
        return chain.then(function () { return Promise.all(imgJobs); }).then(function () { return themeP; }).then(function (theme) {
          var allToks = ENGINE.tokens(texts.join("\n"));
          var clean = cleanup(slides, opt, stats);
          assemble(clean, lecture, opt);
          var toks = modelTokens(lecture);
          stats.words = toks.length;
          // ما حُذف عمداً بخيارات التنظيف (للتقرير)
          var c = {}, removed = [];
          allToks.forEach(function (w) { c[w] = (c[w] || 0) + 1; }); toks.forEach(function (w) { c[w] = (c[w] || 0) - 1; });
          Object.keys(c).forEach(function (w) { if (c[w] > 0) removed.push([w, c[w]]); });
          stats.removedWords = removed.reduce(function (n, x) { return n + x[1]; }, 0); stats.removedSample = removed.slice(0, 12);
          return { lecture: lecture, tokens: toks, stats: stats, title: lecture.title || "", theme: theme };
        });
      });
    });
  }
  /* ---------- ألوان قالب العرض ---------- */
  function themeColors(zip) {
    var tf = Object.keys(zip.files).filter(function (n) { return /^ppt\/theme\/theme\d+\.xml$/.test(n); }).sort()[0];
    if (!tf) return Promise.resolve(null);
    return zip.file(tf).async("string").then(function (x) {
      var d = parse(x), sch = all(d, NA, "clrScheme")[0]; if (!sch) return null;
      var o = {};
      ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].forEach(function (k) {
        var el = kid(sch, NA, k); if (!el) return; var c = kid(el, NA, "srgbClr"), sc = kid(el, NA, "sysClr");
        o[k] = c ? c.getAttribute("val") : sc ? (sc.getAttribute("lastClr") || null) : null;
      });
      return o;
    }).catch(function () { return null; });
  }
  function lum(h) { h = String(h || "").replace("#", ""); if (h.length !== 6) return 1; var r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255, b = parseInt(h.substr(4, 2), 16) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function sat(h) { h = String(h || "").replace("#", ""); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; }
  function darken(h, t) { h = String(h).replace("#", ""); var o = ""; for (var i = 0; i < 3; i++) { var v = Math.round(parseInt(h.substr(i * 2, 2), 16) * (1 - t)); o += ("0" + v.toString(16)).slice(-2); } return o.toUpperCase(); }
  // لون أساسي غامق (لخلفيات العناوين البيضاء النص) + لون تمييز من ألوان القالب
  function pickColors(th) {
    if (!th) return null;
    var cands = ["accent1", "dk2", "accent2", "accent5", "accent6", "accent3", "accent4"].map(function (k) { return th[k]; }).filter(function (c) { return c && /^[0-9A-Fa-f]{6}$/.test(c); });
    if (!cands.length) return null;
    var main = cands.filter(function (c) { return sat(c) > 0.2; })[0] || cands[0];
    var guard = 0; while (lum(main) > 0.32 && guard++ < 10) main = darken(main, 0.15);
    var acc = cands.filter(function (c) { return c.toUpperCase() !== main.toUpperCase() && sat(c) > 0.25 && lum(c) > 0.18 && lum(c) < 0.75; })[0] || "A9761E";
    var g2 = 0; while (lum(acc) > 0.55 && g2++ < 10) acc = darken(acc, 0.12);
    return { main: "#" + main.toUpperCase(), acc: "#" + String(acc).toUpperCase() };
  }

  /* ---------- تنظيف طبيعة الشرائح (كل خيار مستقل) ---------- */
  var END_RE = /^\s*(شكر|شكرا|شكراً|thank|thanks|any\s*questions?|questions?\b|أسئلة|اسئلة|الأسئلة|هل من أسئلة|نهاية|انتهت|the\s*end\b|end\b)/i;
  function normTitle(t) { return String(t || "").replace(/[\(\[]?\s*(تابع|يتبع|تكملة|تتمة|continued|cont\.?|con't)\s*[\)\]]?/gi, "").replace(/[\(\[]?\s*\d+\s*[\)\]]?\s*$/, "").replace(/[\s\-–—:.…،,]+/g, " ").trim().toLowerCase(); }
  function cleanup(slides, opt, stats) {
    stats.dropped = 0; stats.repeatRemoved = 0; stats.merged = 0; stats.joined = 0;
    var out = slides.slice();
    if (opt.dropEmpty) out = out.filter(function (sl, i) {
      var t = sl.title ? plainOf(sl.title).trim() : "";
      var drop = i > 0 && !sl.blocks.filter(function (b) { return b.t !== "gen"; }).length && (!t || (END_RE.test(t) && t.length <= 45));
      if (drop) stats.dropped++; return !drop;
    });
    if (opt.stripRepeat && out.length >= 4) {
      var cnt = {};
      out.forEach(function (sl) { var seen = {}; sl.blocks.forEach(function (b) { if ((b.t === "p" || b.t === "li") && b.src === "box") { var k = plainOf(b.inl).replace(/\s+/g, " ").trim(); if (k && k.length < 140 && !seen[k]) { seen[k] = 1; cnt[k] = (cnt[k] || 0) + 1; } } }); });
      var rep = {}; Object.keys(cnt).forEach(function (k) { if (cnt[k] >= 3 && cnt[k] >= out.length * 0.4) rep[k] = 1; });
      out.forEach(function (sl, i) { if (i === 0) return; sl.blocks = sl.blocks.filter(function (b) { var k = (b.t === "p" || b.t === "li") && b.src === "box" ? plainOf(b.inl).replace(/\s+/g, " ").trim() : null; if (k && rep[k]) { stats.repeatRemoved++; return false; } return true; }); });
    }
    if (opt.mergeCont) {
      var prev = null;
      out.forEach(function (sl, i) {
        var nt = sl.title ? normTitle(plainOf(sl.title)) : "";
        if (i > 0 && nt && prev && nt === prev) { sl.title = null; sl.cont = true; stats.merged++; }
        if (nt) prev = nt;
      });
    }
    if (opt.joinFrag) out.forEach(function (sl) {
      var res = [];
      sl.blocks.forEach(function (b) {
        var pr = res[res.length - 1];
        if (pr && b.t === "li" && pr.t === "li" && pr.level === b.level && !pr.imp && !b.imp) {
          var a = plainOf(pr.inl).trim(), n = plainOf(b.inl).trim();
          if (a && !/[.!?؟:؛،;)\]»]$/.test(a) && (/^[a-z]/.test(n) || /^(و|أو|او|ثم|التي|الذي|الذين|اللذان|حيث|لكن|بسبب|مما|كما|إلى|الى|في|من|على|عن|مع|عند|بينما|بعد|قبل)\s/.test(n))) {
            pr.inl = pr.inl.concat([{ text: " " }], b.inl); stats.joined++; return;
          }
        }
        res.push(b);
      });
      sl.blocks = res;
    });
    return out;
  }
  function assemble(slides, lecture, opt) {
    slides.forEach(function (sl, i) {
      var head = [];
      if (i === 0 && sl.title && lecture.title === null) { lecture.title = plainOf(sl.title).trim(); lecture.titleInl = sl.title; }
      else if (sl.title) head.push({ t: "h", level: 2, inl: sl.title });
      if (opt.slideNums) head.push({ t: "gen", kind: "note", text: (sl.cont ? "تابع — " : "") + "شريحة " + sl.n });
      lecture.blocks = lecture.blocks.concat(head, sl.blocks);
    });
    if (opt.glossary) {
      var seen = {}, rows = [["المصطلح", "Term"]], RE = /((?:[\u0600-\u06FF]+\s+){0,2}[\u0600-\u06FF]+)\s*\(\s*([A-Za-z][A-Za-z0-9\s\-\/,'+.]{1,60}?)\s*\)/g;
      var texts = [];
      (function walk(bl) { bl.forEach(function (b) { if (b.inl) texts.push(plainOf(b.inl)); if (b.t === "ol") b.items.forEach(function (it) { texts.push(plainOf(it.inl)); walk(it.children || []); }); if (b.t === "table") b.rows.forEach(function (r) { r.forEach(function (c) { texts.push(plainOf(c)); }); }); }); })(lecture.blocks);
      if (lecture.title) texts.unshift(lecture.title);
      texts.forEach(function (t) { var m; RE.lastIndex = 0; while ((m = RE.exec(t))) { var en = m[2].replace(/\s+/g, " ").trim(), k = en.toLowerCase(); if (!seen[k] && /[A-Za-z]{3}/.test(en)) { seen[k] = 1; rows.push([m[1].trim(), en]); } } });
      if (rows.length > 2) lecture.blocks.push({ t: "gen", kind: "glossary", title: "مسرد المصطلحات", rows: rows });
    }
    if (opt.notesPage) lecture.blocks.push({ t: "gen", kind: "notes", title: "ملاحظات", lines: 22 });
  }
  // كلمات النموذج النهائي (ما سيظهر فعلاً) — للتحقق
  function modelTokens(L) {
    var parts = [];
    if (L.title) parts.push(plainOf(L.titleInl || [{ text: L.title }]));
    (function walk(bl) {
      bl.forEach(function (b) {
        if (b.t === "gen") return;
        if (b.t === "h" || b.t === "p" || b.t === "li") parts.push(plainOf(b.inl));
        else if (b.t === "ol") b.items.forEach(function (it) { parts.push(plainOf(it.inl)); walk(it.children || []); });
        else if (b.t === "table") b.rows.forEach(function (r) { r.forEach(function (c) { parts.push(plainOf(c.filter ? c.filter(function (sg) { return sg.text !== undefined; }) : c)); }); });
      });
    })(L.blocks);
    return ENGINE.tokens(parts.join("\n"));
  }
  return { parse: parseDeck, pickColors: pickColors };
})();
