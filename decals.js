"use strict";

function DecalsBrace (g, grid, compass) {
	var main_svg = XML.SVGNode("svg");
	var x, y, ax, ay, phi, c, s;
	var node;
	var snapping = find("snapping");

	/* Local Coordinate System */
	var ctm;
	function getLocalCoordinates (event) {
		if ("touches" in event)
			event = event.touches[0];
		return [
			(event.clientX - ctm.e) / ctm.a,
			(event.clientY - ctm.f) / ctm.d
		];
	}

	var drag = null;
	var onup = function() {
		if (!drag) return;
		drag = null;
		grid.style.visibility = "";
		compass.style.visibility = "";
		var s = node.state;
		var old = variants.setItem(node.id, s);
		History.push(node, s, old);
	}
	document.addEventListener("mouseup", onup);
	document.addEventListener("touchend", onup);
	function setupDragAndDrop (node, drag_id, before, after) {
		var offset = [0, 0];
		function ondown (event) {
			ctm = main_svg.getScreenCTM();
			offset = getLocalCoordinates(event);
			offset = before(offset);
			drag = drag_id;
		}
		function onmove (event) {
			if (drag != drag_id) return;
			event.preventDefault();
			var coord = getLocalCoordinates(event);
			coord[0] -= offset[0];
			coord[1] -= offset[1];
			after(coord);
		}

		node.addEventListener("mousedown", ondown);
		node.addEventListener("touchstart", ondown);
		document.addEventListener("mousemove", onmove, {passive: false});
		document.addEventListener("touchmove", onmove, {passive: false});
	}

	var ch = g.lastElementChild.children;
	setupDragAndDrop(ch[0], 1, function (offset) {
		if (snapping.checked)
			grid.style.visibility = "visible";
		return [offset[0] - x, offset[1] - y];
	}, function (coord) {
		if (snapping.checked)
			coord = coord.map(Math.round);
		x = coord[0]; y = coord[1];

		var v = {x:x, y:y, ax:ax, ay:ay, phi:phi};
		node.state = {v: v};
		self.state = v;
	});
	setupDragAndDrop(ch[1], 2, function (offset) {
		if (snapping.checked) {
			var m = compass.transform.baseVal[0].matrix;
			m.a = m.d = ay;
			m.e = x - ay * 60;
			m.f = y - ay * 60;
			compass.style.visibility = "visible";
		}
		return [
			offset[0] - (57.5 * s * ay),
			offset[1] - (-57.5 * c * ay)
		];
	}, function (coord) {
		coord[0] = coord[0] / (57.5 * ay);
		coord[1] = coord[1] / (-57.5 * ay);

		phi = Math.atan2(coord[0], coord[1]) * 180 / Math.PI;
		if (snapping.checked)
			phi = Math.round(phi);

		var v = {x:x, y:y, ax:ax, ay:ay, phi:phi};
		node.state = {v: v};
		self.state = v;

		var p = phi * Math.PI / 180;
		c = Math.cos(p);
		s = Math.sin(p);
	});
	setupDragAndDrop(ch[2], 3, function (offset) {
		if (snapping.checked)
			grid.style.visibility = "visible";
		return [
			offset[0] - 50 * (c * ax - s * ay),
			offset[1] - 50 * (s * ax + c * ay)
		];
	}, function (coord) {
		ax = (c * coord[0] + s * coord[1]) / 50;
		ay = (c * coord[1] - s * coord[0]) / 50;
		if (snapping.checked) {
			ax = Math.round(ax * 100) / 100;
			ay = Math.round(ay * 100) / 100;
		}
		var v = {x:x, y:y, ax:ax, ay:ay, phi:phi};
		node.state = {v: v};
		self.state = v;
	});

	var self = {
		coordinates (x, y) {
			ctm = main_svg.getScreenCTM();
			return getLocalCoordinates({clientX: x, clientY: y});
		},
		set SVG (value) {
			main_svg = value;
			var main_body = main_svg.lastElementChild;
			main_body.appendChild(grid);
			main_body.appendChild(compass);
			main_body.appendChild(g);
		},
		set target (value) {
			if (node == value)
				return;
			node = value;
			if (value == null) {
				g.style.visibility = "";
			} else {
				g.style.visibility = "visible";
				this.state = node.state.v;
			}
		},
		set state (v) {
			x = v.x; ax = v.ax;
			y = v.y; ay = v.ay;
			phi = v.phi;

			var p = phi * Math.PI / 180;
			s = Math.sin(p); c = Math.cos(p);

			var tl = g.transform.baseVal;
			if (tl.length < 3) {
				tl.initialize(main_svg.createSVGTransform());
				tl.appendItem(main_svg.createSVGTransform());
				tl.appendItem(main_svg.createSVGTransform());
			}

			tl[0].setTranslate(x, y);
			tl[1].setRotate(phi, 0, 0);
			tl[2].setScale(ax, ay);
		}
	}
	return self;
}

