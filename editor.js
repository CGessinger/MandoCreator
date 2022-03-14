/* MandoCreator */
"use strict";
var Download, History, Settings, Decals;
var colors, variants;

var Vault = {
	vault: {},
	finishUp: function (svg, onload) {
		svg = svg.cloneNode(true);
		if (onload)
			onload(svg);
		return svg;
	},
	getItem: function (name, onload) {
		if (name in this.vault)
			return this.finishUp(this.vault[name], onload);

		var xhr = new XMLHttpRequest();
		xhr.open("GET", name);
		xhr.setRequestHeader("Cache-Control", "no-cache, max-age=10800");
		xhr.responseType = 'document';
		var self = this;
		xhr.onload = function () {
			var xml = this.responseXML;
			if (this.status !== 200 || !xml)
				return;
			var svg = xml.documentElement;
			self.vault[name] = svg;
			self.finishUp(svg, onload);
		};
		xhr.send();
	}
}

class ArmorControl {
	static Picker = new PickerFactory;
	static DOMLists = [];

	static init (am) {
		this.Picker.finishUp();

		var topLevelLists = am.getElementsByClassName("slide_content");
		for (var i = 0; i < topLevelLists.length; i++)
			this.DOMLists.push(topLevelLists[i]);
	}

	static cache () {
		this.Picker.cache();
		variants.cache();
	}

	constructor (node) {
		this.node = node;
		this.children = [];
		this.UI = null;
	}

	push (ch) {
		this.children.push(ch);
		ch.ambient = this;
	}

	get id () {return this.node.id}

	get name () {
		if (this.node.hasAttribute("serif:id"))
			return this.node.getAttribute("serif:id");
		return this.id.split("_", 1)[0].replace(/-/g, " ");
	}

	get state () {
		var s = {};
		for (var c of this.children)
			s[c.id] = c.state;
		return s;
	}

	set state (s) {
		for (var c of this.children)
			c.state = s[c.id];
	}

	get parent () {
		if ("p" in this)
			return this.p;
		var san = this.id.split("_", 1)[0];
		if (san == "Vest")
			san = "Suit";
		san += "Colors";
		this.p = ArmorControl.DOMLists.find(L => L.id == san);
		return this.p;
	}

	set parent (p) {
		if (p) {
			p = this.parent || p;
			if (!this.UI)
				this.Build(p);
			if (this.par)
				p.appendChild(this.par);
			p.appendChild(this.UI);
		} else {
			if (this.UI)
				this.UI.remove();
			if (this.par)
				this.par.remove();
		}
	}

	set visible (v) {
		this.node.style.display = v ? "" : "none";
	}

	deconstruct () {
		this.parent = null;
		for (var c of this.children)
			c.deconstruct();
		this.children = this.node = this.UI = this.par = null;
	}

	Build (p) {
		if (p.tagName == "DETAILS" &&
		    p.childElementCount == 0) {
			var id = this.name;
			if (p != this.p)
				id = this.ambient.name;
			var par = XML.DOMNode("summary", {class: "headline no_collapse"}, p);
			par.innerText = id + " Options:";
			var symmetric = id.match(/Left|Right/);
			if (symmetric)
				Build.Mirror(par, this, symmetric[0]);
			p.onclick = function (event) {
				if (event.target == par) return;
				this.open = true;
			};
			this.par = par;
		}
		this.UI = XML.DOMNode("div", {});
	}
}

class GenericControl extends ArmorControl {
	constructor (node) {
		super(node);

		var uie; /* child */
		var options = [], toggles = [];
		var ch = node.children;
		for (var i = ch.length - 1; i >= 0; i--) {
			var cls = ch[i].getAttribute("class");
			if (cls == "option")
				options.push(ch[i]);
			else if (cls == "toggle")
				toggles.push(ch[i]);
			else {
				uie = Build.Deserialize(ch[i]);
				if (uie) this.push(uie);
			}
		}

		/* Step 2.2: Build controls for .option and .toggle */
		if (options.length) {
			if (node.id.includes("Ear"))
				uie = new IconCheckboxes(node, options);
			else
				uie = new ArmorSelect(node, options);
			this.push(uie);
		}
		for (var o of toggles)
			this.push(new Toggle(o));
	}

