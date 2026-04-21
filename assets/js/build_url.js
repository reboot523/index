// 部署以 index 目录为站点根时，壳页在站点根下：/README.html 等（与 index.html 同级）。api/*.html 旧链仍可用。
var FANG_API_SHELLS = ["README.html", "docs.html", "LICENSE.html", "SECURITY.html"];
var FANG_API_DIR = "";
async function build_url() {
	var raw = (document.querySelector("#url").value || "").trim();
	var out = document.getElementById("b_url");
	if (raw === "" || raw.indexOf("http") === -1) {
		out.innerHTML = "输入的不是链接或者未加http请求头！";
		return;
	}
	if (!window.crypto || !window.crypto.subtle || typeof window.FANG_encryptTargetToHash !== "function") {
		out.innerHTML =
			"无法生成：请通过 <strong>HTTPS</strong> 访问本站（GitHub Pages 等），本地请用 http://localhost 调试；file:// 不支持加密。";
		return;
	}
	var base = window.location.href;
	var hashIdx = base.indexOf("#");
	if (hashIdx !== -1) {
		base = base.substring(0, hashIdx);
	}
	var finalUrl;
	try {
		var shell = FANG_API_SHELLS[Math.floor(Math.random() * FANG_API_SHELLS.length)];
		var apiPage = new URL(FANG_API_DIR + shell, base);
		var frag = await window.FANG_encryptTargetToHash(raw);
		apiPage.hash = frag;
		finalUrl = apiPage.href;
	} catch (e) {
		out.innerHTML = "无法生成：" + String(e.message || e);
		return;
	}
	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}
	var safe = escapeHtml(finalUrl);
	out.innerHTML =
		'<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' + safe + "</a><br><small>" +
		escapeHtml("默认生成 v4（AES-CTR，比 GCM 更短）；旧链 v1～v3 仍可解密。配置 FANG_STRIP_PREFIXES 可缩短同域链接。口令在脚本内并非绝对保密。") +
		"</small>";
}
