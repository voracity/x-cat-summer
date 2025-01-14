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
  
  function sortArcInfluenceByDiff(arcInfluence, nodeBeliefs, getColor, evidenceNodeName) {
    console.log('evidenceNodeName:', evidenceNodeName);
    console.log('nodeBeliefs', nodeBeliefs);
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
        console.log('diffs', diffs);
  
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