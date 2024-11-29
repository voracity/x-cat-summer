var {n} = require('htm');

class WhatIsCat {
	make() {
		this.root = n('div',
			n('h2', 'What is CAT?'),
		);
	}
}

module.exports = {
	template: 'StandardPage',
	component: WhatIsCat,
	noUserRequired: true,
}