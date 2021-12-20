"use strict";

function DecalsBrace (g, grid, compass) {
	var main_svg = XML.SVGNode("svg");
	var x, y, ax, ay, phi, c, s;
	var target_id, target_category;
	var snapping = find("snapping");

	/* Transforms */
	var target_translate, target_scale, target_rotate;
	var this_translate, this_scale, this_rotate;

	this_translate = main_svg.createSVGTransform();
	this_scale = main_svg.createSVGTransform();
	this_rotate = main_svg.createSVGTransform();
	var tl = g.transform.baseVal;

	tl.initialize(this_translate);
	tl.appendItem(this_rotate);
	tl.appendItem(this_scale);

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

	function setupDragAndDrop (node, before, after) {
		var drag = false;
		var offset = [0, 0];
		var ondown = function(event) {
			ctm = main_svg.getScreenCTM();
			offset = getLocalCoordinates(event);
			offset = before(offset);
			drag = true;
		}
		var onmove = function (event) {
			if (!drag) return;
			event.preventDefault();
			var coord = getLocalCoordinates(event);
			coord[0] -= offset[0];
			coord[1] -= offset[1];
			after(coord);
		}
		var onup = function () {
			if (!drag) return;
			drag = false;
			grid.style.visibility = "hidden";
			compass.style.visibility = "hidden";
			variants.setItem(target_id, {x: x, y: y, ax: ax, ay: ay, phi: phi}, "decal", target_category);
		}

		node.addEventListener("mousedown", ondown);
		node.addEventListener("mousemove", onmove, {passive: false});
		node.addEventListener("mouseup", onup);
		node.addEventListener("mouseleave", onup);

		node.addEventListener("touchstart", ondown);
		node.addEventListener("touchmove", onmove, {passive: false});
		node.addEventListener("touchend", onup);
	}

	var ch = g.lastElementChild.children;
	setupDragAndDrop(ch[0], function (offset) {
		if (snapping.checked)
			grid.style.visibility = "visible";
		return [offset[0] - x, offset[1] - y];
	}, function (coord) {
		if (snapping.checked)
			coord = coord.map(Math.round);
		x = coord[0]; y = coord[1];
		target_translate.setTranslate(x, y);
		this_translate.setTranslate(x, y);
	});
	setupDragAndDrop(ch[1], function (offset) {
		if (snapping.checked) {
			var a = ay * 1.1;
			var m = compass.transform.baseVal[0].matrix;
			m.a = m.d = a;
			m.e = x - a*60;
			m.f = y - a*60;
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
		this_rotate.setRotate(phi, 0, 0);
		target_rotate.setRotate(phi, 0, 0);

		phi = phi * Math.PI / 180;
		c = Math.cos(phi);
		s = Math.sin(phi);
	});
	setupDragAndDrop(ch[2], function (offset) {
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
		target_scale.setScale(ax, ay);
		this_scale.setScale(ax, ay);
	});

	return {
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
			if (value == null) {
				g.style.visibility = "hidden";
				target_id = "";
			} else {
				target_id = value.id;
				g.style.visibility = "";
				var tl = value.transform.baseVal;
				target_translate = tl[0];
				target_rotate    = tl[1];
				target_scale     = tl[2];

				var mt = target_translate.matrix;
				x = mt.e; y = mt.f;
				var ms = target_scale.matrix;
				ax = ms.a; ay = ms.d;
				phi = target_rotate.angle * Math.PI / 180;
				c = Math.cos(phi); s = Math.sin(phi);

				this_translate.setTranslate(x, y);
				this_rotate.setRotate(phi * 180 / Math.PI, 0, 0);
				this_scale.setScale(ax, ay);
			}
		},
		set Category (value) {
			target_category = value;
		}
	}
}

