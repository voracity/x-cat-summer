var {n} = require('htm');

function colorToVerbal(color) {
  if (color == "influence-idx6")
    return "greatly reduces";
  else if (color == "influence-idx5")
    return "moderately reduces";
  else if (color == "influence-idx4")
    return "slightly reduces";
  else if (color == "influence-idx3")
    return "doesn't change";
  else if (color == "influence-idx2")
    return "slightly increases";
  else if (color == "influence-idx1")
    return "moderately increases";
  else if (color == "influence-idx0")
    return "greatly increases";
}

function colorToVerbalShorten(color) {
  if (color == "influence-idx6" || color == "influence-idx5" || color == "influence-idx4")
    return "reduces";
  else if (color == "influence-idx3")
    return "doesn't change";
  else if (color == "influence-idx2" || color == "influence-idx1" || color == "influence-idx0")
    return "increases";
}

function buildFindingOutSentence(numsFinding, evidenceNodeName, evidenceState, colorContribute, targetNodeName, targetState, detail=false) {    
  let findingSentence = n('p', `${numsFinding > 1 ? '● ' : ''}Finding out `, 
    n('span', evidenceNodeName, {class: 'verbalTextBold'}), ' was ', 
    n('span', evidenceState, {class: 'verbalTextItalic'}),' ', 
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderline'}), ' the probability of ', 
    n('span', targetNodeName, {class: 'verbalTextBold'}), ' is ', 
    n('span', targetState, {class: 'verbalTextItalic'}), detail ? ', by direct connection.' : ' .'); 
    
  return findingSentence;
}

function buildDetailSentenceList(activePaths, arcsContribution, verbalListDisplay) {
  let index = 0;

  console.log('activePaths', activePaths);

  activePaths.forEach((path) => {
    console.log('path', path);
    const arc = arcsContribution[index]; // Access the arc using the current index
    if (path.length == 2) { 
      // Direct connection: only one arc      
      const sentence = n(
        'p',
        '● By direct connection, it ',
        n('span', colorToVerbal(arc.color), { class: 'verbalText' }),
        ' the probability of ',
        n('span', path[1], { class: 'verbalTextBold' }),
        '.'
      );
      verbalListDisplay.appendChild(sentence); // Append the generated sentence to the display
    } else {
      // Indirect connection: multiple arcs
      const sentence = n('p', '● It ');

      path.forEach((node, i) => {
        if (i < path.length - 1) {
          let toState = path[index + 1] == arc.to ? arc.toState : arc.fromState;
          // Not the last node in the path          
          if (i === 0) {
            // First step in the path
            sentence.appendChild(
              n('span', colorToVerbalShorten(arc.color), { class: 'verbalText' })
            );
            sentence.appendChild(n('span', ' the probability that '));
            sentence.appendChild(
              n('span', path[index + 1], { class: 'verbalTextBold' })
            );
            sentence.appendChild(n('span', ' was '));
            sentence.appendChild(
              n('span', toState, { class: 'verbalTextItalic' })
            );
            sentence.appendChild(n('span', ','));
          } 
          // else {
          //   // Intermediate steps
          //   sentence.appendChild(n('span', ' which in turn '));
          //   sentence.appendChild(
          //     n('span', colorToVerbalShorten(arc.color), { class: 'verbalText' })
          //   );
          //   sentence.appendChild(n('span', ' the probability that '));
          //   sentence.appendChild(
          //     n('span', arc.to, { class: 'verbalTextBold' })
          //   );
          //   sentence.appendChild(n('span', ' was '));
          //   sentence.appendChild(
          //     n('span', arc.toState, { class: 'verbalTextItalic' })
          //   );
          //   sentence.appendChild(n('span', ','));
          // }
        } else {
          // Last step in the path  
          // console.log('path[i]', path[i]); 
          
          sentence.appendChild(n('span', ' which in turn '));
          sentence.appendChild(
            n('span', colorToVerbal(arc.color), { class: 'verbalText' })
          );
          sentence.appendChild(n('span', ' the probability of '));
          sentence.appendChild(
            n('span', path[i], { class: 'verbalTextBold' })
          );
          sentence.appendChild(n('span', '.'));
        }        
      });
      index++; // Move to the next arc
      verbalListDisplay.appendChild(sentence); // Append the generated sentence
    }
  });
}

