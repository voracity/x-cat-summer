# Getting started with development on X-CAT

## Components

X-CAT uses a custom framework, where components look as follows:

```js
class MyComponent {
    make() {
        this.root = n('div.myComponent',
            n('h3', 'Example heading'),
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
```

i.e., a typical 'render()' function (like what you might see in React) is split into a static make() function
and a dynamic $handleUpdate() function.

These components can be rendered both statically (on the server, delivered as HTML) and dynamically (created in client-side
JavaScript).

## Pages.

Every page has an associated component, which will be rendered statically first. Typically, routes map to a page under public
(e.g. /bn -> /public/bn.route.js).
Each page specifies a main component for that page, and a template. These will be combined for the first static rendering.
The page is treated as a module with this information exported. e.g.:

```js
# MyPage

class MyPageComponent {
    make() { ... }
    $handleUpdate(m) {...}
}

module.exports = {
	template: 'StandardPage',
	component: MyPageComponent,
	noUserRequired: true,
}
```

You can also query the database or do other data preparation in order to hydrate (i.e., call $handleUpdate() with data)
a component:

```js
module.exports = {
	template: 'StandardPage',
	component: MyPageComponent,
	noUserRequired: true,
    prepareData(req,res,db) {
        # ...use database to prepare and return data in the form of a message object
        let msg = {...};
        return msg;
    }
}
```

prepareData() can also be used to save data to the database (e.g. in response to a POST).

If you have a prepareData() exported function, this will automatically be called (which will hydrate the page via $handleUpdate).

For more information, see the introduction at the beginning of server.js.

## Tasks to get oriented with the code base

Here's a suggested order of tasks for getting familiar with how X-CAT works:

1. Create a new simple page, based on /public/what_is_cat.route.js
    1. Get this working first, and ensure you can prepare data, and see it update the component
2. Fork /public/bn.route.js
    1. Update BnDetail -> make() to add some buttons to the toolbar
    2. Update BnDetail -> $handleUpdate() to add an extra button alongside the 'C' and 'E' popup buttons, that pops up an alert
        (The alert can be done inline first, but can then be handled in an event in /public/_/js/bn.js, which is where all event
        handling should go.)
    3. Modify BnDetail -> $handleUpdate() to listen for a change to the target state, and style the target node and target state accordingly
        (This should just be a case of adding a CSS class to the target state, and using CSS with the :has() function to color things as intended!) 
