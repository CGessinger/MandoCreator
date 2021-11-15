/* MandoCreator */
"use strict";
var Download, History, Vault, Builder, Settings, Decals;
var colors, variants;

function find (st) {
	return document.getElementById(st);
}

function SVGVault () {
	var vault = {};
	function finishUp (svg, onload, replace) {
		svg = svg.cloneNode(true);
		if (replace && (replace != svg)) {
			var par = replace.parentNode;
			par.replaceChild(svg, replace);
		}
		if (onload)
			onload(svg);
		return svg;
	}
	this.getItem = function (name, onload, replace) {
		if (name in vault)
			return finishUp(vault[name], onload, replace);

		var xhr = new XMLHttpRequest();
		xhr.open("GET", "images/" + name + ".svg");
		xhr.setRequestHeader("Cache-Control", "no-cache, max-age=10800");
		xhr.responseType = 'document';
		return new Promise(function (resolve) {
			xhr.onload = function () {
				var xml = xhr.responseXML;
				if (xhr.status !== 200 || !xml) {
					resolve(null);
				} else {
					var svg = xml.documentElement;
					vault[name] = svg;
					finishUp(svg, onload, replace);
					resolve(svg);
				}
			};
			xhr.send();
		});
	}
}

function BuildManager (History, Picker, Decals) {
	var swapLists = [];
	var icons = {
		"Range Finder":	"icon-range-finder",
		"Main Antenna":	"icon-main-antenna",
		"Sub Antenna":	"icon-sub-antenna",
		"Sensor Stalk":	"icon-sensor-stalk",
		"Antenna":	"icon-antenna",
		"Lear Cap":	"icon-lear-cap",
		"Module":	"icon-module"
	}
	var categories = {
		"Helmet":	["Helmet"],
		"UpperArmor":	["Biceps", "Chest", "Chest-Attachments", "Collar", "Shoulders", "Gauntlets"],
		"LowerArmor":	["Shins", "Foot", "Knees", "Thighs", "Groin", "Waist"],
		"SoftParts":	["Boots", "Suit", "Sleeves", "Gloves", "Vest"],
		"Extras":	["Extras_Front", "Extras_Back"],
		"Helmet":	["Helmets"]
	}
	function findCategory (id) {
		for (var i in categories)
			if (categories[i].includes(id))
				return i;
		return "";
	}

	var hax = { /* Store the location for all those parts, where it isn't apparent from the name */
		"Vest": "Suit",
	}
	var variantID = null;
	var swapFilter = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT,
		{ acceptNode: function (node) {
			if (node.getAttribute("class") == "swappable")
				return NodeFilter.FILTER_ACCEPT;
			variantID = node.id;
			return NodeFilter.FILTER_REJECT;
		} }
	);
	function BuildMirrorButton (headline, parent, thisSide) {
		var b = XML.DOMNode("button", {class: "mirror_button right", title:"Mirror Settings"}, headline);
		b.innerText = "\uE915";
		var walker = document.createTreeWalker(parent, NodeFilter.SHOW_ELEMENT,
			{ acceptNode: function (node) {
				if (node.hasAttribute("class") && (node.id !== ""))
					return NodeFilter.FILTER_ACCEPT;
				return NodeFilter.FILTER_SKIP;
			} }
		);
		var otherSide = (thisSide == "Left") ? "Right" : "Left";
		var node;
		b.addEventListener("click", function () {
			var changes = [];
			walker.currentNode = parent;
			showPicker = History.track = false;
			while (node = walker.nextNode()) {
				var c, newValue;
				var mirrorImageName = node.id.replace(thisSide, otherSide);
				var mirrorImage = find(mirrorImageName);
				if (!mirrorImage)
					continue;
				switch (node.getAttribute("class")) {
					case "color_picker":
						newValue = node.style.backgroundColor;
						c = History.format("color", mirrorImage.style.backgroundColor, newValue, mirrorImageName)
						mirrorImage.style.backgroundColor = newValue;
						mirrorImage.click();
						break;
					case "component_select":
						newValue = node.value.replace(thisSide, otherSide);
						c = History.format("select", mirrorImage.value, newValue, mirrorImageName);
						mirrorImage.value = newValue;
						mirrorImage.dispatchEvent(new Event("change"));
						break;
					case "armor_toggle":
						c = History.format("toggle", mirrorImage.checked, node.checked, mirrorImageName);
						if (node.checked ^ mirrorImage.checked)
							mirrorImage.click();
						break;
					default:
						c = {}
				}
				if ("target" in c) changes.push(c);
			}
			showPicker = History.track = true;
			if (changes.length > 0)
				History.push(changes);
		});
	}
	var armor_menu = find("armor_menu")
	var possibleParents = armor_menu.getElementsByClassName("slide_content");
	function DOMParent (node) {
		/* Step 1: Find the parent in the DOM */
		var id = node.id;
		var san = id.split("_",1)[0];
		if (san in hax)
			id = san = hax[san];
		san += "Colors";
		var parent = null;
		for (var i = 0; i < possibleParents.length; i++) {
			if (possibleParents[i].id == san) {
				parent = possibleParents[i];
				break;
			}
		}
		if (!parent) return;
		/* Step 2: Check for swappable armor pieces */
		variantID = node.id;
		swapFilter.currentNode = node;
		if (swapFilter.parentNode()) {
			parent = XML.DOMNode("details", {class: "swapslide", open: true}, parent);
			swapLists.push(parent);
		}
		/* Step 3: If the parent is empty, make a headline */
		if (parent.childElementCount == 0) {
			var par = XML.DOMNode("summary", {class: "headline no_collapse"}, parent);
			par.innerText = prettify(id) + " Options:";
			var symmetric = id.match(/Left|Right/);
			if (symmetric)
				BuildMirrorButton(par, parent, symmetric[0]);
			parent.addEventListener("click", function (event) {
				if (event.target == par) return;
				this.open = true;
			});
		}
		return parent;
	}

	function prettify (str) {
		var components = str.split("_", 1)[0];
		return components.replace(/-/g, " ");
	}

	function BuildToggle (toggle, parent) {
		/* Step 1: Build all DOM components */
		parent = XML.DOMNode("div", {}, parent);
		var label = XML.DOMNode("label", {class: "pseudo_checkbox no_collapse"}, parent);

		var span = XML.DOMNode("span", {class: "pseudo_label"}, label);
		span.innerText = prettify(toggle.id);

		var id = toggle.id + "Toggle";
		var input = XML.DOMNode("input", {type: "checkbox", id: id, class: "armor_toggle"}, label);
		var sp = XML.DOMNode("span", {class: "slider right"}, label);

		var subslide = XML.DOMNode("div", {class: "subslide"}, parent);
		if (id.startsWith("Right"))
			BuildMirrorButton(label, parent, "Right");
		else if (id.startsWith("Left"))
			BuildMirrorButton(label, parent, "Left");

		/* Step 2: Find the default value and attach an event handler */
		if (id.startsWith("Mask")) {
			input.onchange = function (event) {
				this.checked = false;
				showRoll('Neo');
			}
		} else {
			var defaultOn = (toggle.style.display !== "none");
			var handler = function () {
				if (this.checked) {
					subslide.style.display = "";
					toggle.style.display = "";
				} else {
					subslide.style.display = "none";
					toggle.style.display = "none";
				}
				if (this.checked != defaultOn)
					variants.setItem(id, this.checked, "toggle");
				else
					variants.removeItem(id, "toggle");
			}
			input.addEventListener("change", handler);
			input.checked = defaultOn;
			if (variants.hasItem(id))
				input.checked = variants.getItem(id);
			handler.bind(input)();
		}
		return BuildManager(toggle, subslide);
	}

	function SelectHistoryHandler (pairs, id) {
		return function (event) {
			variants.setItem(id, this.value, "select");
			for (var i in pairs) {
				var p = pairs[i];
				if (p[0].id == this.value) {
					p[0].style.display = "inherit";
					p[1].style.display = "";
				} else {
					p[0].style.display = "";
					p[1].style.display = "none";
				}
			}
		}
	}

	function BuildDropDown (options, name, parent) {
		/* Step 1: Build a <select> */
		var id = name + "Select";
		var wrapper = XML.DOMNode("div", {class: "select_wrapper no_collapse"}, parent); /* For arrow placement */
		var select = XML.DOMNode("select", {id: id, class: "component_select"}, wrapper);

		/* Step 2: Iterate over the options, creating an <option> and Controls for each one */
		var def = options[options.length-1].id;
		if (variants.hasItem(id))
			def = variants.getItem(id);
		var pairs = [];
		while (options.length) {
			var o = options.pop();
			var label = prettify(o.id);

			/* Step 2.1: Build an <option> and attach it to the <select> */
			var opt = new Option(label, o.id, false, (o.id == def));
			select.add(opt);

			/* Step 2.2: Build Controls */
			var subParent = XML.DOMNode("div", {id: o.id + "SubColors"});
			BuildManager(o, subParent);
			parent.appendChild(subParent);
			pairs.push([o,subParent]);
		}

		/* Step 3: Simulate a change event, to trigger all the right handlers */
		var handler = SelectHistoryHandler(pairs, id, def);
		select.addEventListener("change", handler);
		handler.bind(select)();
	}

	function CheckboxHistoryHandler (id, sublist, node) {
		return function () {
			if (this.checked) {
				sublist.style.display = "";
				node.style.display = "inherit";
			} else {
				sublist.style.display = "none";
				node.style.display = "";
			}
			if (this.checked)
				variants.setItem(id, true, "toggle");
			else
				variants.removeItem(id, "toggle");
		}
	}
	function BuildCheckboxes (options, parent) {
		var icons_wrapper = XML.DOMNode("div", {class: "checkbox_list no_collapse"}, parent);
		while (options.length) {
			var o = options.pop();
			var title = prettify(o.id);
			var id = o.id + "Toggle";

			/* Step 2.1: Build a checkbox hidden behind an icon */
			var input = XML.DOMNode("input", {type: "checkbox", class: "checkbox", id: id}, icons_wrapper);
			var label = XML.DOMNode("label", {for: id, class: "checkbox_label " + icons[title], title: title}, icons_wrapper);

			/* Step 2.2: Build a sublist for all the colors to go in */
			var sublist = XML.DOMNode("div", {id: o.id+"SubColors"}, parent);
			BuildManager(o, sublist);

			/* Step 2.3: Attach an event handler to the checkbox */
			var handler = CheckboxHistoryHandler(id, sublist, o);
			input.addEventListener("change", handler);
			input.checked = variants.getItem(id);
			handler.bind(input)();
		}
	}

	function attachSwapRadio (node, type) {
		var radio = find(node.id + "Radio");
		var s = swapLists;
		radio.onchange = function () {
			node.dataset.show = "true";
			for (var i = 0; i < s.length; i++)
				s[i].dataset.show = "true";
			variants.setItem(type, node.id, "variant");
		}
		swapLists = [];
	}

	function setupSwapHandler (node, category) {
		var options = find(category + "Options");
		var slides = options.getElementsByClassName("swapslide");
		var ch = node.children;
		var typesList = options.getElementsByTagName("details")[0];
		typesList.onchange = function () {
			for (var i = 0; i < slides.length; i++) {
				if ("show" in slides[i].dataset) {
					slides[i].style.display = "block";
					delete slides[i].dataset.show;
				} else {
					slides[i].style.display = "";
				}
			}
			for (var j = 0; j < ch.length; j++) {
				if ("show" in ch[j].dataset) {
					ch[j].style.visibility = "visible";
					delete ch[j].dataset.show;
				} else {
					ch[j].style.visibility = "";
				}
			}
		}
	}

	function BuildManager (node, realParent) {
		/* Step 0.1: Check if the node needs treatment */
		var ch = node.children;
		if (!ch.length && node.tagName == "g")
			return;
		/* Step 0.2: Look for an appropriate DOM parent */
		var possibleParent = DOMParent(node);
		if (possibleParent)
			realParent = possibleParent;

		/* Step 1: Check if node has a named child. If not, build ColorPicker for this node! */
		var allNamed = (ch.length !== 0);
		for (var i = 0; i < ch.length; i++)
			allNamed &= (ch[i].id !== "");
		if (!allNamed)
			return Picker.build(node, realParent, {
				text: prettify(node.id),
				default: "#FFFFFF"
			});

		/* Step 2.1: Node has only named children
		 * -> map `BuildManager` over `ch`, but filter out .option and .toggle */
		var parent = document.createDocumentFragment();
		var options = [], toggles = [];
		var isSwappable = (node.getAttribute("class") == "swappable");
		for (var i = 0; i < ch.length; i++) {
			var cls = ch[i].getAttribute("class");
			if (cls == "option")
				options.push(ch[i]);
			else if (cls == "toggle")
				toggles.push(ch[i]);
			else
				BuildManager(ch[i], parent);
			if (isSwappable)
				attachSwapRadio(ch[i], node.id);
		}

		/* Step 2.2: Build controls for .option and .toggle */
		if (options.length) {
			if (node.id.includes("Ear"))
				BuildCheckboxes(options, parent);
			else
				BuildDropDown(options, node.id, parent);
		}
		while (toggles.length)
			BuildToggle(toggles.pop(), parent);

		/* Step 3: Put all controls in the DOM */
		if (realParent) {
			if (possibleParent)
				XML.DOMNode("hr", {}, parent);
			realParent.appendChild(parent);
		}
	}

	this.setup = function (nodes) {
		for (var i = nodes.length-1; i >= 0; i--) {
			if (nodes[i].hasAttribute("mask")) {
				if (!variants.hasItem(nodes[i].id))
					continue;
				var decals = variants.getItem(nodes[i].id);
				Decals.Recreate(nodes[i], decals);
				continue;
			}
			var category = findCategory(nodes[i].id);
			if (!category)
				continue;
			BuildManager(nodes[i]);
			if (nodes[i].getAttribute("class") == "swappable") {
				setupSwapHandler(nodes[i], category);
				var selected = variants.getItem(nodes[i].id);
				var radio = find(selected + "Radio");
				radio.checked = false;
				radio.click();
			}
		}
		Picker.cache()
	}
}

