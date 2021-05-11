/* MandoCreator */
"use strict";
var Download, Upload, Change;

function find (st) {
	return document.getElementById(st);
}

function SVGVault (vault) {
	function prepareSVGAttributes (svg) {
		var iter = document.createNodeIterator(svg, NodeFilter.SHOW_ELEMENT,
			{ acceptNode: function (n) {
				return n.id ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
			} } );
		var node;
		while (node = iter.nextNode()) {
			var id = node.id;
			var comp = id.match(/Option|Toggle/);
			if (!comp)
				continue;
			node.setAttribute("class", comp[0].toLowerCase());
			id = node.id = id.replace("_"+comp[0], "");
			if (id.includes("Off")) {
				node.id = id.replace("Off", "");
				node.style.display = "none";
			}
		}
		vault.appendChild(svg);
	}

	this.query = function (st) {
		var ch = vault.children;
		for (var i = 0; i < ch.length; i++) {
			var svg = ch[i];
			if (svg.id === st)
				return svg;
			var local = svg.getElementById(st);
			if (local)
				return local;
		}
	}
	this.load = function (name, onload) {
		var local = this.query(name);
		if (local) {
			var copy = local.cloneNode(true);
			return onload(copy);
		}
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "images/" + name + ".svg");
		xhr.setRequestHeader("Cache-Control", "no-cache, max-age=10800");
		xhr.responseType = 'document';
		return new Promise(function (resolve) {
			xhr.onload = function () {
				var xml = xhr.responseXML;
				if (xhr.status !== 200 || !xml) {
					resolve(undefined);
				} else {
					var svg = xml.documentElement;
					svg.setAttribute("id", name);
					prepareSVGAttributes(svg);
					onload(svg.cloneNode(true));
					resolve();
				}
			};
			xhr.send();
		});
	}
}
var Vault = new SVGVault(find("vault"));

