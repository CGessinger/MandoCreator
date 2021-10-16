/* MandoCreator */
"use strict";
var Download, History, Vault, Builder, Settings;
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
					resolve(xhr.status);
				} else {
					var svg = xml.documentElement;
					vault[name] = svg;
					finishUp(svg, onload, replace);
					resolve(0);
				}
			};
			xhr.send();
		});
	}
}

function BuildManager (History) {
	var Picker = new PickerFactory(History);
	var swapLists = [];
	var icons = {
		"Range Finder":	"\uE919",
		"Main Antenna":	"\uE918",
		"Sub Antenna":	"\uE91B",
		"Sensor Stalk":	"\uE91A",
		"Antenna":	"\uE91C",
		"Lear Cap":	"\uE91D",
		"Module":	"\uE922"
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

	function DOMNode (type, props, parent) {
		var n = document.createElement(type);
		for (var p in props)
			n.setAttribute(p, props[p]);
		if (parent)
			parent.appendChild(n);
		return n;
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
		var b = DOMNode("button", {class: "mirror_button", title:"Mirror Settings"}, headline);
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
	function DOMParent (node) {
		/* Step 1: Find the parent in the DOM */
		var id = node.id;
		var san = id.split("_",1)[0];
		if (san in hax)
			id = san = hax[san];
		var parent = find(san + "Colors");
		if (!parent) return;
		/* Step 2: Check for swappable armor pieces */
		variantID = node.id;
		swapFilter.currentNode = node;
		if (swapFilter.parentNode()) {
			parent = DOMNode("div", {class: "swapslide"}, parent);
			swapLists.push(parent);
		}
		/* Step 3: If the parent is empty, make a headline */
		if (parent.childElementCount == 0) {
			DOMNode("hr", {}, parent);
			var par = DOMNode("h3", {class: "option_name hidden"}, parent);
			par.innerText = prettify(id) + " Options:";
			var symmetric = id.match(/Left|Right/);
			if (symmetric)
				BuildMirrorButton(par, parent, symmetric[0]);
		}
		return parent;
	}

	function prettify (str) {
		var components = str.split("_", 1)[0];
		return components.replace(/-/g, " ");
	}

	function ColorPicker (target, parent) {
		var wrapper = DOMNode("div", {class: "color_wrapper"}, parent);

		var buttonID = target.id + "Color";
		var b = DOMNode("button", {class: "color_picker", id: buttonID}, wrapper);

		var label = DOMNode("label", {class: "color_label hidden", for: buttonID}, wrapper);
		var p = DOMNode("p", {class: "name"}, label);
		p.innerText = prettify(target.id);
		var c = DOMNode("p", {class: "detail"}, label);

		Picker.attach(b, c, target);
		target.addEventListener("click", function(event) { b.click(); } );
		return b;
	}

	function BuildToggle (toggle, parent) {
		/* Step 1: Build all DOM components */
		if (parent.childElementCount != 0) {
			var prev = parent.lastElementChild;
			/* Build a (fancier) line-break */
			if (!prev.matches(".option_name"))
				DOMNode("hr", {}, parent);
		}
		parent = DOMNode("div", {}, parent);
		var label = DOMNode("label", {class: "pseudo_checkbox hidden"}, parent);

		var span = DOMNode("span", {class: "pseudo_label"}, label);
		span.innerText = prettify(toggle.id);

		var id = toggle.id + "Toggle";
		var input = DOMNode("input", {type: "checkbox", id: id, class: "armor_toggle"}, label);
		var sp = DOMNode("span", {class: "slider"}, label);

		var subslide = DOMNode("div", {class: "subslide"}, parent);
		if (id.startsWith("Right"))
			BuildMirrorButton(label, parent, "Right");
		else if (id.startsWith("Left"))
			BuildMirrorButton(label, parent, "Left");

		/* Step 2: Find the default value and attach an event handler */
		if (id.startsWith("Mask"))
		{
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
		var wrapper = DOMNode("div", {class: "select_wrapper hidden"}, parent); /* For arrow placement */
		var select = DOMNode("select", {id: id, class: "component_select"}, wrapper);

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
			var subParent = DOMNode("div", {id: o.id + "SubColors"});
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
		var icons_wrapper = DOMNode("div", {class: "checkbox_list hidden"}, parent);
		while (options.length) {
			var o = options.pop();
			var title = prettify(o.id);
			var id = o.id + "Toggle";

			/* Step 2.1: Build a checkbox hidden behind an icon */
			var input = DOMNode("input", {type: "checkbox", class: "checkbox", id: id}, icons_wrapper);
			var label = DOMNode("label", {for: id, class: "checkbox_label", title: title}, icons_wrapper);
			label.innerText = icons[title];

			/* Step 2.2: Build a sublist for all the colors to go in */
			var sublist = DOMNode("div", {id: o.id+"SubColors"}, parent);
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
			return ColorPicker(node, realParent);

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
		if (realParent)
			realParent.appendChild(parent);
	}

	this.setup = function (nodes) {
		for (var i = nodes.length-1; i >= 0; i--) {
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

function SettingsManager (Builder, History, Vault) {
	var slides = find("controls").getElementsByClassName("slide_content");
	var main = find("main");

	this.Sex = async function (female, upload) {
		for (var i = 0; i < slides.length; i++)
			slides[i].innerHTML = "";

		History.track = false; /* Do not track any changes during setup  */
		var SVG = main.firstElementChild;
		var helmet;
		var master_file = female ? "Female" : "Male";
		var body = Vault.getItem(master_file, function (Body) {
			Body.style.position = "relative";
			Builder.setup(Body.children);
			var h = Body.getElementById("Helmets");
			helmet = Vault.getItem("Helmets", function (helmets) {
				helmets.setAttribute("class", "swappable");
				Builder.setup([helmets], upload);
			}, h);
		}, SVG);

		localStorage.setItem("female_sex", (!!female).toString());
		await body;
		zoom();
		SVG.scrollIntoView({inline: "center"});
		await helmet;
		History.track = true;
	}
}

function VariantsVault (asString) {
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

	this.hasItem = function (key) {
		return key in __vars;
	}
	this.setItem = function (key, value, type) {
		if (value == __vars[key])
			return;
		var c = History.format(type, __vars[key], value, key);
		if (!c)
			return;
		History.push(c);
		__vars[key] = value;
		cache();
	}
	this.getItem = function (key) {
		return __vars[key];
	}
	this.removeItem = function (key, type) {
		if (!(key in __vars))
			return;
		var c = History.format(type, __vars[key], undefined, key);
		if (!c)
			return;
		History.push(c);
		delete __vars[key];
		cache();
	}
	this.toString = function () {
		return JSON.stringify(__vars);
	}
}

function setupControlMenu () {
	var controls = find("controls");
	if (window.innerWidth > 786) {
		controls.classList.remove("controls_collapsed");
	}

	var button = controls.firstElementChild;
	button.addEventListener("click", function () {
		controls.classList.toggle("controls_collapsed");
	});

	var slides = controls.getElementsByClassName("slide");
	for (var i = 0; i < slides.length; i++) {
		slides[i].addEventListener("click", toggleSlide(slides[i]));
	}

	window.addEventListener("keydown", function (event) {
		if (!event.ctrlKey)
			return;
		if (event.key == "z")
			History.undo();
		else if (event.key == "y")
			History.undo(1)
	});
}

function setupDragAndDrop () {
	var main = find("main");
	var drag = false;
	main.addEventListener("mousedown", function (event) {
		if (event.buttons !== 1)
			return;
		drag = true;
	});
	main.addEventListener("mousemove", function (event) {
		if (!drag) return;
		this.style.cursor = 'grabbing';
		this.style.userSelect = 'none';
		this.scrollTop -= event.movementY;
		this.scrollLeft -= event.movementX;
	});
	main.addEventListener("mouseup", function () {
		this.removeAttribute("style");
		drag = false;
	});
}

function onload () {
	var nsw = navigator.serviceWorker;
	if (nsw) {
		nsw.onmessage = function (event) {
			localStorage.clear();
			var form = find("reload");
			form.style.display = "";
		};
		nsw.register("sw.js");
	}

	Vault = new SVGVault;
	History = new HistoryTracker;
	Builder = new BuildManager(History);
	Settings = new SettingsManager(Builder, History, Vault);
	variants = new VariantsVault(localStorage.getItem("variants"));
	colors = resetColorCache(true);

	Download = new Downloader;
	Download.attach(find("download_svg"), "image/svg+xml");
	Download.attach(find("download_jpeg"), "image/jpeg");

	var Upload = new Uploader(window.location.search, Download);
	setDefaultBackground();
	find("kote").volume = 0.15;

	setupControlMenu();
	setupDragAndDrop();
}

function openFolder (folder) {
	if (typeof folder == "string") {
		folder = find(folder + "Options");
	} else {
		var radioName = folder.id.replace("Options", "Radio");
		var radio = find(radioName);
		if (radio.checked) {
			return find("picker").click();
		}
		radio.checked = true;
	}
	var folders = document.getElementsByClassName("folder");
	for (var i = 0; i < folders.length; i++)
		folders[i].classList.remove("selected");
	folder.classList.add("selected");
	find("picker").click();
}

function toggleSlide (slide) {
	var button = slide.firstElementChild;
	button.addEventListener("click", function(event) {
		event.preventDefault();
	});
	var folder = slide.parentNode.parentNode;
	var allSlides = folder.getElementsByClassName("slide");
	return function (event) {
		if (event.defaultPrevented) {
			slide.classList.toggle("selected");
			folder.classList.toggle("overview");
		} else {
			if (slide.classList.contains("selected"))
				return;
			for (var i = 0; i < allSlides.length; i++)
				allSlides[i].classList.remove("selected");
			slide.classList.add("selected");
			folder.classList.remove("overview");
		}
	}
}

function setSponsor (sponsor, href) {
	var link = find(sponsor);
	link.setAttribute("href", href);
	link.style.display = "";
	link.dataset.show = "true";

	var img = link.getElementsByTagName("img")[0];
	if (!img.hasAttribute("src"))
		img.setAttribute("src", "assets/" + sponsor + ".png");
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

function zoom (scale) {
	if (!scale)
		scale = find("zoom").value;
	var SVG = find("main").firstElementChild;
	SVG.style.height = scale + "%";
}

function zoomInOut (step) {
	var scale = find("zoom");
	var val = parseInt(scale.value);
	scale.value = val + step;
	zoom(scale.value);
}

function showRoll (type) {
	var rickRoll = find("rickroll");
	rickRoll.setAttribute("src", "assets/" + type + "Roll.mp4");
	rickRoll.style.display = "";
	setTimeout(function () {
		rickRoll.style.display = "none";
	}, 10000);
}

function playKote () {
	var kote = find("kote");
	kote.setAttribute("src", "assets/KOTE.mp3");
}

function reset (skipBuild, skipPrompt) {
	var conf = skipPrompt || confirm("This will erase all settings, such as colors and armor pieces. Do you want to proceed? This cannot be undone.\n\nSave or save not. There is no undo.");
	if (!conf) return;
	variants = new VariantsVault;
	colors = resetColorCache(false);
	Vault = new SVGVault();
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