	get parent () {return super.parent}

	set parent (p) {
		super.parent = p;
		if (p) {
			for (var c of this.children)
				c.parent = this.UI;
		} else {
			for (var c of this.children)
				c.parent = null;
		}
	}
}

class ColorPicker extends ArmorControl {
	constructor (node) {
		super(node);
		this.def = "#FFFFFF";
		if (node.hasAttribute("fill"))
			this.def = node.getAttribute("fill");
	}

	get state () {
		return {v: colors[this.id + "__C"] || this.def};
	}

	set state (s) {
		this.node.setAttribute("fill", s.v);
		if (s.v === this.def)
			delete colors[this.id + "__C"];
		else
			colors[this.id + "__C"] = s.v;
		if (!s.force) return;

		this.input.style.backgroundColor = s.v;
		this.label.innerText = s.v;
	}

	Build (p) {
		super.Build(p);
		this.UI = ArmorControl.Picker.build(this, p, {
			disabled: this.id.includes("__cd")
		});
		this.input = this.UI.children[0];
		this.label = this.UI.children[1].lastElementChild;

		var s = this.state;
		s.force = 1;
		this.state = s;
	}
}

class Toggleable extends ArmorControl {
	constructor (node) {
		super(node);
		this.def = (node.style.display !== "none");
		this.ch = Build.Deserialize(node);
		this.push(this.ch);
	}

	get state () {
		return {
			v: this.input.checked,
			c: this.ch.state
		};
	}

	set state (s) {
		this.ch.parent = s.v ? this.ambient.UI : null;
		this.ch.visible = s.v;

		if (s.force) this.input.checked = s.v;
		if (s.c) this.ch.state = s.c;

		var id = this.id + "__T";
		var old;
		if (s.v != this.def)
			old = variants.setItem(id, s.v);
		else
			old = variants.removeItem(id);
		if (old === undefined) old = this.def;
		History.push(this, s, {v: old});
	}

	EventHandler (parent) {
		var self = this;
		return function () {
			self.state = {v: this.checked};
		}
	}
}

class Toggle extends ArmorControl {
	constructor (node) {
		super(node);
		this.push(new Toggleable(node));
	}

	get parent () {return;}
	set parent (p) {super.parent=p}

	get state () {
		var s = {v: this.input.checked}
		if (this.input.checked)
			s.c = this.children[0].state
		return s;
	}

	set state (s) {
		if (this.input.checked ^ s.v)
			this.input.click();
		if (s.v && s.c)
			this.children[0].state = s.c;
	}

	Build (parent) {
		super.Build(parent);
		/* Step 1: Build all DOM components */
		var label = XML.DOMNode("label", {class: "pseudo_checkbox no_collapse"}, this.UI);

		var span = XML.DOMNode("span", {class: "pseudo_label"}, label);
		span.innerText = this.name;

		var id = this.id + "__T";
		var input = XML.DOMNode("input", {type: "checkbox", id: id, class: "armor_toggle"}, label);
		var sp = XML.DOMNode("span", {class: "slider right"}, label);

		if (id.startsWith("Right"))
			Build.Mirror(label, this, "Right");
		else if (id.startsWith("Left"))
			Build.Mirror(label, this, "Left");

		/* Step 2: Find the default value and attach an event handler */
		if (id.startsWith("Mask")) {
			input.onchange = function (event) {
				this.checked = false;
				showRoll('Neo');
			}
		} else {
			var uie = this.children[0];
			var handler = uie.EventHandler(this);
			uie.input = input;

			input.onchange = handler;
			input.checked = uie.def;
			if (variants.hasItem(id))
				input.checked = variants.getItem(id);
			handler.bind(input)();
		}
		this.input = input;
	}
}