function SettingsManager (Builder, History, Vault, Decals) {
	var slides = document.getElementsByClassName("slide_content");
	var main = find("main");

	this.Sex = async function (female, upload) {
		for (var i = 0; i < slides.length; i++)
			slides[i].innerHTML = "";

		History.track = false; /* Do not track any changes during setup */
		var helmet;
		var master_file = female ? "Female" : "Male";
		var body = Vault.getItem(master_file, function (Body) {
			var h = Body.getElementById("Helmets");
			Decals.SVG = Body;
			Body = Body.getElementById("Main-Body");
			Builder.setup(Body.children);
			helmet = Vault.getItem("Helmets", function (helmets) {
				helmets.className.baseVal = "swappable";
				Builder.setup([helmets], upload);
			}, h);
		}, main.firstElementChild);

		localStorage.setItem("female_sex", (!!female).toString());
		await body;
		Zoom.scale = 0;
		var SVG = main.firstElementChild;
		SVG.scrollIntoView({inline: "center"});
		await helmet;
		History.track = true;
	}
}

function VariantsVault (asString, History) {
	var __vars = {
		"Helmets": "Helmet_Classic",
		"Chest": "Chest_Classic"
	};
	if (asString)
		__vars = JSON.parse(asString);
	function cache () {
		localStorage.setItem("variants", JSON.stringify(__vars));
	}
	cache();

	this.hasItem = function (key, category) {
		var v = __vars;
		if (category) {
			if ( !(category in __vars) )
				return false;
			v = __vars[category];
		}
		return key in v;
	}
	this.setItem = function (key, value, type, category) {
		var v = __vars;
		if (category)
			v = __vars[category] || {};

		if (value == v[key])
			return;
		var c = History.format(type, v[key], value, key); // TODO
		v[key] = value;

		if (category)
			__vars[category] = v;

		History.push(c);
		cache();
	}
	this.getItem = function (key, category) {
		var v = __vars;
		if (category)
			v = __vars[category] || {};
		return v[key];
	}
	this.removeItem = function (key, type, category) {
		var v = __vars;
		if (category) {
			if ( !(category in __vars) )
				return;
			var v = __vars[category];
		}
		if ( !(key in v) )
			return;
		delete v[key];

		var c = History.format(type, v[key], undefined, key); // TODO
		History.push(c);
		cache();
	}
	this.toString = function () {
		return JSON.stringify(__vars);
	}
}

