"use strict";

var XML = {
	SVGNode: function (type, atts, parent) {
		var n = document.createElementNS("http://www.w3.org/2000/svg", type);
		this.setAttributes(n, atts);
		if (parent)
			parent.appendChild(n);
		return n;
	},
	DOMNode: function (type, atts, parent) {
		var n = document.createElement(type);
		this.setAttributes(n, atts);
		if (parent)
			parent.appendChild(n);
		return n;
	},
	setAttributes: function (obj, atts) {
		for (var a in atts)
			obj.setAttribute(a, atts[a]);
	}
}

function Uploader (queryString, D) {
	var svg = XML.SVGNode("svg");
	var readerBck = new FileReader;
	var file;
	readerBck.onload = function() {
		var data = this.result;
		if (file.type == "image/svg+xml") {
			svg.innerHTML = data;
			data = svg.firstElementChild;
			svg.innerHTML = "";
		}
		D.Background = {type: file.type, data: data, custom: true};
		file = null;
	}
	find("background_upload").addEventListener("change", function() {
		file = this.files[0];
		if (!file) return;

		if (file.type == "image/svg+xml")
			readerBck.readAsText(file);
		else
			readerBck.readAsDataURL(file);
		this.value = "";
	});

	function parseMando (svg) {
		var iter = document.createNodeIterator(svg, NodeFilter.SHOW_ELEMENT,
			{ acceptNode: function (node) {
				if (!node.id)
					return NodeFilter.FILTER_REJECT;
				node.id = node.id.replace(/_(M|F|Toggle(Off)?|Option)($|_)/g,"$3");
				if ( !(node.hasAttribute("fill")
					|| node.hasAttribute("color")
					|| node.hasAttribute("class")
					|| node.style.fill) )
					return NodeFilter.FILTER_SKIP;
				return NodeFilter.FILTER_ACCEPT;
			} }
		);

		var node;
		while (node = iter.nextNode()) {
			var id = node.id.replace(/_Toggle(Off|On)?|_Option/, "");
			var bn = id + "Color";
			if (node.hasAttribute("color")) {
				colors[bn] = node.getAttribute("color");
			} else if (node.hasAttribute("fill")) {
				colors[bn] = node.getAttribute("fill");
			} else if (node.style.fill) {
				colors[bn] = node.style.fill;
			}
			switch (node.getAttribute("class")) {
				case null:
					break;
				case "toggle":
					variants.setItem(id + "Toggle", node.style.display !== "none");
					break;
				case "option":
					var parent = node.parentNode;
					if (parent.id.includes("Ear"))
						variants.setItem(id + "Toggle", true);
					else {
						var parName = parent.id + "Select";
						variants.setItem(parName, id);
					}
					break;
				case "swappable":
					var ch = node.firstElementChild;
					variants.setItem(node.id, ch.id);
					break;
				case "decal":
					var l = node.transform.baseVal;
					var tm  = l[0].matrix;
					var phi = l[1].angle * Math.PI / 180;
					var sm  = l[2].matrix;
					variants.setItem(node.id, {
						x: tm.e,
						y: tm.f,
						phi: phi,
						ax: sm.a,
						ay: sm.d
					}, "decal", node.parentNode.id);
				default: /* For backwards compatibility */
					if (id.endsWith("Current")) {
						var cls = node.getAttribute("class").replace(/_M|_F/,"");
						var name = id.replace("_Current","");
						if (name == "Helmet")
							variants.setItem("Helmets", "Helmet_" + cls);
						else if (name == "Chest")
							variants.setItem("Chest", "Chest_" + cls);
					}
			}
		}
		localStorage.setItem("colors", JSON.stringify(colors));
	}

	function dissectSVG () {
		svg.innerHTML = this.result;
		svg = svg.firstElementChild;

		var mando = svg.lastElementChild;
		var img = svg.firstElementChild;

		reset(true);
		parseMando(mando);
		if (mando.id === "Female-Body") {
			var sex_radio = find("female");
			sex_radio.checked = true;
			Settings.Sex(true, true);
		} else {
			var sex_radio = find("male");
			sex_radio.checked = true;
			Settings.Sex(false, true);
		}

		if (img.tagName.toLowerCase() === "svg") {
			if (img.getAttribute("id").startsWith("Background"))
				setDefaultBackground();
			else
				D.Background = { type: "image/svg+xml", data: img, custom: true };
		} else {
			var href = img.getAttribute("href");
			var mime = href.match(/^data:image\/([\w+-.]+)/);
			if (!mime) return;
			D.Background = { type: mime[1], data: href };
		}
	}

	var readerMando = new FileReader();
	readerMando.onload = dissectSVG;
	find("reupload").addEventListener("change", function() {
		readerMando.readAsText(this.files[0]);
		this.value = "";
	});

	function readQueryString (st) {
		var options = {};
		var regex = /(\w+)=([^&]*)&?/g;
		var matches;
		while (matches = regex.exec(st)) {
			options[matches[1]] = unescape(matches[2]);
		}
		return options;
	}

	function loadPreset (preset, female) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", preset);
		xhr.setRequestHeader("Cache-Control", "no-cache, max-age=10800");
		xhr.onload = function () {
			var xml = this.responseXML;
			if (this.status !== 200 || !xml)
				return Settings.Sex(female, false);
			var svg = xml.documentElement;
			find("female").checked = female;
			reset(true, true);
			parseMando(svg);
			Settings.Sex(female, true);
		};
		xhr.onerror = function () {
			Settings.Sex(female, false);
		};
		xhr.send();
	}

	var female;
	var options = readQueryString(queryString);
	if ("sex" in options)
		female = options["sex"] == "1";
	else
		female = (localStorage.getItem("female_sex") == "true");

	if ("preset" in options) {
		loadPreset(options["preset"], female);
	} else {
		if (!female) {
			var sex_radio = find("male");
			sex_radio.checked = true;
		} else {
			var sex_radio = find("female");
			sex_radio.checked = true;
		}
		Settings.Sex(female);
	}
	if (queryString)
		history.replaceState(null, document.title, "?");
	return parseMando;
}

