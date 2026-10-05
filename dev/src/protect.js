/* Random.MEd — حماية الملفات بدون مكتبات:
   1) Word: كلمة سر للفتح بتشفير Office القياسي (ECMA-376 Agile: AES-256 + SHA-512) داخل حاوية OLE/CFB — نفس ما يعمله Word عند «تشفير بكلمة مرور».
   2) PDF: معالج الأمان القياسي AES-256 (الإصدار R6): كلمة سر للفتح + منع الطباعة/النسخ/التعديل بكلمة سر المالك. */
var RMED_PROTECT = (function () {
  "use strict";
  var subtle = (window.crypto || {}).subtle;
  function rnd(n) { var a = new Uint8Array(n); window.crypto.getRandomValues(a); return a; }
  function cat() { var n = 0, i, o, p = 0; for (i = 0; i < arguments.length; i++) n += arguments[i].length; o = new Uint8Array(n); for (i = 0; i < arguments.length; i++) { o.set(arguments[i], p); p += arguments[i].length; } return o; }
  function le32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
  function utf16(s) { var o = new Uint8Array(s.length * 2); for (var i = 0; i < s.length; i++) { o[i * 2] = s.charCodeAt(i) & 255; o[i * 2 + 1] = s.charCodeAt(i) >> 8; } return o; }
  function b64(u) { var s = ""; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function hex(u) { var s = ""; for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16); return s.toUpperCase(); }

  /* ---------- SHA-512 متزامن (لـ 100000 تكرار بسرعة) ---------- */
  var K512 = (function () {
    var h = ["428a2f98d728ae22", "7137449123ef65cd", "b5c0fbcfec4d3b2f", "e9b5dba58189dbbc", "3956c25bf348b538", "59f111f1b605d019", "923f82a4af194f9b", "ab1c5ed5da6d8118", "d807aa98a3030242", "12835b0145706fbe", "243185be4ee4b28c", "550c7dc3d5ffb4e2", "72be5d74f27b896f", "80deb1fe3b1696b1", "9bdc06a725c71235", "c19bf174cf692694", "e49b69c19ef14ad2", "efbe4786384f25e3", "0fc19dc68b8cd5b5", "240ca1cc77ac9c65", "2de92c6f592b0275", "4a7484aa6ea6e483", "5cb0a9dcbd41fbd4", "76f988da831153b5", "983e5152ee66dfab", "a831c66d2db43210", "b00327c898fb213f", "bf597fc7beef0ee4", "c6e00bf33da88fc2", "d5a79147930aa725", "06ca6351e003826f", "142929670a0e6e70", "27b70a8546d22ffc", "2e1b21385c26c926", "4d2c6dfc5ac42aed", "53380d139d95b3df", "650a73548baf63de", "766a0abb3c77b2a8", "81c2c92e47edaee6", "92722c851482353b", "a2bfe8a14cf10364", "a81a664bbc423001", "c24b8b70d0f89791", "c76c51a30654be30", "d192e819d6ef5218", "d69906245565a910", "f40e35855771202a", "106aa07032bbd1b8", "19a4c116b8d2d0c8", "1e376c085141ab53", "2748774cdf8eeb99", "34b0bcb5e19b48a8", "391c0cb3c5c95a63", "4ed8aa4ae3418acb", "5b9cca4f7763e373", "682e6ff3d6b2b8a3", "748f82ee5defb2fc", "78a5636f43172f60", "84c87814a1f0ab72", "8cc702081a6439ec", "90befffa23631e28", "a4506cebde82bde9", "bef9a3f7b2c67915", "c67178f2e372532b", "ca273eceea26619c", "d186b8c721c0c207", "eada7dd6cde0eb1e", "f57d4f7fee6ed178", "06f067aa72176fba", "0a637dc5a2c898a6", "113f9804bef90dae", "1b710b35131c471b", "28db77f523047d84", "32caab7b40c72493", "3c9ebe0a15c9bebc", "431d67c49c100d4c", "4cc5d4becb3e42b6", "597f299cfc657e2a", "5fcb6fab3ad6faec", "6c44198c4a475817"];
    var o = new Int32Array(160); h.forEach(function (x, i) { o[i * 2] = parseInt(x.slice(0, 8), 16) | 0; o[i * 2 + 1] = parseInt(x.slice(8), 16) | 0; }); return o;
  })();
  var IV512 = [0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179];
  var W = new Int32Array(160), MB = new Uint8Array(256), HB = new Int32Array(16);
  function sha512(msg) {
    var l = msg.length, nb = ((l + 17 + 127) >> 7) << 7, m = nb <= 256 ? MB : new Uint8Array(nb), H = HB, i, t;
    if (m === MB) m.fill(0, 0, nb); for (i = 0; i < 8; i++) { H[i * 2] = IV512[i * 2]; H[i * 2 + 1] = IV512[i * 2 + 1]; }
    m.set(msg); m[l] = 0x80; var bits = l * 8; m[nb - 4] = (bits >>> 24) & 255; m[nb - 3] = (bits >>> 16) & 255; m[nb - 2] = (bits >>> 8) & 255; m[nb - 1] = bits & 255; m[nb - 5] = Math.floor(l / 0x20000000) & 255;
    for (var off = 0; off < nb; off += 128) {
      for (i = 0; i < 32; i++) { var p = off + i * 4; W[i] = (m[p] << 24) | (m[p + 1] << 16) | (m[p + 2] << 8) | m[p + 3]; }
      for (i = 32; i < 160; i += 2) {
        var xh = W[i - 30], xl = W[i - 29]; // sigma0(W[t-15])
        var s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
        var s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
        xh = W[i - 4]; xl = W[i - 3]; // sigma1(W[t-2])
        var s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
        var s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));
        var lo = (s0l >>> 0) + (s1l >>> 0) + (W[i - 13] >>> 0) + (W[i - 31] >>> 0);
        var hi = s0h + s1h + W[i - 14] + W[i - 32] + ((lo / 4294967296) | 0);
        W[i] = hi | 0; W[i + 1] = lo | 0;
      }
      var ah = H[0], al = H[1], bh = H[2], bl = H[3], ch = H[4], cl = H[5], dh = H[6], dl = H[7], eh = H[8], el = H[9], fh = H[10], fl = H[11], gh = H[12], gl = H[13], hh = H[14], hl = H[15];
      for (i = 0; i < 160; i += 2) {
        var S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
        var S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
        var chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
        var t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512[i + 1] >>> 0) + (W[i + 1] >>> 0);
        var t1h = hh + S1h + chh + K512[i] + W[i] + ((t1l / 4294967296) | 0);
        var S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
        var S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
        var mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
        var t2l = (S0l >>> 0) + (mjl >>> 0), t2h = S0h + mjh + ((t2l / 4294967296) | 0);
        hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
        t = (dl >>> 0) + (t1l >>> 0); eh = (dh + t1h + (t > 0xFFFFFFFF ? 1 : 0)) | 0; el = t | 0;
        dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
        t = (t1l >>> 0) + (t2l >>> 0); ah = (t1h + t2h + (t > 0xFFFFFFFF ? 1 : 0)) | 0; al = t | 0;
      }
      t = (H[1] >>> 0) + (al >>> 0); H[0] = (H[0] + ah + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[1] = t | 0;
      t = (H[3] >>> 0) + (bl >>> 0); H[2] = (H[2] + bh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[3] = t | 0;
      t = (H[5] >>> 0) + (cl >>> 0); H[4] = (H[4] + ch + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[5] = t | 0;
      t = (H[7] >>> 0) + (dl >>> 0); H[6] = (H[6] + dh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[7] = t | 0;
      t = (H[9] >>> 0) + (el >>> 0); H[8] = (H[8] + eh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[9] = t | 0;
      t = (H[11] >>> 0) + (fl >>> 0); H[10] = (H[10] + fh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[11] = t | 0;
      t = (H[13] >>> 0) + (gl >>> 0); H[12] = (H[12] + gh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[13] = t | 0;
      t = (H[15] >>> 0) + (hl >>> 0); H[14] = (H[14] + hh + (t > 0xFFFFFFFF ? 1 : 0)) | 0; H[15] = t | 0;
    }
    var out = new Uint8Array(64); for (i = 0; i < 16; i++) { out[i * 4] = (H[i] >>> 24) & 255; out[i * 4 + 1] = (H[i] >>> 16) & 255; out[i * 4 + 2] = (H[i] >>> 8) & 255; out[i * 4 + 3] = H[i] & 255; }
    return out;
  }

  /* ---------- AES عبر WebCrypto ---------- */
  function aesKey(raw) { return subtle.importKey("raw", raw, { name: "AES-CBC" }, false, ["encrypt"]); }
  // CBC بلا حشو: المدخل مضاعف 16، نحذف كتلة الحشو التي يضيفها WebCrypto (لا تؤثر على ما قبلها)
  function cbcNoPad(key, iv, data) { return subtle.encrypt({ name: "AES-CBC", iv: iv }, key, data).then(function (b) { return new Uint8Array(b, 0, data.length).slice(); }); }
  function cbcPad(key, iv, data) { return subtle.encrypt({ name: "AES-CBC", iv: iv }, key, data).then(function (b) { return new Uint8Array(b); }); }
  function pad16(u) { if (u.length % 16 === 0) return u; var o = new Uint8Array(Math.ceil(u.length / 16) * 16); o.set(u); return o; }

  /* ======================= Word: تشفير Agile ======================= */
  var BK = { vhi: [0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79], vhv: [0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e], key: [0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6], hk: [0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6], hv: [0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33] };
  var SPIN = 100000;
  function pwHash(pw, salt) { var h = sha512(cat(salt, utf16(pw))), buf = new Uint8Array(68); for (var i = 0; i < SPIN; i++) { buf.set(le32(i), 0); buf.set(h, 4); h = sha512(buf); } return h; }
  function encryptDocx(data, password) {
    return Promise.resolve(data instanceof Blob ? data.arrayBuffer() : data).then(function (ab) {
      var pkg = new Uint8Array(ab), secret = rnd(32), kdSalt = rnd(16), pwSalt = rnd(16), vInput = rnd(16), hmacKey = rnd(64);
      var H = pwHash(String(password), pwSalt);
      function dk(b) { return sha512(cat(H, new Uint8Array(b))).slice(0, 32); }
      function ivFor(b) { return sha512(cat(kdSalt, b)).slice(0, 16); }
      return aesKey(secret).then(function (sk) {
        var segs = [], n = Math.ceil(pkg.length / 4096) || 1, chain = Promise.resolve();
        for (var i = 0; i < n; i++) (function (i) { chain = chain.then(function () { return cbcNoPad(sk, ivFor(le32(i)), pad16(pkg.subarray(i * 4096, Math.min(pkg.length, (i + 1) * 4096)))).then(function (c) { segs[i] = c; }); }); })(i);
        return chain.then(function () {
          var size = new Uint8Array(8); size.set(le32(pkg.length)); size.set(le32(Math.floor(pkg.length / 0x100000000)), 4);
          var encPkg = cat.apply(null, [size].concat(segs));
          return subtle.importKey("raw", hmacKey, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]).then(function (hk) { return subtle.sign("HMAC", hk, encPkg); }).then(function (hv) {
            return Promise.all([
              cbcNoPad(sk, ivFor(new Uint8Array(BK.hk)), hmacKey), cbcNoPad(sk, ivFor(new Uint8Array(BK.hv)), new Uint8Array(hv)),
              aesKey(dk(BK.vhi)).then(function (k) { return cbcNoPad(k, pwSalt, vInput); }),
              aesKey(dk(BK.vhv)).then(function (k) { return cbcNoPad(k, pwSalt, sha512(vInput)); }),
              aesKey(dk(BK.key)).then(function (k) { return cbcNoPad(k, pwSalt, secret); })
            ]);
          }).then(function (r) {
            var A = 'saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512"';
            var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password" xmlns:c="http://schemas.microsoft.com/office/2006/keyEncryptor/certificate">' +
              '<keyData ' + A + ' saltValue="' + b64(kdSalt) + '"/><dataIntegrity encryptedHmacKey="' + b64(r[0]) + '" encryptedHmacValue="' + b64(r[1]) + '"/>' +
              '<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password"><p:encryptedKey spinCount="' + SPIN + '" ' + A + ' saltValue="' + b64(pwSalt) + '" encryptedVerifierHashInput="' + b64(r[2]) + '" encryptedVerifierHashValue="' + b64(r[3]) + '" encryptedKeyValue="' + b64(r[4]) + '"/></keyEncryptor></keyEncryptors></encryption>';
            var info = cat(new Uint8Array([4, 0, 4, 0, 0x40, 0, 0, 0]), new TextEncoder().encode(xml));
            return new Blob([cfb(info, encPkg)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          });
        });
      });
    });
  }
  /* ---- حاوية CFB (الإصدار 3، قطاعات 512 بايت) ---- */
  function lp4(s) { var u = utf16(s), o = cat(le32(u.length), u); return o.length % 4 ? cat(o, new Uint8Array(4 - o.length % 4)) : o; }
  function ver() { return new Uint8Array([1, 0, 0, 0]); }
  function dataSpaces() {
    var version = cat(lp4("Microsoft.Container.DataSpaces"), ver(), ver(), ver());
    var entry = cat(le32(1), le32(0), lp4("EncryptedPackage"), lp4("StrongEncryptionDataSpace"));
    var map = cat(le32(8), le32(1), le32(entry.length + 4), entry);
    var dsInfo = cat(le32(8), le32(1), lp4("StrongEncryptionTransform"));
    var tid = lp4("{FF9A3F03-56EF-4613-BDD5-5A41C1D07246}");
    var primary = cat(le32(8 + tid.length), le32(1), tid, lp4("Microsoft.Container.EncryptionTransform"), ver(), ver(), ver(), le32(0), le32(0), le32(0), le32(4));
    return { version: version, map: map, dsInfo: dsInfo, primary: primary };
  }
  function cfb(info, pkg) {
    var ds = dataSpaces(), SEC = 512, ENDC = -2, FATS = -3, DIFS = -4, FREE = -1;
    // الإدخالات: 0 الجذر
    var E = [
      { name: "Root Entry", type: 5 },
      { name: "EncryptionInfo", type: 2, data: info },
      { name: "EncryptedPackage", type: 2, data: pkg },
      { name: "\u0006DataSpaces", type: 1 },
      { name: "Version", type: 2, data: ds.version },
      { name: "DataSpaceMap", type: 2, data: ds.map },
      { name: "DataSpaceInfo", type: 1 },
      { name: "StrongEncryptionDataSpace", type: 2, data: ds.dsInfo },
      { name: "TransformInfo", type: 1 },
      { name: "StrongEncryptionTransform", type: 1 },
      { name: "\u0006Primary", type: 2, data: ds.primary }
    ];
    var kids = { 0: [1, 2, 3], 3: [4, 5, 6, 8], 6: [7], 8: [9], 9: [10] };
    E.forEach(function (e) { e.L = e.R = e.C = -1; e.start = ENDC; e.size = 0; });
    function cmp(a, b) { var x = E[a].name.toUpperCase(), y = E[b].name.toUpperCase(); return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0); }
    Object.keys(kids).forEach(function (p) { // شجرة متوازنة من قائمة مرتبة
      var list = kids[p].slice().sort(cmp);
      function bal(lo, hi) { if (lo > hi) return -1; var mid = (lo + hi) >> 1, n = list[mid]; E[n].L = bal(lo, mid - 1); E[n].R = bal(mid + 1, hi); return n; }
      E[p].C = bal(0, list.length - 1);
    });
    // المجرى الصغير (أقل من 4096 بايت)
    var mini = [], miniFat = [], miniLen = 0;
    E.forEach(function (e) {
      if (e.type !== 2) return; e.size = e.data.length;
      if (e.size < 4096) { var n = Math.ceil(e.size / 64); e.start = n ? miniLen / 64 : ENDC; for (var k = 0; k < n; k++) miniFat.push(k === n - 1 ? ENDC : miniLen / 64 + k + 1); var padded = new Uint8Array(n * 64); padded.set(e.data); mini.push(padded); miniLen += n * 64; e.mini = true; }
    });
    var miniStream = cat.apply(null, mini.length ? mini : [new Uint8Array(0)]);
    var nDir = Math.ceil(E.length * 128 / SEC), nMiniFat = Math.ceil(miniFat.length * 4 / SEC), nMiniS = Math.ceil(miniStream.length / SEC), nPkg = pkg.length >= 4096 ? Math.ceil(pkg.length / SEC) : 0;
    var nData = nDir + nMiniFat + nMiniS + nPkg, nFat = 0, nDifat = 0;
    while (true) { var tot = nData + nFat + nDifat, f = Math.ceil(tot / 128), d = f > 109 ? Math.ceil((f - 109) / 127) : 0; if (f === nFat && d === nDifat) break; nFat = f; nDifat = d; }
    var fat = new Int32Array(nFat * 128).fill(FREE), s = 0;
    function run(n) { var st = s; for (var k = 0; k < n; k++) fat[s + k] = k === n - 1 ? ENDC : s + k + 1; s += n; return n ? st : ENDC; }
    var dirStart = run(nDir), mfStart = run(nMiniFat), msStart = run(nMiniS), pkStart = run(nPkg);
    var fatStart = s; for (var k = 0; k < nFat; k++) fat[s++] = FATS; var difStart = s; for (k = 0; k < nDifat; k++) fat[s++] = DIFS;
    E[0].start = nMiniS ? msStart : ENDC; E[0].size = miniStream.length; if (nPkg) { E[2].start = pkStart; E[2].size = pkg.length; }
    var total = s, out = new Uint8Array(SEC * (1 + total)), dv = new DataView(out.buffer);
    // الترويسة
    out.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], 0);
    dv.setUint16(24, 0x3E, true); dv.setUint16(26, 3, true); dv.setUint16(28, 0xFFFE, true); dv.setUint16(30, 9, true); dv.setUint16(32, 6, true);
    dv.setUint32(44, nFat, true); dv.setInt32(48, dirStart, true); dv.setUint32(56, 4096, true);
    dv.setInt32(60, nMiniFat ? mfStart : ENDC, true); dv.setUint32(64, nMiniFat, true); dv.setInt32(68, nDifat ? difStart : ENDC, true); dv.setUint32(72, nDifat, true);
    for (k = 0; k < 109; k++) dv.setInt32(76 + k * 4, k < nFat ? fatStart + k : FREE, true);
    function so(sec) { return SEC * (1 + sec); }
    // الدليل
    E.forEach(function (e, i) {
      var o = so(dirStart) + i * 128, nm = utf16(e.name); out.set(nm, o); dv.setUint16(o + 64, nm.length + 2, true); out[o + 66] = e.type; out[o + 67] = 1;
      dv.setInt32(o + 68, e.L, true); dv.setInt32(o + 72, e.R, true); dv.setInt32(o + 76, e.C, true); dv.setInt32(o + 116, e.type === 1 ? 0 : e.start, true); dv.setUint32(o + 120, e.type === 1 ? 0 : e.size, true);
    });
    for (k = E.length; k < nDir * 4; k++) { var o2 = so(dirStart) + k * 128; dv.setInt32(o2 + 68, -1, true); dv.setInt32(o2 + 72, -1, true); dv.setInt32(o2 + 76, -1, true); }
    var mf = new Int32Array(nMiniFat * 128).fill(FREE); mf.set(miniFat); for (k = 0; k < mf.length; k++) dv.setInt32(so(mfStart) + k * 4, mf[k], true);
    if (nMiniS) out.set(miniStream, so(msStart)); if (nPkg) out.set(pkg, so(pkStart));
    for (k = 0; k < fat.length; k++) dv.setInt32(so(fatStart) + k * 4, fat[k], true);
    for (var d = 0; d < nDifat; d++) { var base = so(difStart + d); for (k = 0; k < 127; k++) { var idx = 109 + d * 127 + k; dv.setInt32(base + k * 4, idx < nFat ? fatStart + idx : FREE, true); } dv.setInt32(base + 508, d === nDifat - 1 ? ENDC : difStart + d + 1, true); }
    return out;
  }

  /* ======================= PDF: AES-256 (R6) ======================= */
  function shaN(n, d) { return subtle.digest("SHA-" + n, d).then(function (b) { return new Uint8Array(b); }); }
  function hash2B(pw, salt, udata) { // الخوارزمية 2.B من ISO 32000-2
    return shaN(256, cat(pw, salt, udata)).then(function (K) {
      var round = 0;
      function step(K) {
        var unit = cat(pw, K, udata), K1 = new Uint8Array(unit.length * 64); for (var i = 0; i < 64; i++) K1.set(unit, i * unit.length);
        return aesKey(K.slice(0, 16)).then(function (k) { return cbcNoPad(k, K.slice(16, 32), K1); }).then(function (E) {
          var sum = 0; for (var i = 0; i < 16; i++) sum += E[i];
          return shaN([256, 384, 512][sum % 3], E).then(function (K2) { round++; if (round >= 64 && E[E.length - 1] <= round - 32) return K2.slice(0, 32); return step(K2); });
        });
      }
      return step(K);
    });
  }
  function pwBytes(s) { return new TextEncoder().encode(String(s || "").normalize("NFKC")).slice(0, 127); }
  // يرجع: { dict: نص قاموس /Encrypt، enc(bytes)->Promise<Uint8Array> لكل نص/مجرى }
  function pdfSecurity(o) {
    var up = pwBytes(o.userPw), op = pwBytes(o.ownerPw || hex(rnd(16))), fk = rnd(32);
    var P = 0xFFFFF0C0 | 0; // البتات 7،8 و13+ مرفوعة؛ الباقي ممنوع
    if (!o.noPrint) P |= (1 << 2) | (1 << 11);
    if (!o.noCopy) P |= (1 << 4) | (1 << 9);
    var uvs = rnd(8), uks = rnd(8), ovs = rnd(8), oks = rnd(8), zero = new Uint8Array(16);
    return hash2B(up, uvs, new Uint8Array(0)).then(function (h) {
      var U = cat(h, uvs, uks);
      return Promise.all([
        hash2B(up, uks, new Uint8Array(0)).then(function (k) { return aesKey(k); }).then(function (k) { return cbcNoPad(k, zero, fk); }),
        hash2B(op, ovs, U).then(function (h2) { return cat(h2, ovs, oks); }),
        hash2B(op, oks, U).then(function (k) { return aesKey(k); }).then(function (k) { return cbcNoPad(k, zero, fk); }),
        aesKey(fk).then(function (k) { var pr = cat(le32(P), new Uint8Array([255, 255, 255, 255, 0x54, 0x61, 0x64, 0x62]), rnd(4)); return cbcNoPad(k, zero, pr); }),
        aesKey(fk)
      ]).then(function (r) {
        var key = r[4];
        return {
          dict: "<< /Filter /Standard /V 5 /R 6 /Length 256 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV3 /Length 32 >> >> /StmF /StdCF /StrF /StdCF /O <" + hex(r[1]) + "> /U <" + hex(U) + "> /OE <" + hex(r[2]) + "> /UE <" + hex(r[0]) + "> /P " + P + " /Perms <" + hex(r[3]) + "> /EncryptMetadata true >>",
          enc: function (bytes) { var iv = rnd(16); return cbcPad(key, iv, bytes).then(function (c) { return cat(iv, c); }); },
          hex: hex
        };
      });
    });
  }
  return { encryptDocx: encryptDocx, pdfSecurity: pdfSecurity, sha512: sha512, _cfb: cfb };
})();