function openFolder (folder) {
	if (typeof folder == "string") {
		Decals.Category = null;
		folder = find(folder + "Options");
	} else if (folder.id.includes("Options")) {
		var radioName = folder.id.replace("Options", "Radio");
		var radio = find(radioName);
		radio.checked = true;
	}
	var parent = folder.parentNode;
	var folders = parent.children;
	for (var i = 0; i < folders.length; i++)
		folders[i].classList.remove("selected");
	folder.classList.add("selected");
}

function folder_opener (event) {
	if (event.defaultPrevented) return;
	openFolder(this);
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
		folders[i].addEventListener("click", folder_opener);
		var opener = slide_opener(folders[i], slides);
		var closer = slide_closer(folders[i]);
		for (var j = 0; j < slides.length; j++) {
			slides[j].addEventListener("click", opener);
			var b = slides[j].firstElementChild;
			b.addEventListener("click", closer);
		}
	}

	var decal_toggles = armor_menu.getElementsByClassName("decals_toggle");
	for (var i = 0; i < decal_toggles.length; i++)
		decal_toggles[i].addEventListener("click", function (event) {
			event.preventDefault();
			Decals.Category = this.dataset.category;
			armor_menu.style.visibility = "hidden";
		});

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

function onload () {
	var nsw = navigator.serviceWorker;
	if (nsw) {
		nsw.onmessage = function (event) {
			var v = localStorage.getItem("version");
			if (v == event.data)
				return;
			localStorage.clear();
			localStorage.setItem("version", event.data);
			var form = find("reload");
			form.style.display = "";
		};
		nsw.register("sw.js");
	}

	History = new HistoryTracker;
	Vault = new SVGVault;

	var Picker = new PickerFactory(History);
	Decals = new DecalFactory(Vault, Picker);
	Builder = new BuildManager(History, Picker, Decals);

	Settings = new SettingsManager(Builder, History, Vault, Decals);
	variants = new VariantsVault(localStorage.getItem("variants"), History);
	colors = resetColorCache(true);

	Download = new Downloader (Decals);
	Download.attach(find("download_svg"), "image/svg+xml");
	Download.attach(find("download_jpeg"), "image/jpeg");

	var Upload = new Uploader(window.location.search, Download);
	setDefaultBackground();
	find("kote").volume = 0.15;

	setupControlMenu(find("armor_menu"), find("decals_menu"));
}