function Settings (Change) {
	var afterUpload = false;
	var editor = find("editor");
	var Picker = new PickerFactory(Change);
	var icons = {
		"Range Finder":	"\uE919",
		"Main Antenna":	"\uE918",
		"Sub Antenna":	"\uE91B",
		"Sensor Stalk":	"\uE91A",
		"Antenna":	"\uE91C",
		"Lear Cap":	"\uE91D"
	}

	function DOMNode (type, props, parent) {
		var n = document.createElement(type);
		for (var p in props)
			n.setAttribute(p, props[p]);
		if (parent)
			parent.appendChild(n);
		return n;
	}

	function redirectClickTo(target) {
		return function () {
			target.click();
		}
	}

	function listName (str) {
		var component = str.split("_", 1)[0];
		var clean = component.replace(/\W/g,"");
		return clean;
	}

	function prepareParent (SVGNode, parent) {
		var name = listName(SVGNode.id);
		var side_name = name.match(/Right|Left/);
		var globalList = find(name + "Colors");
		if (globalList) {
			parent = globalList;
			parent.style.removeProperty("display");
			var ps = parent.getElementsByClassName("option_name");
			if (ps.length !== 1) {
				p = DOMNode("p", {class: "option_name hidden"});
				globalList.prepend(p);
				p.innerText = prettify(SVGNode.id) + " Options:";
				if (side_name)
					S.mirror(parent, p, side_name[0]);
			}
		}
		if (SVGNode.getAttribute("class") === "toggle") {
			if (parent.children.length > 1) // 1 for option-name built before
				DOMNode("p", {class: "separator"}, parent);

			var p = DOMNode("label", {class: "pseudo_checkbox hidden"}, parent);
			var labelText = DOMNode("span", {class: "pseudo_label"}, p);
			labelText.innerText = prettify(SVGNode.id);

			var checkID = buttonName(SVGNode.id) + "Toggle";
			var check = DOMNode("input", {type: "checkbox", class: "armor_toggle", id: checkID}, p);
			DOMNode("span", {class: "slider"}, p);
			parent = DOMNode("div", {style: "display:none", class: "subslide"}, parent);
			if (side_name)
				S.mirror(parent, p, side_name[0]);

			var defaultOn = !afterUpload && (SVGNode.style.display !== "none");
			var varName = neutralize(SVGNode.id);
			if (variants.hasItem(varName))
				defaultOn = variants.getItem(varName);
			var toggle = S.toggle.Subslide(parent, SVGNode, (SVGNode.style.display !== "none"));
			check.checked = defaultOn;
			toggle.bind({checked: defaultOn})();
			check.addEventListener("change", toggle);
		}
		return parent;
	}

	function ColorPicker (affectedObject, parent) {
		var wrapper = DOMNode("div", {class: "color_wrapper"}, parent);

		var buttonID = buttonName(affectedObject.id) + "Color";
		var b = DOMNode("button", {class: "color_picker", id: buttonID}, wrapper);

		var label = DOMNode("label", {class: "color_label hidden", for: buttonID}, wrapper);
		var p = DOMNode("p", {class: "name"}, label);
		p.innerText = prettify(affectedObject.id);
		var c = DOMNode("p", {class: "detail"}, label);

		Picker.attach(b, c, affectedObject);
		return b;
	}

	var build = {
		IO: function (SVGNode, category, parent) {
			var p = ColorPicker(SVGNode, parent);
			var redirectToPicker = redirectClickTo(p);

			var radio = find(category + "Settings");
			var redirectToRadio = redirectClickTo(radio);
			if (radio.checked)
				redirectToRadio();

			SVGNode.addEventListener("click", function(event) {
				if (event.defaultPrevented)
					return;
				redirectToRadio();
				while (p && p.getAttribute("class") !== "slide")
					p = p.parentElement;
				if (p) {
					var but = p.firstElementChild;
					redirectClickTo(but)();
				}
				redirectToPicker();
			});
		},
		Dropdown: function (addons, category, parent, SVGName) {
			var select = find(SVGName + "Select");
			var useDefault = !select;
			if (!select) {
				var wrapper = DOMNode("div", {class: "select_wrapper hidden"}, parent);
				select = DOMNode("select", {class: "component_select", id: SVGName + "Select"}, wrapper);
			}

			var colors = [];
			for (var i = addons.length - 1; i >= 0; i--) {
				var fullName = addons[i].id;
				var name = prettify(fullName);
				var neutral = neutralize(fullName);

				/* Create an option in the select, and a hideable color list */
				var opt = DOMNode("option", {label: name, value: neutral}, select);
				opt.innerText = name;

				var san = listName(fullName);
				var col = DOMNode("div", {id: san + "SubColors"}, parent);
				if (variants.getItem(SVGName) == neutral) {
					addons[i].style.display = "inherit";
					useDefault = false;
					opt.selected = true;
				} else {
					addons[i].style.removeProperty("display");
					col.style.display = "none";
				}
				build.All(addons[i], category, col);
				colors.push(col);
			}
			if (useDefault) {
				addons[addons.length-1].style.display = "inherit";
				colors[0].style.removeProperty("display");
			}

			select.addEventListener("change", function() {
				variants.setItem(SVGName, this.value, "select");
				for (var i = 0; i < addons.length; i++) {
					if (neutralize(addons[i].id) === this.value)
						addons[i].style.display = "inherit";
					else
						addons[i].style.removeProperty("display");
				}

				var id = listName(this.value) + "SubColors"
				for (var i = 0; i < colors.length; i++) {
					if (colors[i].id === id)
						colors[i].style.removeProperty("display");
					else
						colors[i].style.display = "none";
				}
			});
			return select;
		},
		Attach: function (category, SVGNode) {
			var identifier = listName(SVGNode.id);

			var wrapper = find(identifier + "_Current");
			var node = SVGNode.cloneNode(true);
			if (!wrapper)
				return console.log("Couldn't find ", identifier + "_Current");
			wrapper.appendChild(node);

			build.All(node, category);
		},
		Checkbox: function (addons, category, parent) {
			var checkboxes = DOMNode("div", {class: "checkbox_list hidden"}, parent);
			for (var i = addons.length - 1; i >= 0; i--) {
				var fullName = addons[i].id;
				var name = prettify(fullName);
				var neutral = neutralize(fullName);
				var labelName = fullName + "_Check";

				var wrapper = DOMNode("div", {class: "checkbox_wrapper"}, checkboxes);
				var checkbox = DOMNode("input", {type: "checkbox", class: "checkbox", id: labelName}, wrapper);
				var label = DOMNode("label", {for: labelName, title: name, class: "checkbox_label"}, wrapper);
				label.innerText = icons[name];

				var san = listName(fullName);
				var col = DOMNode("div", {id: san + "SubColors"}, parent);
				if (variants.getItem(neutral)) {
					addons[i].style.display = "inherit";
					checkbox.checked = true;
				} else {
					addons[i].style.removeProperty("display");
					col.style.display = "none";
				}
				build.All(addons[i], category, col);
				checkbox.addEventListener("change", S.toggle.Sublist(col, addons[i], neutral));
			}
		},
		All: function (SVGNode, category, parent) {
			parent = prepareParent(SVGNode, parent);
			var ch = SVGNode.children;
			for (var i = 0; i < ch.length; i++) {
				if (!ch[i].id)
					return build.IO(SVGNode, category, parent);
			}
			if (!ch.length) {
				if (SVGNode.tagName === "g")
					return;
				return build.IO(SVGNode, category, parent);
			}
			var options = [];
			var toggle = [];
			var realParent = null;
			if (document.contains(parent)) { /* Stay away from the DOM! */
				realParent = parent;
				parent = document.createDocumentFragment();
			}
			for (var i = ch.length-1; i >= 0; i--) {
				var className = ch[i].getAttribute("class");
				if (className == "option")
					options.unshift(ch[i]);
				else if (className == "toggle")
					toggle.push(ch[i]);
				else
					build.All(ch[i], category, parent);
			}
			var SVGName = neutralize(SVGNode.id) + "_Option";
			if (options.length > 0) {
				if (SVGName.includes("Earcap"))
					build.Checkbox(options, category, parent);
				else
					build.Dropdown(options, category, parent, SVGName);
			}
			/* defer toggles to the very last */
			for (var i = 0; i < toggle.length; i++)
				build.All(toggle[i], category, parent);
			if (realParent)
				realParent.appendChild(parent);
		}
	}
	this.Build = build.All;
	this.toggle = {
		Slide: function (slide) {
			slide.classList.toggle("selected");
			var folder = slide.parentNode.parentNode;
			folder.classList.toggle("overview");
		},
		Subslide: function (subslide, SVGNode, def) {
			var varName = neutralize(SVGNode.id);
			return function () {
				if (this.checked) {
					subslide.style.removeProperty("display");
					SVGNode.style.removeProperty("display");
				} else {
					subslide.style.display = "none";
					SVGNode.style.display = "none";
				}
				if (this.checked == def)
					variants.removeItem(varName, "subslide");
				else
					variants.setItem(varName, this.checked, "subslide");
			}
		},
		Sublist: function (sublist, SVGNode, neutral) {
			return function () {
				if (this.checked) {
					sublist.style.removeProperty("display");
					SVGNode.style.display = "inherit";
					variants.setItem(neutral, true, "sublist");
				} else {
					sublist.style.display = "none";
					SVGNode.style.display = "none";
					variants.removeItem(neutral, "sublist");
				}
			}
		},
		Options: function () {
			find("settings").classList.toggle("settings_collapsed");
		}
	}
	this.set = {
		Sex: function (female, upload) {
			var body, sexSuffix;
			var settings = find("settings");
			if (female) {
				body = "Female-Body";
				sexSuffix = "F";
				settings.classList.remove("male");
				settings.classList.add("female");
			} else {
				body = "Male-Body";
				sexSuffix = "M";
				settings.classList.remove("female");
				settings.classList.add("male");
			}
			var slides = settings.getElementsByClassName("slide_content");
			for (var i = 0; i < slides.length; i++) {
				slides[i].innerHTML = "";
			}

			Vault.load(body, function (svg) {
				S.setup(svg, sexSuffix, upload);
			});
			localStorage.setItem("female_sex", female.toString());
		},
		DarkMode: function (darkMode, keepBck) {
			var className = "light_mode";
			var bckName = "LogoLight";
			var logoName = "#titleLight";
			var href = "assets/fog-reversed.jpg";
			if (darkMode) {
				className = "dark_mode";
				bckName = "LogoDark";
				logoName = "#titleDark";
				href = "assets/fog-small.jpg";
			}
			Vault.load(bckName, function(logo) {
				Download.Logo = logo;
				if (!keepBck) {
					Download.Background = {type: "image/jpg", data: href};
					var reset = find("reset_wrapper");
					reset.style.display = "none";
				}
			});
			document.body.className = className;
			var use = find("title");
			use.setAttribute("href", logoName);
			localStorage.setItem("dark_mode", darkMode.toString());
		}
	}
	this.mirror = function (parent, paragraph, side) {
		var mirror = DOMNode("button", {class: "mirror_button", title: "Mirror Settings"}, paragraph);
		mirror.innerText = "\uE915";

		var otherSide = (side == "Right" ? "Left" : "Right");
		mirror.addEventListener("click", function () {
			var changes = []
			Change.track = false;
			/* Mirror all Checkboxes */
			var checks = parent.getElementsByTagName("input");
			for (var i = 0; i < checks.length; i++) {
				var mirrorImageName = checks[i].id.replace(side, otherSide);
				var mirrorImage = find(mirrorImageName);
				if (!mirrorImage)
					continue;
				if (mirrorImage.checked ^ checks[i].checked) {
					changes.push(Change.format(
						"sublist",
						mirrorImage.checked,
						checks[i].checked,
						mirrorImageName,
						true
					));
					mirrorImage.click();
				}
			}
			/* Mirror the checkbox in paragraph itself (if present) */
			var top_check = paragraph.getElementsByTagName("input")[0];
			if (top_check) {
				var mirrorImageName = top_check.id.replace(side, otherSide);
				var mirrorImage = find(mirrorImageName);
				if (mirrorImage) {
					if (mirrorImage.checked ^ top_check.checked) {
						changes.push(Change.format(
							"subslide",
							mirrorImage.checked,
							top_check.checked,
							mirrorImageName,
							true
						));
						mirrorImage.click();
					}
				}
			}
			/* Mirror all selects */
			var selects = parent.getElementsByClassName("component_select");
			for (var i = 0; i < selects.length; i++) {
				var mirrorImageName = selects[i].id.replace(side, otherSide);
				var mirrorImage = find(mirrorImageName);
				if (!mirrorImage)
					continue;
				var singleChange = Change.format(
					"select",
					mirrorImage.value,
					selects[i].value.replace(side, otherSide),
					mirrorImageName,
					true
				);
				changes.push(singleChange);
				mirrorImage.value = singleChange.newValue;
				mirrorImage.dispatchEvent(new Event("change"));
			}
			/* Mirror all the colors */
			showPicker = false;
			var buttons = parent.getElementsByClassName("color_picker");
			for (var i = 0; i < buttons.length; i++) {
				var mirrorImageName = buttons[i].id.replace(side, otherSide);
				var mirrorImage = find(mirrorImageName);
				if (!mirrorImage) /* Allow for asymmetric helmets */
					continue;
				var singleChange = Change.format(
					"color",
					mirrorImage.style.backgroundColor,
					buttons[i].style.backgroundColor,
					mirrorImageName,
					true
				);
				changes.push(singleChange);
				mirrorImage.style.background = singleChange.newValue;
				mirrorImage.click();
			}
			Change.track = true;
			Change.push(changes);
			showPicker = true;
		});
	}
	var symmetric = ["Shoulders", "Biceps", "Gauntlets", "Thighs", "Knees", "Shins", "Foot"];
	function buildBodyParts (self, ch, category) {
		for (var i = 0; i < ch.length; i++) {
			var n = ch[i];
			if ( symmetric.includes(listName(n.id)) ) {
				var ch2 = n.children;
				for (var j = 0; j < ch2.length; j++)
					build.Attach(category, ch2[j]);
			} else {
				build.Attach(category, n);
			}
		}
	}
	this.setup = async function (svg, sexSuffix, upload) {
		afterUpload = upload; /* Set to true, if this function was called after an upload */
		Change.track = false; /* Do not track Setup history */
		var old_svg = editor.firstElementChild;
		if (old_svg)
			editor.replaceChild(svg, old_svg);
		else
			editor.appendChild(svg);
		var scale = find("zoom");
		zoom(scale.value);
		svg.scrollIntoView({inline: "center"});

		var variant = variants.getItem("Helmet");
		var helmet = Vault.load("Helmets", function() {
			var button = find("Helmet_Variant_" + variant);
			button.click();
		} );

		var self = this; // Needed because 'this' changes scope in Promises
		var upper = Vault.load("Upper-Armor_" + sexSuffix, function(svg) {
			buildBodyParts(self, svg.children, "UpperArmor");
			var variant = variants.getItem("Chest");
			var button = find("Chest_Variant_" + variant);
			if (!button) button = find("Chest_Variant_" + variant + "_" + sexSuffix);
			button.click();
		});

		var lower = Vault.load("Lower-Armor_" + sexSuffix, function(svg) {
			buildBodyParts(self, svg.children, "LowerArmor");
		});

		var ch = svg.children;
		for (var i = 0; i < ch.length; i++) {
			var id = ch[i].id;
			if (id.includes("Back") || id.includes("Front"))
				build.All(ch[i], "Back");
			else if (id.includes("Vest") || id.includes("Flight-Suit")) {
				var parent = find("SoftPartsColors");
				build.All(ch[i].lastElementChild, "FlightSuit", parent);
			}
		}

		await helmet;
		await upper;
		await lower;
		afterUpload = false;
		Change.track = true;
	}
}
var Change = new ChangeHistory;
var S = new Settings(Change);

