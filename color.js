'use strict';

var showPicker = true;
function PickerFactory (history) {
	var latestChange = {};

	function cache() {
		if (!colors)
			return;
		localStorage.setItem("colors", JSON.stringify(colors));
	}

	function on(elem, event, func) {
		elem.addEventListener(event, func);
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
			event.preventDefault();
			if ("touches" in event)
				event = event.touches[0];
			else if (event.buttons != 1)
				return;
			var s = (event.clientX - rect.left) / rect.width;
			var l = (event.clientY - rect.top) / rect.height;
			done(clamp(s, 0, 1), clamp(l, 0, 1));
		}

		on(o, "mousedown", function (event) {
			rect = o.getBoundingClientRect();
			touch(event);
		});
		on(o, "touchstart", function (event) {
			rect = o.getBoundingClientRect();
			touch(event);
		});
		on(o, "mousemove", touch);
		on(o, "touchmove", touch);
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

		wrapper.addEventListener("click", function (event) {
			event.stopPropagation();
		});

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
			on(pal, "click", function() { _setColor(this.style.backgroundColor); });
			on(pal, "contextmenu", save);
			on(pal, "touchstart", startTimer);
			on(pal, "touchend", stopTimer);
		}

		var hue = ch[1], spectrum = ch[2];
		var hueSelector = hue.firstElementChild;
		var colorSelector = spectrum.firstElementChild;

		var editor = ch[3];
		on(editor, "input", function() { var s = this.value; _setColor(s.trim(), true); });
		var Okay = ch[4];
		on(Okay, "click", function(event) { DOM.parent = null; DOM.display(); });

		setupDragAndClick(hue, function(hue) { var c = color.hsv; c[0] = hue; return _setColor(c); });
		setupDragAndClick(spectrum, function(s, v) { var c = color.hsv; c[1] = s; c[2] = 1-v; return _setColor(c)});

		function move(key, t, f) {
			t.style[key] = 100 * f + "%";
		}
		var _parent = null;
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
					history.push(latestChange);
					latestChange = {};
					cache();
				}
			},
			display: function () {
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
		}
	}

	document.addEventListener("mousedown", function () {
		DOM.parent = null;
	});
	document.addEventListener("click", function () {
		DOM.display();
	});
	window.addEventListener("resize", function () {
		DOM.display();
	});

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
		latestChange["newValue"] = color.hex;
		onChange(color.hex);
	}

	function getDefaultColor (id, SVGNode) {
		if (id in colors)
			return colors[id];
		if (SVGNode.hasAttribute("fill"))
			return SVGNode.getAttribute("fill");
		if (SVGNode.hasAttribute("color"))
			return SVGNode.getAttribute("color");
	}

	var color = new Color();
	var DOM = new PickerDOM();
	var onChange = null;
	this.attach = function (button, colorText, SVGNode, def_val) {
		function input (hex) {
			button.style.backgroundColor = hex;
			SVGNode.setAttribute("fill", hex);
			colorText.innerText = hex;
			if (hex === def_val)
				delete colors[button.id];
			else
				colors[button.id] = hex;
		}
		on(button, "click", function(event) {
			if (event.defaultPrevented)
				return;
			onChange = input;

			var oldValue = this.style.backgroundColor;
			latestChange = history.format("color", oldValue, "", button.id);
			_setColor(oldValue);
			latestChange.newValue = latestChange.oldValue;

			if (showPicker)
				DOM.parent = this;
			else
				DOM.parent = null;
		});
		SVGNode.addEventListener("click", function () {
			button.click();
		});
		var def = getDefaultColor(button.id, SVGNode);
		if (!def) def = def_val;
		onChange = input;
		_setColor(def);
	}
	this.build = function (target, parent, kwargs) {
		var label = XML.DOMNode("label", {class: "color_wrapper"}, parent);

		var buttonID = target.id + "Color";
		var b = XML.DOMNode("button", {class: "color_picker", id: buttonID}, label);

		var p = XML.DOMNode("span", {class: "soft_text no_collapse"}, label);
		p.innerText = kwargs.text;
		var c = XML.DOMNode("p", {class: "detail no_collapse"}, label);

		if (kwargs.disabled) {
			b.disabled = true;
			c.innerText = "No colors available";
		} else {
			this.attach(b, c, target, kwargs["default"]);
		}
		return b;
	}
	this.cache = cache;
}

function HistoryTracker () {
	var changes = [];
	var redos = [];
	var self = this;

	function undoSingleChange (type, targetID, value) {
		if (type == "variant") /* Manual Override */
			targetID = value + "Radio";
		var target = find(targetID);
		if (!target) return false;
		switch (type) {
			case "color":
				target.style.backgroundColor = value;
				break;
			case "variant":
				target.checked = false;
				break;
			case "select":
				target.value = value;
				target.dispatchEvent(new Event("change"));
				return true;
			case "decal":
				Decals.Set(target, value);
				return true;
		}
		target.click();
		return true;
	}

	this.format = function (type, oldVal, newVal, target) {
		if (oldVal == newVal)
			return {};
		return {
			"type": type,
			"oldValue": oldVal,
			"newValue": newVal,
			"target": target
		}
	}

	this.undo = function (redo) {
		var from, to, key;
		if (redo) {
			from = redos;
			to = changes;
			key = "newValue";
		} else {
			from = changes;
			to = redos;
			key = "oldValue";
		}
		showPicker = false;
		self.track = false;
		var change = from.pop();
		if (!change) {
			showPicker = self.track = true;
			return;
		} else if ("target" in change) {
			undoSingleChange(change["type"], change["target"], change[key]);
		} else {
			for (var c in change) {
				var C = change[c];
				undoSingleChange(C["type"], C["target"], C[key]);
			}
		}
		to.push(change);
		showPicker = true;
		self.track = true;
	}
	function isValid (c) {
		return (!!c) && (!!c.target) && (c.oldValue != c.newValue);
	}
	this.push = function (C) {
		if (!self.track || !C)
			return;
		var d = [];
		if (!C.length && isValid(C))
			d = [C];
		while (C.length) {
			var c = C.pop();
			if (!isValid(c))
				continue;
			d.push(c);
		}
		if (d.length == 0)
			return;
		else if (d.length == 1)
			changes.push(d[0]);
		else
			changes.push(d);
		redos = [];
	}
	this.track = false;
}