function setSponsor (sponsor, href) {
	var link = find(sponsor);
	link.href = href;
	link.style.display = "";
	link.dataset.show = "true";

	var img = link.getElementsByTagName("img")[0];
	if (!img.hasAttribute("src"))
		img.src = "assets/" + sponsor + ".png";
	var parent = link.parentNode;
	var closer = parent.getElementsByClassName("close_sponsors")[0];
	closer.style.display = "";
	closer.dataset.show = "true";
}

function UpdateSponsor (category) {
	var parent = find(category + "Options");
	var logos = parent.getElementsByClassName("sponsor_link");
	for (var i = 0; i < logos.length; i++) {
		if (logos[i].dataset.show == "true")
			delete logos[i].dataset.show;
		else
			logos[i].style.display = "none";
	}
	var closer = parent.getElementsByClassName("close_sponsors")[0];
	if (closer.dataset.show == "true")
		delete closer.dataset.show;
	else
		closer.style.display = "none";
}

function resetColorCache (cached) {
	var cache = localStorage.getItem("colors");
	if (cached && cache)
		return JSON.parse(cache);
	return {
		undefined: "#FFFFFF",
		"Bucket_Budget-BucketColor":	"#F74416",
		"Visor_Budget-BucketColor":	"#000000",
		"Rage_Gauntlet_RightColor":	"#08CB33",
		"Rage_Gauntlet_LeftColor":	"#08CB33"
	};
}

var Zoom = new (function () {
	var z = find("zoom");
	var main = find("main");
	return {
		set scale (value) {
			if (value <= 0)
				value = z.value;
			var SVG = main.firstElementChild;
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
	variants = new VariantsVault(null, History);
	colors = resetColorCache(false);
	Decals.reset();
	if (skipBuild)
		return;
	var female = find("female").checked;
	Settings.Sex(female);
}

function setDefaultBackground () {
	Vault.getItem("Background", function (bck) {
		Download.Background = {
			type: "image/svg+xml",
			data: bck,
			custom: false
		};
	});
}