function VariantsVault (asString) {
	var __vars = {
		"Helmet": "Classic",
		"Chest": "Classic"
	};
	if (asString)
		__vars = JSON.parse(asString);

	this.hasItem = function (key) {
		return key in __vars;
	}
	this.setItem = function (key, value, type) {
		if (value == __vars[key])
			return;
		var c = Change.format(type, __vars[key], value, key);
		if (!c)
			return;
		Change.push(c);
		__vars[key] = value;
	}
	this.getItem = function (key) {
		return __vars[key];
	}
	this.removeItem = function (key, type) {
		if (!(key in __vars))
			return;
		var c = Change.format(type, __vars[key], undefined, key);
		if (!c)
			return;
		Change.push(c);
		delete __vars[key];
	}
	this.toString = function () {
		return JSON.stringify(__vars);
	}
}
var variants = new VariantsVault(localStorage.getItem("variants"));

function prettify (str) {
	var components = str.split("_", 1);
	var shortName = components[0];
	return shortName.replace(/-/g, " ");
}

function neutralize (str) {
	return str.replace(/(_M|_F)+($|_)/,"$4");
}

function buttonName (str) {
	var clean = str.replace(/\W/g,"");
	return neutralize(clean);
}

function setupWindow () {
	if (window.innerWidth > 786) {
		var settings_menu = find("settings");
		settings_menu.classList.remove("settings_collapsed");
	}

	function cache () {
		localStorage.setItem("settings", JSON.stringify(settings));
		localStorage.setItem("variants", variants.toString());
	}

	window.addEventListener("pagehide", cache);
	document.addEventListener("visibilitychange", function() {
		switch (document.visibilityState) {
			case "hidden":
				cache();
				break;
			default:
				variants = new VariantsVault(localStorage.getItem("variants"));
				settings = resetSettings(true);
				break;
		}
	})

	var main = find("editor");
	var mv = { dragged: false, drag: false };
	main.addEventListener("mousedown", function (event) {
		if (event.buttons !== 1)
			return;
		mv = { drag: true, dragged: false };
	});
	main.addEventListener("mousemove", function (event) {
		if (!mv.drag)
			return;
		mv.dragged = true;
		this.style.cursor = 'grabbing';
		this.style.userSelect = 'none';
		this.scrollTop -= event.movementY;
		this.scrollLeft -= event.movementX;
	});
	main.addEventListener("mouseup", function () {
		this.style.removeProperty("cursor");
		this.style.removeProperty('user-select');
	});
	main.addEventListener("click", function (event) {
		if (mv.dragged)
			event.preventDefault();
		mv = { drag: false, dragged: false }
	}, true);
}