function buildDetailCombinedExplanation(arcsContribution, verbalListDisplay) {
  verbalListDisplay.innerHTML = '';

  if (!arcsContribution || arcsContribution.length === 0) {
    // If no arcs, just exit or show something minimal
    const p = n('p', '(No arcs to explain.)');
    verbalListDisplay.appendChild(p);
    return;
  }

  const introSpans = [];
  arcsContribution.forEach((arc, i) => {
    // For each arc: “the presence of Dermascare”, or “inheriting the Mutation”
    const chunk = n('span', 
      n('span', arc.fromState, { class: 'verbalTextItalic' }), ' ',
      n('span', arc.from, { class: 'verbalTextBold' })
    );
    introSpans.push(chunk);
    // if not the last item, insert “ or ”
    if (i < arcsContribution.length - 1) {
      introSpans.push(' or ');
    }
  });

  // Combine them into one sentence
  const firstParagraph = n('p',
    'Either ',
    ...introSpans,
    ' can directly cause ',
    n('span', arcsContribution[0].toState, { class: 'verbalTextItalic' }), ' ',
    n('span', arcsContribution[0].to, { class: 'verbalTextBold' }),
    '.'
  );

  verbalListDisplay.appendChild(firstParagraph);


  arcsContribution.forEach((arc, index) => {
    // We'll create a bullet like “1.”, “2.”, etc. 

    const bulletNumber = (index + 1) + '.';
 
    const colorPhrase = colorToVerbal(arc.color);

    // Construct the paragraph
    const bulletParagraph = n('p',
      n('span', bulletNumber, { style: 'font-weight:bold' }), ' ',
      `If we didn't know about `,
      n('span', arc.to, { class: 'verbalTextBold' }),
      `, finding out the `,
      n('span', arc.fromState, { class: 'verbalTextItalic' }),
      ' of ',
      n('span', arc.from, { class: 'verbalTextBold' }),
      ' would ',
      n('span', colorPhrase, { class: 'verbalTextUnderline' }),
      ' the probability of ',
      n('span', arc.toState, { class: 'verbalTextItalic' }), ' ',
      n('span', arc.to, { class: 'verbalTextBold' }),
      '.'
    );

    verbalListDisplay.appendChild(bulletParagraph);
  });

}

function generateDetailedExplanations(activePaths,arcsContribution,colliderNodes,verbalListDisplay) {

  // sort them into two categories: colliderPaths and normalPaths
  const colliderPaths = [];
  const normalPaths   = [];

  activePaths.forEach((path) => {
    // If the path has a collider node in the "middle" (or anywhere), we treat it as collider
    if (pathHasCollider(path, colliderNodes)) {
      colliderPaths.push(path);
    } else {
      normalPaths.push(path);
    }
  });
  
  // call the detail function for normal vs. collider paths
  if (normalPaths.length > 0) {
    console.log("normalPaths: ", normalPaths)
    buildDetailSentenceList(normalPaths, arcsContribution, verbalListDisplay);
  }

  if (colliderPaths.length > 0) {
    console.log("colliderPaths: ", colliderPaths)
    buildDetailCombinedExplanation(arcsContribution, verbalListDisplay);
  }
}


function pathHasCollider(path, colliderNodes) {

  const middleNodes = path.slice(1, -1);
  return middleNodes.some(node => colliderNodes.includes(node));
}

function findAllColliders(relationships) {
  //childToParents: for each child, a set of distinct parents
  const childToParents = {};
  relationships.forEach(({ from, to }) => {
    if (!childToParents[to]) {
      childToParents[to] = new Set();
    }
    childToParents[to].add(from);
  });


  //check if there's a path from one parent to another
  const adjacency = {};
  relationships.forEach(({ from, to }) => {
    if (!adjacency[from]) {
      adjacency[from] = [];
    }
    adjacency[from].push(to);
  });

  // check if there's a path from nodeA to nodeB using DFS
  function canReach(nodeA, nodeB) {
    // If adjacency[nodeA] is empty or undefined, no path
    if (!adjacency[nodeA]) return false;
    const stack = [nodeA];
    const visited = new Set([nodeA]);

    while (stack.length > 0) {
      const current = stack.pop();
      // if current can go directly to nodeB
      if (adjacency[current]?.includes(nodeB)) {
        return true;
      }
      // push children not visited
      for (const nxt of (adjacency[current] || [])) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          stack.push(nxt);
        }
      }
    }
    return false;
  }

  const finalColliders = [];


  for (const child in childToParents) {
    const parents = Array.from(childToParents[child]);
    if (parents.length < 2) continue;  // not a collider candidate

    // only keep 'child' if no two parents are connected
    let keepNode = true;
    for (let i = 0; i < parents.length && keepNode; i++) {
      for (let j = i + 1; j < parents.length && keepNode; j++) {
        const p1 = parents[i];
        const p2 = parents[j];
        if (canReach(p1, p2) || canReach(p2, p1)) {
          keepNode = false;
          break;
        }
      }
    }
    // if keepNode is still true => no parents are connected
    if (keepNode) {
      finalColliders.push(child);
    }
  }

  return finalColliders;
}
  
function buildSummarySentence(numsFinding, colorContribute, targetNodeName, targetState) {
  let findings = numsFinding == 2 ? 'Both' : 'All';
  return n('p', 
    n('span', `${findings} findings`, {class: 'verbalTextBold'}),
    ' combined ',
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderline'}),
    ' the probability that ',
    n('span', targetNodeName, {class: 'verbalTextBold'}),
    ' is ',
    n('span', targetState, {class: 'verbalTextItalic'}),
    '.',
    n('br'),
    n('br'),
    'The ',
    n('span', 'contribution', {style: 'text-decoration: underline;'}),
    ' of each finding is:',
   )
}

function numberToWord(num) {
  if (num == 0) return "zero";
  if (num == 1) return "one";
  if (num == 2) return "two";
  if (num == 3) return "three";
  if (num == 4) return "four";
  if (num == 5) return "five";
  if (num == 6) return "six";
  if (num == 7) return "seven";
  if (num == 8) return "eight";
  if (num == 9) return "nine";
  if (num == 10) return "ten";
  return num;
}