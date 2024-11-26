(function (global) {
  // Check if 'require' is available (Node.js environment)
  if (typeof require != "undefined") {
    // Use jsdom to create a document object for DOM manipulation
    document = new (require("jsdom").JSDOM)().window.document;
  }

  // Define namespaces for different XML-based languages
  let namespaces = {
    svg: "http://www.w3.org/2000/svg",
    s: "http://www.w3.org/2000/svg", // Custom alias for SVG
    math: "http://www.w3.org/1998/mathml",
    m: "http://www.w3.org/1998/mathml", // Custom alias for MathML
  };

  // Function to create a DOM node with optional namespace, classes, and IDs
  function node(tag, ...args) {
    // Split the tag to check for namespace
    let nsParts = tag.split(/:/);
    let ns = null;
    if (nsParts.length > 1) {
      ns = nsParts[0]; // Namespace prefix
      tag = nsParts[1]; // Actual tag name
    }

    // Split the tag to separate tag name, classes, and IDs
    let parts = tag.split(/(?=[.#])/);
    tag = parts[0];
    let attrs = parts.slice(1);

    // Create the element, using namespace if provided
    let el = ns
      ? document.createElementNS(namespaces[ns], tag)
      : document.createElement(tag);

    // Add classes and IDs to the element
    let attr = null;
    let arg = null;
    let i = 0;
    for (i = 0; i < attrs.length; i++) {
      attr = attrs[i];
      if (attr[0] == ".") el.classList.add(attr.slice(1)); // Add class
      else if (attr[0] == "#") el.id = attr.slice(1); // Add ID
    }

    // Handle additional arguments (children, attributes, etc.)
    for (i = 0; i < args.length; i++) {
      arg = args[i];
      handleArg(el, arg);
    }

    return el;
  }

  // Function to create a DOM node without namespace handling
  function qnode(tag, ...args) {
    let el = document.createElement(tag);

    // Handle additional arguments (children, attributes, etc.)
    for (i = 0; i < args.length; i++) {
      arg = args[i];
      handleArg(el, arg);
    }

    return el;
  }

  function handleArg(el, arg) {
    let type = typeof arg;
    let containerEl = el;

    /// Blah to special casing :(
    /// This at least makes it work seamlessly with HTML
    if (el.tagName == "TEMPLATE") {
      containerEl = el.content;
    }

    if (arg === null || arg === undefined) {
      /// pass
    }
    /// This is far quicker than instanceof, though more prone to error
    else if (arg && arg.nodeType && arg.nodeName) {
      // If arg is a DOM node, append it to the container element
      containerEl.appendChild(arg);
    } else if (Array.isArray(arg)) {
      // If arg is an array, recursively handle each element
      let args = arg;
      for (var arg of args) {
        handleArg(el, arg);
      }
    } else if (type == "string" || type == "number" || type == "boolean") {
      // If arg is a primitive type, create a text node and append it
      containerEl.appendChild(document.createTextNode(String(arg)));
    } else {
      // If arg is an object, treat it as a set of attributes
      for (var attr in arg) {
        var attrVal = arg[attr];
        if (attr in node.hooks) {
          // If the attribute has a custom hook, use it
          node.hooks[attr](el, attrVal, attr);
        } else if (attrVal === null || attrVal === undefined) {
          // Skip null or undefined attribute values
        } else {
          // Convert mixedCase to mixed-case and set the attribute
          attr = attr.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          el.setAttribute(attr, String(attrVal));
        }
      }
    }
  }

  /// Attributes that do custom things. Recommend prefixing with 'hook'. JS style names only.
  node.hooks = {};
  var n = node;

  /// A rather important hook
  // Custom hook to add event listeners
  node.hooks.on = (el, obj) => {
    for (var [eventName, func] of Object.entries(obj)) {
      el.addEventListener(eventName, func);
    }
  };

  // Custom hook to set text content
  node.hooks.dataText = (el, arg) => {
    el.appendChild(document.createTextNode(String(arg)));
  };

  /*function syncNode(target, source) {
			var nodesToSync = [target];
			
	}*/

  // Function to escape HTML special characters in a string
  function toHtml(str) {
    if (str === null || str === undefined) return "";
    str = "" + str;
    str = str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return str;
  }

  /** Call using html`<div>${content}</div>` or using html('<div>'+content+'</div>') **/
  function html(strs, ...keys) {
    if (strs && strs.nodeType !== undefined) return strs; // If strs is a DOM node, return it directly
    let str =
      typeof strs == "string"
        ? strs // If strs is a string, use it directly
        : strs[0] + keys.map((k, i) => toHtml(k) + strs[i + 1]).join(""); // Otherwise, construct the string with HTML escaping
    var wrapper = document.createElement("div");
    var range = document.createRange();
    wrapper.innerHTML = str; // Set the innerHTML of the wrapper to the constructed string
    range.selectNodeContents(wrapper); // Select the contents of the wrapper
    return range.extractContents(); // Extract and return the contents as a DocumentFragment
  }

  /** This restores jquery like chaining --- but for any object at all! **/
  function chain(o, opts = {}) {
    let chainSym = Symbol("chain");
    if (typeof o != "object" || o == null || o[chainSym]) return o; // Return if o is not an object, is null, or already chained
    let proxy = new Proxy(o, {
      get(target, prop, receiver, noCustomProps) {
        let handler = this;
        if (!noCustomProps) {
          if (prop === "my") {
            return new Proxy(proxy, {
              get(_target, _prop) {
                // Return a proxy for 'my' property
                return handler.get(target, _prop, receiver, true);
              },
            });
          } else if (prop === "root") {
            return opts.root; // Return the root of the chain
          } else if (prop === "set") {
            /** return function to set things **/
            return (obj) => {
              Object.assign(target, obj); // Assign properties to the target
              /// return the root of the chain (i.e. the original proxy)
              return proxy;
            };
          } else if (prop === "unchain") {
            /** I think .raw is better than unchain() **/
            return (_) => target; // Return the raw target object
          } else if (prop === "raw") {
            return target; // Return the raw target object
          }

          /// More experimental:
          else if (prop === "forEach") {
            return (func) => {
              target.forEach((element, index, array) =>
                func(chain(element, { root: opts.root }), index, array)
              );
              return proxy; // Return the proxy for chaining
            };
          }
        }
        if (!(prop in target)) return undefined; // Return undefined if the property does not exist

        if (typeof target[prop] == "function") {
          return (...args) => {
            let val = target[prop](...args); // Call the function
            if (typeof val == "object" && val != null) {
              return chain(val, { root: opts.root }); // Chain the returned object
            } else if (val == null) {
              return proxy; // Return the proxy for chaining
            } else {
              return val; // Return the value
            }
          };
        } else if (typeof target[prop] == "object" && target[prop] != null) {
          return chain(target[prop], { root: opts.root }); // Chain the object property
        } else {
          return target[prop]; // Return the property value
        }
      },
    });
    proxy[chainSym] = true; // Mark the proxy as chained
    opts.root ??= proxy; // Set the root of the chain if not already set
    return proxy; // Return the proxy
  }

  // Expose functions and variables globally
  global.node = node;
  global.qnode = qnode;
  global.n = n;
  global.q = (str) => document.querySelector(str);
  global.qa = (str) => [...document.querySelectorAll(str)];
  global.toHtml = toHtml;
  global.html = html;
  global.chain = chain;
})(typeof window != "undefined" ? window : exports);