function onload () {
	var useDarkMode = localStorage.getItem("dark_mode");
	if (useDarkMode !== null)
		useDarkMode = (useDarkMode == "true");
	else
		useDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
	S.set.DarkMode(useDarkMode);
	find("color_scheme_picker").checked = useDarkMode;
	find("kote").volume = 0.15;

	settings = resetSettings(true);

	Download = new Downloader;
	Download.attach(find("download_svg"), "image/svg+xml");
	Download.attach(find("download_jpeg"), "image/jpeg");

	Upload = new Uploader(window.location.search, Download);
	setupWindow();
	var nsw = navigator.serviceWorker;
	if (!nsw)
		return;
	nsw.onmessage = function (event) {
		displayForm(true, 'reload');
	};
	//nsw.register("sw.js");
}

function openArmorFolder (category) {
	var now = find(category + "Options");
	var components = document.getElementsByClassName("folder");
	for (var i = 0; i < components.length; i++)
		components[i].classList.remove("selected");
	now.classList.add("selected");
	var slides = now.getElementsByClassName("slide");
	for (var i = 0; i < slides.length; i++)
		slides[i].classList.remove("selected");
	if (slides.length)
		now.classList.add("overview");
}

function setVariantButton (category, button) {
	if (typeof button === "string")
		button = find(button);
	var parent = find(category + "Options");
	var old_button = parent.getElementsByClassName("current_variant")[0];
	if (old_button)
		old_button.classList.remove("current_variant");
	button.classList.add("current_variant");

	var old_lists = parent.getElementsByClassName("replace");
	for (var i = 0; i < old_lists.length; i++) {
		old_lists[i].style.display = "none";
		old_lists[i].innerHTML = "";
	}
	return parent;
}

