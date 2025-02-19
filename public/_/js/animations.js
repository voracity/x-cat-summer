var { getColor} = require('./utils.js');

function fadeNodes(classifiedPaths, bnView) {						
  let activeNodes = new Set([
    ...classifiedPaths.firstOrderPaths.map(path => path.map(subpath => subpath[0])).flat(),	
    ...classifiedPaths.secondOrderPaths.map(path => path.map(subpath => subpath[0])).flat(),	
  ]);						
  bnView.querySelectorAll('div.node').forEach(node => {
    let nodeName = node.getAttribute('data-name');
    if (!activeNodes.has(nodeName)) {
      node.style.opacity = 0.3;
    }
  });
}

function extractActiveNodes(classifiedPaths) {
  return new Set([
    ...classifiedPaths.firstOrderPaths.map(path => path.map(subpath => subpath[0])).flat(),
    ...classifiedPaths.secondOrderPaths.map(path => path.map(subpath => subpath[0])).flat(),
  ]);
}

// extractActiveNodes that can be used to extract only the first order nodes
// function extractActiveNodes(classifiedPaths, onlyFirstOrder=false) {
//   let activeNodes = new Set([
//     ...classifiedPaths.firstOrderPaths.map(path => path.map(subpath => subpath[0])).flat()
//   ]);

//   if (!onlyFirstOrder) {
//     classifiedPaths.secondOrderPaths.forEach(path => {
//       path.forEach(subpath => {
//         activeNodes.add(subpath[0]);
//       });
//     });
//   }

//   return activeNodes;
// }

function fadeNodes(activeNodes, bnView) {										
  bnView.querySelectorAll('div.node').forEach(node => {
    let nodeName = node.getAttribute('data-name');
    if (!activeNodes.has(nodeName)) {
      node.style.opacity = 0.3;
    }
  });
}

function fadeAllArrows(activeNodes, arcInfluence) {
  arcInfluence.forEach((arcEntry) => {    
    if (!activeNodes.has(arcEntry.child) || !activeNodes.has(arcEntry.parent)) {      
      fadeArrow(arcEntry.parent, arcEntry.child);
    }
  });
}

function colorNode(nodeName, m) {
  // Find the node with the given data-name
  let node = document.querySelector(`.node[data-name="${nodeName}"]:not(.focusEvidence)`);

  if (!node) {
      // console.warn(`Node with name "${nodeName}" not found.`);
      return;
  }

  let currentBelief = m.nodeBeliefs[nodeName];
  let origBeliefs = m.origModel.find(entry => entry.name == nodeName).beliefs;

  
  currentBelief.forEach((curBelief, idx) => {
    let diff = curBelief - origBeliefs[idx]
    let absDiff = diff * 100;
    
    // let colorClass = getColor(/curBelief/origBeliefs[idx])
    let colorClass = getColor(diff)

    let barchangeElem = node.querySelector(`.state[data-index="${idx}"] .barchange`)
    
    barchangeElem.classList.add(colorClass)						

    if (absDiff > 0) {
      // overlay change over the current belief bar
      barchangeElem.style.marginLeft = `-${absDiff}%`;
      barchangeElem.style.width = `${absDiff}%`;
    } else {
      // the change will be placed right next to the original belief bar
      barchangeElem.style.width = `${absDiff}%`;
    }
  });
}

