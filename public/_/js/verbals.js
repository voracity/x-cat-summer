var {n} = require('htm');
var {Net} = require('../../../bni_smile');

// Converts color codes to verbal descriptions indicating the effect magnitude (e.g., increases, reduces).
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

// Simplifies color descriptions into general categories like "increases" or "reduces".
function colorToVerbalShorten(color) {
  if (color == "influence-idx6" || color == "influence-idx5" || color == "influence-idx4")
    return "reduces";
  else if (color == "influence-idx3")
    return "doesn't change";
  else if (color == "influence-idx2" || color == "influence-idx1" || color == "influence-idx0")
    return "increases";
}

// Determines the direction of arrows between evidence and target
function inferTenseFromArcInfluence(arcInfluence, evidenceNodeName, targetNodeName) {
  let isParent = arcInfluence.some(arc => arc.parent === evidenceNodeName && arc.child === targetNodeName);

  // Target should always have tense "is"
  let targetTense = "is";

  // If evidence is "Mutation", it should always have tense "was"
  let evidenceTense = evidenceNodeName === "Mutation" ? "was" : (isParent ? "was" : "is");

  return { evidenceTense, targetTense };
}

function buildFindingOutSentence(numsFinding, evidenceNodeName, evidenceState, colorContribute, targetNodeName, targetState, 
  detail = false, arcInfluence, activePaths) 
  {
  let { evidenceTense, targetTense } = inferTenseFromArcInfluence(arcInfluence, evidenceNodeName, targetNodeName);

  // **Find Direct and Indirect Paths**
  const directPaths = activePaths.filter(path => path.length === 2);
  const indirectPaths = activePaths.filter(path => path.length > 2);

  // **Ensure Single Direct Path Only in Detail Mode**
  if (detail && directPaths.length === 1 && indirectPaths.length === 0) {
      console.log("Printing Direct Path Sentence in Detail Mode");

      return n('p',
          `Finding out `,
          n('span', evidenceNodeName, { class: 'verbalTextBold' }), ` ${evidenceTense} `,
          n('span', evidenceState, { class: 'verbalTextItalic' }), ' ',
          n('span', colorToVerbal(colorContribute), { class: 'verbalTextUnderline' }), 
          ` the probability of `,
          n('span', targetNodeName, { class: 'verbalTextBold' }), ` ${targetTense} `,
          n('span', targetState, { class: 'verbalTextItalic' }),
          `, by direct connection.`
      );
  }

  // **Existing Functionality for Multiple Paths or Summary Mode**
  return n('p', `${numsFinding > 1 ? '● ' : ''}Finding out `, 
      n('span', evidenceNodeName, { class: 'verbalTextBold' }), ` ${evidenceTense} `, 
      n('span', evidenceState, { class: 'verbalTextItalic' }), ' ', 
      n('span', colorToVerbal(colorContribute), { class: 'verbalTextUnderline' }), 
      ' the probability of ', 
      n('span', targetNodeName, { class: 'verbalTextBold' }), ` ${targetTense} `, 
      n('span', targetState, { class: 'verbalTextItalic' }),
      detail ? ', by direct connection.' : ' .'
  );
}


// Generates 2 dot points explanations of how active paths and arcs contribute to the target node's belief.
function buildDetailSentenceList(activePaths, arcsContribution, verbalListDisplay, arcInfluence) {
  verbalListDisplay.innerHTML = '';

  if (!activePaths || activePaths.length === 0) {
    verbalListDisplay.appendChild(n('p','(No paths)'));
    return;
  }

  if (!arcsContribution || arcsContribution.length === 0) {
    verbalListDisplay.appendChild(n('p','(No arcs)'));
    return;
  }

  const primaryArc = arcsContribution[0]; 
  const subjectName = primaryArc.from || 'UnknownSubject';      
  const subjectState = primaryArc.fromState || 'someState';    
  const targetName = primaryArc.to || 'UnknownTarget';   
  const targetState = primaryArc.toState || 'someState';       

  let { evidenceTense, targetTense } = inferTenseFromArcInfluence(arcInfluence, subjectName, targetName);

  const connectionsCount = activePaths.length;
  const introPara = n(
    'p',
    `Finding out ${targetName} ${evidenceTense} ${targetState} contributes due to `,
    n('span', numberToWord(connectionsCount), { class: 'verbalTextBold' }),
    ' connection',
    (connectionsCount > 1 ? 's' : ''), 
    ':'
  );
  verbalListDisplay.appendChild(introPara);

  const seenPaths = new Set();
  activePaths.forEach((path) => {
    const pathKey = path.join('->');
    if (seenPaths.has(pathKey)) return;
    seenPaths.add(pathKey);

    if (path.length === 2) {
      const [nodeA, nodeB] = path;
      const arc = arcsContribution.find(
        (a) =>
          (a.from === nodeA && a.to === nodeB) ||
          (a.from === nodeB && a.to === nodeA)
      );
      if (arc) {
        const bulletText = `By direct connection, it ${colorToVerbal(arc.color)} the probability of ${nodeB}.`;
        verbalListDisplay.appendChild(n('p', '• ' + bulletText));
      } else {
        verbalListDisplay.appendChild(
          n('p', `• By direct connection, it doesn't change the probability of ${nodeB}.`)
        );
      }
    } else {
      const chainEffects = [];
      for (let i = 0; i < path.length - 1; i++) {
        const fromNode = path[i];
        const toNode = path[i + 1];
        const arc = arcsContribution.find(
          (a) =>
            (a.from === fromNode && a.to === toNode) ||
            (a.from === toNode && a.to === fromNode)
        );
        if (arc) {
          if (i === 0) {
            chainEffects.push(`It ${colorToVerbalShorten(arc.color)} the probability of ${toNode} was ${arc.fromState}`);
          } else {
            chainEffects.push(`${colorToVerbal(arc.color)} the probability of ${toNode}`);
          }
        } else {
          if (i === 0) {
            chainEffects.push(`It ${colorToVerbalShorten(arc.color)} the probability of ${toNode} was ${arc.fromState}`);
          } else {
            chainEffects.push(`${colorToVerbal(arc.color)} the probability of ${toNode}`);
          }
        }
      }
      const chainSentence = chainEffects.join(', which in turn ');
      verbalListDisplay.appendChild(n('p', `• ${chainSentence}.`));
    }
  });

  const overallColor = primaryArc.color || 'does not change';
  const overallPara = n(
    'p',
    'Overall, the finding ',
    n('span', colorToVerbal(overallColor), { class: 'verbalTextUnderline' }),
    ' the probability of ',
    n('span', arcsContribution[0].to, { class: 'verbalTextBold' }),
    '.'
  );
  verbalListDisplay.appendChild(overallPara);
}


