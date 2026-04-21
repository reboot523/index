/**
 * 中转页共用逻辑（多份 api/*.html 引用）。配置 window.FANG_API_CFG。
 * 外置浏览器：uiMode 为 random 时「过渡动画」与「滑动验证」随机二选一；可改为 transition / slide / none。
 * 移动端：注入安全区与防过度滚动；滑动条使用 touch-action:none + 拖动期 preventDefault，减轻与系统返回/下拉手势冲突。
 */
(function () {
	"use strict";

	function injectFangMobileBase() {
		if (document.getElementById("fang-mobile-shell")) return;
		var s = document.createElement("style");
		s.id = "fang-mobile-shell";
		s.textContent =
			"html.fang-api-page,body.fang-api-page{height:100%;margin:0;-webkit-text-size-adjust:100%;}" +
			"body.fang-api-page{min-height:100vh;min-height:100dvh;min-height:-webkit-fill-available;overscroll-behavior-y:contain;overscroll-behavior-x:none;-webkit-overflow-scrolling:touch;}" +
			"body.fang-api-page .wrap{min-height:100vh;min-height:100dvh;min-height:-webkit-fill-available;display:flex;align-items:center;justify-content:center;" +
			"padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));box-sizing:border-box;}" +
			"body.fang-api-page #tips{width:100%;max-width:420px;padding:0 8px;box-sizing:border-box;word-break:break-word;-webkit-tap-highlight-color:transparent;}";
			/* 微信提示样式见 assets/css/wx-notice.css（壳页 head 直链，避免 X5 仅用 JS 注入时失效或强缓存旧脚本） */
		document.head.appendChild(s);
		document.documentElement.classList.add("fang-api-page");
		document.body.classList.add("fang-api-page");
	}

	injectFangMobileBase();

	var cfg = typeof window.FANG_API_CFG === "object" && window.FANG_API_CFG ? window.FANG_API_CFG : {};

	function num(n, def) {
		var v = cfg[n];
		return typeof v === "number" && !isNaN(v) ? v : def;
	}

	var REDIRECT_DELAY_MS_MIN = num("delayMin", 3000);
	var REDIRECT_DELAY_MS_MAX = num("delayMax", 6000);
	var wxHintId = typeof cfg.wxHintId === "number" ? cfg.wxHintId : 0;
	var WECHAT_EMPTY_TARGET_HINT = "网络故障：请切换网络后重试^_^";
	var SLIDE_LABEL = typeof cfg.slideLabel === "string" ? cfg.slideLabel : "向右滑动验证后继续";
	/** random | transition | slide | none */
	var UI_MODE = typeof cfg.uiMode === "string" ? cfg.uiMode.toLowerCase() : "random";
	/** uiMode 为 random 时，选「滑动」的概率，默认 0.5 */
	var SLIDE_CHANCE = typeof cfg.slideChance === "number" && cfg.slideChance >= 0 && cfg.slideChance <= 1 ? cfg.slideChance : 0.5;

	function randomDelayMs() {
		var lo = Math.min(REDIRECT_DELAY_MS_MIN, REDIRECT_DELAY_MS_MAX);
		var hi = Math.max(REDIRECT_DELAY_MS_MIN, REDIRECT_DELAY_MS_MAX);
		return Math.floor(lo + Math.random() * (hi - lo + 1));
	}

	function wechatNoticeHtml(targetUrlForCopy) {
		var raw =
			typeof targetUrlForCopy === "string" && targetUrlForCopy.length > 0
				? targetUrlForCopy
				: WECHAT_EMPTY_TARGET_HINT;
		var u = escapeHtml(raw);
		var id = Math.abs(wxHintId) % 4;
		var blocks = [
			'<div class="fang-wx-notice"><h2 class="fang-wx-h2">请点击右上角菜单</h2><p class="fang-wx-body">选择「在浏览器中打开」后继续。备用：<b class="fang-wx-em">' +
				u +
				"</b></p></div>",
			'<div class="fang-wx-notice fang-wx-card"><p class="fang-wx-lead">当前为应用内浏览</p><p class="fang-wx-body">请通过右上角 <strong>···</strong> → <strong>在浏览器打开</strong>。若无法跳转，请复制：<span class="fang-wx-url">' +
				u +
				"</span></p></div>",
			'<div class="fang-wx-notice"><p class="fang-wx-lead-lg">系统检测到内置浏览器限制</p><p class="fang-wx-muted">请点右上角 <b>···</b>，用系统浏览器打开本页。参考地址：<b class="fang-wx-url">' +
				u +
				"</b></p></div>",
			'<div class="fang-wx-notice"><h3 class="fang-wx-h3">外链需在浏览器中访问</h3><ol class="fang-wx-ol"><li>点右上角「···」</li><li>选「在浏览器打开」</li><li>或复制：<span class="fang-wx-url">' +
				u +
				"</span></li></ol></div>",
		];
		return blocks[id];
	}

	async function getTargetUrlStrict() {
		if (!location.hash || location.hash.length <= 1) {
			throw new Error("missing");
		}
		var h = location.hash;
		if (h.indexOf("#v1.") !== 0 && h.indexOf("#v2.") !== 0 && h.indexOf("#v3.") !== 0 && h.indexOf("#v4.") !== 0) {
			throw new Error("not_v1");
		}
		if (!window.crypto || !window.crypto.subtle || typeof FANG_decryptTargetFromHashFragment !== "function") {
			throw new Error("crypto");
		}
		return await FANG_decryptTargetFromHashFragment(location.hash);
	}

	function showTips(html) {
		var el = document.getElementById("tips");
		if (el) el.innerHTML = html;
	}

	function scheduleRedirect(urlParmStr) {
		var ms = randomDelayMs();
		setTimeout(function () {
			location.href = urlParmStr;
		}, ms);
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function resolveExternalUiMode() {
		if (UI_MODE === "none") return "none";
		if (UI_MODE === "transition") return "transition";
		if (UI_MODE === "slide") return "slide";
		if (UI_MODE === "random") {
			return Math.random() < SLIDE_CHANCE ? "slide" : "transition";
		}
		return "transition";
	}

	var SHARED_CSS =
		"<style>" +
		"#fang-twrap,#fang-swrap{animation:fangFade .45s ease;max-width:min(100%,380px);margin:0 auto;}" +
		"@keyframes fangFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
		".fang-spin{width:48px;height:48px;margin:0 auto 20px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:fangSpin .8s linear infinite;}" +
		"@keyframes fangSpin{to{transform:rotate(360deg)}}" +
		".fang-sub{color:#64748b;font-size:14px;margin-top:8px;line-height:1.5;}" +
		"#fang-slide-box{margin-top:12px;text-align:left;-webkit-touch-callout:none;}" +
		"#fang-slide-track{position:relative;height:52px;background:#e2e8f0;border-radius:26px;overflow:hidden;touch-action:none;-ms-touch-action:none;user-select:none;-webkit-user-select:none;isolation:isolate;}" +
		"#fang-slide-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#818cf8,#6366f1);border-radius:26px;}" +
		"#fang-slide-knob{position:absolute;left:2px;top:2px;width:48px;height:48px;background:#fff;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,.12);cursor:grab;display:flex;align-items:center;justify-content:center;font-size:18px;touch-action:none;-ms-touch-action:none;-webkit-user-drag:none;}" +
		"#fang-slide-knob:active{cursor:grabbing}" +
		"#fang-slide-hint{text-align:center;font-size:14px;color:#64748b;margin-bottom:12px;line-height:1.45;}" +
		".fang-done .fang-spin{animation:none;border-color:#22c55e;border-top-color:#22c55e;}" +
		"</style>";

	function runTransitionOnly(urlParmStr, tips) {
		tips.innerHTML =
			SHARED_CSS +
			'<div id="fang-twrap">' +
			'<div class="fang-spin"></div>' +
			'<div style="font-size:17px;font-weight:600;color:#334155;">正在准备跳转</div>' +
			'<p class="fang-sub">' +
			escapeHtml("即将跳转，请稍候") +
			"</p>" +
			"</div>";
		window.setTimeout(function () {
			scheduleRedirect(urlParmStr);
		}, 650);
	}

	function bindSlideHandlers(urlParmStr, wrapId) {
		var track = document.getElementById("fang-slide-track");
		var knob = document.getElementById("fang-slide-knob");
		var fill = document.getElementById("fang-slide-fill");
		if (!track || !knob || !fill) {
			scheduleRedirect(urlParmStr);
			return;
		}

		var maxX = 0;
		var dragging = false;
		var dragOffsetInKnob = 0;

		var TOUCH_LOCK_OPTS = { passive: false, capture: true };

		function lockBrowserGesture(e) {
			if (dragging) e.preventDefault();
		}

		function clearGestureLock() {
			document.removeEventListener("touchmove", lockBrowserGesture, TOUCH_LOCK_OPTS);
		}

		function setMax() {
			maxX = Math.max(0, track.clientWidth - knob.offsetWidth - 4);
		}
		setMax();
		window.addEventListener("resize", setMax);

		function applyKnobLeft(leftPx) {
			var x = Math.max(2, Math.min(2 + maxX, leftPx));
			knob.style.left = x + "px";
			fill.style.width = Math.min(Math.max(0, x - 2 + knob.offsetWidth), track.clientWidth) + "px";
		}

		function onWinMove(e) {
			if (!dragging) return;
			var rect = track.getBoundingClientRect();
			var x = e.clientX - rect.left - dragOffsetInKnob;
			applyKnobLeft(x);
		}

		function finishDrag(clientX) {
			var rect = track.getBoundingClientRect();
			var x = clientX - rect.left - dragOffsetInKnob;
			x = Math.max(0, Math.min(x, maxX));
			if (x >= maxX * 0.88) {
				knob.style.left = maxX + 2 + "px";
				fill.style.width = track.clientWidth + "px";
				var tw = document.getElementById(wrapId);
				if (tw) tw.classList.add("fang-done");
				var hint = document.getElementById("fang-slide-hint");
				if (hint) hint.textContent = "验证通过";
				window.setTimeout(function () {
					scheduleRedirect(urlParmStr);
				}, 400);
			} else {
				knob.style.left = "2px";
				fill.style.width = "0";
			}
		}

		function onWinUp(e) {
			if (!dragging) return;
			dragging = false;
			clearGestureLock();
			window.removeEventListener("pointermove", onWinMove);
			window.removeEventListener("pointerup", onWinUp);
			window.removeEventListener("pointercancel", onWinCancel);
			finishDrag(e.clientX);
		}

		function onWinCancel() {
			dragging = false;
			clearGestureLock();
			window.removeEventListener("pointermove", onWinMove);
			window.removeEventListener("pointerup", onWinUp);
			window.removeEventListener("pointercancel", onWinCancel);
			knob.style.left = "2px";
			fill.style.width = "0";
		}

		knob.addEventListener(
			"pointerdown",
			function (e) {
				if (e.pointerType === "mouse" && e.button !== 0) return;
				dragging = true;
				setMax();
				var kr = knob.getBoundingClientRect();
				dragOffsetInKnob = e.clientX - kr.left;
				document.addEventListener("touchmove", lockBrowserGesture, TOUCH_LOCK_OPTS);
				window.addEventListener("pointermove", onWinMove);
				window.addEventListener("pointerup", onWinUp);
				window.addEventListener("pointercancel", onWinCancel);
				e.preventDefault();
			},
			{ passive: false }
		);
	}

	function runSlideOnly(urlParmStr, tips) {
		tips.innerHTML =
			SHARED_CSS +
			'<div id="fang-swrap">' +
			'<div style="font-size:17px;font-weight:600;color:#334155;">安全验证</div>' +
			'<p class="fang-sub">' +
			escapeHtml("请完成滑动后继续") +
			"</p>" +
			'<div id="fang-slide-box">' +
			'<p id="fang-slide-hint">' +
			escapeHtml(SLIDE_LABEL) +
			"</p>" +
			'<div id="fang-slide-track">' +
			'<div id="fang-slide-fill"></div>' +
			'<div id="fang-slide-knob" aria-label="slide">→</div>' +
			"</div></div>" +
			"</div>";
		bindSlideHandlers(urlParmStr, "fang-swrap");
	}

	function runExternalFlow(urlParmStr) {
		var mode = resolveExternalUiMode();
		if (mode === "none") {
			scheduleRedirect(urlParmStr);
			return;
		}

		var tips = document.getElementById("tips");
		if (!tips) {
			scheduleRedirect(urlParmStr);
			return;
		}

		if (mode === "transition") {
			runTransitionOnly(urlParmStr, tips);
			return;
		}
		runSlideOnly(urlParmStr, tips);
	}

	(async function () {
		var ua = navigator.userAgent.toLowerCase();
		var isQQ = ua.indexOf("qq") !== -1;
		var isWeixin = ua.indexOf("micromessenger") !== -1;

		var urlParmStr;
		try {
			urlParmStr = await getTargetUrlStrict();
		} catch (e) {
			var code = e && e.message;
			if (code === "crypto") {
				showTips("<h2>无法解密</h2><p>请使用 HTTPS 打开本页；本地 file 打开不支持 Web Crypto。</p>");
			} else if (code === "missing" || code === "not_v1" || code === "not v1") {
				showTips(
					"<h2>无效访问</h2><p>仅支持由本站生成的加密链接（#v1～#v4），无法从地址栏直接看出或还原目标网址。</p>"
				);
			} else if (code === "noinflate" || code === "badcomp") {
				showTips(
					"<h2>无法解压</h2><p>当前浏览器过旧或链接损坏。请升级浏览器后重试，或重新生成链接。</p>"
				);
			} else if (code && String(code).indexOf("请在 redirect-crypto.js") === 0) {
				showTips("<h2>未配置密钥</h2><p>" + String(e.message) + "</p>");
			} else {
				showTips(
					"<h2>链接无效或密钥不一致</h2><p>请确认 redirect-crypto.js 口令与生成页一致，或重新生成链接。</p>"
				);
			}
			return;
		}

		if (isWeixin || isQQ) {
			showTips(wechatNoticeHtml(urlParmStr));
			return;
		}

		runExternalFlow(urlParmStr);
	})();
})();
