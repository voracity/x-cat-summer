var {n, toHtml} = require('htm');
var {sitePath, ...siteUtils} = require('siteUtils');
var {Net, Node} = require('../bni_smile');
var fs = require('fs');
const { noUserRequired } = require('./bn.route');

/// Class is available on both server and client
class Example {
    /// Runs on both server and client
    /// (Therefore, inline event functions won't work)
    make(root) {
        this.root = root ?? n('div',
            // Inline style just as example. Styles should normally be in CSS files.
            n('style', `
                .popup { display: none; position: fixed; background: white; padding: 5px; border: solid 1px #ccc; box-shadow: 1px 1px 2px #cccc; }
            `),
            n('h3.heading'),
            n('ul.nodeList'),
            n('div.popup'),
        );
    }

    /// Runs on both server and client
    /// (Therefore, inline event functions won't work)
    $handleUpdate(m) {
        if (m.title) {
            this.updateHeading(m.title);
        }
        if (m.nodeList) {
            let nl = this.root.querySelector('.nodeList');
            m.nodeList.forEach(node => nl.append(n('li', node.title, {dataDescription: node.description})));
        }
    }

    /// Runs on client ONLY
    /// (Event functions WILL work.)
    setupEvents() {
        this.root.querySelector('.nodeList').addEventListener('mouseover', event => {
            let li = event.target.closest('li');
            if (li) {
                this.showPopup(li.dataset.description, event.clientX, event.clientY);
            }
        });
        this.root.querySelector('.nodeList').addEventListener('mouseout', event => {
            let li = event.target.closest('li');
            if (li) {
                this.hidePopup();
            }
        });
    }

    /// Can run on client or server
    updateHeading(title) {
        this.root.querySelector('.heading').textContent = title;
    }

    /// Can run on client or server (but since it's a popup, usually only client)
    showPopup(text, x, y) {
        let popup = this.root.querySelector('.popup');
        popup.textContent = text;
        popup.style.display = text ? 'block' : 'none';
        popup.style.top = `${y}px`;
        popup.style.left = `${x}px`;
    }

    /// Can run on client or server (but since it's a popup, usually only client)
    hidePopup() {
        this.root.querySelector('.popup').style.display = 'none';
    }
}

module.exports = {
    component: Example,
    prepareData(db, req, res) {
        return {title: 'Test title', nodeList: [
            {title:'Node 1',description:'This is the first node'},
            {title:'Node 2',description:'This is the second node'},
            {title:'etc.'}
        ]};
    },
    noUserRequired: true
};