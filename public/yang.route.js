var { n } = require("htm");

class Yang {
  make() {
    // Create the root element for the component
    this.root = n("div", n("h1", "Hi, my name is Yang!"));
    return this.root;
  }
}

module.exports = {
  template: "StandardPage",
  component: Yang,
  noUserRequired: true,
};
