// 部署以 index 目录为站点根时，壳页在站点根下：/README.html 等（与 index.html 同级）。api/*.html 旧链仍可用。
// 生成仅在浏览器内拼接 URL + 哈希，不会在服务器上新建或覆盖任何文件。
var FANG_API_SHELLS = ["README.html", "docs.html", "LICENSE.html", "SECURITY.html"];
var FANG_API_DIR = "";

var FANG_QR_API =
	"https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=";

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function showError(msgHtml) {
	var errEl = document.getElementById("b_url");
	var panel = document.getElementById("fang-success-panel");
	if (panel) {
		panel.hidden = true;
	}
	if (errEl) {
		errEl.innerHTML = msgHtml;
	}
	var img = document.getElementById("fang-qr-img");
	if (img) {
		img.removeAttribute("src");
		img.alt = "";
	}
}

function bindCopyButton(finalUrl) {
	var btn = document.getElementById("fang-copy-btn");
	if (!btn) return;
	btn.onclick = function () {
		copyToClipboard(finalUrl);
	};
}

function copyToClipboard(text) {
	var btn = document.getElementById("fang-copy-btn");
	var oldLabel = btn ? btn.textContent : "";

	function flashDone() {
		if (btn) {
			btn.textContent = "已复制";
			setTimeout(function () {
				btn.textContent = oldLabel || "一键复制链接";
			}, 1600);
		}
	}

	function fallback() {
		var ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.left = "-2000px";
		document.body.appendChild(ta);
		ta.select();
		try {
			document.execCommand("copy");
			flashDone();
		} catch (e) {}
		document.body.removeChild(ta);
	}

	if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
		navigator.clipboard.writeText(text).then(flashDone).catch(fallback);
	} else {
		fallback();
	}
}

async function build_url() {
	var raw = (document.querySelector("#url").value || "").trim();
	var errEl = document.getElementById("b_url");
	var panel = document.getElementById("fang-success-panel");
	var linkEl = document.getElementById("fang-gen-link");
	var hintEl = document.getElementById("fang-gen-hint");
	var qrImg = document.getElementById("fang-qr-img");

	if (raw === "" || raw.indexOf("http") === -1) {
		showError("输入的不是链接或者未加http请求头！");
		return;
	}
	if (!window.crypto || !window.crypto.subtle || typeof window.FANG_encryptTargetToHash !== "function") {
		showError(
			"无法生成：请通过 <strong>HTTPS</strong> 访问本站（GitHub Pages 等），本地请用 http://localhost 调试；file:// 不支持加密。"
		);
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
		showError("无法生成：" + escapeHtml(String(e.message || e)));
		return;
	}

	if (errEl) {
		errEl.innerHTML = "";
	}
	if (panel) {
		panel.hidden = false;
	}
	if (linkEl) {
		linkEl.href = finalUrl;
		linkEl.textContent = finalUrl;
	}
	if (hintEl) {
		hintEl.textContent =
			"默认生成 v4（AES-CTR，比 GCM 更短）；旧链 v1～v3 仍可解密。配置 FANG_STRIP_PREFIXES 可缩短同域链接。口令在脚本内并非绝对保密。";
	}
	if (qrImg) {
		qrImg.src = FANG_QR_API + encodeURIComponent(finalUrl);
		qrImg.alt = "链接二维码";
	}
	bindCopyButton(finalUrl);
}
