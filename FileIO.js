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

var Uploader = {
	parseMando: function (svg) {
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
	},
	dissectSVG: function (data) {
		var svg = XML.SVGNode("svg");
		svg.innerHTML = data;
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
		interactive = false;
		this.parseMando(mando);
		interactive = true;

		if (mando.id === "Female-Body") {
			var sex_radio = find("female");
			sex_radio.checked = true;
			Settings.Sex(true, true);
		} else {
			var sex_radio = find("male");
			sex_radio.checked = true;
			Settings.Sex(false, true);
		}
	},
	attach: function (target, type) {
		var reader = new FileReader;
		var self = this;
		if (type == "armor") {
			reader.onload = function () {
				self.dissectSVG(this.result);
			};
			target.addEventListener("change", function() {
				reader.readAsText(this.files[0]);
				this.value = "";
			});
		} else {
			reader.onload = function() {
				Download.Background = {data: this.result, custom: true}
			}
			target.addEventListener("change", function() {
				reader.readAsDataURL(this.files[0]);
				this.value = "";
			});
		}

	}
}

function Downloader (Decals) {
	var xml = new XMLSerializer();
	var img = new Image();
	img.decoding = "sync";
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

	function SVGFromEditor (width, height) {
		var svg = find("main").lastElementChild;
		svg =  svg.cloneNode(true);
		var body = svg.lastElementChild;
		prepareForExport(body);

		var decals = Decals.SVG;
		svg.insertBefore(decals, body);

		var meta = XML.SVGNode("metadata", {}, svg);
		meta.innerHTML = "<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:rdfs='http://www.w3.org/2000/01/rdf-schema#' xmlns:dc='http://purl.org/dc/elements/1.1/'><rdf:Description><dc:creator>MandoCreator</dc:creator><dc:publisher>https://www.mandocreator.com</dc:publisher><dc:description>Your Beskar'gam - created by MandoCreator</dc:description><dc:format>image/svg+xml</dc:format><dc:type>Image</dc:type><dc:title>MandoCreator - Ner Berskar'gam</dc:title><dc:date>" + (new Date).toISOString() + "</dc:date></rdf:Description></rdf:RDF>";
		svg.insertBefore(meta, body);

		svg.setAttribute("width", width);
		svg.setAttribute("height", height);
		svg.style.height = "";

		var str = xml.serializeToString(svg);
		return str.replace(/\n\s*\n/g, "");
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
			a.addEventListener("click", function(event) {
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
					var str = SVGFromEditor(170, 300);
					var document = "<?xml version='1.0' encoding='UTF-8'?>\n" + str;
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
				var supportsDecoding = ("decoding" in XML.SVGNode("image"));
				a.addEventListener("click", function (event) {
					if (isSetUp)
						return true;
					event.preventDefault();
					var first = !supportsDecoding;
					img.onload = async function () {
						await this.decode();
						if (first) {
							this.src = this.src;
							return first = false;
						}
						canvasCtx.drawImage(this, 0, 0);
						canvas.toBlob(toURL, "image/jpeg");
					}
					var s = SVGFromEditor(canvas.width, canvas.height);
					img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
				});
			}
		}
	}
}
