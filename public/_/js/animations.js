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

          // Capture target node
          if (nextRelation === "target") {
              targetNode = nextNode;
          }

          // Add arrow if not visited
          if (!visitedArrows.has(arrowKey)) {
              animationOrder.push({ type: "arrow", from: currentNode, to: nextNode, direction: arrowDirection });
              visitedArrows.add(arrowKey);
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
      bnView.querySelectorAll(`div.node`).forEach(node => {						
        node.style.opacity = 1
      });
      bn.drawArcs();
    }
  }
  
  function sortArcInfluenceByDiff(arcInfluence, nodeBeliefs, evidenceNodeName) {
    console.log('evidenceNodeName:', evidenceNodeName);
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

function colorElement(elem, paintColor, arcSize, direction = 'normal') {
    elem.style.stroke = paintColor;
    elem.style.strokeWidth = arcSize;

    let elemLength = elem.getTotalLength();
    elem.style.strokeDasharray = elemLength;

    if (direction === 'normal') {
        elem.style.strokeDashoffset = elemLength; // Normal start (hidden)
    } else {
        elem.style.strokeDashoffset = -elemLength; // Reverse the animation
    } 

    elem.style.transition = "none"; // Remove any previous transitions
    elem.getBoundingClientRect(); // Trigger the flow, without this it just appears not flowing from the start to finish
    
    elem.style.transition = "stroke-dashoffset 1s ease-in-out";
    
    // Normal direction: animate from no stroke to full stroke 
    elem.style.strokeDashoffset = 0;

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