// Creates combined explanations for contributions in collider scenarios, identifying patterns like 
// "explaining away" and "empowering way".
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
    n('span', arc0.toState, {class:'verbalTextItalic'}), "       ",
    n('span', arc0.to, {class:'verbalTextBold'}), '  ',
    'can directly cause by the', '  ',
    n('span', arc0.from, {class:'verbalTextBold'}),' being ',
    n('span', arc0.fromState, {class:'verbalTextItalic'}), 
    ' or the ',
    n('span', arc1.from, {class:'verbalTextBold'}),' being ',
    n('span', arc1.fromState, {class:'verbalTextItalic'}), '.'
  );
  verbalListDisplay.appendChild(introParagraph);

  // Step 1
  const step1 = n('p',
    n('span','1.',{style:'fontWeight:bold'}),' ',
    `If we didn’t know about `,
    n('span', arc0.to,{class:'verbalTextBold'}),
    `, finding out the `,
    n('span', arc0.from,{class:'verbalTextBold'}),
    ' was ',
    n('span', arc0.fromState,{class:'verbalTextItalic'}),'    ',
    `wouldn't change the probability of  ` ,
    n('span', arc1.from,{class:'verbalTextBold'}),
    '.'
  );
  verbalListDisplay.appendChild(step1);

  // Step 2a
  const step2a = n('p',
    n('span','2a. ',{style:'fontWeight:bold'}),' ',
    `But we do already know `,
    n('span', arc0.to,{class:'verbalTextBold'}),
    ' is ',
    n('span', arc0.toState,{class:'verbalTextItalic'}),
    ` which has ${colorToVerbal(arc1.color)} the probability of  `,
    n('span', arc1.from,{class:'verbalTextBold'}),
    '.'
  );
  verbalListDisplay.appendChild(step2a);

  // Step 2b 
  let step2bText = '';
  if (effectType === 'explaining away') {
    step2bText = n(
      'span',
      `${colorToVerbalShorten(arc1.color)} the probability that `,
      n('span', arc1.toState, { class: 'verbalTextItalic' }),
      ' ',
      n('span', arc1.to, { class: 'verbalTextBold' }),
      ' occurred without ',
      n('span', arc1.from, { class: 'verbalTextBold' }),
      ' -- so knowing ',
      n('span', arc0.to, { class: 'verbalTextBold' }),
      ' is ',
      n('span', arc0.toState, { class: 'verbalTextBold' }),
      ` now only ${colorToVerbal(arc0.color)} the probability of `,
      n('span', arc1.from, { class: 'verbalTextBold' }),
      '.'
    );
  } else {
    step2bText = n(
      'span',
      `${colorToVerbalShorten(arc1.color)} the probability that `,
      n('span', arc1.toState, { class: 'verbalTextItalic' }),
      ' ',
      n('span', arc1.to, { class: 'verbalTextBold' }),
      ' occurred without ',
      n('span', arc1.from, { class: 'verbalTextBold' }),
      ' -- so knowing ',
      n('span', arc0.to, { class: 'verbalTextBold' }),
      ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }),
      ` now only ${colorToVerbal(arc1.color)} the probability of `,
      n('span', arc1.from, { class: 'verbalTextBold' }),
      '.'
    );
  }
  
  // Now, step2b is a single paragraph <p> containing an inline <span>
  const step2b = n(
    'p',
    n('span', '2b.', { style: 'fontWeight:bold' }),
    ' Now finding out the ',
    n('span', arc0.from, { class: 'verbalTextBold' }),
    ' was ',
    n('span', arc0.fromState, { class: 'verbalTextItalic' }),
    ' ',
    step2bText
  );
  
  verbalListDisplay.appendChild(step2b);

  // Final line
  const finalOverall = n('p',
    'Overall, finding out the ',
    n('span', arc0.from, { class: 'verbalTextBold' }),' was ',
    n('span', arc0.fromState, { class: 'verbalTextItalic' }),'  ',
    `${colorToVerbal(arc0.color)} the probability of `,
    n('span', arc1.from, { class: 'verbalTextBold' }),' , ',
    `by making the ${colorToVerbalShorten(arc1.color)} from `,
    n('span', arc0.toState, { class: 'verbalTextItalic' }),'  ',
    n('span', arc0.to, { class: 'verbalTextBold' }),
    '.'
  );
  verbalListDisplay.appendChild(finalOverall);
}