function Downloader (Decals) {
	var xml = new XMLSerializer();
	var img = new Image();
	var reset = find("reset_wrapper");
	var canvas = find("canvas");
	var canvasCtx = canvas.getContext('2d');
	var bckImgURI, bckSVG;

	var logoSVG = (function () {
		var t = find("title");
		var d = t.contentDocument;
		var de = d.documentElement;
		return de.cloneNode(true);
	})();

	function prepareForExport (svg) {
		var iter = document.createNodeIterator(svg, NodeFilter.SHOW_ELEMENT,
			{ "acceptNode": function (node) {
				if (node.hasAttribute("class"))
					return NodeFilter.FILTER_ACCEPT;
				return NodeFilter.FILTER_SKIP;
			} }
		);
		var node, rem;
		function advance () {
			if (rem) {
				var parent = rem.parentNode;
				parent.removeChild(rem);
			}
			rem = null;
			return iter.nextNode();
		}
		while (node = advance()) {
			var display = node.style.display;
			switch (node.getAttribute("class")) {
				case "brace":
					rem = node;
					break;
				case "option":
					if (display !== "inherit")
						rem = node;
					break;
				case "toggle":
					if (display == "none")
						node.innerHTML = "";
					break;
				case "swappable":
					var ch = node.children;
					for (var i = 0; i < ch.length;) {
						if (ch[i].style.visibility !== "visible")
							node.removeChild(ch[i]);
						else
							i++;
					}
			}
		}
		return svg;
	}

	function encodeSVG (svg) {
		var san = svg.replace(/\s+/g," ").replace(/"/g,"'");
		return encodeURIComponent(san);
	}

	function SVGFromEditor () {
		var SVG = find("main").firstElementChild;
		var copy = SVG.cloneNode(true);

		var decals = Decals.SVG;
		copy.appendChild(decals);

		return prepareForExport(copy);
	}

	function svg2img(svg, width, height) {
		svg.setAttribute("width", width || 1920);
		svg.setAttribute("height", height || 1080);
		var copy = svg.cloneNode(true);
		var str = xml.serializeToString(copy);
		var svgEnc = encodeSVG(str);
		var image64 = 'data:image/svg+xml,' + svgEnc;
		return image64;
	}

	function prepareCanvas (href) {
		if (!href) return;
		canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
		img.onload = function () {
			/* Background Image */
			if (this.width > 1280) {
				canvas.width = this.width;
				canvas.height = this.height;
			} else {
				canvas.width = 1280;
				canvas.height = Math.round(this.height / this.width * 1280);
			}
			canvasCtx.drawImage(this, 0, 0, canvas.width, canvas.height);
			/* Logo */
			img.onload = function () {
				canvasCtx.drawImage(this, 0, 0);
			};
			img.src = svg2img(logoSVG, canvas.width, Math.round(canvas.height / 12) );
		};
		img.src = href;
	}

	return {
		set Background (bck) {
			var mouse = find("Mouse_Droid");
			if (mouse)
				mouse.remove();
			var width = 0, height = 0;
			switch (bck.type) {
				case "image/svg+xml":
					bckSVG = bck.data;
					var viewBox = bckSVG.viewBox.baseVal;
					bckImgURI = svg2img(bckSVG, viewBox.width, viewBox.height);
					break;
				default:
					bckImgURI = bck.data;
					bckSVG = null;
			}
			if (logoSVG)
				prepareCanvas(bckImgURI);
			document.body.style.backgroundImage = "url(\"" + bckImgURI + "\")";

			if (bck.custom) {
				reset.style.display = "";
			} else {
				reset.style.display = "none";
				Vault.getItem("Mouse-Droid", function (mouse) {
					bckSVG.appendChild(mouse.cloneNode(true));
					function anim(n) {
						return function(){this.style.animationName = n;}
					}
					mouse.onmouseenter = anim("drive_off");
					mouse.ontouchstart = anim("drive_off");
					mouse.onanimationend = anim("none");
					document.body.insertBefore(mouse, document.body.firstElementChild);
				});
			}
		},
		get Background () {
			var svgMain = XML.SVGNode("svg", {
				"version": "1.1",
				"width": canvas.width,
				"height": canvas.height,
				"viewBox": [0, 0, canvas.width, canvas.height].join(" ")
			});
			if (bckSVG) {
				svgMain.appendChild(bckSVG);
			} else {
				var img = XML.SVGNode("image", {
					"width": "100%",
					"height": "100%",
					"href": bckImgURI
				}, svgMain);
			}

			var logo = logoSVG.cloneNode(true);
			svgMain.appendChild(logo);

			var meta = XML.SVGNode("metadata", {}, svgMain);
			meta.innerHTML = "<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:rdfs='http://www.w3.org/2000/01/rdf-schema#' xmlns:dc='http://purl.org/dc/elements/1.1/'> <rdf:Description> <dc:creator>MandoCreator</dc:creator> <dc:publisher>https://www.mandocreator.com</dc:publisher> <dc:description>Your Beskar'gam - created by MandoCreator</dc:description> <dc:format>image/svg+xml</dc:format> <dc:type>Image</dc:type> <dc:title>MandoCreator - Ner Berskar'gam</dc:title> <dc:date>" + (new Date).toISOString() + "</dc:date> </rdf:Description> </rdf:RDF>";

			return svgMain;
		},
		attach: function (a, type) {
			var blobURL;
			var isSetUp = false;
			a.addEventListener("click", function() {
				if (!isSetUp) return;
				setTimeout(function() {
					URL.revokeObjectURL(blobURL)
					isSetUp = false;
				}, 500);
			});
			a.type = type;
			if (type === "image/svg+xml") {
				var self = this;
				a.addEventListener("click", function () {
					var bck = self.Background;
					bck.appendChild(SVGFromEditor());
					var str = xml.serializeToString(bck);
					var noEmptyLines = str.replace(/\n\s*\n/,"");
					var document = "<?xml version='1.0' encoding='UTF-8'?>" + noEmptyLines;
					var blob = new Blob([document], {type: "image/svg+xml"});
					blobURL = URL.createObjectURL(blob);
					this.href = blobURL;
				});
			} else {
				a.addEventListener("click", function (event) {
					if (isSetUp) {
						prepareCanvas(bckImgURI);
						return true;
					}
					event.preventDefault();
					img.onload = function () {
						canvasCtx.drawImage(this, 0, 0);
						canvas.toBlob(function (blob) {
							blobURL = URL.createObjectURL(blob);
							a.href = blobURL;
							isSetUp = true;
							a.click();
						}, "image/jpeg");
					}
					img.src = svg2img(SVGFromEditor(), canvas.width, canvas.height);
				});
			}
		}
	}
}