function generateAnimationOrder(classifiedPaths) {
  let {firstOrderPaths, secondOrderPaths} = classifiedPaths;
  let animationOrder = [];
  let visitedArrows = new Set();
  let visitedNodes = new Set();
  let targetNode = null; // Store target node to ensure it's added at the end

  function processPath(path) {
    for (let i = 0; i < path.length - 1; i++) {
      let [currentNode, relation] = path[i];
      let [nextNode, nextRelation] = path[i + 1];

      let arrowDirection = relation === "parent" ? "normal" : "reverse";
      let arrowKey = `${currentNode}->${nextNode}`;
      let arrowKeyReverse = `${nextNode}->${currentNode}`;

      // Capture target node
      if (nextRelation === "target") {
          targetNode = nextNode;
      }

      // Add arrow if not visited
      if (!visitedArrows.has(arrowKey)) {
          animationOrder.push({ type: "arrow", from: currentNode, to: nextNode, direction: arrowDirection });
          visitedArrows.add(arrowKey);
          visitedArrows.add(arrowKeyReverse);
      }

      // Add node if not visited and it's not the target yet
      if (!visitedNodes.has(nextNode) && nextRelation !== "target") {
          animationOrder.push({ type: "node", name: nextNode });
          visitedNodes.add(nextNode);
      }
    }
  }

  // Process first-order paths
  firstOrderPaths.forEach(processPath);

  // Process second-order paths, ensuring no duplicates
  secondOrderPaths.forEach(processPath);

  // Ensure the target node is added at the end
  if (targetNode && !visitedNodes.has(targetNode)) {
      animationOrder.push({ type: "target", name: targetNode });
      visitedNodes.add(targetNode);
  }

  return animationOrder;
}

function reset(arcInfluence, bn, bnView) {
    if (arcInfluence) {
      arcInfluence.forEach((arcEntry) => {
        let arc = document.querySelector(
          `[data-child=${arcEntry.child}][data-parent=${arcEntry.parent}]`
        );
        if (arc) {
          arc.remove();        
        }
      });      
      bn.drawArcs();
    }
    bnView.querySelectorAll('div.node').forEach(node => {						
      node.style.opacity = 1
      node.style.boxShadow = ""
    });        
  }
  
function sortArcInfluenceByDiff(arcInfluence, nodeBeliefs, evidenceNodeName) {
  
  return arcInfluence
    .map((arcEntry) => {
      // Calculate max diff for this arcEntry       
      const diffs = Object.entries(arcEntry.targetBelief).map(
        ([targetNodeName, arcBeliefs]) => {
          const targetNode = document.querySelector(
            `div.node[data-name=${targetNodeName}]`
          );
          const targetStateElem = targetNode.querySelector(".state.istarget");
          const targetStateIdx = targetStateElem.dataset.index;

          // Calculate diff for this target
          return nodeBeliefs[targetNodeName][targetStateIdx] - arcBeliefs[targetStateIdx];
        }
      );

      // max to ensures the arc represents its strongest influence across all targets.
      const maxDiff = Math.max(...diffs);
      const color = getColor(maxDiff);

      // Add a priority flag: 1 if evidenceNodeName is part of the arc, 0 otherwise
      const isPriority = (arcEntry.child === evidenceNodeName || arcEntry.parent === evidenceNodeName) ? 1 : 0;

      
      return { ...arcEntry, maxDiff, color, isPriority };      
    })
    .sort((a, b) => {
      if (b.isPriority !== a.isPriority) {
        return b.isPriority - a.isPriority;
      }
      return b.maxDiff - a.maxDiff;
    }) // Sort by maxDiff in descending order
    .map(({ maxDiff, color, ...arcEntry }) => ({...arcEntry, color})); // Remove the maxDiff property
}

function getArcColors(arcInfluence, nodeBeliefs) {
  const arcColors = {};  

  arcInfluence.forEach((arcEntry) => {
      // Calculate max diff for this arcEntry       
      const diffs = Object.entries(arcEntry.targetBelief).map(([targetNodeName, arcBeliefs]) => {
          const targetNode = document.querySelector(`div.node[data-name=${targetNodeName}]`);
          const targetStateElem = targetNode.querySelector(".state.istarget");
          const targetStateIdx = targetStateElem.dataset.index;

          // Calculate diff for this target
          return nodeBeliefs[targetNodeName][targetStateIdx] - arcBeliefs[targetStateIdx];
      });

      // Calculate the maximum difference to represent the arc's strongest influence
      const maxDiff = Math.max(...diffs);
      const color = getColor(maxDiff);

      // Create the key using child and parent names
      const key = `${arcEntry.parent}, ${arcEntry.child}`;

      // Add the key-value pair to the dictionary
      arcColors[key] = color;
  });

  return arcColors;
}