function DecalFactory () {
	var count = {}, nonce = 0;
	var decals_list, decals_group;
	var brace = {};
	var customs_menu = find("custom_decals_menu");

	var main_svg, target_div, vault = {custom: find("custom_vault")};

	/* Event Handlers */
	function initializeEventHandlers () {
		var decals_menu = find("decals_menu");
		var armor_menu = find("armor_menu");
		decals_menu.addEventListener("click", function (event) {
			if (event.defaultPrevented) return;
			openFolder(this);
		});
		var slides = decals_menu.getElementsByClassName("slide");
		var opener = slide_opener(decals_menu, slides);
		for (var j = 0; j < slides.length; j++) {
			slides[j].addEventListener("click", opener);
		}

		decals_menu.children[0].addEventListener("click", function (event) {
			armor_menu.classList.toggle("menu_collapsed");
			decals_menu.classList.toggle("menu_collapsed");
		});

		decals_menu.children[1].addEventListener("click", function (event) {
			event.preventDefault(); /* The default is opening the decal-folder */
			decals_menu.classList.remove("selected");
			armor_menu.style.visibility = "visible";
		});
		armor_menu.addEventListener("click", function (event) {
			brace.target = null;
		});

		var lists = decals_menu.lastElementChild;
		var divs = lists.getElementsByClassName("decal_control");
		decals_menu.addEventListener("click", function (event) {
			if (event.target == decals_menu.children[0]) return;
			for (var i = 0; i < divs.length; i++)
				divs[i].classList.remove("selected");
			if (!target_div)
				return brace.target = null;
			target_div.classList.add("selected");
			target_div = null;
		});
	}

	function BuildControlButtons (controls, div, use) {
		var up = XML.DOMNode("button", {class: "reorder icon-up"}, controls);
		up.addEventListener("click", function () {
			var prev = div.previousElementSibling;
			if (!prev)
				return;
			var next_svg = use.nextElementSibling;
			use.parentNode.insertBefore(next_svg, use);
			div.parentNode.insertBefore(div, prev);
		});
		var down = XML.DOMNode("button", {class: "reorder icon-down"}, controls);
		down.addEventListener("click", function () {
			var next = div.nextElementSibling;
			if (!next)
				return;
			var prev_svg = use.previousElementSibling;
			use.parentNode.insertBefore(use, prev_svg);
			div.parentNode.insertBefore(next, div);
		});

		var bd = XML.DOMNode("button", {class: "recreate icon-copy", title: "Duplicate",}, controls);
		bd.style.gridColumn = "5";
		var bm = XML.DOMNode("button", {class: "recreate icon-mirror", title: "Mirror",}, controls);
		bm.style.gridColumn = "6";
		return {
			"duplicate": bd,
			"mirror": bm
		};
	}

	function AddDecal (name, id, data) {
		Decals.finishUp();
		var display_name = name
		var d = find(name);
		if (!d)
			return;
		else if (d.hasAttribute("serif:id"))
			display_name = d.getAttribute("serif:id");

		if (name in count)
			count[name]++;
		else
			count[name] = 1;

		if (!id) {
			id = name + "__" + (++nonce);
		} else {
			var dec = id.split("__");
			nonce = Math.max(nonce, +dec[dec.length - 1]);
		}

		var use = XML.SVGNode("use", {
			class: "decal",
			href: "#" + name,
			id: id,
		});
		if (d.hasAttribute("serif:id"))
			use.setAttribute("serif:id", d.getAttribute("serif:id"));

		var D = new Decal(use, decals_group);
		D.parent = decals_list;
		D.visible = true;
		var def = colors[D.id + "__C"] || "#000000";
		if (!data) data = {c: {v:def, force:true}, v: null};
		else if ( !("c" in data) ) data.c = {v:def, force:true};
		D.state = data;

		target_div = D.UI;
		brace.target = D;

		var s = D.state;
		variants.setItem(D.id, s);
		History.push(D, s, {}, 1);
	}

	class ControlButtons extends ArmorControl {
		Build (p) {
			super.Build(p);
			var close = XML.DOMNode("button", {class: "delete right icon-remove no_collapse", title: "Delete"}, p);
			this.UI.className = "decal_buttons no_collapse";

			var buttons = BuildControlButtons(this.UI, p, this.node);
			var a = this.ambient;
			var name = this.id.split("__", 1)[0];
			close.onclick = function () {
				a.parent = null;
				a.visible = null;
				a.closed = true;
				brace.target = null;
			};
			buttons["duplicate"].onclick = function () {
				AddDecal(name, null, a.state);
			};
			buttons["mirror"].onclick = function () {
				var S = a.state;
				var v = S.v;
				v.x = 170 - v.x;
				v.phi = -v.phi;
				v.ax = -v.ax;
				AddDecal(name, null, S);
			};
		}
	}

	class Decal extends GenericControl {
		constructor (node, g) {
			super(node);
			this.SVGParent = g;

			this.push(new ColorPicker(node));
			this.push(new ControlButtons(node));
		}

		get state () {
			var tl = this.node.transform.baseVal;
			var mt = tl[0].matrix;
			var phi = tl[1].angle;
			var ms = tl[2].matrix;
			return {
				c: this.children[0].state,
				v: {x: mt.e, y: mt.f, ax: ms.a, ay: ms.d, phi: phi},
				p: this.p.id
			}
		}

		set state (s) {
			if (s.c)
				this.children[0].state = s.c;
			if ("v" in s) {
				SetTransform(this.node, s.v);
				if (s.force) brace.state = s.v;
				if (this.closed) {
					this.closed = false;
					this.parent = this.parent;
					this.visible = true;

					var S = this.state;
					variants.setItem(this.id, S);
					History.push(this, S, {}, 1);
				}
			} else {
				this.visible = false;
				this.parent = null;
				brace.target = null;
			}
		}

		set visible (v) {
			this.closed = !v;
			if (v) {
				this.SVGParent.appendChild(this.node);
			} else {
				this.node.remove();
				var old = variants.removeItem(this.id);
				History.push(this, {}, old, 1);
			}
		}

		get parent () {return this.p}

		set parent (p) {
			if (p) this.p = p;
			super.parent = p;
			if (p)
				p.insertBefore(this.UI, p.firstElementChild);
		}

		Build (p) {
			super.Build(p);
			this.UI.classList = "decal_control selected";

			var self = this;
			this.UI.onclick = function () {
				if (self.closed)
					return;
				brace.target = self;
				target_div = this;
				decals_group = self.SVGParent;
				decals_list = self.p;
			}
		}
	}

	function Recreate (node) {
		decals_group = node;
		var name = node.id + "List";
		decals_list = find(name);
		for (var id of variants.getKeys(name)) {
			var data = id.match(/(.+)__\d+/);
			var state = variants.getItem(id);
			AddDecal(data[1], id, state);
		}
		decals_group = decals_list = null;
		brace.target = null;
	}

	function SetTransform (target, data) {
		var tl = target.transform.baseVal;
		if (!data) {
			var coords = brace.coordinates(window.innerWidth/2, window.innerHeight/2);
			var scale = brace.coordinates(window.innerWidth, window.innerHeight);
			scale[0] = (scale[0] - coords[0]) / 150;
			scale[1] = (scale[1] - coords[1]) / 150;
			scale = Math.min(scale[0], scale[1]);
			data = { x: coords[0], y: coords[1], ax: scale, ay: scale, phi: 0 };
		}

		var translate = main_svg.createSVGTransform();
		translate.setTranslate(data.x, data.y);
		tl.initialize(translate);

		var rotate = main_svg.createSVGTransform();
		rotate.setRotate(data.phi, 0, 0);
		tl.appendItem(rotate);

		var scale = main_svg.createSVGTransform();
		scale.setScale(data.ax, data.ay);
		tl.appendItem(scale);

		var t2 = main_svg.createSVGTransform();
		t2.setTranslate(-50, -50);
		tl.appendItem(t2);
	}

	function makeName (str, display) {
		str = str.slice(0, 15).split(".", 1)[0];
		if (display)
			return str.split("_", 1)[0].replaceAll("-", " ");
		return btoa(str);
	}

	var done;
	return {
		Add: AddDecal,
		Recreate: Recreate,
		Set: SetTransform,
		set Category (cat) {
			if (cat == null) {
				decals_group = decals_list = null;
			} else {
				var name = cat + "Decals";
				decals_group = find(name);
				decals_list = find(name + "List");
				decals_list.click();
			}
		},
		get SVG () {
			var defs = XML.SVGNode("defs", {id: "Decals"});
			var customs = vault.custom.children;
			for (var n in count) {
				if (count[n] < 1)
					continue;
				var d = vault.def.getElementById(n);
				if (!d) d = vault.custom.getElementById(n);
				defs.appendChild(d.cloneNode(true));
			}
			return defs;
		},
		set SVG (value) {
			main_svg = value;
			brace.SVG = value;
		},
		custom: function (data, name) {
			var id = makeName(name, false) + "__cd";
			var display = makeName(name, true);
			if (vault.custom.getElementById(id) != undefined)
				return false;

			XML.SVGNode("image", {
				href: data,
				width: 100,
				height: 100,
				id: id,
				"serif:id": display
			}, vault.custom);

			var button = XML.DOMNode("button", {class: "type_button"}, customs_menu);
			var svg = XML.SVGNode("svg", {viewBox: "-15 -15 130 130", class: "preview_icon"}, button);
			XML.SVGNode("use", {href: "#" + id}, svg);

			button.onclick = function () {AddDecal(id);}

			var t = document.createTextNode(display);
			button.appendChild(t);
		},
		reset: function () {
			nonce = 0;
			count = {};

			var list = find("Decal_Lists");
			var lists = list.children;
			for (var i = 0; i < lists.length; i++)
				lists[i].innerHTML = "";

			brace.target = null;
			decals_group = decals_list = 0;

			find("decals_menu").classList.remove("selected");
			find("armor_menu").classList.add("selected");
		},
		finishUp: function () {
			if (done) return;
			done = true;
			brace = new DecalsBrace(find("brace"), find("grid"), find("compass"));
			brace.SVG = main_svg;
			Vault.getItem("images/Decals.svg", function (decals) {
				vault.def = decals;
				find("decal_vault").replaceWith(decals);

				var previews = find("Decal_Previews").getElementsByTagName("use");
				for (var i = previews.length - 1; i >= 0; i--)
					previews[i].href.baseVal = "images/Decals.svg" + previews[i].href.baseVal;
			});
			initializeEventHandlers();
		}
	};
}

function addCustomDecal (file) {
	var reader = new FileReader();
	reader.onload = function () {
		Decals.custom(this.result, file.name);
	}
	reader.readAsDataURL(file);
}
