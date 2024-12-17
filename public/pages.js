class StandardPage {
    make() {
        this.root = n('html',
            n('head', n('title', 'Main Page')),
            n('body',
                n('div.header', n('h1', 'Main Page Header')),
                n('div.content',
                    this.contentEl = n('div',
                        n('button', { onclick: "window.location.href='/new-page'" }, 'Go to New Page')
                    )
                )
            )
        );
    }
}

class NewPage extends StandardPage {
    make() {
        super.make();
        this.contentEl.append(n('p', 'Welcome to the new page!'));
    }
}

module.exports = { StandardPage, NewPage };
