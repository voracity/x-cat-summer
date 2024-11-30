var {n} = require('htm');

class MyComponent {
    make() {
        this.root = n('div.myComponent',
            n('h3', 'Hello there is Yang'),
            n('div',
                n('p', 'Example text', {style: 'color: red'}),
                n('p', 'Second paragraph', {dataCustomName: 'my data value'}),
                n('p.time')
            )
        );

        return this.root;
    }

    // Takes a message object ('m'), with changes to be made to the component
    $handleUpdate(m) {
        if (m.time) {
            this.root.querySelector('p.time').textContent = m.time;
        }
    }
}

module.exports = {
	template: 'StandardPage',
	component: Yang,
	noUserRequired: true,
}