function switchToArmorButton (category, pieceName, button) {
	var name = button.dataset.name;
	if (!name) return;
	var parent = setVariantButton(category, button);
	hideSponsors(parent);
	if (callback)
		callback();
	callback = null;

	switchToArmorVariant(category, pieceName, name);
}

function switchToArmorVariant (category, pieceName, variantName) {
	var old = find(pieceName + "_Current");
	var SVGparent = old.parentNode;
	var n = Vault.query(pieceName + "_" + variantName);
	n = n.cloneNode(true);
	n.id = pieceName + "_Current";
	n.setAttribute("class", variantName);
	SVGparent.replaceChild(n, old);
	S.Build(n, category);
	variants.setItem(pieceName, neutralize(variantName), "variant");
}

var callback = null;
function hideSponsors (parent) {
	var logos = parent.getElementsByClassName("sponsor_link");
	for (var i = 0; i < logos.length; i++)
		logos[i].style.display = "none";
	var closer = parent.getElementsByClassName("close_sponsors")[0];
	if (!closer)
		return;
	closer.style.display = "none";
}

function setSponsor (sponsor, href) {
	var link = find(sponsor);
	link.setAttribute("href", href);

	var img = link.getElementsByTagName("img")[0];
	if (!img.hasAttribute("src"))
		img.setAttribute("src", "assets/" + sponsor + ".png");
	var parent = link.parentNode;
	var close = parent.getElementsByTagName("button")[0];
	callback = function () {
		link.style.removeProperty("display");
		close.style.removeProperty("display");
	}
}

function displayForm (visible, form) {
	if (!form.style)
		form = find(form);
	form.style.display = visible ? "" : "none";
}

function zoom (scale) {
	var main = find("editor");
	var svg = main.children[0];
	svg.style.height = scale + "%";
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
	rickRoll.style.removeProperty("display");
}

function playKote () {
	var kote = find("kote");
	kote.setAttribute("src", "assets/KOTE.mp3");
}

function reset () {
	if (!confirm("Do you want to reset all settings? You will lose all colors and all armor options. This cannot be undone."))
		return;
	variants = new VariantsVault;
	settings = resetSettings(false);
	var female = find("female").checked;
	S.set.Sex(female);
}
