/**
 * 与 api/*.html 共用。
 * v1–v3=AES-GCM（含 16B 认证标签，旧链）；v4=AES-CTR+类型字节（无标签，更短；可被篡改比特，仅增「偷看」成本）。
 * 口令仍在脚本内，对能读源码的人并非保密；「不可逆」仅对不掌握口令与实现的人成立。
 */
(function (global) {
	"use strict";

	// ==================== 只需改这一处：自有长随机口令，≥16 字符，勿用占位串 ====================
	var FANG_CRYPTO_PASSPHRASE = "jkfhsdkfdfjk57345kfdslfdfldjldsdldjfldjfld";
	// =============================================================================

	/**
	 * 若目标多为同一站点，在此列出要从 URL 开头剥掉的前缀（长串在前），可显著缩短密文。
	 * 例：["https://www.baidu.com", "https://m.baidu.com"]
	 */
	var FANG_STRIP_PREFIXES = [];

	var FULL_URL_FLAG = 254;

	function assertPassphraseConfigured() {
		var p = FANG_CRYPTO_PASSPHRASE;
		var UNSET_PLACEHOLDER = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_MIN_16_CHARS";
		if (!p || typeof p !== "string" || p.length < 16 || p === UNSET_PLACEHOLDER) {
			throw new Error("请在 redirect-crypto.js 中设置 FANG_CRYPTO_PASSPHRASE 为自有长随机口令（替换占位字符串）");
		}
	}

	function b64urlFromBytes(bytes) {
		var bin = "";
		for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
		var b64 = btoa(bin);
		return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
	}

	function bytesFromB64url(s) {
		s = s.replace(/-/g, "+").replace(/_/g, "/");
		while (s.length % 4) s += "=";
		var bin = atob(s);
		var out = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	}

	function concat2(a, b) {
		var o = new Uint8Array(a.length + b.length);
		o.set(a, 0);
		o.set(b, a.length);
		return o;
	}

	/** @returns {Uint8Array} 首字节：0–253 表前缀下标，254=完整 URL */
	function packUrl(url) {
		var te = new TextEncoder();
		var prefs = FANG_STRIP_PREFIXES.slice().sort(function (a, b) {
			return b.length - a.length;
		});
		for (var i = 0; i < prefs.length && i < 254; i++) {
			var p = prefs[i];
			if (p && url.indexOf(p) === 0) {
				var rest = url.slice(p.length);
				return concat2(new Uint8Array([i]), te.encode(rest));
			}
		}
		var full = te.encode(url);
		return concat2(new Uint8Array([FULL_URL_FLAG]), full);
	}

	function unpackUrl(packed) {
		if (!packed || packed.length === 0) return "";
		var flag = packed[0];
		var rest = packed.slice(1);
		if (flag === FULL_URL_FLAG) {
			return new TextDecoder().decode(rest);
		}
		if (flag < FANG_STRIP_PREFIXES.length) {
			var pre = FANG_STRIP_PREFIXES[flag] || "";
			return pre + new TextDecoder().decode(rest);
		}
		return new TextDecoder().decode(packed);
	}

	async function compressStream(kind, inputBytes) {
		var CS = global.CompressionStream;
		if (!CS) return null;
		try {
			var cs = new CS(kind);
			var w = cs.writable.getWriter();
			w.write(inputBytes);
			w.close();
			var ab = await new Response(cs.readable).arrayBuffer();
			return new Uint8Array(ab);
		} catch (e) {
			return null;
		}
	}

	async function decompressStream(kind, inputBytes) {
		var DS = global.DecompressionStream;
		if (!DS) throw new Error("noinflate");
		var ds = new DS(kind);
		var w = ds.writable.getWriter();
		w.write(inputBytes);
		w.close();
		var ab = await new Response(ds.readable).arrayBuffer();
		return new Uint8Array(ab);
	}

	/** 0=无压缩 1=deflate 2=gzip */
	async function bestCompressPacked(packed) {
		var best = { t: 0, u8: packed };
		var d = await compressStream("deflate", packed);
		if (d && d.length < best.u8.length) best = { t: 1, u8: d };
		var g = await compressStream("gzip", packed);
		if (g && g.length < best.u8.length) best = { t: 2, u8: g };
		return best;
	}

	async function decompressInner(cf, body) {
		if (cf === 0) return body;
		if (cf === 1) return decompressStream("deflate", body);
		if (cf === 2) return decompressStream("gzip", body);
		throw new Error("badcomp");
	}

	async function deflateIfSmaller(utf8Bytes) {
		return compressStream("deflate", utf8Bytes).then(function (comp) {
			if (comp && comp.length < utf8Bytes.length) return comp;
			return null;
		});
	}

	async function inflateDeflated(deflatedBytes) {
		var raw = await decompressStream("deflate", deflatedBytes);
		return new TextDecoder().decode(raw);
	}

	function getPassphraseBytes() {
		return new TextEncoder().encode(FANG_CRYPTO_PASSPHRASE);
	}

	async function deriveAesKey() {
		if (!global.crypto || !global.crypto.subtle) {
			throw new Error("Web Crypto 不可用");
		}
		assertPassphraseConfigured();
		var enc = new TextEncoder();
		var raw = getPassphraseBytes();
		var keyMaterial = await global.crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
		var salt = enc.encode("fang-redirect-pbkdf2-salt-v1");
		return global.crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
			keyMaterial,
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt", "decrypt"]
		);
	}

	/** v4 专用，与 GCM 不同盐，避免与旧逻辑混用 */
	async function deriveCtrKey() {
		if (!global.crypto || !global.crypto.subtle) {
			throw new Error("Web Crypto 不可用");
		}
		assertPassphraseConfigured();
		var enc = new TextEncoder();
		var raw = getPassphraseBytes();
		var keyMaterial = await global.crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
		var salt = enc.encode("fang-redirect-ctr-pbkdf2-v1");
		return global.crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" },
			keyMaterial,
			{ name: "AES-CTR", length: 256 },
			false,
			["encrypt", "decrypt"]
		);
	}

	/** kind: 1=原文 utf8 2=deflate 3=v3 包 */
	function wrapKind(kind, innerBytes) {
		return concat2(new Uint8Array([kind & 0xff]), innerBytes);
	}

	global.FANG_encryptTargetToHash = async function (plainText) {
		assertPassphraseConfigured();
		var te = new TextEncoder();
		var rawU8 = te.encode(plainText);

		var parts = [];
		parts.push({ k: 1, inner: rawU8 });
		var d2 = await deflateIfSmaller(rawU8);
		if (d2) parts.push({ k: 2, inner: d2 });
		var packed = packUrl(plainText);
		var bc = await bestCompressPacked(packed);
		var inner3 = new Uint8Array(1 + bc.u8.length);
		inner3[0] = bc.t;
		inner3.set(bc.u8, 1);
		parts.push({ k: 3, inner: inner3 });

		var bestPart = parts[0];
		for (var i = 1; i < parts.length; i++) {
			if (parts[i].inner.length < bestPart.inner.length) bestPart = parts[i];
		}

		var wrapped = wrapKind(bestPart.k, bestPart.inner);
		var keyCtr = await deriveCtrKey();
		var iv = global.crypto.getRandomValues(new Uint8Array(16));
		var ct = await global.crypto.subtle.encrypt(
			{ name: "AES-CTR", counter: iv, length: 128 },
			keyCtr,
			wrapped
		);
		var ctU8 = new Uint8Array(ct);
		var blob = new Uint8Array(16 + ctU8.length);
		blob.set(iv, 0);
		blob.set(ctU8, 16);
		return "v4." + b64urlFromBytes(blob);
	};

	global.FANG_decryptTargetFromHashFragment = async function (hashWithOrWithoutSharp) {
		var s = hashWithOrWithoutSharp.charAt(0) === "#" ? hashWithOrWithoutSharp.slice(1) : hashWithOrWithoutSharp;
		var dot = s.indexOf(".");
		if (dot < 2) throw new Error("not_v1");
		var tag = s.slice(0, dot);
		if (tag !== "v1" && tag !== "v2" && tag !== "v3" && tag !== "v4") {
			throw new Error("not_v1");
		}
		assertPassphraseConfigured();
		var payload = s.slice(dot + 1);
		var bin = bytesFromB64url(payload);

		if (tag === "v4") {
			if (bin.length < 17) throw new Error("not_v1");
			var iv4 = bin.slice(0, 16);
			var ct4 = bin.slice(16);
			var kctr = await deriveCtrKey();
			var plainBuf = await global.crypto.subtle.decrypt(
				{ name: "AES-CTR", counter: iv4, length: 128 },
				kctr,
				ct4
			);
			var u4 = new Uint8Array(plainBuf);
			var kind = u4[0];
			var rest = u4.slice(1);
			if (kind === 1) {
				return new TextDecoder().decode(rest);
			}
			if (kind === 2) {
				return await inflateDeflated(rest);
			}
			if (kind === 3) {
				var cf = rest[0];
				var body = rest.slice(1);
				var packed = await decompressInner(cf, body);
				return unpackUrl(packed);
			}
			throw new Error("not_v1");
		}

		var iv = bin.slice(0, 12);
		var ct = bin.slice(12);
		var key = await deriveAesKey();
		var buf = await global.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
		var u8 = new Uint8Array(buf);

		if (tag === "v1") {
			return new TextDecoder().decode(u8);
		}
		if (tag === "v2") {
			return await inflateDeflated(u8);
		}
		if (tag === "v3") {
			var cf3 = u8[0];
			var body3 = u8.slice(1);
			var packed3 = await decompressInner(cf3, body3);
			return unpackUrl(packed3);
		}
		throw new Error("not_v1");
	};
})(typeof self !== "undefined" ? self : this);
