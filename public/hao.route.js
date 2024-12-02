var {n,html} = require('htm');


class Hao_page {
	make() {
        let text_home = `
        <div style="display: flex; justify-content: center; align-items: center">
            Hao's page
        </div>
    `;
		this.root = n('div',
			n('h1', html(text_home)),
            n('h2','TODO:'),
            n('p','W2-Fri')
		);
	}
}

module.exports = {
	template: 'StandardPage',
	component: Hao_page,
	noUserRequired: true,
}