class IconCheckboxes extends ArmorControl {
	static icons = {
		"Range Finder":	"icon-range-finder",
		"Main Antenna":	"icon-main-antenna",
		"Sensor Stalk":	"icon-sensor-stalk",
		"Sub Antenna":	"icon-sub-antenna",
		"Lear Cap":	"icon-lear-cap",
		"Antenna":	"icon-heavy-antenna",
		"Module":	"icon-module"
	}

	constructor (node, options) {
		super(node);
		for (var i = 0; i < options.length; i++) {
			var uie = new Toggleable(options[i]);
			uie.visible = false;
			this.push(uie);
		}
	}

	get state () {
		var s = {};
		var ch = this.input.children;
		for (var k = 0; k < this.children.length; k++) {
			var i = ch[2 * k];
			if (i.checked) {
				var c = this.children[k];
				s[c.id] = c.state;
			}
		}
		return s;
	}

	set state (s) {
		var ch = this.input.children;
		for (var k = 0; k < this.children.length; k++) {
			var c = this.children[k];
			var i = ch[2 * k];
			if (c.id in s) {
				if (!i.checked)
					i.click();
				c.state = s[c.id];
			} else {
				if (i.checked)
					i.click();
			}
		}
	}

	Build (parent) {
		super.Build(parent);
		var icons_wrapper = XML.DOMNode("div", {class: "checkbox_list no_collapse"}, this.UI);

		for (var o of this.children) {
			var title = o.name;
			var id = o.id + "__T";

			/* Step 1: Build a checkbox hidden behind an icon */
			var input = XML.DOMNode("input", {type: "checkbox", class: "checkbox", id: id}, icons_wrapper);
			var label = XML.DOMNode("label", {
				for: id, title: title,
				class: "checkbox_label " + IconCheckboxes.icons[title]
			}, icons_wrapper);

			/* Step 2: Attach an event handler to the checkbox */
			o.def = false;
			o.input = input;
			input.onchange = o.EventHandler(this);
			input.checked = variants.getItem(id);
			input.onchange();
		}
		this.input = icons_wrapper;
	}
}

class ArmorSelect extends ArmorControl {
	constructor (node, options) {
		super(node);
		for (var o of options)
			this.push(Build.Deserialize(o));

		var def = this.def;
		for (var c of this.children)
			c.visible = (c.id == def);
	}

	EventHandler () {
		var self = this;
		return function (event) {
			self.state = {v: this.value};
		}
	}

	get state () {
		var s = {v: this.input.value};
		for (var o of this.children)
			if (o.id == s.v) {
				s.c = o.state;
				break;
			}
		return s;
	}

	set state (s) {
		for (var o of this.children) {
			if (o.id == s.v) {
				o.visible = true;
				o.parent = this.UI;
				if (s.c)
					o.state = s.c;
			} else {
				o.visible = false;
				o.parent = null;
			}
		}
		if (s.force)
			this.input.value = s.v;
		var old = variants.setItem(this.id + "__S", s.v);
		History.push(this, s, {v: old});
	}

	get def () {
		var def = this.children[0].id;
		var id = this.id + "__S";
		if (variants.hasItem(id))
			def = variants.getItem(id);
		return def;
	}

	Build (parent) {
		super.Build(parent);
		/* Step 1: Build a <select> */
		var wrapper = XML.DOMNode("div", {class: "select_wrapper no_collapse"}, this.UI); /* For arrow placement */
		var select = XML.DOMNode("select", {id: this.id + "__S", class: "component_select"}, wrapper);

		/* Step 2: Iterate over the options, creating an <option> and Controls for each one */
		var def = this.def;
		for (var c of this.children)
			select.add(new Option(c.name, c.id, false, c.id == def));

		/* Step 3: Attach event handlers */
		var handler = this.EventHandler();
		select.onchange = handler;
		handler.bind(select)();
		this.input = select;
	}
}