function DecalFactory (Vault, Picker) {
	var count = {}, nonce = 0;
	var decals_list, decals_group;
	var decals_brace = new DecalsBrace(find("brace"), find("grid"), find("compass"));
	var customs_menu = find("custom_decals_menu");

	var main_svg, target_div, vault;

	var vault = Vault.getItem("Decals", function (decals) {
		vault = decals;
	}, find("decal_vault"));

	/* Event Handlers */
	var decals_menu = find("decals_menu");
	var armor_menu = find("armor_menu");
	decals_menu.addEventListener("click", folder_opener);
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
		event.preventDefault();
		decals_menu.classList.remove("selected");
		armor_menu.style.visibility = "visible";
		decals_brace.target = null;
	});
	armor_menu.addEventListener("click", function (event) {
		decals_brace.target = null;
	});

	var previews = find("Decal_Previews");
	var ch = previews.getElementsByTagName("button");
	for (var i = 0; i < ch.length; i++) {
		ch[i].addEventListener("click", function () {
			AddDecal(this.dataset.name, null, {});
		});
	}

	var lists = decals_menu.lastElementChild;
	var divs = lists.getElementsByClassName("decal_control");
	decals_menu.addEventListener("mousedown", function () {
		target_div = null;
	});
	decals_menu.addEventListener("click", function (event) {
		if (event.target == decals_menu.children[0]) return;
		for (var i = 0; i < divs.length; i++)
			divs[i].classList.remove("selected");
		if (!target_div)
			return decals_brace.target = null;
		target_div.classList.add("selected");
	});

	/* Construction Functions */
	function BuildUse (name, id, ref, data) {
		var use = XML.SVGNode("use", {
			class: "decal",
			href: "#" + name,
			id: id
		}, decals_group);
		SetTransform (use, data);
		decals_brace.target = use;
		return use;
	}

	function BuildControlButtons (div, use) {
		var controls = XML.DOMNode("span", {class: "right no_collapse"}, div);

		var up = XML.DOMNode("button", {class: "reorder icon-keyboard_arrow_up"}, controls);
		up.addEventListener("click", function () {
			var prev = div.previousElementSibling;
			if (!prev)
				return;
			var next_svg = use.nextElementSibling;
			use.parentNode.insertBefore(next_svg, use);
			div.parentNode.insertBefore(div, prev);
		});
		var down = XML.DOMNode("button", {class: "reorder icon-keyboard_arrow_down"}, controls);
		down.addEventListener("click", function () {
			var next = div.nextElementSibling;
			if (!next)
				return;
			var prev_svg = use.previousElementSibling;
			use.parentNode.insertBefore(use, prev_svg);
			div.parentNode.insertBefore(next, div);
		});

		var close = XML.DOMNode("button", {class: "remove"}, controls);
		close.innerText = "x";
		return close;
	}

	function AddDecal (name, id, data) {
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
		nonce++;
		if (!id) id = name + "__" + nonce;

		var category = decals_group.id;
		var cat_short = category.replace("Decals", "");

		var use = BuildUse (name, id, d, data);

		var div = XML.DOMNode("div", {class: "decal_control"});
		decals_list.insertBefore(div, decals_list.firstElementChild);

		var button = Picker.build(use, div, {
			text: display_name,
			default: "#000000",
			disabled: name.endsWith("__cd")
		});

		var close = BuildControlButtons(div, use);
		var closed = false;
		close.addEventListener("click", function () {
			closed = true;
			use.remove();
			div.remove();
			delete colors[button.id];
			variants.removeItem(id, "decal", category);
			count[name]--;
		});

		var html_ch = decals_list.children;
		div.addEventListener("click", function () {
			if (closed) {
				decals_brace.target = null;
				return;
			}
			Decals.Category = cat_short;
			decals_brace.target = use;
			target_div = this;
		});

		div.click();
		return div;
	}

	function Recreate (node, decals) {
		decals_group = node;
		decals_list = find(node.id + "List");
		for (var name in decals) {
			var data = name.match(/(.+)__\d+/);
			if (!data)
				continue;
			AddDecal(data[1], name, decals[name]);
		}
		decals_brace.target = null;
	}

	function SetTransform (target, data) {
		var tl = target.transform.baseVal;
		var coords = decals_brace.coordinates(window.innerWidth/2, window.innerHeight/2);
		var scale = decals_brace.coordinates(window.innerWidth, window.innerHeight);
		scale[0] = (scale[0] - coords[0]) / 150;
		scale[1] = (scale[1] - coords[1]) / 150;
		scale = Math.min(scale[0], scale[1]);
		data = {
			x: data.x || coords[0],
			y: data.y || coords[1],
			ax: data.ax || scale,
			ay: data.ay || scale,
			phi: data.phi || 0
		}

		var translate = main_svg.createSVGTransform();
		translate.setTranslate(data.x, data.y);
		tl.initialize(translate);

		var rotate = main_svg.createSVGTransform();
		rotate.setRotate(data.phi * 180 / Math.PI, 0, 0);
		tl.appendItem(rotate);

		var scale = main_svg.createSVGTransform();
		scale.setScale(data.ax, data.ay);
		tl.appendItem(scale);

		var t2 = main_svg.createSVGTransform();
		t2.setTranslate(-50, -50);
		tl.appendItem(t2);

		decals_brace.target = null;
		variants.setItem(target.id, data, "decal", target.parentNode.id);
	}

	function makeName (str, display) {
		str = str.split(".", 1)[0];
		if (display)
			return str.replaceAll("-", " ");
		str = str.replace("-", "");
		return encodeURIComponent(str);
	}

	return {
		Recreate: Recreate,
		Set: SetTransform,
		set Category (cat) {
			if (cat == null) {
				decals_brace.Category = null;
				decals_group = decals_list = null;
			} else {
				decals_brace.Category = cat + "Decals";

				decals_group = find(cat + "Decals");
				decals_list = find(cat + "DecalsList");
				decals_list.click();
			}
		},
		get SVG () {
			var defs = XML.SVGNode("defs", {id: "Decals"});
			var ch = find("decal_vault").children;
			var i = 0;
			while (i < ch.length) {
				var id = ch[i].id;
				if (count[id] >= 1) {
					var n = ch[i].cloneNode(true);
					n.removeAttribute("serif:id");
					defs.appendChild(n);
				}
				i++;
			}
			return defs;
		},
		set SVG (value) {
			main_svg = value;
			decals_brace.SVG = value;
		},
		custom: function (data, name, parent) {
			var id = makeName(name, true) + "__cd";
			var display = makeName(name, true);

			var button = XML.DOMNode("button", {class: "type_button"}, customs_menu);
			var svg = XML.SVGNode("svg", {viewBox: "-15 -15 130 130", class: "preview_icon"}, button);
			XML.SVGNode("use", {href: "#" + id}, svg);

			XML.SVGNode("image", {
				href: data,
				width: 100,
				height: 100,
				id: id,
				"serif:id": display
			}, vault);

			button.addEventListener("click", function () {
				AddDecal(id, null, {});
			});

			var t = document.createTextNode(display);
			button.appendChild(t);
		},
		reset: function () {
			nonce = 0;
			count = {};
		}
	};
}

function addCustomDecal (files) {
	for (var i = 0; i < files.length; i++) {
		var reader = new FileReader();
		let name = files[i].name;
		reader.onload = function () {
			Decals.custom(this.result, name);
		}
		reader.readAsDataURL(files[i]);
	}
}
