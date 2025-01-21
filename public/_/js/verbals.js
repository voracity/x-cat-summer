var {n} = require('htm');
var {Net} = require('../../../bni_smile');

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
        } else {  
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

// function buildDetailCombinedExplanation(arcsContribution, verbalListDisplay) {
//   verbalListDisplay.innerHTML = '';

//   if (!arcsContribution || arcsContribution.length === 0) {
//     // If no arcs, just exit or show something minimal
//     const p = n('p', '(No arcs to explain.)');
//     verbalListDisplay.appendChild(p);
//     return;
//   }

//   const introSpans = [];
//   arcsContribution.forEach((arc, i) => {
//     // For each arc: “the presence of Dermascare”, or “inheriting the Mutation”
//     const chunk = n('span', 
//       n('span', arc.fromState, { class: 'verbalTextItalic' }), ' ',
//       n('span', arc.from, { class: 'verbalTextBold' })
//     );
//     introSpans.push(chunk);
//     // if not the last item, insert “ or ”
//     if (i < arcsContribution.length - 1) {
//       introSpans.push(' or ');
//     }
//   });

//   // Combine them into one sentence
//   const firstParagraph = n('p',
//     'Either ',
//     ...introSpans,
//     ' can directly cause ',
//     n('span', arcsContribution[0].toState, { class: 'verbalTextItalic' }), ' ',
//     n('span', arcsContribution[0].to, { class: 'verbalTextBold' }),
//     '.'
//   );

//   verbalListDisplay.appendChild(firstParagraph);


//   arcsContribution.forEach((arc, index) => {
//     // We'll create a bullet like “1.”, “2.”, etc. 

//     const bulletNumber = (index + 1) + '.';
 
//     const colorPhrase = colorToVerbal(arc.color);

//     // Construct the paragraph
//     const bulletParagraph = n('p',
//       n('span', bulletNumber, { style: 'font-weight:bold' }), ' ',
//       `If we didn't know about `,
//       n('span', arc.to, { class: 'verbalTextBold' }),
//       `, finding out the `,
//       n('span', arc.fromState, { class: 'verbalTextItalic' }),
//       ' of ',
//       n('span', arc.from, { class: 'verbalTextBold' }),
//       ' would ',
//       n('span', colorPhrase, { class: 'verbalTextUnderline' }),
//       ' the probability of ',
//       n('span', arc.toState, { class: 'verbalTextItalic' }), ' ',
//       n('span', arc.to, { class: 'verbalTextBold' }),
//       '.'
//     );

//     verbalListDisplay.appendChild(bulletParagraph);
//   });

// }

function buildDetailCombinedExplanation(arcsContribution, verbalListDisplay, colliderDiffs = []) {
  verbalListDisplay.innerHTML = '';

  // Basic check
  if (!arcsContribution || arcsContribution.length === 0) {
    const p = n('p', '(No arcs to explain.)');
    verbalListDisplay.appendChild(p);
    return;
  }

  // Figure out if we see "explaining away" or "empowering" from colliderDiffs.
  let effectType = 'explaining away'; // default
  let baseDiff = 0, powerDiff = 0;
  if (colliderDiffs.length > 0) {
    const c = colliderDiffs[0]; 
    baseDiff  = c.baseDiff;
    powerDiff = c.powerDiff;
    if (powerDiff > baseDiff) {
      effectType = 'empowering';
    }
  }

  const arc0 = arcsContribution[0];
  const arc1 = arcsContribution[1];

  // Intro
  const introParagraph = n('p',
    'Either ',
    n('span', arc0.fromState, {class:'verbalTextItalic'}), ' ',
    n('span', arc0.from, {class:'verbalTextBold'}),
    ' or the ',
    n('span', arc1.fromState, {class:'verbalTextItalic'}), ' ',
    n('span', arc1.from, {class:'verbalTextBold'}),
    ' can directly cause ',
    n('span', arc0.toState, {class:'verbalTextItalic'}), ' ',
    n('span', arc0.to, {class:'verbalTextBold'}),
    '.'
  );
  verbalListDisplay.appendChild(introParagraph);

  // Step 1
  const step1 = n('p',
    n('span','1.',{style:'fontWeight:bold'}),' ',
    `If we didn’t know about `,
    n('span', arc0.to,{class:'verbalTextBold'}),
    `, finding out the `,
    n('span', arc0.fromState,{class:'verbalTextItalic'}),
    ' of ',
    n('span', arc0.from,{class:'verbalTextBold'}),
    ' would be enough to increase the probability of ',
    n('span', arc0.toState,{class:'verbalTextItalic'}),' ',
    n('span', arc0.to,{class:'verbalTextBold'}),
    ', even without ',
    n('span', arc1.from,{class:'verbalTextBold'}),
    '. This alone wouldn’t change the probability of ',
    n('span', arc1.from,{class:'verbalTextBold'}),
    '.'
  );
  verbalListDisplay.appendChild(step1);

  // Step 2a
  const step2a = n('p',
    n('span','2a.',{style:'fontWeight:bold'}),' ',
    'But first knowing ',
    n('span', arc0.to,{class:'verbalTextBold'}),
    ' is ',
    n('span', arc0.toState,{class:'verbalTextItalic'}),
    ' greatly increases the probability of ',
    n('span', arc1.from,{class:'verbalTextBold'}),
    '.'
  );
  verbalListDisplay.appendChild(step2a);

  // Step 2b 
  let step2bText = '';
  if (effectType === 'explaining away') {
    step2bText = ` only slightly increases the probability of ${arc1.from}. By making ${arc0.to}'s contribution smaller, the ${arc0.from} finding moderately reduces the probability of ${arc1.from}. (baseDiff = ${baseDiff.toFixed(2)}) `;
  } else {
    step2bText = ` significantly increases the probability of ${arc1.from}. By making ${arc0.to}'s contribution bigger, the ${arc0.from} finding slightly increases the probability of ${arc1.from}. (powerDiff = ${powerDiff.toFixed(2)}) `;
  }

  const step2b = n('p',
    n('span','2b.',{style:'fontWeight:bold'}),' ',
    'Now finding out the ',
    n('span', arc0.fromState,{class:'verbalTextItalic'}),' of ',
    n('span', arc0.from,{class:'verbalTextBold'}),
    step2bText
  );
  verbalListDisplay.appendChild(step2b);

  // Pattern paragraph
  const patternParagraph = n('p',
    'Because we see an ',
    n('span', effectType,{class:'verbalTextBold'}),
    ' pattern, the net effect on ',
    n('span', arc0.to,{class:'verbalTextBold'}),
    ' is that the probability is ',
    (effectType === 'explaining away' ? 'reduced overall.' : 'increased overall.')
  );
  verbalListDisplay.appendChild(patternParagraph);

  // // Final line
  // const finalOverall = n('p',
  //   'Overall, the findings ',
  //   (effectType === 'explaining away'
  //     ? n('span','moderately reduces',{class:'verbalTextUnderline'})
  //     : n('span','slightly increases',{class:'verbalTextUnderline'})
  //   ),
  //   ' the probability of ',
  //   n('span', arc1.from,{class:'verbalTextBold'}),
  //   '.'
  // );
  // verbalListDisplay.appendChild(finalOverall);
}

function generateDetailedExplanations(activePaths,arcsContribution,colliderNodes,verbalListDisplay,colliderDiffs) {

  // We'll sort them into two categories: colliderPaths and normalPaths
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
  
  // Now call the detail function for normal vs. collider paths
  if (normalPaths.length > 0) {
    console.log("normalPaths: ", normalPaths)
    buildDetailSentenceList(normalPaths, arcsContribution, verbalListDisplay);
  }

  if (colliderPaths.length > 0) {
    console.log("colliderPaths: ", colliderPaths)
    buildDetailCombinedExplanation(arcsContribution, verbalListDisplay, colliderDiffs);
  }
}


function pathHasCollider(path, colliderObjs) {
  const middleNodes = path.slice(1, -1);
  return middleNodes.some(node =>
    colliderObjs.some(colliderObj => colliderObj.node === node)
  );
}

function findAllColliders(relationships) {
  const colliders = [];
  const incomingEdges = {};
  relationships.forEach(rel => {
    if (!incomingEdges[rel.to]) {
      incomingEdges[rel.to] = [];
    }
    incomingEdges[rel.to].push(rel.from);
  });

  for (const [node, parents] of Object.entries(incomingEdges)) {
    if (parents.length > 1) {
      // Check if any two parents are directly connected in 'relationships'
      const hasDirectPath = parents.some(parentA =>
        parents.some(parentB =>
          relationships.some(rel =>
            (rel.from === parentA && rel.to === parentB) ||
            (rel.from === parentB && rel.to === parentA)
          )
        )
      );

      // If no direct edge among parents => node is a collider
      if (!hasDirectPath) {
        colliders.push({ node, parents });
      }
    }
  }
  console.log("colliders------------",colliders)

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

function findColliders(net, relationships) {
    const colliders = [];
    const incomingEdges = {};

    relationships.forEach(rel => {
        if (!incomingEdges[rel.to]) incomingEdges[rel.to] = [];
        incomingEdges[rel.to].push(rel.from);
    });

    for (const [node, parents] of Object.entries(incomingEdges)) {
        if (parents.length > 1) {
            const hasDirectPath = parents.some(parentA =>
                parents.some(parentB =>
                    relationships.some(rel => 
                        (rel.from === parentA && rel.to === parentB) || 
                        (rel.from === parentB && rel.to === parentA)
                    )
                )
            );

            if (!hasDirectPath) colliders.push({ node, parents });
        }
    }

    return colliders;
}

function calculateBaseDiff(net, colliderNode, parents, targetNode, evidence, targetStateIndex, bnKey) {
  const baselineNet = new Net(bnKey);
  const evidenceNet = new Net(bnKey);
  evidenceNet.compile();

  // Apply evidence only to evidenceNet
  Object.entries(evidence).forEach(([nodeName, stateIndex]) => {
      if (evidenceNet.node(nodeName)) evidenceNet.node(nodeName).finding(Number(stateIndex));
  });

  evidenceNet.node(targetNode).finding(targetStateIndex);
  evidenceNet.update();

  const probWithEvidence = evidenceNet.node(colliderNode).beliefs()[targetStateIndex];

  // Baseline without evidence
  baselineNet.node(targetNode).finding(targetStateIndex);
  baselineNet.update();

  const probWithoutEvidence = baselineNet.node(colliderNode).beliefs()[targetStateIndex];

  return Math.abs(probWithEvidence - probWithoutEvidence);
}

function calculatePowerDiff(net, colliderNode, parents, targetNode, evidence, targetStateIndex, bnKey) {
  const evidenceNet = new Net(bnKey);
  evidenceNet.compile();

  // Apply evidence to evidenceNet
  Object.entries(evidence).forEach(([nodeName, stateIndex]) => {
      if (evidenceNet.node(nodeName)) evidenceNet.node(nodeName).finding(Number(stateIndex));
  });

  evidenceNet.node(targetNode).finding(targetStateIndex);
  evidenceNet.update();

  let cumulativeDiff = 0;

  parents.forEach(parent => {
      const parentNode = evidenceNet.node(parent);
      if (!parentNode) return;

      parentNode.states().forEach((_, stateIndex) => {
          parentNode.finding(stateIndex);
          evidenceNet.update();

          const beliefs = evidenceNet.node(colliderNode).beliefs();
          const probWithEvidence = beliefs[targetStateIndex];
          const probWithoutEvidence = 1 - probWithEvidence;

          cumulativeDiff += Math.abs(probWithEvidence - probWithoutEvidence);
      });

      parentNode.retractFindings();
  });

  return cumulativeDiff;
}


function calculateOddsRatio(net, colliderNode, parents, targetNode, evidence, targetStateIndex, bnKey) {
  const baselineNet = new Net(bnKey);
  const evidenceNet = new Net(bnKey);
  baselineNet.compile();
  evidenceNet.compile();

  // Apply evidence to evidenceNet
  Object.entries(evidence).forEach(([nodeName, stateIndex]) => {
      if (baselineNet.node(nodeName)) baselineNet.node(nodeName).finding(Number(stateIndex));
      if (evidenceNet.node(nodeName)) evidenceNet.node(nodeName).finding(Number(stateIndex));
  });

  let P_v_t = 0, P_v_not_t = 0, P_v_t_e = 0, P_v_not_t_e = 0;

  parents.forEach(parent => {
      const parentNode = evidenceNet.node(parent);
      if (!parentNode) return;

      parentNode.states().forEach((_, stateIndex) => {
          parentNode.finding(stateIndex);

          // P(v | t)
          baselineNet.node(targetNode).finding(targetStateIndex);
          baselineNet.update();
          P_v_t = baselineNet.node(colliderNode).beliefs()[targetStateIndex];

          // P(v | ~t)
          baselineNet.node(targetNode).finding(1 - targetStateIndex);
          baselineNet.update();
          P_v_not_t = baselineNet.node(colliderNode).beliefs()[targetStateIndex];

          // P(v | t, e)
          evidenceNet.node(targetNode).finding(targetStateIndex);
          evidenceNet.update();
          P_v_t_e = evidenceNet.node(colliderNode).beliefs()[targetStateIndex];

          // P(v | ~t, e)
          evidenceNet.node(targetNode).finding(1 - targetStateIndex);
          evidenceNet.update();
          P_v_not_t_e = evidenceNet.node(colliderNode).beliefs()[targetStateIndex];
      });

      parentNode.retractFindings();
  });

  // Normalize and calculate Odds Ratio
  const oddsRatio = (P_v_not_t * P_v_t_e) / (P_v_t * P_v_not_t_e + 1e-9);

  return {
      oddsRatio,
      P_v_t,
      P_v_not_t,
      P_v_t_e,
      P_v_not_t_e
  };
}

function analyzeColliders(net, relationships, evidence, targetNode, targetStateIndex, bnKey) {
  const colliders = findColliders(net, relationships);
  const results = [];

  colliders.forEach(collider => {
      const baseDiff = calculateBaseDiff(
          net,
          collider.node,
          collider.parents,
          targetNode,
          evidence,
          targetStateIndex,
          bnKey
      );

      const powerDiff = calculatePowerDiff(
          net,
          collider.node,
          collider.parents,
          targetNode,
          evidence,
          targetStateIndex,
          bnKey
      );

      const { oddsRatio } = calculateOddsRatio(
          net,
          collider.node,
          collider.parents,
          targetNode,
          evidence,
          targetStateIndex,
          bnKey
      );

      results.push({ 
          colliderNode: collider.node, 
          baseDiff, 
          powerDiff, 
          oddsRatio 
      });
  });

  return results;
}

module.exports = {
  findAllColliders,
  analyzeColliders
}