class Previewable extends GenericControl {
	static vault = find("item_vault");

	constructor (node, SVGParent) {
		super(node);
		this.SVGParent = SVGParent;
	}

	deconstruct () {
		this.node.remove();
		super.deconstruct();
	}

	set visible (v) {
		if (this.v === v) return;
		this.input.checked = v;
		if (v) {
			this.SVGParent.appendChild(this.node);
			for (var c of this.children) {
				c.parent = c.parent || this.parent;
			}
		} else {
			Previewable.vault.appendChild(this.node);
			for (var c of this.children)
				c.parent = null;
		}
		this.v = v;
	}
}

class Swappable extends ArmorControl {
	constructor (node) {
		super(node);

		var ch = node.children;
		for (var i = 0; i < ch.length; i++)
			this.push(new Previewable(ch[i], node));
	}

	EventHandler (child) {
		var self = this;
		return function () {
			self.state = {v: child.id};
		}
	}

	get state () {
		return {
			v: this.selection.id,
			c: this.selection.state
		}
	}

	set state (s) {
		for (var o of this.children) {
			if (o.id == s.v) {
				this.selection = o;
			} else {
				o.visible = false;
			}
		}
		this.selection.visible = true;
		if (s.c) this.selection.state = s.c;
		var old = variants.setItem(this.id, s.v);
		History.push(this, s, {v: old});
	}

	get parent () {
		switch (this.id) {
			case "Helmets":
			case "Helmet":
				return find("HelmetOptions");
			case "Chest":
				return find("UpperArmorOptions");
		}
	}

	set parent (p) {
		var previews = this.parent.getElementsByTagName("details")[0];
		for (var c of this.children) {
			c.input = previews.querySelector("#" + c.id + "Radio");
			c.input.onchange = this.EventHandler(c);
		}
		this.state = {v: variants.getItem(this.id)};
	}
}

class Build {
	static MirrorImage (s, t, o) {
		if (s === true || s === false)
			return s;
		if (s.replace)
			return s.replace(t, o);
		var n = {force: true};
		for (var a in s) {
			n[a.replace(t, o)] = Build.MirrorImage(s[a], t, o);
		}
		return n;
	}

	static Mirror (headline, self, ts) {
		var b = XML.DOMNode("button", {class: "mirror_button right", title:"Mirror Settings"}, headline);
		b.innerText = "\uE915";

		var os = (ts == "Left") ? "Right" : "Left";
		var id = self.id.replace(ts, os);
		b.onclick = function () {
			var state = Build.MirrorImage(self.state, ts, os);

			for (var c of self.ambient.children) {
				if (c.id == id) {
					History.push(c, state, c.state);
					interactive = false;
					c.state = state;
					interactive = true;
					break;
				}
			}
			ArmorControl.cache();
		};
	}

	static Deserialize (node) {
		/* Check for decals lists */
		if (node.hasAttribute("mask"))
			return Decals.Recreate(node);

		if (node.tagName != "g")
			return new ColorPicker(node);

		if (node.getAttribute("class") == "swappable")
			return new Swappable(node);

		var ch = node.children;
		for (var i = ch.length - 1; i >= 0; i--) {
			if (ch[i].id == "")
				return new ColorPicker(node);
		}

		return new GenericControl(node);
	}
}

function SettingsManager () {
	var main = find("main");
	var ToplevelControl;

	return {
		set Sex (female) {
			if (ToplevelControl)
				ToplevelControl.deconstruct();
			History.reset();

			var master_file = female ? "images/Female.svg" : "images/Male.svg";
			Vault.getItem(master_file, function (svg) {
				Decals.SVG = svg;
				var body = svg.lastElementChild;
				var i = 0;
				var h, ch = body.children;
				while (h = ch[i++])
					if (h.id == "Helmets") break;

				Vault.getItem("images/Helmets.svg", function (helmets) {
					var ch = helmets.children;
					while (ch.length)
						h.appendChild(ch[0]);
					interactive = false;

					ToplevelControl = Build.Deserialize(body);
					ToplevelControl.parent = XML.DOMNode("div", {});

					var r = find("HelmetRadio")
					r.checked = true;

					interactive = true;
					ArmorControl.cache()

					svg.style.height = "100%";
					main.replaceChild(svg, main.lastElementChild);
				});
			});
			localStorage.setItem("female_sex", (!!female).toString());
		}
	}
}

