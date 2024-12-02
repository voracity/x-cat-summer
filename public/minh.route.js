var { n } = require("htm");

class Minh {
  make() {
    // Create the root element for the component
    this.nameElement = n("h2", "Hi, my name is Minh!");
    this.inputElement = n("input", {
      id: "mynameis",
      autofocus: "",
      placeholder: "Enter your name",
    });
    this.root = n(
      "div",
      this.nameElement,
      n(
        "p",
        "I am a software engineer at Cat Digital. I am currently working on the Cat Digital Platform team. I am passionate about software development and I am always looking for ways to improve my skills. I am also a huge fan of the outdoors and I love to go hiking and camping. I am always looking for new adventures and I am excited to see where my career takes me!",
        { style: "color: red" }
      ),
      this.inputElement,
      n("button.clickMe", "Click me!", {
        onclick: `console.log("Button clicked. Input value:", document.getElementById("mynameis").value);`,
      })
    );
    return this.root;
  }

  $handleUpdate(m) {
    // Respond to updates passed by the framework
    if (m.name) {
      console.log("Updating name to:", m.name); // Log on the client side
      this.nameElement.textContent = `Hi, my name is ${m.name}!`;

      this.root.querySelector(
        "button.clickMe"
      ).textContent = `Click me, ${m.name}!`;

      this.root
        .querySelector("button.clickMe")
        .addEventListener("click", () => {
          console.log("Button clicked. Input value:", m.name);
        });

      // m.name = this.root.querySelector("input#mynameis").value;
    }
  }
}

module.exports = {
  template: "StandardPage",
  component: Minh,
  noUserRequired: true,

  async prepareData(req, res, db, cache) {
    // Provide initial data for the component
    return { name: "Minh" }; // Default name
  },
};
