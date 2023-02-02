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
	applyStyle: function(el, target) {
		s = getComputedStyle(el);
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
	Network: function(){
		let outimg = document.createElement("img")
		outimg.style.position = "absolute"
		outimg.style.top + "0px"
		outimg.style.left + "0px"
		
		document.body.appendChild(outimg)


		let networkView = document.querySelector(".bnView")
		let nodes = networkView.querySelectorAll(".node");
		let edges = networkView.querySelectorAll("svg");
		
		
		let copyContainer = document.createElement("div");
		copyContainer.style.position = "absolute";
		copyContainer.style.width = "100%"
		copyContainer.style.height = "100%"
		copyContainer.style.top = "1000px"		

		let k = document.createElement("div");
		k.className = "bnView"
		
		document.body.appendChild(copyContainer)
		copyContainer.appendChild(k)


		minx = networkView.clientWidth
		miny = networkView.clientHeight
		width = 0
		height = 0
		Array.from(nodes).forEach(n => {
			let copy = n.cloneNode(true)
			// rect = n.getBoundingClientRect()
			miny = Math.min(n.offsetTop, miny)
			minx = Math.min(n.offsetLeft, minx)
			width = Math.max(n.offsetLeft + n.clientWidth) - minx
			height = Math.max(n.offsetTop + n.clientHeight) - miny
			k.append(copy)
		})
		let s = `translate(-${minx}px, -${miny}px)`
		
		// convert styles to inline styles
		Array.from(copyContainer.querySelectorAll("*")).forEach(node => {
			render.applyStyle(node)
		})

		Array.from(edges).forEach(n => {
			let copy = n.cloneNode(true)
			k.append(copy)
		})

		k.style.transform = s

		let c = document.createElement('canvas')
		c.width = width
		c.height = height
		ctx = c.getContext('2d')

		let data = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		// data.setAttribute("version", "1.1")
		// data.setAttribute("width", networkView.clientWidth)
		// data.setAttribute("height", networkView.clientHeight)
		
		// let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
		// circle.setAttribute("cx", 40)
		// circle.setAttribute("cy", 40)
		// circle.setAttribute("r", 40)
		// circle.setAttribute("fill", "red")
		// data.appendChild(circle)

		fo = document.createElementNS("http://www.w3.org/2000/svg", 'foreignObject')
		fo.setAttribute("width", networkView.clientWidth)
		fo.setAttribute("height", networkView.clientHeight)
		fo.innerHTML = copyContainer.innerHTML
		data.appendChild(fo)

		xmlencoded = new XMLSerializer().serializeToString(data);

		/**
		 * Cannot use Blob here because of crossOrigin policy in Chrome
		 * 		blob = new Blob([xmlencoded], {type:"image/svg+xml"})
		 *	 	bloburi = URL.createObjectURL(blob)
		 * So we just create a texturi
		 */
		bloburi = "data:image/svg+xml;charset=utf-8,"+xmlencoded
		var img = new Image()
		// img.crossOrigin = "Anonymous";
		img.onload = function() {
			ctx.drawImage(this, 0, 0)

			imguri = c.toDataURL("image/png", 1)
			outimg.src = imguri

			let a = document.createElement('a')
			a.href = imguri
			a.download = "graph"
			a.target = "_blank"
			a.click()
			
			URL.revokeObjectURL(bloburi)
			document.body.removeChild(copyContainer)
		}

		img.src = bloburi;
		


	}
}