function VariantsVault (asString) {
	var __vars = {
		"Helmets": "Helmet_Classic",
		"Chest": "Chest_Classic"
	};
	if (asString)
		__vars = JSON.parse(asString);
	this.cache = function () {
		localStorage.setItem("variants", JSON.stringify(__vars));
	}
	this.cache();

	this.hasItem = function (key) {
		return key in __vars;
	}
	this.getKeys = function* (key) {
		for (var e in __vars) {
			if (__vars[e].p == key)
				yield e;
		}
	}
	this.setItem = function (key, value, target) {
		var o = __vars[key];
		if (value == o)
			return;
		__vars[key] = value;
		this.cache();
		return o;
	}
	this.getItem = function (key) {
		return __vars[key];
	}
	this.removeItem = function (key) {
		if ( !(key in __vars) )
			return;
		var o = __vars[key];
		delete __vars[key];
		this.cache();
		return o;
	}
}

function MandoCreator () {
	var female = (localStorage.getItem("female_sex") == "true");
	History = new HistoryTracker;

	Decals = new DecalFactory(ArmorControl.Picker);

	Settings = new SettingsManager();
	variants = new VariantsVault(localStorage.getItem("variants"));
	colors = resetColorCache(true);

	function readQueryString (st) {
		if (!st) return {};
		var options = {};
		var regex = /(\w+)=([^&]*)&?/g;
		var matches;
		while (matches = regex.exec(st)) {
			options[matches[1]] = unescape(matches[2]);
		}
		history.replaceState(null, document.title, "?");
		return options;
	}

	/* ---------- Pre-Setup ---------- */
	var opt = readQueryString(window.location.search);
	/* ---------- Main Setup ---------- */
	if ("preset" in opt) {
		Vault.getItem(opt.preset, function (svg) {
			Uploader.dissectSVG(null, svg);
		});
	} else {
		Settings.Sex = female;
	}
	/* ---------- Post-Setup ---------- */
	var am = find("armor_menu");
	ArmorControl.init(am);
	document.body.onload = function () {
		Download = new Downloader (Decals);
		Download.attach(find("download_svg"), "image/svg+xml");
		Download.attach(find("download_jpeg"), "image/jpeg");
		Download.attach(find("share"), "share");

		Uploader.attach(find("background_upload"), "background");
		Uploader.attach(find("reupload"), "armor");

		setupControlMenu(am, find("decals_menu"));

		setDefaultBackground();
	}
}

function openFolder (folder) {
	var parent = folder.parentNode;
	var folders = parent.children;
	for (var i = 0; i < folders.length; i++)
		folders[i].classList.remove("selected");
	folder.classList.add("selected");
}

function slide_opener (f, slides) {
	return function (event) {
		if (event.defaultPrevented) return;
		for (var k = 0; k < slides.length; k++)
			slides[k].classList.remove("selected");
		f.classList.remove("overview");
		this.classList.add("selected");
	}
}
function slide_closer (f) {
	return function (event) {
		if (f.classList.contains("overview"))
			return;
		event.preventDefault();
		f.classList.add("overview");
	}
}