function colorArrows(arcParent, arcChildren, colorOrder, color) {
  let arc = document.querySelector(
    `[data-child=${arcChildren}][data-parent=${arcParent}]`,
  );

  let influeceArcBodyElems = arc.querySelectorAll("[data-influencearc=body]");
  let influeceArcHeadElems = arc.querySelectorAll("[data-influencearc=head]");
  let paintColor = getComputedStyle(document.documentElement).getPropertyValue(`--${color}`);
  let arcSize = 8;

  let combinedElems = Array.from(influeceArcBodyElems).map(
    (bodyElem, index) => {
      return {
        body: bodyElem,
        head: influeceArcHeadElems[index],
      };
    },
  );
  												
  combinedElems.forEach((pair) => {
    let bodyElem = pair.body;
    let headElem = pair.head;	      																			
    
    if (colorOrder == 'normal') {
      // coloring arrow from bottom to top
      colorElement(bodyElem, paintColor, arcSize, colorOrder);	
      // console.log('bodyElem working:');						
      setTimeout(() => {											
        // console.log("headElem:", headElem, "Tag:", headElem?.tagName);
        colorElement(headElem, paintColor, arcSize, colorOrder, isBody = false);												
        
      }, 800);
    
    } else {
      // coloring arrow from top to bottom														
      colorElement(headElem, paintColor, arcSize, colorOrder, isBody = false);											  
      colorElement(bodyElem, paintColor, arcSize, colorOrder);												        
    }										
  });
}

async function extractColoredArrows(animationOrderBN) {
  const coloredArcs = new Set();
  animationOrderBN.forEach((path) => {
    if (path.type === "arrow") {
      let { arcParent, arcChildren } = getArcEndpoints(path);
      let key = `${arcParent}, ${arcChildren}`;
      coloredArcs.add(key);
    }
  });
  return coloredArcs;
}

function fadeArrow(arcParent, arcChildren) {
  let arc = document.querySelector(
      `[data-child="${arcChildren}"][data-parent="${arcParent}"]`
  );    

  if (!arc) {
      console.warn(`fadeArc: Arc not found - Parent: ${arcParent}, Child: ${arcChildren}`);
      return;
  }

  let arcBodys = arc.querySelectorAll('path.line'); 
  let arcHeads = arc.querySelectorAll('g.head');
  
  arcBodys[1].setAttribute('stroke', '#DBDBDB');
  arcHeads[1].setAttribute('fill', '#DBDBDB');
  arcHeads[1].setAttribute('stroke', '#DBDBDB');  
}


function colorElement(elem, paintColor, arcSize, direction = 'normal', isBody = true) {
  if (!elem) {
      console.warn("colorElement: Element is null or undefined");
      return;
  }

  elem.style.stroke = paintColor;
  elem.style.strokeWidth = arcSize;

  let elemLength = 100; 

  if (elem.tagName.toLowerCase() === "path") {
      elemLength = elem.getTotalLength();

  } else if (elem.tagName.toLowerCase() === "g") {      
      let pathElem = elem.querySelector("path");
      
      if (pathElem && typeof pathElem.getTotalLength === "function") {
          elemLength = pathElem.getTotalLength();
          elem = pathElem; 
      } else {
          console.warn("colorElement: No valid path inside <g> or getTotalLength() not supported.");
      }
      
  } else {
      console.warn("colorElement: getTotalLength() not supported for", elem);
  }

  elem.style.strokeDasharray = elemLength;

  if (direction === 'normal') {
      elem.style.strokeDashoffset = elemLength; // Normal start (hidden)
  } else {
      elem.style.strokeDashoffset = -elemLength; // Reverse the animation
  } 

  elem.style.transition = "none"; 
  elem.getBoundingClientRect(); // Trigger reflow to apply changes
  
  if (isBody) {
    elem.style.transition = "stroke-dashoffset 1s ease-in-out";
  }
  
  // Animate stroke from hidden to full visibility
  elem.style.strokeDashoffset = 0;
}

