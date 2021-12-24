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

function Uploader (queryString, D, History) {
	var readerBck = new FileReader;
	readerBck.onload = function() {
		D.Background = {data: this.result, custom: true};
	}
	find("background_upload").addEventListener("change", function() {
		var file = this.files[0];
		if (!file) return;
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
					|| node.hasAttribute("class")
					|| node.style.fill) )
					return NodeFilter.FILTER_SKIP;
				return NodeFilter.FILTER_ACCEPT;
			} }
		);

		var node;
		while (node = iter.nextNode()) {
			var bn = node.id + "Color";
			if (node.hasAttribute("fill")) {
				colors[bn] = node.getAttribute("fill");
			} else if (node.style.fill) {
				colors[bn] = node.style.fill;
			}
			switch (node.getAttribute("class")) {
				case "toggle":
					variants.setItem(node.id + "Toggle", node.style.display !== "none");
					break;
				case "option":
					var parent = node.parentNode;
					if (parent.id.includes("Ear"))
						variants.setItem(node.id + "Toggle", true);
					else {
						var parName = parent.id + "Select";
						variants.setItem(parName, node.id);
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
			}
		}
		localStorage.setItem("colors", JSON.stringify(colors));
	}

	function dissectSVG () {
		var svg = XML.SVGNode("svg");
		svg.innerHTML = this.result;
		svg = svg.firstElementChild;

		reset(true);

		var ds = svg.children[2];
		if (ds.id == "Decals") {
			var ch = ds.children;
			for (var i = 0; i < ch.length; i++) {
				if (ch[i].id.endsWith("__cd")) {
					var name = ch[i].getAttribute("serif:id");
					var data = ch[i].getAttribute("href");
					Decals.custom(data, name);
				}
			}
		}

		var mando = svg.lastElementChild;
		History.track = false;
		parseMando(mando);
		History.track = true;

		if (mando.id === "Female-Body") {
			var sex_radio = find("female");
			sex_radio.checked = true;
			Settings.Sex(true, true);
		} else {
			var sex_radio = find("male");
			sex_radio.checked = true;
			Settings.Sex(false, true);
		}
		setDefaultBackground();
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
	var bckImgURI;

	function prepareForExport (svg) {
		var iter = document.createNodeIterator(svg, NodeFilter.SHOW_ELEMENT,
			{ "acceptNode": function (node) {
				if (node.hasAttribute("class"))
					return NodeFilter.FILTER_ACCEPT;
				return NodeFilter.FILTER_SKIP;
			} }
		);
		var node;
		while (node = iter.nextNode()) {
			var display = node.style.display;
			switch (node.getAttribute("class")) {
				case "controls":
					node.remove();
					break;
				case "option":
					if (display !== "inherit")
						node.remove();
					break;
				case "toggle":
					if (display == "none")
						node.innerHTML = "";
					break;
			}
		}
		return svg;
	}

	function SVGFromEditor () {
		var SVG = find("main").lastElementChild;
		var copy = SVG.cloneNode(true);
		var body = copy.lastElementChild;

		var decals = Decals.SVG;
		copy.insertBefore(decals, body);

		var meta = XML.SVGNode("metadata", {}, copy);
		meta.innerHTML = "<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:rdfs='http://www.w3.org/2000/01/rdf-schema#' xmlns:dc='http://purl.org/dc/elements/1.1/'><rdf:Description><dc:creator>MandoCreator</dc:creator><dc:publisher>https://www.mandocreator.com</dc:publisher><dc:description>Your Beskar'gam - created by MandoCreator</dc:description><dc:format>image/svg+xml</dc:format><dc:type>Image</dc:type><dc:title>MandoCreator - Ner Berskar'gam</dc:title><dc:date>" + (new Date).toISOString() + "</dc:date></rdf:Description></rdf:RDF>";
		copy.insertBefore(meta, body);

		return prepareForExport(copy);
	}

	function svg2img(svg, width, height) {
		svg.setAttribute("width", width || 1920);
		svg.setAttribute("height", height || 1080);
		var str = xml.serializeToString(svg);
		return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
	}

	function prepareCanvas (href) {
		if (!href) return;
		canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
		img.onload = function () {
			/* Background Image */
			if (this.width >= 1280) {
				canvas.width = this.width;
				canvas.height = this.height;
			} else {
				canvas.width = 1280;
				canvas.height = Math.round(this.height / this.width * 1280);
			}
			canvasCtx.drawImage(this, 0, 0, canvas.width, canvas.height);
			/* Logo */
			this.onload = function () {
				var width = Math.round(canvas.width / 3);
				var height = Math.round(canvas.width / 18);
				canvasCtx.drawImage(this, 0, 0, width, height);
			};
			this.src = "images/Logo.svg";
		};
		img.src = href;
	}

	return {
		set Background (bck) {
			bckImgURI = bck.data;
			prepareCanvas(bckImgURI);
			document.body.style.backgroundImage = "url(\"" + bckImgURI + "\")";

			reset.style.display = bck.custom ? "" : "none";
		},
		attach: function (a, type) {
			var blobURL;
			var isSetUp = false;
			a.addEventListener("click", function() {
				if (!isSetUp) return;
				setTimeout(function() {
					prepareCanvas(bckImgURI);
					URL.revokeObjectURL(blobURL)
					isSetUp = false;
					a.href = "";
				}, 1000);
			});
			a.type = type;
			if (type === "image/svg+xml") {
				var self = this;
				a.addEventListener("click", function () {
					var svg = SVGFromEditor();
					var str = xml.serializeToString(svg);
					var noEmptyLines = str.replace(/\n\s*\n/g,"");
					var document = "<?xml version='1.0' encoding='UTF-8'?>" + noEmptyLines;
					var blob = new Blob([document], {type: "image/svg+xml;charset=utf-8"});
					blobURL = URL.createObjectURL(blob);
					this.href = blobURL;
				});
			} else {
				function toURL (blob) {
					blobURL = URL.createObjectURL(blob);
					a.href = blobURL;
					isSetUp = true;
					a.click();
				}
				a.addEventListener("click", function (event) {
					if (isSetUp)
						return true;
					event.preventDefault();
					img.onload = function () {
						canvasCtx.drawImage(this, 0, 0);
						canvas.toBlob(toURL, "image/jpeg");
					}
					img.src = svg2img(SVGFromEditor(), canvas.width, canvas.height);
				});
			}
		}
	}
}