function setupControlMenu (armor_menu, decals_menu) {
	var folders = armor_menu.getElementsByClassName("folder");
	for (var i = 0; i < folders.length; i++) {
		var slides = folders[i].getElementsByClassName("slide");
		var radioName = folders[i].id.replace("Options", "Radio");
		let radio = find(radioName);
		folders[i].onclick = function(event){
			if (event.defaultPrevented) return;
			radio.checked = true;
			openFolder(this);
		};
		var opener = slide_opener(folders[i], slides);
		var closer = slide_closer(folders[i]);
		for (var j = 0; j < slides.length; j++) {
			slides[j].onclick = opener;
			var b = slides[j].firstElementChild;
			b.onclick = closer;
		}
	}

	var decal_toggles = armor_menu.getElementsByClassName("decals_toggle");
	var handler = function (event) {
		event.preventDefault();
		Decals.finishUp();
		Decals.Category = this.dataset.category;
		armor_menu.style.visibility = "hidden";
	}
	for (var i = 0; i < decal_toggles.length; i++)
		decal_toggles[i].onclick = handler;

	armor_menu.addEventListener("click", function (event) {
		if (event.defaultPrevented)
			return;
		this.style.visibility = "";
		decals_menu.classList.remove("selected");
	});

	armor_menu.firstElementChild.addEventListener("click", function (event) {
		armor_menu.classList.toggle("menu_collapsed");
		decals_menu.classList.toggle("menu_collapsed");
	});

	if (window.innerWidth > 786) {
		armor_menu.classList.remove("menu_collapsed");
		decals_menu.classList.remove("menu_collapsed");
	}
}

function setSponsor (sponsor, href) {
	var link = find(sponsor);
	link.href = href;
	link.hidden = false;
	link.dataset.show = "true";

	var img = link.getElementsByTagName("img")[0];
	if (!img.hasAttribute("src"))
		img.src = "assets/" + sponsor + ".png";
	var parent = link.parentNode;
	var closer = parent.firstElementChild;
	closer.hidden = false;
	closer.dataset.show = "true";
}

function UpdateSponsor (category) {
	var parent = find(category + "Options");
	var sponsor_modal = parent.lastElementChild;
	var items = sponsor_modal.children;
	for (var i = 0; i < items.length; i++) {
		if (items[i].dataset.show == "true")
			delete items[i].dataset.show;
		else
			items[i].hidden = true;
	}
}

function resetColorCache (cached) {
	if (cached && "colors" in localStorage)
		return JSON.parse(localStorage.colors);
	return {
		undefined: "#FFFFFF",
		"Bucket_Budget-Bucket__C":	"#F74416",
		"Visor_Budget-Bucket__C":	"#000000",
		"Rage_Gauntlet_Right__C":	"#08CB33",
		"Rage_Gauntlet_Left__C":	"#08CB33"
	};
}

var Zoom = new (function () {
	var z = find("zoom");
	z.value = 100;
	var main = find("main");
	return {
		set scale (value) {
			if (value <= 0)
				value = z.value;
			var SVG = main.lastElementChild;
			SVG.style.height = value + "%";
		},
		in: function () {
			z.stepUp(10);
			this.scale = z.value;
		},
		out: function () {
			z.stepDown(10);
			this.scale = z.value;
		}
	}
})()

function showRoll (type) {
	var rickRoll = find("rickroll");
	rickRoll.src = "assets/" + type + "Roll.mp4";
	rickRoll.style.display = "";
	setTimeout(function () {
		rickRoll.style.display = "none";
	}, 10000);
}

function playKote () {
	var kote = find("kote");
	kote.src = "assets/KOTE.mp3";
}

function reset (skipBuild, skipPrompt) {
	var conf = skipPrompt || confirm("This will erase all settings, such as colors and armor pieces. Do you want to proceed? This cannot be undone.\n\nSave or save not. There is no undo.");
	if (!conf) return;
	variants = new VariantsVault(null);
	colors = resetColorCache(false);
	History.reset();
	Decals.reset();
	if (skipBuild)
		return;
	Settings.Sex = find("female").checked;
}

function setDefaultBackground () {
	Download.Background = {
		data: "images/Background.svg",
		custom: false
	};
}