function getArcEndpoints(path) {
  return path.direction === "normal"
      ? { arcParent: path.from, arcChildren: path.to }
      : { arcParent: path.to, arcChildren: path.from };
}

function colorTargetBar(listTargetNodes, m) {
  Object.entries(listTargetNodes).forEach(([targetNodeName, data]) => {
    let baseBelief = data.model.beliefs[data.index];
    let currentBelief = m.nodeBeliefs[targetNodeName][data.index];
    let diff = currentBelief - baseBelief
    let absDiff = 100*Math.abs(diff)
    let targetColorClass = getColor(diff)				
    let barchangeElem = data.targetStateElem.querySelector(`span.barchange`);

    Array.from(barchangeElem.classList).forEach(classname=> {
      if (classname.indexOf("influence-idx") == 0) {
        barchangeElem.classList.remove(classname);
        barchangeElem.classList.remove(`${targetColorClass}-box`);
        barchangeElem.classList.remove(`influence-box`);
      }
    })

    if (diff > 0) {
      barchangeElem.style.marginLeft = `-${absDiff}%`;
      barchangeElem.style.width = `${absDiff}%`;
    } else {
      barchangeElem.style.marginLeft = `-${absDiff}%`;
      barchangeElem.style.width = `${absDiff}%`;

    }
    // shadow-boxes with width 0 still show their glow

    // target bar color
    if (Math.abs(diff)>0)
      barchangeElem.classList.add(targetColorClass+"-box");

  })
}

// class AnimationStep {
//     repeats = 1;
//     async playOnce() {
//         await this.setup();
//         await new Promise(r => requestAnimationFrame(r));
//         this.raiseIfStop();

//         await this.run();
//         await new Promise(r => requestAnimationFrame(r));
//         this.raiseIfStop();

//         await this.finish();
//         await new Promise(r => requestAnimationFrame(r));
//         this.raiseIfStop();
//     }

//     async play() {
//         try {
//             for (let i=0; i<this.repeats; i++) {
//                 await this.playOnce();
//             }
//         }
//         catch (err) {
//             if (err instanceof AnimationStop) {
//                 /// Just bring animation to an end;
//             }
//             else {
//                 throw err;
//             }
//         }
//     }

//     stop() {
//         this.stopping = true;
//     }

//     raiseStop() {
//         if (this.stopping) {
//             this.stopping = false;
//             throw new AnimationStop();
//         }
//     }

//     async setup() {}
//     async run() {}
//     async finish() {}
// }

// class AnimationStop extends Error {}

// class FlashNode extends AnimationStep {
//     node = null;
//     constructor(node) {
//         super();
//         this.node = node;
//     }

//     async setup() {
//         this.node.style.boxShadow = '1px 1px 3px rgba(255,0,0,0.5)';
//     }

//     async run() {
//         /// Or use CSS animation with keyframes, which is nicer. Just need to store the keyframes in a CSS file,
//         /// or include them in an inline <style> tag, and the CSS animation needs to be written such that they work
//         /// generically with any appropriate element.
//         let dur = 0.5; //s
//         this.node.style.transition = `box-shadow ${dur}s`;
//         this.node.style.boxShadow = '1px 1px 0 rgba(255,0,0,0.5)';
//         await new Promise(r => setTimeout(r, dur*1000));
//     }

//     async finish() {
//         this.node.style.transition = '';
//     }
// }

// class AnimationQueue extends AnimationStep {
//     queue = [];
//     current = 0;
//     constructor(queue) {
//         this.queue = queue;
//     }

//     stop() {
//         super.stop();
//         this.queue[current]?.stop?.();
//     }

//     async setup() {
//         this.current = 0;
//     }

//     async run() {
//         for (; this.current < queue.length; this.current++) {
//             await step.play();
//         }
//     }
// }

// new AnimationQueue([
//     new FlashNode(.,,,)
//     new ArcAnimate(...),
// ])