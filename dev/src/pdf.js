/* Random.MEd — محرك PDF: تخطيط صفحات A4 حقيقي على Canvas (تشكيل العربي من المتصفح نفسه) + كاتب PDF صغير بدون مكتبات */
var RMED_PDF = (function () {
  "use strict";
  var PW = 595.28, PH = 841.89; // نقاط A4
  var AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/, LA = /[A-Za-z0-9À-ɏ٠-٩]/;
  var INVIS = /[\u200E\u200F\u2060\u2066-\u2069\u202A-\u202E\uFEFF]/g; // نفس ENGINE.tokens (نُبقي ZWNJ/ZWJ لتشكيل الكلمة)
  var FA = '"Simplified Arabic","Geeza Pro","Noto Naskh Arabic","Traditional Arabic","Arial",sans-serif';
  var FL = '"Times New Roman","Liberation Serif","Times",serif';
  function hx(c) { return "#" + String(c || "000000").replace("#", ""); }

  /* ---------- كاتب PDF: كل صفحة صورة JPEG + روابط ---------- */
  function pdfStr(s) {
    s = String(s || "");
    if (/^[\x20-\x7E]*$/.test(s)) return "(" + s.replace(/[\\()]/g, "\\$&") + ")";
    var h = "FEFF"; for (var i = 0; i < s.length; i++) h += ("000" + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    return "<" + h + ">";
  }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }
  function strBytes(s) { // بايتات النص كما يكتبه pdfStr (ASCII أو UTF-16BE مع BOM)
    s = String(s || ""); var o, i;
    if (/^[\x20-\x7E]*$/.test(s)) { o = new Uint8Array(s.length); for (i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
    o = new Uint8Array(2 + s.length * 2); o[0] = 0xFE; o[1] = 0xFF; for (i = 0; i < s.length; i++) { o[2 + i * 2] = s.charCodeAt(i) >> 8; o[3 + i * 2] = s.charCodeAt(i) & 255; } return o;
  }
  // sec (اختياري): حماية AES-256 من RMED_PROTECT.pdfSecurity — تُشفَّر كل المجاري والنصوص
  function writePdf(pages, title, sec) {
    var enc = new TextEncoder();
    var csText = "q " + PW + " 0 0 " + PH + " 0 0 cm /Im0 Do Q", csBytes = enc.encode(csText);
    if (!sec) return Promise.resolve(emit(null));
    var jobs = [sec.enc(strBytes(title)).then(function (b) { title = b; })];
    pages.forEach(function (p) {
      jobs.push(sec.enc(csBytes).then(function (b) { p.encCs = b; }), sec.enc(p.jpeg).then(function (b) { p.encJpeg = b; }));
      p.encUrl = []; p.links.forEach(function (l, k) { jobs.push(sec.enc(strBytes(l.url)).then(function (b) { p.encUrl[k] = b; })); });
    });
    return Promise.all(jobs).then(function () { return emit(sec); });
    function emit(sec) {
      var chunks = [], off = 0, xref = [];
      function push(x) { if (typeof x === "string") x = enc.encode(x); chunks.push(x); off += x.length; }
      function hexs(b) { return "<" + sec.hex(b) + ">"; }
      var next = 4, kids = [];
      pages.forEach(function (p) { p.o = next; p.c = next + 1; p.im = next + 2; next += 3; p.an = p.links.map(function () { return next++; }); kids.push(p.o + " 0 R"); });
      var encObj = sec ? next++ : 0;
      push(sec ? "%PDF-1.7\n" : "%PDF-1.4\n"); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
      function obj(n, parts) { xref[n] = off; push(n + " 0 obj\n"); parts.forEach(push); push("\nendobj\n"); }
      obj(1, ["<< /Type /Catalog /Pages 2 0 R" + (sec ? " /Extensions << /ADBE << /BaseVersion /1.7 /ExtensionLevel 8 >> >>" : "") + " >>"]);
      obj(2, ["<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pages.length + " >>"]);
      obj(3, ["<< /Title " + (sec ? hexs(title) : pdfStr(title) + " /Creator (Random.MEd) /Producer (Random.MEd)") + " >>"]);
      pages.forEach(function (p) {
        obj(p.o, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /XObject << /Im0 " + p.im + " 0 R >> >> /Contents " + p.c + " 0 R" +
          (p.an.length ? " /Annots [" + p.an.map(function (n) { return n + " 0 R"; }).join(" ") + "]" : "") + " >>"]);
        var cs = sec ? p.encCs : csBytes, jp = sec ? p.encJpeg : p.jpeg;
        obj(p.c, ["<< /Length " + cs.length + " >>\nstream\n", cs, "\nendstream"]);
        obj(p.im, ["<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jp.length + " >>\nstream\n", jp, "\nendstream"]);
        p.links.forEach(function (l, k) {
          obj(p.an[k], ["<< /Type /Annot /Subtype /Link /Rect [" + [l.x, PH - l.y - l.h, l.x + l.w, PH - l.y].map(f2).join(" ") + "] /Border [0 0 0] /A << /S /URI /URI " + (sec ? hexs(p.encUrl[k]) : pdfStr(l.url)) + " >> >>"]);
        });
      });
      if (sec) obj(encObj, [sec.dict]);
      var xo = off;
      push("xref\n0 " + next + "\n0000000000 65535 f \n");
      for (var i = 1; i < next; i++) push(("0000000000" + xref[i]).slice(-10) + " 00000 n \n");
      var id = sec ? sec.hex(window.crypto.getRandomValues(new Uint8Array(16))) : "";
      push("trailer\n<< /Size " + next + " /Root 1 0 R /Info 3 0 R" + (sec ? " /Encrypt " + encObj + " 0 R /ID [<" + id + "><" + id + ">]" : "") + " >>\nstartxref\n" + xo + "\n%%EOF\n");
      return new Blob(chunks, { type: "application/pdf" });
    }
  }
  function canvasJpeg(c, q) { return new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(function (ab) { res(new Uint8Array(ab)); }); }, "image/jpeg", q); }); }

  /* ---------- البناء ---------- */
  function build(m, A, opt) {
    opt = opt || {};
    var S = m.s, T = ENGINE.resolveTheme(S), Z = Object.assign({}, ENGINE.SIZE_DEFAULTS, S.sizes || {});
    var K = opt.scale || 2, LS = S.lineSpacing || 1.5;
    var MX = 70.87, MT = 70.87, MB = 70.87, CW = PW - 2 * MX, TOP = MT, BOT = PH - MB;
    var PF = Object.assign({ name: "Random.MEd", url: "" }, S.platform || {}), pfName = String(PF.name || "Random.MEd").trim() || "Random.MEd";
    var URL = String(PF.url || "").trim(), HREF = URL ? (/^https?:\/\//i.test(URL) ? URL : "https://" + URL) : "", URLTXT = URL.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    var YEAR = String(new Date().getFullYear()), rightsOn = S.rights !== false, PBG = ENGINE.pageBgColor ? ENGINE.pageBgColor(S) : null, GOLD = "A9761E";
    var meas = document.createElement("canvas").getContext("2d"), wcache = {};
    var LL = m.L.filter(function (L) { return L.title !== null || L.intro || (L.outro && L.outro.length) || (L.blocks && L.blocks.length); }); // لا صفحات فارغة لمحاضرات بلا محتوى
    if (!LL.length) LL = m.L.slice(0, 1);
    function width(font, t) { var k = font + "\u0001" + t; if (wcache[k] === undefined) { meas.font = font; wcache[k] = meas.measureText(t).width; } return wcache[k]; }
    function fitFont(t, size, bold, ar, maxW) { var s = size, f = fnt(s, bold, false, ar); while (width(f, t) > maxW && s > 5) { s *= 0.93; f = fnt(s, bold, false, ar); } return f; }
    function fnt(size, bold, italic, ar) { return (italic ? "italic " : "") + (bold ? "700 " : "400 ") + f2(size) + "px " + (ar ? FA : FL); }

    /* ---- السطح: صفحات (تُرسم فقط في التمرير الثاني) ---- */
    var dry = true, pages = [], cur = null, pageNo = 0, bodyPage = 0, y = 0, drawn = [], onPage = null;
    function g() { return cur ? cur.g : null; }
    function newPage(kind) {
      pageNo++; if (kind === "body") bodyPage++;
      if (!dry) {
        var c = document.createElement("canvas"); c.width = Math.round(PW * K); c.height = Math.round(PH * K);
        var gg = c.getContext("2d"); gg.scale(K, K); gg.fillStyle = "#FFFFFF"; gg.fillRect(0, 0, PW, PH); gg.textBaseline = "alphabetic";
        cur = { c: c, g: gg, links: [], kind: kind }; pages.push(cur);
      } else cur = null;
      y = TOP;
      if ((kind === "body" || kind === "toc") && !dry) {
        if (PBG) rect(0, 0, PW, PH, PBG);
        if (S.pageFrame) { rect(17, 17, PW - 34, PH - 34, null, T.h2line, 1.4); rect(21, 21, PW - 42, PH - 42, null, T.h2line, 0.6); }
      }
      if (kind === "body") bodyChrome();
      if (onPage) onPage(pageNo);
    }
    function rect(x, yy, w, h, fill, stroke, lw, dash) {
      if (dry) return; var gg = g(); gg.save();
      if (fill) { gg.fillStyle = hx(fill); gg.fillRect(x, yy, w, h); }
      if (stroke) { gg.strokeStyle = hx(stroke); gg.lineWidth = lw || 0.6; if (dash) gg.setLineDash(dash); gg.strokeRect(x, yy, w, h); }
      gg.restore();
    }
    function hline(x, yy, w, color, lw, dash) { if (dry) return; var gg = g(); gg.save(); gg.strokeStyle = hx(color); gg.lineWidth = lw; if (dash) gg.setLineDash(dash); gg.beginPath(); gg.moveTo(x, yy); gg.lineTo(x + w, yy); gg.stroke(); gg.restore(); }
    function img(im, x, yy, w, h, alpha) { if (dry || !im) return; var gg = g(); gg.save(); if (alpha !== undefined) gg.globalAlpha = alpha; try { gg.drawImage(im, x, yy, w, h); } catch (e) {} gg.restore(); }
    function text(t, x, yy, font, color, rtl) { if (dry) return; var gg = g(); gg.font = font; gg.fillStyle = hx(color); gg.direction = rtl ? "rtl" : "ltr"; gg.textAlign = "left"; gg.fillText(t, x, yy); }
    function link(x, yy, w, h) { if (!dry && HREF) cur.links.push({ x: x, y: yy, w: w, h: h, url: HREF }); }

    /* ---- تقطيع النص إلى وحدات (كلمات) ← أجزاء باتجاه واحد ← ذرّات بأنماط — بنفس تقسيم Word (ENGINE.splitDir) ---- */
    var SEG = (typeof Intl !== "undefined" && Intl.Segmenter) ? new Intl.Segmenter("ar", { granularity: "grapheme" }) : null;
    function graphemes(t) { return SEG ? Array.from(SEG.segment(t), function (x) { return x.segment; }) : Array.from(t); }
    function words(inl, o) {
      var units = [], cur = null, sz = o.size;
      inl.forEach(function (sg) {
        if (sg.text === undefined || sg.img) return;
        ENGINE.splitDir(String(sg.text)).forEach(function (seg) {
          var d = seg.emoji ? "N" : (seg.rtl ? "R" : "L");
          String(seg.t).replace(INVIS, "").split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { cur = null; return; }
            var ar = AR.test(part), s2 = sg.sup || sg.sub ? sz * 0.66 : sz, bold = !!(o.bold || sg.b || sg.tag);
            var a = { t: part, ar: ar, rtl: d === "R", font: fnt(s2, bold, !!(sg.i || o.italic), ar || !LA.test(part)), sup: sg.sup, sub: sg.sub, tag: sg.tag,
              color: sg.tag ? "FFFFFF" : (sg.b && o.boldColor ? o.boldColor : (o.color || "111111")) };
            a.w = width(a.font, part) + (sg.tag ? 4 : 0);
            if (!cur) { cur = { parts: [], w: 0 }; units.push(cur); }
            var lp = cur.parts[cur.parts.length - 1];
            if (lp && lp.dir === d) { lp.atoms.push(a); lp.w += a.w; } else cur.parts.push({ atoms: [a], w: a.w, dir: d });
            cur.w += a.w;
          });
        });
      });
      units.forEach(function (u) { u.text = u.parts.map(function (p) { return p.atoms.map(function (a) { return a.t; }).join(""); }).join(""); });
      return units;
    }
    function lineH(size) { return size * 1.22 * LS; }
    // تخطيط فقرة: أسطر من وحدات ضمن عرض محدد
    function layout(inl, o) {
      var units = words(inl, o), W = o.width;
      // كلمة قصيرة أعرض من الخانة (جداول ضيقة): نصغّر خط الفقرة بدل كسر الكلمة
      var widest = units.reduce(function (m, u) { return u.w > m.w ? u : m; }, { w: 0, text: "" });
      if (widest.w > W && graphemes(widest.text).length <= 24 && !o._shrunk) {
        var f = Math.max(0.6, (W / widest.w) * 0.98);
        return layout(inl, Object.assign({}, o, { size: o.size * f, _shrunk: true }));
      }
      var rtl = o.rtl !== undefined ? o.rtl : (AR.test(ENGINE.plain(inl.filter(function (x) { return x.text !== undefined; }))) || !units.length);
      var sw = width(fnt(o.size, false, false, true), " "), lines = [], line = [], lw = 0;
      units.forEach(function (u) {
        if (u.w > W) { // كلمة/رابط أطول من السطر: نقسمه على حدود المحارف المركّبة
          if (line.length) { lines.push(line); line = []; lw = 0; }
          var a0 = u.parts[0].atoms[0], gs = graphemes(u.text), chunk = "", first = true;
          var mk = function (t) { var w = width(a0.font, t); return { parts: [{ atoms: [Object.assign({}, a0, { t: t, w: w })], w: w, dir: u.parts[0].dir }], w: w, text: t, piece: true, rec: first ? u.text : null }; };
          gs.forEach(function (g) { if (chunk && width(a0.font, chunk + g) > W) { lines.push([mk(chunk)]); first = false; chunk = ""; } chunk += g; });
          line = [mk(chunk)]; lw = line[0].w; return;
        }
        var add = line.length ? sw + u.w : u.w;
        if (lw + add > W && line.length) { lines.push(line); line = [u]; lw = u.w; }
        else { line.push(u); lw += add; }
      });
      if (line.length || !lines.length) lines.push(line);
      var lh = lineH(o.size);
      return { lines: lines, lh: lh, h: lines.length * lh, rtl: rtl, sw: sw, W: W, size: o.size, align: o.align || "justify" };
    }
    // رسم سطر: ترتيب بصري (الأجزاء RTL يمين←يسار، والأجزاء LTR كتلة يسار→يمين، والمحايد حسب جيرانه)
    function drawLine(L, idx, x0, top) {
      var line = L.lines[idx], last = idx === L.lines.length - 1;
      line.forEach(function (u) { if (u.rec) drawn.push(u.rec); else if (!u.piece) drawn.push(u.text); });
      if (dry || !line.length) return;
      var nat = line.reduce(function (s, u) { return s + u.w; }, 0) + L.sw * (line.length - 1), gap = L.sw;
      if (L.align === "justify" && !last && line.length > 1) { var ex = (L.W - nat) / (line.length - 1); if (ex < L.sw * 3) gap = L.sw + ex; }
      var used = line.reduce(function (s, u) { return s + u.w; }, 0) + gap * (line.length - 1);
      var gs = [];
      line.forEach(function (u, ui) { u.parts.forEach(function (p, pi) { gs.push({ p: p, w: p.w, d: p.dir, gb: pi > 0 ? 0 : (ui > 0 ? gap : 0) }); }); });
      var base = L.rtl ? "R" : "L";
      gs.forEach(function (g, i) {
        if (g.d !== "N") return;
        var pv = null, nx = null, a, b;
        for (a = i - 1; a >= 0; a--) if (gs[a].d !== "N") { pv = gs[a].d; break; }
        for (b = i + 1; b < gs.length; b++) if (gs[b].d !== "N") { nx = gs[b].d; break; }
        g.r = pv && pv === nx ? pv : base;
      });
      gs.forEach(function (g) { if (!g.r) g.r = g.d; });
      var runs = [];
      gs.forEach(function (g) { if (runs.length && runs[runs.length - 1].d === g.r) runs[runs.length - 1].gs.push(g); else runs.push({ d: g.r, gs: [g] }); });
      var baseY = top + (L.lh - L.size) / 2 + L.size * 0.86, pos = [];
      function runW(r) { return r.gs.reduce(function (s, g, k) { return s + g.w + (k ? g.gb : 0); }, 0); }
      if (L.rtl) {
        var x = x0 + L.W - (L.align === "center" ? (L.W - used) / 2 : L.align === "left" ? L.W - used : 0);
        runs.forEach(function (r) {
          x -= r.gs[0].gb;
          if (r.d === "R") r.gs.forEach(function (g, k) { if (k) x -= g.gb; x -= g.w; pos.push([g, x]); });
          else { var tw = runW(r), xx = x - tw; r.gs.forEach(function (g, k) { if (k) xx += g.gb; pos.push([g, xx]); xx += g.w; }); x -= tw; }
        });
      } else {
        var x2 = x0 + (L.align === "center" ? (L.W - used) / 2 : L.align === "right" ? L.W - used : 0);
        runs.forEach(function (r) {
          x2 += r.gs[0].gb;
          if (r.d !== "R") r.gs.forEach(function (g, k) { if (k) x2 += g.gb; pos.push([g, x2]); x2 += g.w; });
          else { var tw2 = runW(r), xr = x2 + tw2; r.gs.forEach(function (g, k) { if (k) xr -= g.gb; xr -= g.w; pos.push([g, xr]); }); x2 += tw2; }
        });
      }
      pos.forEach(function (pg) {
        var g = pg[0], x = pg[1], atoms = g.r === "R" ? g.p.atoms.slice().reverse() : g.p.atoms;
        atoms.forEach(function (a) {
          var yy = baseY + (a.sup ? -L.size * 0.35 : a.sub ? L.size * 0.15 : 0);
          if (a.tag) { rect(x, top + (L.lh - L.size * 1.25) / 2, a.w, L.size * 1.25, a.tag.tagFill || "C00000"); text(a.t, x + 2, yy, a.font, a.color, g.r === "R"); }
          else text(a.t, x, yy, a.font, a.color, g.r === "R");
          x += a.w;
        });
      });
    }

    /* ---- ترويسة/تذييل صفحات المتن ---- */
    function bodyChrome() {
      if (dry) return;
      if (A.wm) { var ww = 430, wh = ww * A.wm.height / A.wm.width; img(A.wm, (PW - ww) / 2, (PH - wh) / 2, ww, wh); }
      var hy = 46, hs = 8.5;
      if (A.logo && S.logo) { var lh2 = 13, lw2 = lh2 * A.logo.width / A.logo.height; img(A.logo, PW - MX - lw2, hy - lh2 + 2, lw2, lh2); }
      var sub = String(S.subject || ""), f = fnt(hs, false, false, true);
      text(sub, PW - MX - (A.logo && S.logo ? 22 : 0) - width(f, sub), hy, f, "7F7F7F", true);
      hline(MX, hy + 6, CW, T.border, 0.6);
      var fy = PH - 42, fs = 9, fp = fnt(fs, true, false, true), fn = fnt(fs + 1, true, false, false), pl = "صفحة ", pn = String(bodyPage);
      var wpl = width(fp, pl), wpn = width(fn, pn), x0 = (PW - wpl - wpn - 3) / 2;
      text(pn, x0, fy, fn, T.acc, false); text(pl, x0 + wpn + 3, fy, fp, T.h1, true);
      // سطر الحقوق: اسم المنصة ذهبي عريض
      if (S.footerText && String(S.footerText).trim()) { var ftx = String(S.footerText).trim(), ffo = fitFont(ftx, 8, false, AR.test(ftx), CW); text(ftx, (PW - width(ffo, ftx)) / 2, fy + 13, ffo, "7F7F7F", AR.test(ftx)); return; }
      var fsz = 7.5, segs, wsg, wr, fu, wu, tot, GAPS = 3;
      for (var tries = 0; tries < 12; tries++) { // يصغر الخط إن طال اسم المنصة أو الرابط
        var fr = fnt(fsz, false, false, true), fb = fnt(fsz, true, false, AR.test(pfName)); segs = [];
        if (rightsOn) segs = [["© " + YEAR, fnt(fsz, false, false, false), "7F7F7F", false], [pfName, fb, GOLD, AR.test(pfName)], ["— جميع الحقوق محفوظة", fr, "7F7F7F", true]];
        else if (S.footBrand) segs = [[pfName, fb, GOLD, AR.test(pfName)]];
        wsg = segs.map(function (q) { return width(q[1], q[0]); }); wr = wsg.reduce(function (a, b) { return a + b; }, 0) + GAPS * Math.max(0, segs.length - 1);
        fu = fnt(fsz, false, false, false); wu = URLTXT ? width(fu, URLTXT) : 0; tot = wr + (wu ? wu + 14 : 0);
        if (tot <= CW) break; fsz *= 0.92;
      }
      var xs = (PW - tot) / 2;
      if (URLTXT) { text(URLTXT, xs, fy + 13, fu, T.acc, false); link(xs, fy + 5, wu, 10); }
      // الترتيب البصري RTL: «جميع الحقوق محفوظة» يساراً ثم الاسم ثم ©السنة يميناً
      var xr = xs + (wu ? wu + 14 : 0);
      for (var q = segs.length - 1; q >= 0; q--) { text(segs[q][0], xr, fy + 13, segs[q][1], segs[q][2], segs[q][3]); xr += wsg[q] + GAPS; }
    }

    /* ---- كتل المتن ---- */
    function room(h) { return y + h <= BOT + 0.01; }
    function ensure(h) { if (!room(h)) newPage("body"); }
    // فقرة مع صندوق اختياري، تنقسم على الصفحات سطراً سطراً
    function para(inl, o, box) {
      var pad = box ? (box.pad || 5) : 0, x0 = o.x + pad + (box && box.padX || 0), L = layout(inl, Object.assign({}, o, { width: o.w - 2 * pad - 2 * (box && box.padX || 0) }));
      var before = o.before || 0, after = o.after === undefined ? 4 : o.after, total = L.h + 2 * pad;
      y += before; if (y > BOT) newPage("body");
      if (S.keepParas || o.keep) { if (!room(total) && total <= BOT - TOP) newPage("body"); }
      if (o.keepNext && !room(total + o.keepNext)) newPage("body");
      var i = 0;
      while (i < L.lines.length) {
        var avail = BOT - y - 2 * pad, n = Math.max(1, Math.min(L.lines.length - i, Math.floor((avail + 0.01) / L.lh)));
        if (avail < L.lh && y > TOP + 1) { newPage("body"); continue; }
        var h = n * L.lh + 2 * pad;
        if (box) { rect(o.x, y, o.w, h, box.fill, box.border, box.lw || 0.8, box.dash); if (box.bottom) hline(o.x, y + h - box.bottom.w / 2, o.w, box.bottom.c, box.bottom.w, box.bottom.dash); }
        for (var k = 0; k < n; k++) drawLine(L, i + k, x0, y + pad + k * L.lh);
        i += n; y += h;
        if (i < L.lines.length) newPage("body");
      }
      y += after;
    }
    function bullet(ch, x, top, size, color) { var f = fnt(size, true, false, false); text(ch, x, top + (lineH(Z.body) - size) / 2 + size * 0.86, f, color, false); }
    function lecTitle(L) {
      para(L.titleInl || [{ text: L.title || "" }], { x: MX, w: CW, size: Z.h1, bold: true, color: "FFFFFF", boldColor: "FFFFFF", align: "center", after: 10, keepNext: lineH(Z.body) * 3, rtl: true }, { fill: T.h1, border: T.h1, pad: 6 });
    }
    function heading(b, x, w) {
      var lv = b.level, kn = Math.max(lineH(Z.body) * 3, 56); // العنوان لا يبقى وحيداً أسفل الصفحة
      if (lv === 2) para(b.inl, { x: x, w: w, size: Z.h2, bold: true, color: T.h2t, boldColor: T.h2t, align: "right", before: 12, after: 7, keepNext: kn }, { fill: T.h2bg, pad: 4, bottom: { c: T.h2line, w: 2.2 } });
      else if (lv === 3) para(b.inl, { x: x, w: w, size: Z.h3, bold: true, color: T.h3, boldColor: T.h3, align: "right", before: 10, after: 5, keepNext: kn }, { pad: 1, bottom: { c: T.h3, w: 0.7, dash: [1.5, 1.5] } });
      else para(b.inl, { x: x, w: w, size: Z.h4, bold: true, color: T.h4, boldColor: T.h4, align: "right", before: 8, after: 3, keepNext: kn });
    }
    function coBox(co) { co = co && co.fill ? co : (ENGINE.CALLOUTS ? ENGINE.CALLOUTS[0] : { fill: "FFF2CC", border: "BF9000" }); return { fill: co.fill, border: co.border, pad: 4, padX: 3, lw: 0.9 }; }
    function blocks(list, x, w) {
      list.forEach(function (b, bi) {
        switch (b.t) {
          case "h": heading(b, x, w); break;
          case "p": { var ind = (b.level || 0) * 18; para(b.inl, { x: x, w: w - ind, size: Z.body, color: "111111", boldColor: T.bold, after: 4 }, b.imp ? coBox(b.imp) : null); break; }
          case "li": {
            var ind2 = 16 + (b.level || 0) * 14, top = y;
            if (b.imp) { para(b.inl, { x: x, w: w - (b.level || 0) * 14, size: Z.body, color: "111111", boldColor: T.bold, after: 3 }, coBox(b.imp)); break; }
            var L0 = layout(b.inl, { size: Z.body, width: w - ind2 }); if (S.keepParas && !room(L0.h) && L0.h <= BOT - TOP) newPage("body"); if (!room(L0.lh)) newPage("body");
            top = y; var rtlL = L0.rtl; bullet(["●", "○", "■", "▪"][Math.min(3, b.level || 0)], rtlL ? x + w - ind2 + 4 + (b.level || 0) * 0 : x + (b.level || 0) * 14 + 2, top, Math.max(6, Z.body - 5), T.acc);
            para(b.inl, { x: rtlL ? x : x + ind2, w: w - ind2, size: Z.body, color: "111111", boldColor: T.bold, after: 2 }); break;
          }
          case "ol": {
            var indO = b.nested ? 18 * Math.max(1, b.indentLevel || 1) : 0, wO = w - indO, NW = 26;
            var ltrList = !b.items.some(function (it) { return AR.test(ENGINE.plain(it.inl)); });
            var numLeft = ltrList || S.numPos === "left";
            // المساحة: قائمة عربية تُزاح من اليمين، وقائمة إنجليزية من اليسار
            var ax = ltrList ? x + indO : x, aw = wO, TWd = aw - NW - 6;
            b.items.forEach(function (it) {
              var Lt = layout(it.inl, { size: Z.body, width: TWd });
              if ((S.keepParas && !room(Lt.h) && Lt.h <= BOT - TOP) || !room(Lt.lh)) newPage("body");
              var top2 = y, nx = numLeft ? ax : ax + aw - NW, tx = numLeft ? ax + NW + 6 : ax;
              rect(nx, top2, NW, Lt.lh, T.light);
              var nt = String(it.num || ""), nf = fitFont(nt, Z.body, true, false, NW - 2);
              text(nt, nx + (NW - width(nf, nt)) / 2, top2 + (Lt.lh - Z.body) / 2 + Z.body * 0.86, nf, T.acc, false); if (!it.gen) drawn.push(nt);
              para(it.inl, { x: tx, w: TWd, size: Z.body, color: "111111", boldColor: T.bold, after: 3 }, it.imp ? coBox(it.imp) : null);
              if (it.children && it.children.length) blocks(it.children, tx, TWd);
            });
            y += 3; break;
          }
          case "table": table(b, x, w); break;
          case "diagram": diagram(b.rows, x, w); break;
          case "pre": {
            var ps = Math.max(7, Z.body - 3), mono = '"Courier New","Liberation Mono",monospace';
            var mw = b.lines.reduce(function (mx, l) { return Math.max(mx, width(f2(ps) + "px " + mono, l.replace(INVIS, ""))); }, 0);
            if (mw > w - 10) ps = Math.max(5, ps * (w - 10) / mw);
            var pf = f2(ps) + "px " + mono, plh = ps * 1.35;
            b.lines.forEach(function (l) {
              if (!room(plh)) newPage("body");
              rect(x, y, w, plh, "F7F7F7"); var t = l.replace(INVIS, "");
              text(t, x + 5, y + plh * 0.75, pf, "333333", false); drawn.push(t); y += plh;
            });
            y += 6; break;
          }
          case "gen": genBlock(b, x, w); break;
          case "img": {
            var nb = list[bi + 1], cap = nb && nb.t === "p" && !nb.imp && ENGINE.plain(nb.inl).length < 120 ? lineH(Z.body) + 6 : 0; // الصورة مع تعليقها
            image(b.img, x, w, cap); break;
          }
        }
      });
    }
    function genBlock(b, x, w) { // كتل مولّدة: لا تدخل في تحقق الكلمات
      var keep = drawn.length;
      if (b.kind === "note") para([{ text: b.text }], { x: x, w: w, size: Math.max(7, Z.body - 3.5), color: "8C8C8C", align: "left", after: 4, rtl: true });
      else if (b.kind === "glossary" && b.rows && b.rows.length > 1) {
        newPage("body"); heading({ level: 2, inl: [{ text: b.title }] }, x, w);
        table({ rows: b.rows.map(function (r) { return r.map(function (t) { return [{ text: t }]; }); }), noHead: false }, x, w);
      } else if (b.kind === "notes") {
        newPage("body"); para([{ text: b.title || "ملاحظات" }], { x: x, w: w, size: Z.h3, bold: true, color: T.h3, boldColor: T.h3, align: "right", after: 8 }, { pad: 1, bottom: { c: T.h2line, w: 1.2 } });
        while (y + 26 <= BOT) { y += 26; hline(x, y, w, "BFBFBF", 0.6, [1.5, 2]); }
      }
      drawn.length = keep;
    }
    function image(im, x, w, keepAfter) {
      var bmp = A.images && A.images.get(im); if (!bmp) return;
      var iw = Math.min(w, (im.w || bmp.width) * 0.75), ih = iw * bmp.height / bmp.width, maxH = (BOT - TOP) * 0.85;
      if (ih > maxH) { ih = maxH; iw = ih * bmp.width / bmp.height; }
      if (!room(ih + 6 + (keepAfter || 0))) newPage("body");
      img(bmp, x + (w - iw) / 2, y + 3, iw, ih); y += ih + 9;
    }
    function cellImg(im, maxW) { // حجم صورة داخل خلية: لا تتجاوز عرض الخلية ولا 70% من ارتفاع الصفحة
      var bm = A.images && A.images.get(im); if (!bm) return null;
      var w = Math.min(maxW, (im.w || bm.width) * 0.75), h = w * bm.height / bm.width, mh = (BOT - TOP) * 0.7;
      if (h > mh) { h = mh; w = h * bm.width / bm.height; }
      return { bm: bm, w: w, h: h };
    }
    function colWidths(rows, W) {
      var n = Math.max.apply(null, rows.map(function (r) { return r.reduce(function (s, c) { return s + (c.span || 1); }, 0); })), lens = [];
      for (var j = 0; j < n; j++) { var tot = 0, cnt = 0; rows.forEach(function (r) { var k = 0; r.forEach(function (c) { if (k === j && (c.span || 1) === 1) { tot += Math.min(ENGINE.plain(c.filter(function (s) { return s.text !== undefined; })).length, 90); cnt++; } k += c.span || 1; }); }); lens.push(Math.max(4, cnt ? tot / cnt : 8)); }
      var sum = lens.reduce(function (a, b) { return a + b; }, 0), mn = Math.min(60, W / n), px = lens.map(function (v) { return Math.max(mn, W * v / sum); });
      var s2 = px.reduce(function (a, b) { return a + b; }, 0); return px.map(function (v) { return v * W / s2; });
    }
    function table(b, x, W) {
      var rows = b.rows.filter(function (r) { return r.length; }); if (!rows.length) return;
      var cw = colWidths(rows, W), rtlT = !b.ltrTable, head = !b.noHead && rows.length > 1, PAD = 3, TS = Z.table;
      function cellBoxes(r, ri) {
        var out = [], k = 0;
        r.forEach(function (c, ci) {
          var sp = c.span || 1, wcell = 0; for (var q = 0; q < sp; q++) wcell += cw[k + q] || 0;
          var vx = 0; for (var q2 = 0; q2 < k; q2++) vx += cw[q2];
          var cx = rtlT ? x + W - vx - wcell : x + vx;
          var isHead = head && ri === 0, fc = !isHead && k === 0 && rtlT;
          var L = layout(c, { size: TS, width: wcell - 2 * PAD, bold: isHead, color: isHead ? "FFFFFF" : "111111", boldColor: isHead ? "FFFFFF" : T.bold, align: isHead ? "center" : (AR.test(ENGINE.plain(c.filter(function (s) { return s.text !== undefined; }))) ? "right" : "left") });
          var ims = c.filter(function (s) { return s.img; }).map(function (s) { return s.img; });
          var imh = ims.reduce(function (h, im) { var sz2 = cellImg(im, wcell - 2 * PAD); return sz2 ? h + sz2.h + 3 : h; }, 0);
          out.push({ x: cx, w: wcell, L: L, ims: ims, imh: imh, fill: isHead ? T.thead : fc ? T.fc : (ri > 0 && ri % 2 === 0 ? T.alt : null), done: 0 });
          k += sp;
        });
        return out;
      }
      var headCells = head ? cellBoxes(rows[0], 0) : null;
      function drawRowChunk(cells, top, h, fullDraw) {
        cells.forEach(function (c) {
          rect(c.x, top, c.w, h, c.fill || null);
          rect(c.x, top, c.w, h, null, T.border, 0.6);
        });
      }
      function rowFull(cells) { return Math.max.apply(null, cells.map(function (c) { return c.L.h + c.imh; })) + 2 * PAD; }
      function repeatHead() { if (headCells) { headCells.forEach(function (c) { c.done = 0; }); var hh = rowFull(headCells); drawRowChunk(headCells, y, hh); headCells.forEach(function (c) { for (var i = 0; i < c.L.lines.length; i++) { var keep = drawn.length; drawLine(c.L, i, c.x + PAD, y + PAD + i * c.L.lh); drawn.length = keep; } }); y += hh; } }
      rows.forEach(function (r, ri) {
        var cells = ri === 0 && headCells ? headCells : cellBoxes(r, ri), full = rowFull(cells);
        if (ri === 0 && headCells && rows.length > 1) { var nx1 = rowFull(cellBoxes(rows[1], 1)); if (!room(full + Math.min(nx1, lineH(TS) * 2 + 2 * PAD)) && y > TOP + 1) newPage("body"); } // لا يبقى سطر العناوين وحيداً
        if (!room(full) && full <= BOT - TOP - 40) { newPage("body"); if (ri > 0) repeatHead(); }
        // يرسم السطر على دفعات إن كان أطول من المساحة المتبقية
        var guard = 0;
        while (cells.some(function (c) { return c.done < c.L.lines.length || (c.ims.length && !c.imgDone); }) && guard++ < 50) {
          var avail = BOT - y - 2 * PAD;
          if (avail < lineH(TS)) { newPage("body"); if (ri > 0) repeatHead(); continue; }
          var plan = cells.map(function (c) { var rem = c.L.lines.length - c.done, n = Math.max(0, Math.min(rem, Math.floor((avail + 0.01) / c.L.lh))); var ih = !c.imgDone && n === rem && c.L.h - c.done * c.L.lh + c.imh <= avail + 0.01 ? c.imh : 0; return { n: n, ih: ih }; });
          var h = Math.max.apply(null, plan.map(function (p, i) { return p.n * cells[i].L.lh + p.ih; })) + 2 * PAD;
          if (h <= 2 * PAD + 0.01) { newPage("body"); if (ri > 0) repeatHead(); continue; }
          drawRowChunk(cells, y, h);
          cells.forEach(function (c, i) {
            for (var k = 0; k < plan[i].n; k++) drawLine(c.L, c.done + k, c.x + PAD, y + PAD + k * c.L.lh);
            var iy = y + PAD + plan[i].n * c.L.lh; c.done += plan[i].n;
            if (plan[i].ih) { c.ims.forEach(function (im) { var sz3 = cellImg(im, c.w - 2 * PAD); if (!sz3) return; img(sz3.bm, c.x + (c.w - sz3.w) / 2, iy + 1, sz3.w, sz3.h); iy += sz3.h + 3; }); c.imgDone = true; }
            if (!c.ims.length) c.imgDone = true;
          });
          y += h;
          if (cells.some(function (c) { return c.done < c.L.lines.length; })) { newPage("body"); if (ri > 0) repeatHead(); }
        }
      });
      y += 8;
    }
    function diagram(rowsD, x, W) {
      rowsD.forEach(function (row, r) {
        var n = row.length, gapD = 8, bw = (W - gapD * (n - 1)) / n;
        if (r > 0) { if (!room(14)) newPage("body"); var af = fnt(10, true, false, false); for (var i = 0; i < n; i++) text("▼", x + W - (i + 1) * bw - i * gapD + bw / 2 - 4, y + 11, af, T.acc, false); y += 14; }
        var Ls = row.map(function (t) { return layout([{ text: t }], { size: Math.max(8, Z.body - 1), width: (r === 0 && n === 1 ? W * 0.6 : bw) - 8, bold: true, color: r === 0 ? "FFFFFF" : T.bold, boldColor: r === 0 ? "FFFFFF" : T.bold, align: "center" }); });
        var h = Math.max.apply(null, Ls.map(function (L) { return L.h; })) + 8;
        if (!room(h)) newPage("body");
        row.forEach(function (t, i) {
          var w2 = r === 0 && n === 1 ? W * 0.6 : bw, bx = r === 0 && n === 1 ? x + (W - w2) / 2 : x + W - (i + 1) * bw - i * gapD;
          rect(bx, y, w2, h, r === 0 ? T.h1 : T.light, r === 0 ? T.h1 : T.acc, 0.8);
          for (var k = 0; k < Ls[i].lines.length; k++) drawLine(Ls[i], k, bx + 4, y + 4 + k * Ls[i].lh);
        });
        y += h;
      });
      y += 8;
    }

    /* ---- الغلاف ---- */
    var CSMAP = {
      classic: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 75, logo: true, bar: T.h2line, foot: "404040", r: 0, l: 0 },
      band: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 130, logo: false, bar: T.h2line, foot: "404040", r: 135, l: 0 },
      geo: { title: "FFFFFF", sub: "F2CF86", line: "FFFFFF", first: "FFFFFF", top: 75, logo: true, bar: "D9A84E", foot: "E6EAF0", r: 15, l: 15 },
      frame: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 85, logo: true, bar: "A9761E", foot: "404040", r: 35, l: 35 },
      wave: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 65, logo: true, bar: T.h2line, foot: "FFFFFF", r: 10, l: 10 },
      block: { title: "FFFFFF", sub: "F2CF86", line: "1A1A1A", first: T.h2t, top: 0, logo: true, bar: "D9A84E", foot: "404040", r: 0, l: 0 },
      dna: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 85, logo: true, bar: T.h2line, foot: "404040", r: 130, l: 0 },
      molecule: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 100, logo: true, bar: T.h2line, foot: "404040", r: 20, l: 20 },
      cycle: { title: "FFFFFF", sub: "F2CF86", line: "FFFFFF", first: "FFFFFF", top: 60, logo: true, bar: "D9A84E", foot: "E6EAF0", r: 15, l: 15 },
      peptide: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 95, logo: true, bar: T.h2line, foot: "404040", r: 15, l: 15 },
      helix: { title: "FFFFFF", sub: "F2CF86", line: "FFFFFF", first: "F2CF86", top: 75, logo: true, bar: "D9A84E", foot: "E6EAF0", r: 20, l: 20 },
      protein: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 100, logo: true, bar: "A9761E", foot: "404040", r: 20, l: 20 },
      steroid: { title: T.h1, sub: "262626", line: "1A1A1A", first: T.h2t, top: 85, logo: true, bar: "A9761E", foot: "404040", r: 20, l: 20 }
    };
    function cover() {
      var st = CSMAP[S.coverStyle] ? S.coverStyle : "classic", c = CSMAP[st];
      var cl = (S.coverLines || []).filter(function (t) { return String(t).trim(); });
      var showSub = S.showSubtitle !== false && (!cl.length || S.subtitle), subTxt = S.subtitle || "التفريغ النصي الأكاديمي الشامل للمحاضرات";
      var extra = String(S.coverExtra || "").split(/\n/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 12), dr = String(S.doctor || "").trim();
      var cnt = (S.tocLabels && S.tocLabels.count || "عدد المحاضرات: ") + (S.tocItems ? S.tocItems.length : LL.length);
      var dark = st === "geo" || st === "cycle" || st === "helix", drC = st === "block" || dark ? "FFFFFF" : c.first, exC = st === "block" ? "FFFFFF" : c.line;
      function plan(f) { // عناصر الغلاف بمقياس f
        var items = [];
        var x = MX + c.l, w = CW - c.l - c.r;
        if (c.logo && S.logo && A.logo) items.push({ k: "logo", h: 62 * f, gap: 14 * f });
        var title = S.coverTitle ? ENGINE.parseInline(String(S.coverTitle)) : [{ text: S.subject || "المحاضرات" }];
        items.push({ k: "p", inl: title, o: { size: (Z.body + 13) * f, bold: true, color: c.title, boldColor: c.title, align: "center" }, gap: 6 * f, orig: !!S.coverTitle });
        items.push({ k: "bar", h: 2.4, gap: 12 * f });
        if (showSub) items.push({ k: "p", inl: [{ text: subTxt }], o: { size: (Z.body + 3) * f, color: c.sub, align: "center" }, gap: 8 * f });
        if (dr) items.push({ k: "p", inl: ENGINE.parseInline(dr), o: { size: (Z.body + 2.5) * f, bold: true, color: drC, boldColor: drC, align: "center" }, gap: 4 * f });
        extra.forEach(function (t) { items.push({ k: "p", inl: ENGINE.parseInline(t), o: { size: (Z.body + 1) * f, color: exC, boldColor: drC, align: "center" }, gap: 3 * f }); });
        if (st === "block") items.push({ k: "split", gap: 30 * f });
        cl.forEach(function (t, k) { items.push({ k: "p", inl: ENGINE.parseInline(String(t)), o: { size: (Z.body + (k ? 1 : 2)) * f, bold: !k, color: k ? c.line : c.first, boldColor: c.first, align: "center" }, gap: 3 * f, orig: true }); });
        items.push({ k: "p", inl: [{ text: cnt }], o: { size: Z.body * f, color: dark ? "E6EAF0" : "404040", align: "center" }, gap: 0, pre: 14 * f });
        var hsum = 0;
        items.forEach(function (it) { if (it.k === "p") { it.L = layout(it.inl, Object.assign({ width: w - 20 }, it.o)); it.h = it.L.h; } hsum += (it.pre || 0) + it.h + (it.gap || 0); });
        return { items: items, h: hsum, x: x, w: w };
      }
      if (S.coverImageOnly && A.cover) { newPage("cover"); img(A.cover, 0, 0, PW, PH); return; } // غلاف = صورة المستخدم فقط
      var f = 1, P = plan(f), avail = PH - MT - c.top - 90;
      while (P.h > avail && f > 0.55) { f *= 0.93; P = plan(f); }
      newPage("cover");
      if (A.cover) img(A.cover, 0, 0, PW, PH);
      var yy = MT + (st === "block" ? 0 : c.top);
      if (st === "block") {
        var hb = 0, splitAt = P.items.findIndex(function (it) { return it.k === "split"; });
        P.items.slice(0, splitAt).forEach(function (it) { hb += (it.pre || 0) + it.h + (it.gap || 0); });
        var bandH = Math.max(380, hb + 90); rect(0, 0, PW, bandH, T.h1); rect(0, bandH, PW, 2.4, "D9A84E");
        yy = (bandH - hb) / 2 + 10; P.bandH = bandH;
      }
      P.items.forEach(function (it, idx) {
        yy += it.pre || 0;
        if (it.k === "logo") { var lw = it.h * A.logo.width / A.logo.height; img(A.logo, P.x + (P.w - lw) / 2, yy, lw, it.h); }
        else if (it.k === "bar") { rect(P.x + P.w / 2 - 55, yy, 110, 2.4, c.bar); }
        else if (it.k === "split") { yy = P.bandH + 30; return; }
        else if (it.k === "p") { var keep = drawn.length; for (var i = 0; i < it.L.lines.length; i++) drawLine(it.L, i, P.x + 10, yy + i * it.L.lh); if (!it.orig) drawn.length = keep; }
        yy += it.h + (it.gap || 0);
      });
      // التذييل: الحقوق + الرابط
      var fy = st === "peptide" ? PH - 142 : PH - 46, fc = c.foot, fr = fnt(8, false, false, true); // الببتيد: فوق السلسلة السفلية
      var availW = st === "band" ? CW - 135 : st === "dna" ? CW - 130 : CW, cx0 = st === "band" || st === "dna" ? MX : (PW - CW) / 2;
      var bigNm = S.coverBigName !== undefined && S.coverBigName !== null ? String(S.coverBigName).trim() : pfName;
      if (bigNm) { var bigC = st === "wave" ? T.h1 : dark ? "E6C27A" : GOLD, fbig = fitFont(bigNm, Z.body + (bigNm.length > 24 ? 6 : 11), true, AR.test(bigNm), availW), wbig = width(fbig, bigNm);
        text(bigNm, cx0 + (availW - wbig) / 2, st === "wave" ? PH - 168 : fy - 22, fbig, bigC, AR.test(bigNm)); } // بالموجات: فوق الموج
      if (S.footerText) { var ft = String(S.footerText).trim(), ff = fitFont(ft, 8.5, false, AR.test(ft), availW); text(ft, cx0 + (availW - width(ff, ft)) / 2, rightsOn ? fy - 9 : fy, ff, fc, AR.test(ft)); }
      if (rightsOn) { var rt = "© " + YEAR + " " + pfName + " — جميع الحقوق محفوظة", frr = fitFont(rt, 8, false, true, availW); text(rt, cx0 + (availW - width(frr, rt)) / 2, fy, frr, fc, true); }
      if (URLTXT) { var fu = fitFont(URLTXT, 8, false, false, availW), wu = width(fu, URLTXT), xu = cx0 + (availW - wu) / 2; text(URLTXT, xu, fy + 12, fu, fc === "404040" ? T.acc : fc, false); link(xu, fy + 3, wu, 11); }
    }

    /* ---- الفهرس (بأرقام صفحات حقيقية) ---- */
    function toc(starts) {
      var TL = Object.assign({ title: "فهرس المحاضرات ومحاورها", c1: "المحاضرة", c2: "المحاور الرئيسية" }, S.tocLabels || {});
      newPage("toc"); var keepT = drawn.length;
      para([{ text: TL.title }], { x: MX, w: CW, size: Z.h2 + 1, bold: true, color: "FFFFFF", boldColor: "FFFFFF", align: "center", after: 10, rtl: true }, { fill: T.h1, pad: 5 });
      var c1 = 120, c3 = 50, c2 = CW - c1 - c3, TS = Z.table;
      function row(cells, fills, headRow) {
        var Ls = cells.map(function (c, i) { return c.map(function (t) { return layout([{ text: t }], { size: TS, width: [c1, c2, c3][i] - 8, bold: headRow || i === 0 || i === 2, color: headRow ? "FFFFFF" : i === 0 ? T.bold : "111111", boldColor: headRow ? "FFFFFF" : T.bold, align: headRow || i !== 1 ? "center" : "right" }); }); });
        var h = Math.max.apply(null, Ls.map(function (arr) { return arr.reduce(function (s, L) { return s + L.h; }, 0); })) + 8;
        if (!room(h)) newPage("toc");
        var xs = [MX + CW - c1, MX + c3, MX];
        [c1, c2, c3].forEach(function (w, i) { rect(xs[i], y, w, h, fills[i]); rect(xs[i], y, w, h, null, T.border, 0.6); });
        Ls.forEach(function (arr, i) { var yy = y + 4 + (i !== 1 ? (h - 8 - arr.reduce(function (s, L) { return s + L.h; }, 0)) / 2 : 0); arr.forEach(function (L) { var keep = drawn.length; for (var k = 0; k < L.lines.length; k++) drawLine(L, k, xs[i] + 4, yy + k * L.lh); drawn.length = keep; yy += L.h; }); });
        y += h;
      }
      drawn.length = keepT;
      row([[TL.c1], [TL.c2], ["الصفحة"]], [T.thead, T.thead, T.thead], true);
      var items = S.tocItems || LL.map(function (L, i) { return { label: ENGINE.lectureLabel(L, i), topics: L.blocks.filter(function (b) { return b.t === "h" && b.level === 2 && !b.twin; }).map(function (b) { return ENGINE.plain(b.inl); }) }; });
      var maxRowH = (BOT - TOP) * 0.8;
      items.forEach(function (it, i) {
        var tops = it.topics && it.topics.length ? it.topics.map(function (t) { return "•  " + t; }) : ["—"], chunks = [], ch = [], hh = 0;
        tops.forEach(function (t) { var th = layout([{ text: t }], { size: TS, width: c2 - 8 }).h; if (ch.length && hh + th > maxRowH) { chunks.push(ch); ch = []; hh = 0; } ch.push(t); hh += th; }); chunks.push(ch);
        chunks.forEach(function (c, k) { row([[k ? it.label + " (تابع)" : it.label], c, [k ? "" : (starts[i] ? String(starts[i]) : "—")]], [T.fc, i % 2 ? T.alt : "FFFFFF", T.light], false); });
      });
    }

    /* ---- الغلاف الخلفي ---- */
    function back() {
      newPage("back");
      if (A.back) img(A.back, 0, 0, PW, PH);
      var yy = A.qr ? 150 : 230;
      if (A.logo && S.logo) { var lh = 70, lw = lh * A.logo.width / A.logo.height; img(A.logo, (PW - lw) / 2, yy, lw, lh); yy += lh + 18; }
      function ctr(t, size, bold, color, ar) { var f = fitFont(t, size, bold, ar, CW), w = width(f, t), sz = parseFloat(f.replace(/^\D*?(\d[\d.]*)px.*$/, "$1")) || size; text(t, (PW - w) / 2, yy + sz, f, color, ar); yy += sz * 1.6; return { x: (PW - w) / 2, w: w, s: sz }; }
      ctr(pfName, Z.body + 20, true, "FFFFFF", AR.test(pfName));
      var btx = String(S.backText || "").trim().slice(0, 300);
      if (btx) { var Lb = layout([{ text: btx }], { size: Z.body + 3, width: CW - 40, color: "E6C27A", align: "center" }); var kb = drawn.length; Lb.lines.slice(0, 6).forEach(function (ln, i) { drawLine(Lb, i, MX + 20, yy + i * Lb.lh); }); drawn.length = kb; yy += Math.min(6, Lb.lines.length) * Lb.lh + 6; }
      rect(PW / 2 - 50, yy + 4, 100, 2, "D9A84E"); yy += 26;
      if (A.qr) { var q = 112; rect(PW / 2 - q / 2 - 6, yy - 6, q + 12, q + 12, "FFFFFF"); img(A.qr, PW / 2 - q / 2, yy, q, q); link(PW / 2 - q / 2, yy, q, q); yy += q + 16; ctr("امسح الرمز لزيارة المنصة", Z.body - 1, false, "D5DCE8", true); }
      if (URLTXT) { var u = ctr(URLTXT, Z.body + 1, false, "E6C27A", false); link(u.x, yy - u.s * 1.6, u.w, u.s + 4); yy += 6; }
      String(S.social || "").split(/\n/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8).forEach(function (t) { ctr(t, Z.body, false, "D5DCE8", AR.test(t)); });
      if (rightsOn) { var rt = "© " + YEAR + " " + pfName + " — جميع الحقوق محفوظة", fr = fitFont(rt, 8, false, true, CW); text(rt, (PW - width(fr, rt)) / 2, PH - 46, fr, "C7D2E0", true); }
    }

    /* ---- تمريرة كاملة ---- */
    function pass(starts) {
      pages = []; pageNo = 0; bodyPage = 0; drawn = []; var st = [];
      if (S.cover) cover();
      if (S.toc) toc(starts || []);
      LL.forEach(function (L, i) {
        if (i === 0 || S.h1NewPage !== false || L.title === null) newPage("body");
        if (L.title !== null) lecTitle(L);
        st[i] = bodyPage;
        if (L.intro) para(L.intro, { x: MX, w: CW, size: Z.body - 1, color: "404040", boldColor: "262626", after: 8 }, { fill: "F2F2F2", border: "BFBFBF", pad: 5 });
        blocks(L.blocks, MX, CW);
        L.outro.forEach(function (o) { para(o, { x: MX, w: CW, size: Z.body, color: "111111", boldColor: T.bold, before: 8, after: 4 }, { fill: T.outro, border: T.acc, pad: 5, dash: [3, 2] }); });
      });
      if (S.backCover) back();
      return st;
    }
    dry = true; var starts = pass(null);
    dry = false; onPage = opt.onPage || null; pass(starts);
    var drawnWords = drawn.slice();
    // صور الصفحات → PDF
    var out = [], chain = Promise.resolve();
    pages.forEach(function (p, i) {
      chain = chain.then(function () { return canvasJpeg(p.c, opt.quality || 0.85); }).then(function (jp) {
        out.push({ jpeg: jp, w: p.c.width, h: p.c.height, links: p.links }); p.c.width = p.c.height = 1; if (opt.onEncode) opt.onEncode(i + 1, pages.length);
      });
    });
    return chain.then(function () { return opt.protect && window.RMED_PROTECT ? RMED_PROTECT.pdfSecurity(opt.protect) : null; })
      .then(function (sec) { return writePdf(out, opt.title || S.subject || "Random.MEd", sec); })
      .then(function (blob) { return { blob: blob, pages: out.length, words: drawnWords, protected: !!opt.protect }; });
  }

  // كلمات المحتوى الأصلي المتوقع ظهورها (للتحقق من أن التخطيط لم يُسقط شيئاً)
  function expectedWords(m) {
    var S = m.s, parts = [];
    function inl(a) { if (a) parts.push(a.filter(function (s) { return s.text !== undefined && !s.img; }).map(function (s) { return s.text; }).join("")); }
    function blocksW(list) {
      list.forEach(function (b) {
        if (b.t === "h" || b.t === "p" || b.t === "li") inl(b.inl);
        else if (b.t === "ol") b.items.forEach(function (it) { if (!it.gen) parts.push(String(it.num || "")); inl(it.inl); blocksW(it.children || []); });
        else if (b.t === "table") b.rows.forEach(function (r) { r.forEach(function (c) { inl(c); }); });
        else if (b.t === "diagram") b.rows.forEach(function (r) { parts.push(r.join(" ")); });
        else if (b.t === "pre") parts.push(b.lines.join(" "));
      });
    }
    if (S.cover) { if (S.coverTitle) parts.push(String(S.coverTitle)); (S.coverLines || []).forEach(function (t) { parts.push(String(t)); }); }
    m.L.forEach(function (L) { if (L.title !== null) inl(L.titleInl || [{ text: L.title }]); if (L.intro) inl(L.intro); blocksW(L.blocks); L.outro.forEach(inl); });
    return ENGINE.tokens(parts.join("\n"));
  }
  return { build: build, expectedWords: expectedWords };
})();
