/*
	Eventually by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function() {

	"use strict";

	var	$body = document.querySelector('body');

	// Methods/polyfills.

		// classList | (c) @remy | github.com/remy/polyfills | rem.mit-license.org
			!function(){function t(t){this.el=t;for(var n=t.className.replace(/^\s+|\s+$/g,"").split(/\s+/),i=0;i<n.length;i++)e.call(this,n[i])}function n(t,n,i){Object.defineProperty?Object.defineProperty(t,n,{get:i}):t.__defineGetter__(n,i)}if(!("undefined"==typeof window.Element||"classList"in document.documentElement)){var i=Array.prototype,e=i.push,s=i.splice,o=i.join;t.prototype={add:function(t){this.contains(t)||(e.call(this,t),this.el.className=this.toString())},contains:function(t){return-1!=this.el.className.indexOf(t)},item:function(t){return this[t]||null},remove:function(t){if(this.contains(t)){for(var n=0;n<this.length&&this[n]!=t;n++);s.call(this,n,1),this.el.className=this.toString()}},toString:function(){return o.call(this," ")},toggle:function(t){return this.contains(t)?this.remove(t):this.add(t),this.contains(t)}},window.DOMTokenList=t,n(Element.prototype,"classList",function(){return new t(this)})}}();

		// canUse
			window.canUse=function(p){if(!window._canUse)window._canUse=document.createElement("div");var e=window._canUse.style,up=p.charAt(0).toUpperCase()+p.slice(1);return p in e||"Moz"+up in e||"Webkit"+up in e||"O"+up in e||"ms"+up in e};

		// window.addEventListener
			(function(){if("addEventListener"in window)return;window.addEventListener=function(type,f){window.attachEvent("on"+type,f)}})();

	// Play initial animations on page load.
		window.addEventListener('load', function() {
			window.setTimeout(function() {
				$body.classList.remove('is-preload');
			}, 100);
		});

	// Slideshow Background — 图片来自 images/manifest.json（相对 images/ 的路径）。
	// 何时跑 gen-image-manifest.sh：首次含图部署前、以及每次在 images/ 增删改名图片之后（可写入 CI：部署前执行一次）。
	// 浏览器不能读目录；未跑脚本时 manifest 可能缺失/为空/过旧——此时使用下方 FALLBACK 相对路径兜底（不含新图，新图须更新 manifest）。
		(function() {

			var delay = 6000;

			/** manifest 不可用或解析后为空时使用的相对 images/ 的文件名（与仓库内默认素材一致时可显示背景） */
			var FALLBACK_MANIFEST_NAMES = ["01.webp", "02.webp", "03.webp"];

			function shuffleInPlace(arr) {
				var i = arr.length, j, t;
				while (i > 1) {
					j = Math.floor(Math.random() * i);
					i--;
					t = arr[i];
					arr[i] = arr[j];
					arr[j] = t;
				}
				return arr;
			}

			function buildPathsFromManifest(list) {
				if (!Array.isArray(list)) return [];
				var out = [];
				for (var i = 0; i < list.length; i++) {
					var name = list[i];
					if (typeof name !== "string" || !name.length) continue;
					name = name.replace(/^\/+/, "");
					if (name.indexOf("..") !== -1) continue;
					out.push("images/" + name);
				}
				return out;
			}

			function namesToUrls(names) {
				var out = [];
				for (var i = 0; i < names.length; i++) {
					out.push("images/" + names[i].replace(/^\/+/, ""));
				}
				return out;
			}

			function runSlideshow(urls) {
				if (!urls.length) return;

				var	pos = 0, lastPos = 0,
					$wrapper, $bgs = [], $bg,
					k;

				$wrapper = document.createElement('div');
				$wrapper.id = 'bg';
				$body.appendChild($wrapper);

				for (k = 0; k < urls.length; k++) {
					$bg = document.createElement('div');
					$bg.style.backgroundImage = 'url("' + urls[k] + '")';
					$bg.style.backgroundPosition = 'center';
					$wrapper.appendChild($bg);
					$bgs.push($bg);
				}

				$bgs[pos].classList.add('visible');
				$bgs[pos].classList.add('top');

				if ($bgs.length == 1 || !canUse('transition'))
					return;

				window.setInterval(function() {

					lastPos = pos;
					pos++;

					if (pos >= $bgs.length)
						pos = 0;

					$bgs[lastPos].classList.remove('top');
					$bgs[pos].classList.add('visible');
					$bgs[pos].classList.add('top');

					window.setTimeout(function() {
						$bgs[lastPos].classList.remove('visible');
					}, delay / 2);

				}, delay);
			}

			function startWithUrls(urls) {
				if (!urls.length) {
					urls = namesToUrls(FALLBACK_MANIFEST_NAMES);
				}
				shuffleInPlace(urls);
				runSlideshow(urls);
			}

			fetch("images/manifest.json", { cache: "no-store" })
				.then(function (r) {
					if (!r.ok) throw new Error("manifest");
					return r.json();
				})
				.then(function (list) {
					startWithUrls(buildPathsFromManifest(list));
				})
				.catch(function () {
					startWithUrls([]);
				});

		})();

	// Signup Form.
		(function() {

			// Vars.
				var $form = document.querySelectorAll('#signup-form')[0],
					$submit = document.querySelectorAll('#signup-form input[type="submit"]')[0],
					$message;

			// Bail if addEventListener isn't supported.
				if (!('addEventListener' in $form))
					return;

			// Message.
				$message = document.createElement('span');
					$message.classList.add('message');
					$form.appendChild($message);

				$message._show = function(type, text) {

					$message.innerHTML = text;
					$message.classList.add(type);
					$message.classList.add('visible');

					window.setTimeout(function() {
						$message._hide();
					}, 3000);

				};

				$message._hide = function() {
					$message.classList.remove('visible');
				};

			// Events.
			// Note: If you're *not* using AJAX, get rid of this event listener.
				$form.addEventListener('submit', function(event) {

					event.stopPropagation();
					event.preventDefault();

					// Hide message.
						$message._hide();

					// Disable submit.
						$submit.disabled = true;

					// Process form.
					// Note: Doesn't actually do anything yet (other than report back with a "thank you"),
					// but there's enough here to piece together a working AJAX submission call that does.
						window.setTimeout(function() {

							// Reset form.
								$form.reset();

							// Enable submit.
								$submit.disabled = false;

							// Show message.
								$message._show('success', 'Thank you!');
								//$message._show('failure', 'Something went wrong. Please try again.');

						}, 750);

				});

		})();

})();