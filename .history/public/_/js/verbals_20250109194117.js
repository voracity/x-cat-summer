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

function buildDetailColliderSentenceList(secondOrderPaths, arcsContribution, verbalListDisplay) {
  // Append second-order explanations below the first-order ones

  secondOrderPaths.forEach((path, index) => {
    const arcInfo = arcsContribution[index];
    if (!arcInfo) return;

    const { from, to, color, isCollider, order } = arcInfo;
    let sentenceEl;

    if (isCollider) {
      // Example text for a collider scenario
      sentenceEl = n(
        'p',
        '● Collider path: ',
        n('span', from, { class: 'verbalTextBold' }),
        ' → ',
        n('span', to, { class: 'verbalTextBold' }),
        '. Observing this collider node ',
        n('span', colorToVerbal(color), { class: 'verbalTextUnderline' }),
        ' the probability for the target.'
      );
    } else if (order && order >= 2) {
      // Non-collider, but second-order or higher
      sentenceEl = n(
        'p',
        '● A second-order path from ',
        n('span', from, { class: 'verbalTextBold' }),
        ' to ',
        n('span', to, { class: 'verbalTextBold' }),
        ' that ',
        n('span', colorToVerbal(color), { class: 'verbalTextUnderline' }),
        ' the target indirectly.'
      );
    } else {
      // Fallback for unexpected data
      sentenceEl = n(
        'p',
        '● (Fallback) This path does not appear to be a second-order/collider path.'
      );
    }

    if (sentenceEl) verbalListDisplay.appendChild(sentenceEl);
  });
}

function generateDetailedExplanations({activePaths,secondOrderPaths,arcsContribution,verbalListDisplay,}) {
  verbalListDisplay.innerHTML = '';

  // 1) Generate explanations for first-order paths
  if (activePaths && activePaths.length > 0) {
    buildDetailSentenceList(activePaths, arcsContribution, verbalListDisplay);
  }

  // 2) If second-order paths exist, generate collider/second-order explanations
  if (secondOrderPaths && secondOrderPaths.length > 0) {
    buildDetailColliderSentenceList(secondOrderPaths, arcsContribution, verbalListDisplay);
  }
}

function findAllColliders(graph) {
  const childToParents = {};

  // Loop over each parent in the graph
  for (const parent in graph) {
    const children = graph[parent];
    children.forEach(child => {
      if (!childToParents[child]) {
        childToParents[child] = new Set();
      }
      // Add the parent to this child's set of parents
      childToParents[child].add(parent);
    });
  }

  // Step 2: A child is a collider if it has 2 or more distinct parents
  const colliders = [];
  for (const child in childToParents) {
    if (childToParents[child].size >= 2) {
      colliders.push(child);
    }
  }

  return colliders;
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