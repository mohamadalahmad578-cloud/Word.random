/* Random.MEd — «التنسيق الذكي»: يدرس نصاً خاماً (بلا Markdown) ويقترح بنيته: عناوين، نقاط، جداول، صناديق ملوّنة، تغميق المصطلحات.
   القاعدة الذهبية: لا يغيّر ولا يحذف ولا يضيف أي كلمة — يضيف رموز تنسيق فقط (#، *، |، **، ووسوم مخفية {{…}}).
   كل سطر مقترح يُفحص: كلماته بعد التنسيق = كلماته قبل التنسيق (عدا رمز النقطة • الذي يتحول لنقطة حقيقية)، وإلا يُرجع كما كان. */
var RMED_SMART = (function () {
  "use strict";
  var AR = "\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF";
  var END = "(?=$|[\\s:：\\-–—.،,؛;!؟?)(\\]])";
  var BUL1 = "•●▪■◆❖➢➤►▶▸◘*+\\-–—\uF0A7\uF0B7\uF0D8\uF076\uF0FC";
  var BUL2 = "◦○▹◇·";
  var BUL_RE = new RegExp("^([" + BUL1 + BUL2 + "])[ \\t\u00A0]+(?=\\S)");
  var ORDW = "(الأول|الأولى|الاول|الاولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|الخامس|الخامسة|السادس|السادسة|السابع|السابعة|الثامن|الثامنة|التاسع|التاسعة|العاشر|العاشرة|الحادية|الحادي|الثانية عشرة|الأخير|الأخيرة|رقم|[\\d٠-٩]+|[IVX]+)";
  var ORD_RE = new RegExp("^(أولاً|أولا|اولاً|اولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا|أخيراً|أخيرا|ختاماً)" + END);
  var ORD_SEP_RE = new RegExp("^\\S+\\s*[:：\\-–—)]");
  var SEC_RE = new RegExp("^((الفصل|القسم|المحور|الباب|الوحدة|الجزء)\\s+" + ORDW + END + "|(Chapter|Section|Part|Unit)\\s+[\\dIVX]+)", "i");
  var LEC_RE = new RegExp("^((ال)?محاضرة\\s+" + ORDW + END + "|Lecture\\s+[\\d٠-٩]+|Lec\\.?\\s*[\\d٠-٩]+)", "i");
  var NUM_RE = /^([\d٠-٩]{1,2}(\.[\d٠-٩]{1,2})*)\s*(?:[-–)]\s*|\.\s+)(?=\S)/;
  var LABEL_ONLY_RE = /^(ملاحظة|ملاحظه|ملاحظات|ملحوظة|هام جداً|هام جدا|مهم جداً|مهم جدا|هام|مهم|تعريف|التعريف|تحذير|تنبيه|حالة سريرية|مثال سريري|حالة مرضية|Note|Notes|Important|Definition|Warning|Case|Clinical case)\s*[:：]?\s*$/i;
  var VERBY = /(^|\s)(قال|يقول|نقول|ونقول|يقسم|تقسم|ويقسم|وتقسم|يصنف|تصنف|يتألف|تتألف|يتكون|تتكون|يشمل|تشمل|هناك|يوجد|توجد|نذكر|كالتالي|يلي)(\s|$)/;
  var LEX = /^(مقدمة|المقدمة|تعريف|التعريف|التصنيف|الأسباب|الأعراض|الأعراض والعلامات|العلامات|التشخيص|العلاج|المعالجة|الإمراضية|آلية التأثير|آلية العمل|الحرائك الدوائية|الاستطبابات|الاستعمالات|التأثيرات الجانبية|الآثار الجانبية|مضادات الاستطباب|موانع الاستعمال|التداخلات الدوائية|الجرعة|الخلاصة|الوبائيات|المضاعفات|الإنذار|الوقاية|أمثلة|Introduction|Definition|Classification|Mechanism of action|Pharmacokinetics|Indications|Uses|Side effects|Adverse effects|Contraindications|Interactions|Drug interactions|Treatment|Management|Diagnosis|Etiology|Aetiology|Pathogenesis|Clinical features|Complications|Summary|Examples)$/i;
  var SUBLEX = /^(الأسباب|الأعراض|الأعراض والعلامات|العلامات|التشخيص|العلاج|المعالجة|الإمراضية|آلية التأثير|آلية العمل|الحرائك الدوائية|الاستطبابات|الاستعمالات|التأثيرات الجانبية|الآثار الجانبية|مضادات الاستطباب|موانع الاستعمال|التداخلات الدوائية|الجرعة|الوبائيات|المضاعفات|الإنذار|الوقاية|أمثلة|الخصائص|التحاليل|الفحوص|الفوائد الإضافية|Mechanism|Mechanism of action|Pharmacokinetics|Indications|Uses|Examples|Side effects|Adverse effects|Contraindications|Interactions|Drug interactions|Treatment|Management|Diagnosis|Etiology|Causes|Clinical features|Complications)$/i;
  var DIALECT = /(^|\s)(حكينا|منحكي|رح|بدنا|قلنا|شفنا|خلصنا|هلق|هون)(\s|$)/;
  var FUNCW = /(^|\s)(في|على|إلى|الى|من|عن|حسب|ما|التي|الذي|هناك|يلي|بعدة)(\s|$)/;
  var LET_RE = new RegExp("^([أابتثجحخدذرزسشصضطظعغفقكلمنهوي]|[a-hA-H])\\s*[-–)]\\s+(?=\\S)");
  var CALL = [
    [new RegExp("^((ملاحظة|ملاحظه|ملاحظات|ملحوظة)" + END + "|(Note|N\\.B\\.?|NB)\\s*[:：\\-–]|Note that\\s)", "i"), "ملاحظة"],
    [new RegExp("^((هام جداً|هام جدا|مهم جداً|مهم جدا|هام|مهم|انتبه|انتبهوا|تذكر|تذكّر|تذكروا|ركّز|ركز)" + END + "|(Important|Remember|Key point)\\s*[:：\\-–])", "i"), "هام جداً"],
    [new RegExp("^((تعريف)" + END + "|(التعريف|Definition|Def\\.?)\\s*[:：\\-–])", "i"), "تعريف"],
    [new RegExp("^((تحذير|احذر|احذروا|تنبيه)" + END + "|(Warning|Caution|Contraindication)\\s*[:：\\-–])", "i"), "تحذير"],
    [new RegExp("^((حالة سريرية|حالة مرضية|مثال سريري|سيناريو سريري)" + END + "|(Clinical case|Case study|Case)\\s*([\\d٠-٩]+\\s*)?[:：\\-–])", "i"), "حالة سريرية"]
  ];
  var SENT_END = /[.،؛!؟?…]["»”')\]]*$/;
  var MD_RE = /^(#{1,6}\s|\||```|[*+\-•]\s|>\s)/;
  var KINDS = { keep: "بلا تغيير", h1: "عنوان المحاضرة", h2: "عنوان رئيسي", h3: "عنوان فرعي", h4: "عنوان صغير", li: "نقطة", li2: "نقطة فرعية", bold: "تغميق المصطلح",
    note: "ملاحظة", imp: "هام جداً", def: "تعريف", warn: "تحذير", "case": "حالة سريرية", table: "جدول" };
  var BOXES = { note: "ملاحظة", imp: "هام جداً", def: "تعريف", warn: "تحذير", "case": "حالة سريرية" };
  var BOX_BY_LABEL = { "ملاحظة": "note", "هام جداً": "imp", "تعريف": "def", "تحذير": "warn", "حالة سريرية": "case" };

  function words(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
  function isHeadingShape(t) {
    if (!t || t.length > 75 || words(t) > 10 || words(t) < 1 || /^#/.test(t)) return false;
    if (SENT_END.test(t)) return false;
    if (/[:：]\s*\S/.test(t)) return false; // «مصطلح: شرح» ليست عنواناً
    if (!new RegExp("[" + AR + "A-Za-z]").test(t)) return false;
    if (/^\(|^\[|^[\d٠-٩.,%\s]+$/.test(t)) return false;
    if (/^(بسم الله|السلام عليكم|الحمد لله|صباح الخير|مساء الخير)/.test(t)) return false;
    if (/^(slide|page|p\.|صفحة|الصفحة|شريحة|الشريحة|سلايد)\s*[\d٠-٩]+(\s*(of|من|\/)\s*[\d٠-٩]+)?$|[–\-|]\s*(page|صفحة)\s*[\d٠-٩]+$/i.test(t)) return false;
    return true;
  }
  var RUN_RE = /^([Ø§o])[ \t\u00A0]+(?=\S)/; // رموز لها معنى أحياناً (Ø = قطر): نقطة فقط إذا تكررت بسطرين متتاليين أو أكثر
  function stripBullet(t, run) { var m = BUL_RE.exec(t) || (run ? RUN_RE.exec(t) : null); return m ? { glyph: m[1], rest: t.slice(m[0].length) } : null; }
  function boxOf(t) { for (var i = 0; i < CALL.length; i++) if (CALL[i][0].test(t)) return BOX_BY_LABEL[CALL[i][1]]; return null; }
  function boldTerm(t) {
    if (/\*\*|`/.test(t)) return t;
    var nm = /^([\d٠-٩]{1,2}[.)]\s+)(?=\S)/.exec(t); if (nm) { var rb = boldTerm(t.slice(nm[0].length)); return rb === t.slice(nm[0].length) ? t : nm[0] + rb; }
    var m = /^([^:：]{2,45}?|[سجQA])(\s*[:：])\s+(?=\S)/.exec(t);
    if (!m) return t;
    var term = m[1].trim();
    if (VERBY.test(term)) return t;
    if (/^\s/.test(t)) return t;
    if (words(term) > 6 || !new RegExp("[" + AR + "A-Za-z]").test(term) || /^(https?|www|ftp)$/i.test(term) || /[.،؛!؟?]$/.test(term)) return t;
    if (/^[\d٠-٩\s]+$/.test(term)) return t;
    return "**" + m[1] + m[2] + "** " + t.slice(m[0].length);
  }
  // يبني السطر الناتج حسب النوع المختار (يُستخدم أيضاً عند تعديل المستخدم للنوع)
  function render(raw, kind, o) {
    o = o || {};
    var t = raw.trim(), b = stripBullet(t, o.run), body = b ? b.rest : t;
    if (!kind || kind === "keep" || kind === "para" || kind === "table" || kind === "inTable" || !KINDS[kind]) return raw;
    if (/^h[1-4]$/.test(kind)) return "#".repeat(+kind.charAt(1)) + " " + body;
    var text = o.bold === false ? body : boldTerm(body), mk = BOXES[kind] ? "{{" + BOXES[kind] + "}} " : "";
    var asLi = kind === "li" || kind === "li2" || !!b, lvl2 = kind === "li2" || (kind !== "li" && !!o.li2);
    if (asLi) return (lvl2 ? "  " : "") + "* " + mk + text; // سطر برمز نقطة يبقى نقطة دائماً
    return mk + text;
  }
  // السطر «المتوقَّع» لمقارنة الكلمات: رمز النقطة في أول السطر يُعامل كنقطة حقيقية فقط إذا تحوّل السطر فعلاً
  function expectedLine(raw, converted, run) { if (!converted) return raw; var t = raw.trim(), b = stripBullet(t, run); return b ? "* " + b.rest : raw; }
  function sameSeq(a, c) { if (a.length !== c.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== c[i]) return false; return true; }
  function sameWords(rawLine, outLine, run) { // الكلمات نفسها وبنفس الترتيب؟ (بلا المحرك = لا نخاطر)
    var E = window.ENGINE; if (!E || !E.inputTokens) return false;
    return sameSeq(E.inputTokens(expectedLine(rawLine, outLine !== rawLine, run)), E.inputTokens(outLine));
  }
  function cellsRaw(l) { return l.replace(/^[\t ]+|[\t ]+$/g, "").split("\t").map(function (c) { return c.trim(); }); }
  function isRow(l) { if (!l || !l.trim() || l.indexOf("\t") < 0 || /\||\{\{|^\s*```/.test(l)) return false; return cellsRaw(l).filter(Boolean).length >= 2; }
  function tableBlock(lines, i) { // أسطر متتالية فيها خليتان أو أكثر مفصولة بـ Tab
    if (!isRow(lines[i])) return 0; var j = i; while (j < lines.length && isRow(lines[j])) j++; return j - i >= 2 ? j - i : 0;
  }
  function cellsOf(l, n) { var c = cellsRaw(l).map(function (x) { return x.replace(/\|/g, "\\|") || " "; }); while (c.length < n) c.push(" "); return c; }

  /* التحليل: يرجع اقتراحاً لكل سطر */
  function analyze(text, opt) {
    opt = Object.assign({ headings: true, bullets: true, tables: true, boxes: true, bold: true, title: true }, opt || {});
    var lines = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    var n = lines.length, nonBlank = 0, md = 0, fence = false, hasH = false;
    lines.forEach(function (l) { var t = l.trim(); if (!t) return; nonBlank++; if (/^```/.test(t)) fence = !fence; if (fence || MD_RE.test(t) && !/^[*\-•]\s/.test(t)) md++; if (/^#{1,6}\s/.test(t)) hasH = true; });
    var already = hasH || (nonBlank > 0 && md / nonBlank > 0.25);
    var S = lines.map(function (l) { return { raw: l, kind: "keep", why: "" }; });
    fence = false;
    function prevNB(i) { for (var k = i - 1; k >= 0; k--) if (lines[k].trim()) return k; return -1; }
    function nextNB(i) { for (var k = i + 1; k < n; k++) if (lines[k].trim()) return k; return -1; }
    function firstDotMajor(ix) { for (var q = ix + 1; q < n; q++) { var lq = lines[q].trim(), mq = /^([\d٠-٩]{1,2})\.[\d٠-٩]{1,2}\.?\s+\S/.exec(lq); if (mq) return mq[1]; if (/^[\d٠-٩]{1,2}\.\s+\S/.test(lq) && words(lq) <= 8 && !SENT_END.test(lq)) return null; } return null; }
    var dotCount = {}, topNums = {}; lines.forEach(function (l) { var m = /^\s*([\d٠-٩]{1,2})\.[\d٠-٩]{1,2}\.?\s+\S/.exec(l); if (m) dotCount[m[1]] = (dotCount[m[1]] || 0) + 1; m = /^\s*([\d٠-٩]{1,2})\.\s+\S/.exec(l); if (m) topNums[m[1]] = 1; });
    var dotParents = {}; lines.forEach(function (l) { var m = /^\s*([\d٠-٩]{1,2})\.[\d٠-٩]{1,2}\.?\s+\S/.exec(l); if (m) dotParents[m[1]] = 1; });
    var used = { ord: 0, num: 0, gen: 0, let: 0, lec: 0 }, pendBox = null;
    var longL = 0, longP = 0; lines.forEach(function (l) { var t = l.trim(); if (words(t) >= 8) { longL++; if (SENT_END.test(t)) longP++; } });
    var lowPunct = longL >= 5 && longP / longL < 0.25;
    function isItem(s) { return NUM_RE.test(s) || LET_RE.test(s); }
    function vis(s) { return String(s || "").replace(/\{\{[^}]*\}\}\s*/g, "").replace(/\*\*/g, "").replace(/^#{1,6}\s+|^\*\s+/, ""); }
    for (var i = 0; i < n; i++) {
      var l = lines[i], t = l.trim();
      if (/^```/.test(t)) { fence = !fence; continue; }
      if (fence || !t) continue;
      if ((MD_RE.test(t) && (already || !/^[\-•]\s/.test(t))) || /^إليك التفريغ|^💡/.test(t) || /\{\{[^}]+\}\}|\[(هام جداً|تعريف|تحذير|حالة سريرية|ملاحظة)\]/.test(t)) continue;
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) continue;
      // جداول
      if (opt.tables) { var tb = tableBlock(lines, i); if (tb) { S[i].kind = "table"; S[i].span = tb; S[i].why = "أسطر مفصولة بـ Tab"; for (var k = 1; k < tb; k++) S[i + k].kind = "inTable"; i += tb - 1; continue; } }
      var indent = (l.match(/^[ \t\u00A0]*/)[0].replace(/\t/g, "    ")).length;
      var runG = RUN_RE.exec(t), isRun = !!runG && [i - 1, i + 1].some(function (q) { var m2 = q >= 0 && q < n && RUN_RE.exec(lines[q].trim()); return m2 && m2[1] === runG[1]; });
      if (isRun) S[i].run = true;
      var b = stripBullet(t, isRun), body = b ? b.rest : t, box = opt.boxes ? boxOf(body) : null;
      if (b && opt.bullets) {
        if (box && LABEL_ONLY_RE.test(body)) { pendBox = box; box = null; } else { if (!box && pendBox) box = pendBox; pendBox = null; }
        var lvl2 = BUL2.indexOf(b.glyph) >= 0 || indent >= 2;
        S[i].kind = box ? box : lvl2 ? "li2" : "li"; S[i].li2 = lvl2; S[i].why = box ? "نقطة تبدأ بـ «" + body.split(/\s/)[0] + "»" : "تبدأ برمز نقطة «" + b.glyph + "»"; continue;
      }
      if (b) continue;
      if (box && LABEL_ONLY_RE.test(body)) { pendBox = box; S[i].kind = "para"; S[i].label = true; continue; } // «تعريف:» وحدها → الصندوق للسطر التالي
      if (pendBox && S[i].kind === "keep") { S[i].kind = pendBox; pendBox = null; S[i].why = "يلي سطر عنوان الصندوق"; continue; }
      pendBox = null;
      var nB = nextNB(i), nL = nB >= 0 ? vis(lines[nB].trim()) : "";
      if (box === "def" && /^تعريف\s/.test(t) && !already && opt.headings && isHeadingShape(t) && !new RegExp("^\\S+(\\s+جداً?|\\s+سريرية|\\s+صغيرة)?\\s*[:：\\-–]").test(t) && words(t) <= 6 && nL.length > t.length * 1.4) { // «تعريف الأنسولين» / «Warning signs of …» = عنوان
        S[i].kind = "gen"; S[i].why = "عنوان يبدأ بكلمة صندوق"; used.gen++; if (box === "def" || box === "case") pendBox = box; continue; }
      if (box) { S[i].kind = box; S[i].why = "تبدأ بـ «" + body.split(/[\s:：]/)[0] + "»"; continue; }
      if (!opt.headings || already) { S[i].kind = "para"; continue; }
      var pi = prevNB(i), ni = nextNB(i), blankBefore = i === 0 || !lines[i - 1].trim() || SENT_END.test(lines[i - 1].trim()), nextLine = ni >= 0 ? vis(lines[ni].trim()) : "";
      if (LEC_RE.test(t) && t.length <= 90 && !SENT_END.test(t) && words(t) <= 12 && (/[:：\-–—]/.test(t) || words(t) <= 6)) { S[i].kind = "h1"; S[i].why = "سطر «المحاضرة…»"; used.lec++; continue; }
      if (ORD_RE.test(t) && (ORD_SEP_RE.test(t) ? (isHeadingShape(t) || t.length <= 90 && !SENT_END.test(t) && !/[:：]\s*\S{1,}\s+\S+\s+\S+\s+\S+/.test(t)) : (isHeadingShape(t) && words(t) <= 6 && !/^(أخيرا|ختاما)/.test(t)))) { S[i].kind = "ord"; S[i].why = "يبدأ بـ «" + t.split(/[\s:：]/)[0] + "»"; used.ord++; continue; }
      if (SEC_RE.test(t) && (isHeadingShape(t) || t.length <= 90 && !SENT_END.test(t) && words(t) <= 10)) { S[i].kind = "ord"; S[i].why = "يبدأ بـ «" + t.split(/\s/)[0] + "»"; used.ord++; continue; }
      var DOT = /^([\d٠-٩]{1,2})((?:\.[\d٠-٩]{1,2})+)\.?\s+(?=\S)/.exec(t), TOPN = /^([\d٠-٩]{1,2})\.\s+(?=\S)/.exec(t);
      if (DOT && isHeadingShape(t) && words(t) <= 9 && (dotCount[DOT[1]] >= 2 || topNums[DOT[1]]) && new RegExp("^[" + AR + "A-Za-z(]").test(t.slice(DOT[0].length))) { S[i].kind = "num"; S[i].depth = DOT[2].split(".").length; S[i].why = "ترقيم متعدد المستويات «" + DOT[0].trim() + "»"; used.num++; continue; }
      if (TOPN && isHeadingShape(t) && words(t) <= 8 && firstDotMajor(i) === TOPN[1]) { S[i].kind = "num"; S[i].depth = 1; S[i].why = "رقم قسم له فروع «" + TOPN[1] + ".1»"; used.num++; continue; }
      var prevT = pi >= 0 ? lines[pi].trim() : "", listCtx = (NUM_RE.test(t) && (NUM_RE.test(nextLine) || NUM_RE.test(prevT) && S[pi].kind === "para")) || (LET_RE.test(t) && LET_RE.test(prevT) && S[pi].kind === "para") || (LET_RE.test(t) && LET_RE.test(nextLine)) || /[:：]$/.test(prevT) && isItem(t) && !SENT_END.test(prevT);
      if (NUM_RE.test(t) && isHeadingShape(t) && ni >= 0 && !listCtx && words(t) <= 6 && (nextLine.length > t.length || stripBullet(nextLine))) { S[i].kind = "num"; S[i].why = "عنوان مرقّم قصير"; used.num++; continue; }
      if (LET_RE.test(t) && isHeadingShape(t) && ni >= 0 && !listCtx && words(t) <= 6 && (nextLine.length > t.length || stripBullet(nextLine))) { S[i].kind = "let"; S[i].why = "عنوان بحرف ترقيم"; used.let++; continue; }
      var realBlank = i === 0 || !lines[i - 1].trim(), shortNext = isHeadingShape(nextLine) && ni === i + 1;
      var hardBreak = pi < 0 || realBlank || (SENT_END.test(prevT) || !isHeadingShape(prevT)) && !/[:：]$/.test(prevT) && /^(para|bold|keep|li|li2|table|inTable|note|imp|def|warn|case)$/.test(S[pi].kind);
      var ppi = pi >= 0 ? prevNB(pi) : -1, listTail = pi >= 0 && ppi >= 0 && pi === i - 1 && ppi === pi - 1 && S[pi].kind === "para" && S[ppi].kind === "para" && isHeadingShape(prevT) && isHeadingShape(lines[ppi].trim());
      var colonIntro = /[:：]$/.test(t) && (/^و/.test(t) || /^(يتميز|تتميز|يمتاز|تمتاز|نسمع|نلاحظ|نميز|يمر|تمر|يحدث|تحدث|يعتمد|تعتمد|نستخدم|يستخدم|تستخدم|يشمل|تشمل|نذكر|منها|ومنها)(\s|:)/.test(t) || /(^|\s)(بعدة|عدة|التالية|الآتية|كالتالي|كالآتي)(\s|:|$)/.test(t)) || /[:：]$/.test(t) && pi >= 0 && /^(gen|ord|num|let|h1)$/.test(S[pi].kind) || DIALECT.test(t) || /[:：]$/.test(t) && words(t) > 4 && (FUNCW.test(t) || VERBY.test(t));
      var nextIsList = ni === i + 1 && isHeadingShape(nextLine) && !isItem(nextLine) && lines[i + 2] !== undefined && isHeadingShape(lines[i + 2].trim());
      var prevBreaks = pi < 0 || realBlank || SENT_END.test(prevT) && !/[:：]$/.test(prevT) || !isHeadingShape(prevT) && !/[:：]$/.test(prevT) || S[pi].kind !== "para" && S[pi].kind !== "bold";
      var n2 = ni >= 0 ? nextNB(ni) : -1, stacked = realBlank && ni === i + 1 && words(t) <= 7 && !/[:：]$/.test(t) && isHeadingShape(nextLine) && !isItem(nextLine) && !boxOf(nextLine) && words(nextLine) <= 6 && n2 === ni + 1 && (words(lines[n2].trim()) >= 8 || !!stripBullet(lines[n2].trim()));
      if (!colonIntro && isHeadingShape(t) && !NUM_RE.test(t) && ni >= 0 && (stacked ||
          (S[pi] && S[pi].kind === "gen" && pi === i - 1 && words(t) <= 5 && !/[,،]/.test(t) && !/^(Dr\.?|د\.|الدكتور|أ\.د)/i.test(t) && words(nextLine) >= 8) ||
          (prevBreaks && (nextLine.length > t.length * 1.4 || stripBullet(nextLine) || /[:：]$/.test(t))) ||
          (realBlank && ni === i + 1 && words(t) <= 7 && NUM_RE.test(nextLine) && lines[i + 2] !== undefined && NUM_RE.test(lines[i + 2].trim())) ||
          (realBlank && ni === i + 1 && words(t) <= 8 && nextLine.length > t.length) ||
          (hardBreak && words(t) <= 5 && nextIsList) ||
          (lowPunct && words(t) <= 5 && nextLine.length >= t.length * 2 && words(nextLine) >= 6 && !boxOf(nextLine) && !listTail) ||
          (LEX.test(t.replace(/[:：]\s*$/, '')) && !/[:：]$/.test(prevT)))) {
        // سلسلة أسطر قصيرة متتالية بلا فراغ = قائمة وليست عناوين
        var runShort = !stacked && !(S[pi] && S[pi].kind === "gen" && words(nextLine) >= 8) && (pi >= 0 && pi === i - 1 && isHeadingShape(lines[pi].trim())) && (ni === i + 1 && isHeadingShape(nextLine));
        if (!runShort) { S[i].kind = "gen"; S[i].why = "سطر قصير بلا نقطة يليه شرح"; used.gen++; continue; }
      }
      S[i].kind = opt.bold && boldTerm(t) !== t ? "bold" : "para";
    }
    function wrapped(r) { if (r.length < 2) return false; var L = r.slice(0, -1).map(function (k) { return lines[k].trim().length; }); return Math.min.apply(null, L) >= 40 && Math.max.apply(null, L) - Math.min.apply(null, L) <= 10; }
    if (opt.bullets) for (i = 0; i < n; i++) { var ti = lines[i].trim();
      if (!/[:：]$/.test(ti) || !/^(para|keep|bold)$/.test(S[i].kind) || words(ti) < 2) continue;
      var j = i + 1, run = [];
      while (j < n && lines[j].trim() && S[j].kind === "para" && words(lines[j]) <= 12 && lines[j].trim().length <= 70 && !SENT_END.test(lines[j].trim()) && !/^و/.test(lines[j].trim()) && !/[:：]/.test(lines[j]) && !isItem(lines[j].trim()) && !boxOf(lines[j].trim())) { run.push(j); j++; }
      if (run.length >= 2 && (j >= n || !lines[j].trim() || /^و/.test(lines[j].trim()) || S[j].kind !== "para" || SENT_END.test(lines[j].trim()) && words(lines[j]) >= 8) && !wrapped(run)) run.forEach(function (k) { S[k].kind = "li"; S[k].why = "عنصر قائمة بعد سطر ينتهي بـ «:»"; });
    }
    // عنوان المحاضرة: أول سطر إذا كان قصيراً ولا يوجد سطر «المحاضرة…»
    var first = -1; for (i = 0; i < n; i++) if (S[i].raw.trim()) { first = i; break; }
    var fT = first >= 0 ? lines[first].trim() : "", titleOK = first >= 0 && !S[first].label && !LABEL_ONLY_RE.test(fT) && !isItem(fT) && !BOXES[S[first].kind] && words(fT) <= 10 && fT.length <= 90 && !SENT_END.test(fT) && !/^(بسم الله|د\.|Dr\.?\s|الدكتور|أ\.د)/i.test(fT) && (isHeadingShape(fT) || /^[^:：]{3,60}[:：]\s*[^:：]{3,60}$/.test(fT));
    var sub = nextNB(first), subOK = titleOK && sub === first + 1 && words(lines[sub]) <= 10 && !SENT_END.test(lines[sub].trim()) && (sub + 1 >= n || !lines[sub + 1].trim());
    if (opt.title && opt.headings && !already && titleOK && /^(para|keep|bold|gen)$/.test(S[first].kind) && (used.lec || subOK || first + 1 >= n || !lines[first + 1].trim())) {
      for (i = first + 1; i < Math.min(n, first + 4); i++) if (S[i].kind === "h1") { S[i].kind = "para"; S[i].why = ""; used.lec--; }
      if (!used.lec) { S[first].kind = "gen"; used.gen++; if (subOK && S[sub].kind !== "para") S[sub].kind = "para"; }
    }
    var titleBlank = first >= 0 && !S[first].label && !isItem(fT) && (first + 1 >= n || !lines[first + 1].trim()) && isHeadingShape(S[first].raw.trim()) && (S[first].kind === "para" || S[first].kind === "keep");
    if (opt.title && opt.headings && !already && !used.lec && first >= 0 && (titleBlank || S[first].kind === "gen" || S[first].kind === "ord" && used.ord === 1 || S[first].kind === "num" && used.num === 1 && !NUM_RE.test(fT))) { S[first].kind = "h1"; S[first].why = "أول سطر قصير = عنوان المحاضرة"; }
    // المستويات: العناوين العامة المتتالية إخوة (نفس المستوى)، «أولاً» = 2، العام تحت «أولاً» = 3، الرقم تحت آخر عنوان، الحرف تحت الرقم
    var lastSub = false; function nextHeadLex(ix) { for (var q = ix + 1; q < n; q++) { var kq = S[q].kind; if (kq === "gen") return SUBLEX.test(S[q].raw.trim().replace(/[:：]\s*$/, "")); if (/^(ord|num|let|h1)$/.test(kq)) return false; } return false; }
    var cur = { ord: 0, num: 0, gen: 0, top: 0 }, lastK = "", lastIdx = -1, lastLv = 0; S.forEach(function (x, idx) { x.i0 = idx; });
    S.forEach(function (x) {
      var k = x.kind, lv = 0;
      if (k === "h1") { cur = { ord: 0, num: 0, gen: 0, top: 0 }; return; }
      if (k !== "ord" && k !== "num" && k !== "let" && k !== "gen") { if (k !== "keep" && k !== "para" || x.raw.trim()) { if (x.raw.trim()) lastK = ""; } return; }
      if (k === "ord") { lv = 2; cur = { ord: 2, num: 0, gen: 0 }; }
      else if (k === "num" && x.depth) { lv = Math.min(4, 1 + x.depth); cur = { ord: 0, num: lv, numDepth: 1, gen: 0, top: 0 }; }
      else if (k === "num") { lv = cur.gen ? cur.gen + 1 : cur.ord ? 3 : 2; cur.num = lv; }
      else if (k === "let") lv = cur.num ? cur.num + 1 : (cur.gen || cur.ord || 1) + 1;
      else if (k === "gen") {
        var tt = x.raw.trim().replace(/[:：]\s*$/, ""), lex = SUBLEX.test(tt), prevH = lastK === "gen" && lastIdx === prevNB(x.i0);
        var nx = nextNB(x.i0), isParent = nx >= 0 && /^(gen|num|let)$/.test(S[nx].kind) && nx === x.i0 + 1;
        var base = cur.ord ? 3 : cur.num && cur.numDepth ? cur.num + 1 : 2;
        if (prevH) lv = Math.min(4, lastLv + 1);
        else if (lex && cur.top && (lastSub || nextHeadLex(x.i0))) lv = Math.min(4, cur.top + 1);
        else if (isParent) lv = base;
        else lv = cur.top || cur.gen || base;
        if (isParent || !LEX.test(tt) && !prevH && !cur.top) cur.top = lv;
        lastSub = lex && cur.top && lv === cur.top + 1; cur.gen = lv; }
      else return;
      x.kind = "h" + Math.min(4, lv); lastK = k; lastIdx = x.i0; lastLv = lv;
    });
    S.forEach(function (x, idx) {
      if (x.kind === "para" || x.kind === "inTable") x.final = x.kind === "para" ? "keep" : "inTable"; else x.final = x.kind;
      x.i = idx;
    });
    return { lines: S, already: already, opt: opt };
  }
  function lineOut(x, kind, opt) {
    if (kind === "keep" || kind === "para") return x.raw;
    var r = render(x.raw, kind, { bold: opt.bold, li2: x.li2, run: x.run });
    if (r !== x.raw && !sameWords(x.raw, r, x.run)) r = render(x.raw, kind, { bold: false, li2: x.li2, run: x.run }); // التغميق غيّر شيئاً؟ نجرب بدونه
    return r;
  }
  // يبني النص النهائي من التحليل (مع اختيارات المستخدم overrides[i] = نوع)
  function compose(A, overrides) {
    overrides = overrides || {};
    var L = A.lines, out = [], exp = [], stats = { h: 0, li: 0, table: 0, box: 0, bold: 0, reverted: 0 }, changed = [], E = window.ENGINE;
    for (var i = 0; i < L.length; i++) {
      var x = L[i], k;
      if (x.kind === "inTable") continue;
      if (x.final === "table") {
        var rawRows = L.slice(i, i + x.span).map(function (y) { return y.raw; });
        if (overrides[i] === "keep" || !E) { out = out.concat(rawRows); exp = exp.concat(rawRows); continue; }
        var rows = rawRows.map(cellsRaw), nc = Math.max.apply(null, rows.map(function (r) { return r.length; }));
        rows = rawRows.map(function (r) { return cellsOf(r, nc); });
        var md = ["| " + rows[0].join(" | ") + " |", "|" + rows[0].map(function () { return " --- "; }).join("|") + "|"].concat(rows.slice(1).map(function (r) { return "| " + r.join(" | ") + " |"; }));
        var rawExp = rawRows.map(function (r) { return r.replace(/\t/g, " "); });
        if (!sameSeq(E.inputTokens(rawExp.join("\n")), E.inputTokens(md.join("\n")))) { stats.reverted++; out = out.concat(rawRows); exp = exp.concat(rawRows); continue; }
        if (out.length && out[out.length - 1].trim()) { out.push(""); exp.push(""); }
        out = out.concat(md); exp = exp.concat(rawExp);
        if (L[i + x.span] && L[i + x.span].raw.trim()) { out.push(""); exp.push(""); }
        stats.table++; changed.push({ i: i, kind: "table", span: x.span, why: x.why, raw: x.raw }); continue;
      }
      var kind = overrides[i] || x.final; if (kind === "table" || !KINDS[kind]) kind = "keep";
      var o = lineOut(x, kind, A.opt);
      if (o !== x.raw && !sameWords(x.raw, o, x.run)) { stats.reverted++; o = x.raw; kind = "keep"; }
      var conv = o !== x.raw;
      if (conv) {
        if (kind.charAt(0) === "h") { stats.h++; if (out.length && out[out.length - 1].trim()) { out.push(""); exp.push(""); } }
        else if (BOXES[kind]) stats.box++; else if (kind !== "bold") stats.li++;
        if (/\*\*/.test(o) && !/\*\*/.test(x.raw)) stats.bold++;
        changed.push({ i: i, kind: kind, why: x.why, raw: x.raw, out: o });
      }
      out.push(o); exp.push(expectedLine(x.raw, conv, x.run));
      if (conv && kind.charAt(0) === "h" && L[i + 1] && L[i + 1].raw.trim()) { out.push(""); exp.push(""); }
    }
    // تحقق نهائي على النص كاملاً: نفس الكلمات وبنفس الترتيب
    var text = out.join("\n"), ok = false, diff = { inCount: 0, missing: [], extra: [], ok: false };
    if (E && E.inputTokens) {
      var a = E.inputTokens(exp.join("\n")), c = E.inputTokens(text);
      diff = E.compare(a, c); diff.inCount = a.length; ok = diff.ok && sameSeq(a, c); diff.ok = ok;
    }
    stats.diff = diff;
    return { text: text, stats: stats, changed: changed, ok: ok };
  }
  function format(text, opt) { var A = analyze(text, opt), r = compose(A); r.analysis = A; return r; }
  return { analyze: analyze, compose: compose, format: format, render: render, KINDS: KINDS };
})();
