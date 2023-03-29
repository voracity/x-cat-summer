window.addEventListener('DOMContentLoaded', event => {
	document.querySelector('button.login')?.addEventListener?.('click', async event => {
		//window.location.href='/login'
		let dlg = ui.popupDialog([
			n('h2', 'Login'),
			n('div.form', 
				
			),
		]);
		let content = await fetch('/login?requestType=slice').then(r=>r.text());
		dlg.querySelector('.form').innerHTML = content;
		dlg.querySelector('.controls').append(n('button', 'Cancel', {type: 'button', on: {click: ui.dismissDialogs}}));
	});

	/** Drag and drop **/
	document.querySelectorAll('.upload.box, .upload.box *').forEach(el => el.addEventListener('dragenter', event => {
		event.target.closest('.upload.box').classList.add('dragover');
	}));
	document.querySelector('.upload.box')?.addEventListener?.('dragover', event => {
		event.preventDefault();
	});
	document.querySelector('.upload.box')?.addEventListener?.('dragleave', event => {
		event.target.classList.remove('dragover');
	});
	document.querySelector('.upload.box')?.addEventListener?.('drop', event => {
		event.target.classList.remove('dragover');
		event.preventDefault();
		q('[name=uploadCbn]').files = event.dataTransfer.files;
		q('[name=uploadCbn]').form.submit();
	}, false);
});

/// Hook fetch to show "loading"
var oldFetch = fetch;
fetch = (resource, init) => {
	let el = null;
	let t = setTimeout(_=> {
		el=n('div.message', 'Loading...');
		document.body.append(el);
	}, 100);
	return oldFetch(resource, init).then((res,rej) => {
		if (el)  el.remove();
		clearTimeout(t);
		return res;
	}).catch(err => console.log(err));
};

function changeUserLogin(type, el) {
	let userLogin = el.closest('.userLogin');
	if (type == 'create') {
		userLogin.querySelector('.login.form').classList.remove('active');
		userLogin.querySelector('.register.form').classList.add('active');
	}
	else {
		userLogin.querySelector('.login.form').classList.add('active');
		userLogin.querySelector('.register.form').classList.remove('active');
	}
}

var ui = {
	/** Dialogs **/
	popupDialog(content, opts) {
		console.log("HERE")
		opts = opts || {};
		opts.buttons = opts.buttons || [];
		opts.className = opts.className || "";

		let veil = n("div.veil", {style: 'opacity:1'});
		q('body').append(veil);

		/// Embed dialog into the veil
		/// $a could be a string, element or jquery element
		let dlg = n("div.dialog"+(opts.className ? '.'+opts.className : ''), content);
		veil.append(dlg);

		/// Add controls
		dlg.append(n('div.controls', opts.buttons));

		return dlg;
	},

	reportError(msg) {
		ui.popupDialog(msg+"<div class=controls><button type=button onclick=dismissDialogs()>OK</button></div>");
	},

	dismissDialog(dlg) {
		dlg.closest('.veil').style.opacity = 0;
		setTimeout(function() {
			dlg.closest('.veil').remove();
		}, 500);
	},

	dismissDialogs() {
		qa(".dialog").forEach(dlg => ui.dismissDialog(dlg));
	},
};

