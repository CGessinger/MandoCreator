'use strict';

var interactive = true;
function PickerFactory () {
	var diff = {};

	function cache() {
		if (!colors)
			return;
		localStorage.setItem("colors", JSON.stringify(colors));
	}

	function setupDragAndClick(o, done) {
		function clamp(n, min, max) {
			if (n > max)
				return max;
			else if (n < min)
				return min;
			return n;
		}

		var rect;
		function touch(event) {
			if (!rect) return;
			event.preventDefault();
			if ("touches" in event)
				event = event.touches[0];
			else if (event.buttons != 1)
				return;
			var s = (event.clientX - rect.left) / rect.width;
			var l = (event.clientY - rect.top) / rect.height;
			done(clamp(s, 0, 1), clamp(l, 0, 1));
		}

		o.addEventListener("mousedown", function (event) {
			rect = o.getBoundingClientRect();
			touch(event);
		});
		o.addEventListener("touchstart", function (event) {
			rect = o.getBoundingClientRect();
			touch(event);
		});
		o.addEventListener("mousemove", touch);
		o.addEventListener("touchmove", touch);
		o.addEventListener("mouseup", function() {rect = null;});
		o.addEventListener("touchend", function() {rect = null;});
	}

	function Color () {
		function hexToHsv(hex) {
			var r = hex[0]/255, g = hex[1]/255, b = hex[2]/255;
			var max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, d = max - min;

			switch(max) {
				case min:
					h = 0; break;
				case r:
					h = (g - b) / d; break;
				case g:
					h = (b - r) / d + 2; break;
				case b:
					h = (r - g) / d + 4; break;
			}
			var s = max === 0 ? 0 : d/max;
			h /= 6;
			if (h < 0)
				h++;
			return [h, s, max];
		}

		function hsvToHex(f) {
			var h = f[0]*6, s = f[1], v = f[2];
			var i = Math.floor(h);
			var f = h - i;

			var	p = v*(1-s),
				q = v*(1-s*f),
				t = v*(1-s*(1-f));
			var rgb;
			switch(i) {
				case 1:
					rgb = [q, v, p]; break;
				case 2:
					rgb = [p, v, t]; break;
				case 3:
					rgb = [p, q, v]; break;
				case 4:
					rgb = [t, p, v]; break;
				case 5:
					rgb = [v, p, q]; break;
				default:
					rgb = [v, t, p]; break;
			}
			return "#" + rgb.map(function(x) {
				var e = Math.round(x*255);
				var p = e.toString(16);
				if (e < 16)
					return "0" + p;
				return p;
			}).join("");
		}

		var _hsv = [0, 0, 0], _hex = "#FFFFFF";
		return {
			get hsv () {
				return _hsv;
			},
			set hsv (value) {
				_hsv = value;
				_hex = hsvToHex(value).toUpperCase();
			},
			get hex () {
				return _hex;
			},
			set hex (value) {
				_hsv = hexToHsv(value);
				_hex = "#" + value.map(function(x) {
					var p = x.toString(16);
					if (x < 16)
						return "0" + p;
					return p;
				}).join("").toUpperCase();
			}
		}
	}

	function PickerDOM () {
		var wrapper = find("picker");
		var ch = wrapper.children;
		var colors = ["#F00", "#0085FF", "#FFD600", "#08CB33", "#8B572A", "#A3A3A3", "#000", "#fff"];

		var timer;
		var pals = wrapper.getElementsByClassName("palette_icon");
		function save (event) {
			event.preventDefault();
			this.style.backgroundColor = color.hex;
		}
		function startTimer () {
			var that = this;
			timer = setTimeout(function() {
				timer = 0;
				that.style.backgroundColor = color.hex;
			}, 500);
		}
		function stopTimer () {
			if (timer) {
				clearTimeout(timer);
				_setColor(this.style.backgroundColor);
				timer = 0;
			}
		}
		for (var i = 0; i < colors.length; i++) {
			var pal = pals[i];
			XML.setAttributes(pal, {
				style: "background-color:" + colors[i],
				title: "Right-click to save the current color"
			});
			pal.addEventListener("click", function() { _setColor(this.style.backgroundColor); });
			pal.addEventListener("contextmenu", save);
			pal.addEventListener("touchstart", startTimer);
			pal.addEventListener("touchend", stopTimer);
		}

		var hue = ch[1], spectrum = ch[2];
		var hueSelector = hue.firstElementChild;
		var colorSelector = spectrum.firstElementChild;

		var editor = ch[3];
		editor.addEventListener("input", function() { _setColor(this.value, true); });
		ch[4].addEventListener("click", function() { DOM.parent = null; update_display(); }); // "Okay"

		setupDragAndClick(hue, function(hue) { var c = color.hsv; c[0] = hue; return _setColor(c); });
		setupDragAndClick(spectrum, function(s, v) { var c = color.hsv; c[1] = s; c[2] = 1-v; return _setColor(c)});

		function move(key, t, f) {
			t.style[key] = 100 * f + "%";
		}
		var _parent = null;
		function update_display () {
			if (_parent == null) {
				document.body.appendChild(wrapper); /* Move it somewhere else! */
				wrapper.style = "display:none";
				return;
			} else if (_parent !== wrapper.parentNode) {
				_parent.appendChild(wrapper);
			}
			wrapper.style = "";
			var rect = wrapper.getBoundingClientRect();
			if (rect.bottom > window.innerHeight)
				wrapper.style.bottom = "0px";
			if (rect.left < 0)
				wrapper.style.left = -rect.right + "px";
		}
		wrapper.addEventListener("mousedown", function() {
			this.cursor = true;
		});
		document.addEventListener("mousedown", function () {
			if (!("cursor" in wrapper) )
				DOM.parent = null;
			delete wrapper.cursor;
		});
		document.addEventListener("click", function() {
			update_display();
		});
		window.addEventListener("resize", function() {
			update_display();
		});
		return {
			update: function (fromEditor) {
				var hsvColor = color.hsv;
				var colorName = "hsl(" + 360 * hsvColor[0] + ", 100%, 50%)";
				move("left", hueSelector, hsvColor[0]);
				move("left", colorSelector, hsvColor[1]);
				move("top", colorSelector, 1 - hsvColor[2]);
				spectrum.style.backgroundColor = hueSelector.style.backgroundColor = colorName;
				colorSelector.style.backgroundColor = color.hex;
				if (!fromEditor) {
					editor.value = color.hex;
				}
			},
			set parent (p) {
				if (_parent == p)
					return;
				_parent = p;
				if (!p) {
					History.push(diff.target, diff.n, diff.o);
					diff = {};
					cache();
				}
			},
		}
	}

	function parseColorString (s) {
		if (/[^#A-Fa-f0-9]/.test(s)) {
			var canvas = find("canvas");
			var ctx = canvas.getContext("2d");
			ctx.fillStyle = s;
			s = ctx.fillStyle;
		}
		if (s[0] == '#')
			s = s.slice(1);
		if (s.length == 3)
			s = [s[0]+s[0], s[1]+s[1], s[2]+s[2]];
		else if (s.length == 6)
			s = [s[0]+s[1], s[2]+s[3], s[4]+s[5]];
		else
			return undefined;
		return s.map(function (e) {return parseInt(e, 16)});
	}

	function _setColor(value, fromEditor) {
		if (Array.isArray(value)) {
			color.hsv = value;
		} else {
			value = value.trim();
			var v = parseColorString(value);
			if (!v) return;
			color.hex = v;
		}
		DOM.update(fromEditor);
		diff.n = color.hex;
		onChange(color.hex);
	}

	function getDefaultColor (id, SVGNode) {
		if (id in colors)
			return colors[id];
		if (SVGNode.hasAttribute("fill"))
			return SVGNode.getAttribute("fill");
	}

	var color, DOM = {}, onChange;
	this.attach = function (button, parent, colorText, SVGNode, kwargs) {
		function input (hex) {
			button.style.backgroundColor = hex;
			SVGNode.setAttribute("fill", hex);
			colorText.innerText = hex;
			if (hex === kwargs.default)
				delete colors[button.id];
			else
				colors[button.id] = hex;
		}
		button.addEventListener("click", function(event) {
			onChange = input;
			if ( !("parent" in DOM) )
				DOM = new PickerDOM;

			var old = colors[this.id] || kwargs.default;
			if ("target" in kwargs)
				diff = {target: kwargs.target, n: old, o: old}
			else
				diff = {};
			_setColor(old);

			if (interactive)
				DOM.parent = parent;
			else
				DOM.parent = null;
		});
		if ( !("noclick" in kwargs) ) {
			SVGNode.addEventListener("click", function () {
				button.click();
			});
		}
		var def = getDefaultColor(button.id, SVGNode);
		if (!def) def = kwargs.default;
		if (def != "#FFFFFF") {
			var c = parseColorString(def);
			if (!c) c = [1,1,1];
			color.hex = c;
			input(color.hex);
		}
	}
	this.build = function (target, parent, kwargs) {
		var span = XML.DOMNode("span", {class: "color_wrapper"}, parent);

		var buttonID = target.id + "__C";
		var b = XML.DOMNode("button", {class: "color_picker", id: buttonID}, span);

		var label = XML.DOMNode("label", {class: "soft_text no_collapse", for: buttonID}, span);
		label.innerText = kwargs.text;
		var p = XML.DOMNode("p", {class: "detail no_collapse"}, label);
		p.innerText = "#FFFFFF";

		if (kwargs.disabled) {
			b.disabled = true;
			b.innerHTML = "<svg stroke='#ddd' viewBox='0 0 20 20'><path d='m3 3 14 14M3 17 17 3'/></svg>"
			p.innerText = "No colors available";
			target.addEventListener("click", function() {
				span.click();
			});
		} else {
			this.attach(b, span, p, target, kwargs);
		}
		return b;
	}
	this.finishUp = function () {
		color = new Color();
	}
	this.cache = cache;
}

function HistoryTracker () {
	var changes = [];
	var redos = [];

	this.undo = function (redo) {
		if (redo) {
			if (redos.length == 0) return;
			interactive = false;
			var change = redos.pop();
			change["target"].state = change["new"];
			changes.push(change);
		} else {
			if (changes.length == 0) return;
			interactive = false;
			var change = changes.pop();
			change["target"].state = change["old"];
			redos.push(change);
		}
		interactive = true;
		ArmorControl.cache();
	}

	function isEqual (o, n) {
		var to = typeof(o), tn = typeof(n);
		if (to != tn) return false;
		if (to != "object")
			return o == n;

		for (var i in o) {
			if (!isEqual(o[i], n[i]))
				return false;
		}
		for (var j in n) {
			if ( !(j in o) )
				return false;
		}
		return true;
	}

	this.push = function (t, n, o, f) {
		if (!interactive || !t || isEqual(o, n))
			return;
		if (f) n.force = o.force = true;
		changes.push({"target": t, "new": n, "old": o});
		redos = [];
	}
}