// Generates both normal and collider-specific detailed explanations based on active paths.
function generateDetailedExplanations(activePaths, arcsContribution, colliderNodes, verbalListDisplay, colliderDiffs, arcInfluence) {
  verbalListDisplay.innerHTML = '';

  // **Sort Paths into Collider and Normal Paths**
  const colliderPaths = [];
  const normalPaths = [];

  activePaths.forEach((path) => {
      if (pathHasCollider(path, colliderNodes)) {
          colliderPaths.push(path);
      } else {
          normalPaths.push(path);
      }
  });

  // **Check if Single Direct Path Exists**
  const directPaths = normalPaths.filter(path => path.length === 2);
  const indirectPaths = normalPaths.filter(path => path.length > 2);

  if (directPaths.length === 1 && indirectPaths.length === 0) {
      console.log(" Detected Single Direct Path - Printing Detail Sentence");
      
      const directPath = directPaths[0];
      const evidenceNodeName = directPath[0];
      const targetNodeName = directPath[1];

      const arc = arcsContribution.find(a => 
        (a.from === evidenceNodeName && a.to === targetNodeName) ||
        (a.to === evidenceNodeName && a.from === targetNodeName)
      );
      const colorContribute = arc ? arc.color : "influence-idx3";

      let evidenceState, targetState;
      if (arc.from === evidenceNodeName) {
          evidenceState = arc.fromState;
          targetState = arc.toState;
      } else {
          evidenceState = arc.toState;
          targetState = arc.fromState;
      }

      const sentence = buildFindingOutSentence(
          1, evidenceNodeName, 
          evidenceState, // Replace this with actual state if available
          colorContribute, targetNodeName, 
          targetState, // Replace this with actual state if available
          true, arcInfluence, activePaths
      );

      verbalListDisplay.appendChild(sentence);
      return;  // **Exit here to prevent further processing**
  }

  // **If Multiple Paths Exist, Use Default Processing**
  if (normalPaths.length > 0) {
      console.log("Multiple Paths Detected - Using Standard Processing");
      buildDetailSentenceList(normalPaths, arcsContribution, verbalListDisplay, arcInfluence);
  }

  if (colliderPaths.length > 0) {
      console.log("Collider Paths Detected - Using Collider Processing");
      buildDetailCombinedExplanation(arcsContribution, verbalListDisplay, colliderDiffs, arcInfluence);
  }
}

// Checks if a path contains any collider nodes based on the provided collider objects.
function pathHasCollider(path, colliderObjs) {
  const middleNodes = path.slice(1, -1);
  return middleNodes.some(node =>
    colliderObjs.some(colliderObj => colliderObj.node === node)
  );
}

// Identifies collider nodes in the network by analyzing relationships among parents.
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
 
// Builds a summary sentence for the combined effect of multiple findings on a target node.
function buildSummarySentence(numsFinding, evidenceNodeName, colorContribute, targetNodeName, targetState, arcInfluence) {
  let { targetTense } = inferTenseFromArcInfluence(arcInfluence, evidenceNodeName, targetNodeName);
  let findings = numsFinding == 2 ? 'Both' : 'All';
  return n('p', 
    n('span', `${findings} findings`, {class: 'verbalTextBold'}),
    ' combined ',
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderline'}),
    ' the probability that ',
    n('span', targetNodeName, {class: 'verbalTextBold'}),
    ` ${targetTense} `,
    n('span', targetState, {class: 'verbalTextItalic'}),
    '.',
    n('br'),
    n('br'),
    'The ',
    n('span', 'contribution', {style: 'text-decoration: underline;'}),
    ' of each finding is:',
   )
}

// Converts numerical values to their corresponding word representations.
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

// Identifies collider nodes in the network relationships (alternative method).
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

// Calculates the baseline difference in probability for collider nodes without additional evidence.
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

// Calculates the cumulative difference in probability for collider nodes under specific evidence conditions.
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

// Computes the odds ratio for collider nodes given evidence and target states.
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

// Analyzes colliders to calculate differences in probability, power, and odds ratios under varying evidence scenarios.
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
  analyzeColliders,
  inferTenseFromArcInfluence
}