var render = {
	 css: function(el) {
		
		var sheets = document.styleSheets, ret = {};
		el.matches = el.matches || el.webkitMatchesSelector || el.mozMatchesSelector 
			|| el.msMatchesSelector || el.oMatchesSelector;
		for (var i in sheets) {

			var rules = sheets[i].rules || sheets[i].cssRules;
			for (var r in rules) {
				if (el.matches(rules[r].selectorText)) {
					let style = rules[r].style;
					for(let i = 0; i < style.length; i++) {
						let cssprop = style[i];
						let prop = cssprop.replace(/\-([a-z])/g, v => v[1].toUpperCase());
						let val = style[prop]
						if (val.indexOf("var(") == 0) {
							let s = getComputedStyle(el);
							let cval = s[cssprop]
							val = cval
						}
						ret[prop] = val;
					}
				}
			}
		}
		return ret;
	},
	applyStyle: function(el, target) {
		let s = getComputedStyle(el);
		if (target == undefined)
			target = el
		for (let key in s) {
			if(!isNaN(Number(key))) {
				let cssprop = s[key]
				let prop = cssprop.replace(/\-([a-z])/g, v => v[1].toUpperCase());
				// let prop = key//.replace(/\-([a-z])/g, v => v[1].toUpperCase());
				// console.log(prop)
				if (s[cssprop].length > 0)
					target.style[prop] = s[cssprop];
			}
			// console.log(target.outerHTML)
		}
		target
	},
	Network: function(scaling = 1){
		let outimg = document.createElement("img")
		outimg.style.position = "absolute"
		outimg.style.top + "0px"
		outimg.style.left + "0px"
		
		// document.body.appendChild(outimg)


		let networkView = document.querySelector(".bnView")
		let legend = document.querySelector(".evidence-scale")
		let nodes = networkView.querySelectorAll(".node");
		let edges = networkView.querySelectorAll("svg");
		
		// This container will contain a copy of the DOM that represents the bayes network.
		// After all elements have been added, those clones will then
		// have inline CSS added to them, which is necessary for rendering
		// inside the SVG Doc.
		let copyContainerRoot = document.createElement("div");
		
		copyContainerRoot.style.position = "absolute";
		copyContainerRoot.style.width = "100%"
		copyContainerRoot.style.height = "100%"
		copyContainerRoot.style.top = "1000px"		
		// Container needs to be added to DOM to allow CSS referencing
		document.body.appendChild(copyContainerRoot)
		
		let copyContainer = document.createElement("div");
		copyContainer.style.width = "100%"
		copyContainer.style.height = "100%"
		copyContainer.style.fontFamily = 'arial'
		copyContainerRoot.appendChild(copyContainer)

		let k = networkView.cloneNode();//document.createElement("div");
		// k.className = "bnView"
		k.style.display = "inline-block"
		k.style.position = "absolute";

		copyContainer.appendChild(k)

		// Following vars contain data to create an image of the exact size of the network
		// Contain the translate coordinates
		minx = networkView.clientWidth
		miny = networkView.clientHeight
		// Final size of the canvas
		networkWidth = 0
		networkHeight = 0

		// Clone all Nodes 
		Array.from(nodes).forEach(n => {
			let copy = n.cloneNode(true)
			// rect = n.getBoundingClientRect()
			miny = Math.min(n.offsetTop, miny)
			minx = Math.min(n.offsetLeft, minx)
			networkWidth = Math.max(n.offsetLeft + n.clientWidth) - minx
			networkHeight = Math.max(n.offsetTop + n.clientHeight) - miny
			k.append(copy)
		})
		// Add clone of the legend
		let clonedLegend = legend.cloneNode(true);
		clonedLegend.style.display = "inline-block"
		clonedLegend.style.position = "absolute";
		clonedLegend.style.fontSize = "0.64em" // the scale container inherited 0.8em and is itself 0.8em
		clonedLegend.style.top = "0px"
		clonedLegend.style.left = "0px";

		copyContainer.append(clonedLegend);

		let legendGap = 10;
		let legendHeight = clonedLegend.clientHeight
		let legendWidth = clonedLegend.clientWidth
		let height = Math.max(legendHeight, networkHeight)
		let width = legendWidth + legendGap + networkWidth

		k.style.width = `${width*devicePixelRatio}px`
		k.style.height = `${height*devicePixelRatio}px`

		// Move legend to the bottom of the network
		clonedLegend.style.transform = `translate(0px, ${legendHeight< networkHeight ? networkHeight-legendHeight :0}px)`


		// convert referenced CSS to inline styles
		let allNodes = Array.from(copyContainer.querySelectorAll("*"))
		allNodes.forEach(node => {
			let style = render.css(node)
			console.log(node)
			Object.keys(style).forEach(key => 
				node.style[key] == '' ? node.style[key] = style[key] : undefined)			
		})

		
		// Add copies of the SVG Elements
		Array.from(edges).forEach(n => {
			let copy = n.cloneNode(true)
			k.append(copy)
		})

		// Move network right of the legend
		let networktop = legendHeight > networkHeight ? -miny+(legendHeight - networkHeight) / 2 : -miny;
		k.style.transform = `translate(${legendWidth + legendGap -minx}px, ${networktop}px)`


		let c = document.createElement('canvas')
		c.width = (width+10) * scaling
		c.height = (height+10) * scaling
		ctx = c.getContext('2d')

		let svgdoc = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		let rootgroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
		svgdoc.appendChild(rootgroup)
		rootgroup.setAttribute('transform', `scale(${scaling}, ${scaling})`)
		// To put HTML content inside a special element
		// This allows us to render HTML to PNG
		fo = document.createElementNS("http://www.w3.org/2000/svg", 'foreignObject')
		fo.setAttribute("width", width*devicePixelRatio)
		fo.setAttribute("height", height*devicePixelRatio)
		fo.innerHTML = copyContainerRoot.innerHTML
		rootgroup.appendChild(fo)
		

		xmlencoded = new XMLSerializer().serializeToString(svgdoc);

		/**
		 * Cannot use Blob here because of crossOrigin policy in Chrome
		 * 		blob = new Blob([xmlencoded], {type:"image/svg+xml"})
		 *	 	bloburi = URL.createObjectURL(blob)
		 * So we just create a texturi
		 */
		bloburi = "data:image/svg+xml;charset=utf-8,"+xmlencoded
		var img = new Image()
		img.onload = function() {
			ctx.drawImage(this, 0, 0)

			imguri = c.toDataURL("image/png", 1)
			// outimg.src = imguri

			let a = document.createElement('a')
			a.href = imguri
			a.download = "graph"
			a.target = "_blank"
			a.click()
			
			URL.revokeObjectURL(bloburi)
			document.body.removeChild(copyContainerRoot)
		}

		img.src = bloburi;

	}
}