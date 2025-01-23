var {n,chain} = require('htm');
var {sitePath} = require('siteUtils');

class StandardPage {
	// Generates the basic structure of the XCAT
	make() {
		this.root = n('html',
			this.headEl = n('head',
				n('title', 'X-CAT'),
				// Linking multiple stylesheets for various components and features.
				n('link', {href: sitePath('/_/css/cat.css'), rel: 'stylesheet', type: 'text/css'}),
				n('link', {href: sitePath('/_/css/influence.css'), id:"influence-css", rel: 'stylesheet', type: 'text/css'}),
				n('link', {href: sitePath('/_/js/menu/menu_styles.css'), rel: 'stylesheet', type: 'text/css'}),
				/*n('style', `
					.cbi { color: rgb(128,0,0); }
				`),*/
				n('script', {src: sitePath('/_/js/components.js')}),
				n('script', {src: sitePath('/_/js/htm.js')}),
				n('script', {src: sitePath('/_/js/utils.js')}),
				n('script', {src: sitePath('/_/js/animations.js')}),
				n('script', {src: sitePath('/_/js/verbals.js')}),
				n('script', {src: sitePath('/_/js/nodepath.js')}),
				n('script', {src: sitePath('/_/js/calculation.js')}),
				n('script', {src: sitePath('/_/js/menu/menu.js')}),
				n('script', {src: sitePath('/_/js/cat.js')}),
			),
			n('body',
				n('div.header',
					n('h1', n('a', {href: '/'}, n('img.logo', {src:'/_/images/cat_logo.png', alt: 'CAT logo'})), n('span.text', 'X-CAT: eXplainable Causal Attribution Tool (beta)')),
					n('div.siteLinks',
						this.loginSection = n('span.loginSection', n('button.login', 'Login')),  // Simple login button placeholder.
					),
				),
				this.contentEl = n('div.content',
				
				),
			),
		);
	}
	
	// Converts the DOM structure into a complete HTML string for rendering.
	toHtml() { return '<!doctype html>\n'+this.root.outerHTML; }
	
	$handleUpdate(m) {
		if (m.body) {
			this.contentEl.append(m.body);  // Appends new content to the content section dynamically.
		}
		if (m.user) {
			// Updates the login section to display the user's username dynamically.
			chain(this.loginSection).set({innerHTML:''}).append(n('span.username', m.user.username));
		}
		if ('user' in m) {
			console.log(m.user, m.user == null);
			let cl = chain(this.root.querySelector('body').classList);
			if (m.user == null)  cl.add('noUser').remove('user');
			else  cl.remove('noUser').add('user');
		}
		if (m.h1) {
			this.root.querySelector('.header h1 .text').textContent = m.h1;
		}
		if (m.componentName) {
			// Dynamically injects and initializes a component using its name.
			this.root.append(n('script', `
				window.defaultRoot = new ${m.componentName};
				window.defaultRoot.make(document.querySelector('.content *'));
				window.defaultRoot.setupEvents?.();
			`));
		}
	}
}

class BnPage extends StandardPage {
	make() {
		super.make(); // Inherit structure and behavior from `StandardPage`.
		this.root.querySelector('body').classList.add('bnPage'); // Adds a class specific to Bayesian Network pages.
		this.$handleUpdate({h1: 'BN PAGE'}); // Sets a custom header for BN pages.
	}
}

module.exports = {
	StandardPage,
	BnPage,
}