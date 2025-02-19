var {n} = require('htm');
var {Net} = require('../../../bni_smile');

// Converts color codes to verbal descriptions indicating the effect magnitude (e.g., increases, reduces).
function colorToVerbal(color, pastTense = false) {
  const effects = {
    "influence-idx6": ["greatly reduces", "greatly reduced"],
    "influence-idx5": ["moderately reduces", "moderately reduced"],
    "influence-idx4": ["slightly reduces", "slightly reduced"],
    "influence-idx3": ["doesn't change", "did not change"],
    "influence-idx2": ["slightly increases", "slightly increased"],
    "influence-idx1": ["moderately increases", "moderately increased"],
    "influence-idx0": ["greatly increases", "greatly increased"]
  };

  return pastTense ? effects[color][1] : effects[color][0];
}

function getNodeState(nodeName, globalTargetNodeName, globalTargetNodeState, m, bnView) {
  if (nodeName === globalTargetNodeName) {
      return globalTargetNodeState;
  }

  let node = bnView.querySelector(`div.node[data-name=${nodeName}]`);
  if (!node) return "Unknown";

  if (node.classList.contains('hasEvidence')) {
      let selectedStateIndex = m.nodeBeliefs[nodeName]
          ? m.nodeBeliefs[nodeName].indexOf(1)  // Find explicitly selected state
          : -1;
      let selectedStateElem = node?.querySelector(`.state[data-index="${selectedStateIndex}"] .label`);
      
      return selectedStateElem ? selectedStateElem.textContent.trim() : "Unknown";
  }

  let currentBelief = m.nodeBeliefs[nodeName];
  let origBeliefs = m.origModel.find(entry => entry.name == nodeName)?.beliefs;

  if (!currentBelief || !origBeliefs) return "Unknown";

  for (let idx = 0; idx < currentBelief.length; idx++) {
      let diff = currentBelief[idx] - origBeliefs[idx];
      let absDiff = diff * 100;

      if (absDiff > 0) {
          let stateElem = node.querySelector(`.state[data-index="${idx}"]`);
          return stateElem?.querySelector('.label')?.textContent.trim() || "Unknown";
      }
  }

  return "Unknown";
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
          n('span', targetNodeName, { class: 'verbalTextBold' }),
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

  if (connectionsCount > 1) {
    const introPara = n(
      'p',
      'Finding out ',
      n('span', targetName, { class: 'verbalTextBold' }),
      ' ',
      n('span', evidenceTense, { class: 'verbalTextItalic' }),
      ' ',
      n('span', targetState, { class: 'verbalTextItalic' }),
      ' contributes due to ',
      n('span', numberToWord(connectionsCount), { class: 'verbalTextBold' }),
      ' connection',
      (connectionsCount > 1 ? 's' : ''),
      ':'
    );
    verbalListDisplay.appendChild(introPara);
  }

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
        const bulletLine = n(
          'p',
          '• By direct connection, it ',
          n('span', colorToVerbal(arc.color), { class: 'verbalTextUnderline' }),
          ' the probability of ',
          n('span', nodeB, { class: 'verbalTextBold' }),
          '.'
        );
        verbalListDisplay.appendChild(bulletLine);
      } else {
        verbalListDisplay.appendChild(
          n(
            'p',
            '• By direct connection, it doesn\'t change the probability of ',
            n('span', nodeB, { class: 'verbalTextBold' }),
            '.'
          )
        );
      }
    } 
    else {
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
            chainEffects.push(
              n(
                'span',
                'It ',
                n('span', colorToVerbalShorten(arc.color), { class: 'verbalTextUnderline' }),
                ' the probability that ',
                n('span', toNode, { class: 'verbalTextBold' }),
                ' was ',
                n('span', arc.fromState, { class: 'verbalTextItalic' })
              )
            );
          } else {
            chainEffects.push(
              n(
                'span',
                n('span', colorToVerbal(arc.color), { class: 'verbalTextUnderline' }),
                ' the probability of ',
                n('span', toNode, { class: 'verbalTextBold' })
              )
            );
          }
        } else {
          if (i === 0) {
            chainEffects.push(
              n(
                'span',
                'It doesn\'t change the probability that ',
                n('span', toNode, { class: 'verbalTextBold' }),
                ' was ???'
              )
            );
          } else {
            chainEffects.push(
              n(
                'span',
                'it doesn\'t change the probability of ',
                n('span', toNode, { class: 'verbalTextBold' })
              )
            );
          }
        }
      }

      const chainContainer = n('span');
      chainEffects.forEach((effect, idx) => {
        chainContainer.appendChild(effect);
        if (idx < chainEffects.length - 1) {
          chainContainer.appendChild(n('span', ', which in turn '));
        }
      });

      verbalListDisplay.appendChild(
        n('p', '• ', chainContainer, '.')
      );
    }
  });

  if (connectionsCount > 1) {
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
}

// Creates combined explanations for contributions in collider scenarios, identifying patterns like 
// "explaining away" and "empowering way".
function buildDetailCombinedExplanation(arcsContribution, verbalListDisplay, focusEvidence) {
  verbalListDisplay.innerHTML = '';

  // Basic check
  if (!arcsContribution || arcsContribution.length === 0) {
    verbalListDisplay.appendChild(n('p', '(No arcs to explain.)'));
    return;
  }

  // Determine effect type: "explaining away" or "empowering"
  // let effectType = 'explaining away';
  // let baseDiff = 0, powerDiff = 0;
  // if (colliderDiffs.length > 0) {
  //   const c = colliderDiffs[0];
  //   baseDiff = c.baseDiff;
  //   powerDiff = c.powerDiff;
  //   if (powerDiff > baseDiff) {
  //     effectType = 'empowering';
  //   }
  // }

  const arc0 = arcsContribution[0];
  const arc1 = arcsContribution[1];
  const colliderNode = arc0.to;  // Node receiving two arrows (collider)
  const parent1 = arc0.from;
  const parent2 = arc1.from;

  focusEvidenceName = focusEvidence.getAttribute('data-name')

  // **Check if the clicked node is the collider or an evidence node**
  if (focusEvidenceName === colliderNode) {
    console.log("Collider node selected – Printing Image 1 format");

    // **Image 1 Format (Collider Node Selected)**
    const introParagraph = n('p',
      n('span', arc0.toState.charAt(0).toUpperCase() + arc0.toState.slice(1), { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), " ",
      "can be caused by the ",
      n('span', parent1, { class: 'verbalTextBold' }), " being ",
      n('span', arc0.fromState, { class: 'verbalTextItalic' }), " or ",
      n('span', parent2, { class: 'verbalTextBold' }), " being ",
      n('span', arc1.fromState, { class: 'verbalTextItalic' }), "."
    );
    verbalListDisplay.appendChild(introParagraph);

    const step1 = n('p',
      n('span', '1.', { style: 'fontWeight:bold' }), ' ',
      `If we didn’t know about `,
      n('span', parent1, { class: 'verbalTextBold' }),
      `, finding out `,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), ' ',
      `would greatly increase the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }),
      '.'
    );
    verbalListDisplay.appendChild(step1);

    const step2 = n('p',
      n('span', '2a.', { style: 'fontWeight:bold' }), ' ',
      `But we do already know `,
      n('span', parent1, { class: 'verbalTextBold' }), ' was ',
      n('span', arc0.fromState, { class: 'verbalTextItalic' }), ", ",
      `which has ${colorToVerbal(arc1.color, true)} the probability that `,
      n('span', arc0.toState.charAt(0).toUpperCase() + arc0.toState.slice(1), { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), ' will occur without ',
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step2);

    const step3 = n('p',
      n('span', '2b.', { style: 'fontWeight:bold' }), ' ',
      `So, finding out `,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      `now only ${colorToVerbal(arc1.color)} the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step3);

  } else {
    console.log("Evidence node selected – Printing Image 2 format");

    // **Image 2 Format (Evidence Node Selected)**
    const introParagraph = n('p',
      n('span', arc0.toState.charAt(0).toUpperCase() + arc0.toState.slice(1), { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), " ",
      "can be caused by the ",
      n('span', parent1, { class: 'verbalTextBold' }), " being ",
      n('span', arc0.fromState, { class: 'verbalTextItalic' }), " or ",
      n('span', parent2, { class: 'verbalTextBold' }), " being ",
      n('span', arc1.fromState, { class: 'verbalTextItalic' }), "."
    );
    verbalListDisplay.appendChild(introParagraph);

    const step1 = n('p',
      n('span', '1.', { style: 'fontWeight:bold' }), ' ',
      `If we didn’t know about `,
      n('span', colliderNode, { class: 'verbalTextBold' }),
      `, finding out the `,
      n('span', focusEvidenceName, { class: 'verbalTextBold' }), ' was ',
      n('span', focusEvidenceName === parent1 ? arc0.fromState : arc1.fromState, { class: 'verbalTextItalic' }), ' ',
      `wouldn't change the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }),
      '.'
    );
    verbalListDisplay.appendChild(step1);

    const step2 = n('p',
      n('span', '2a.', { style: 'fontWeight:bold' }), ' ',
      `But we do already know `,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), ", ",
      `which has greatly increased the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step2);

    const step3 = n('p',
      n('span', '2b.', { style: 'fontWeight:bold' }), ' ',
      `Now finding out `,
      n('span', focusEvidenceName, { class: 'verbalTextBold' }), ' was ',
      n('span', focusEvidenceName === parent1 ? arc0.fromState : arc1.fromState, { class: 'verbalTextItalic' }), " ",
      `increases the probability that `,
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), " occurred without ",
      n('span', parent2, { class: 'verbalTextBold' }), ` — so knowing `,
      n('span', colliderNode, { class: 'verbalTextBold' }), " is ",
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      `now only ${colorToVerbal(arc1.color)} the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step3);

    // **Adding the "Overall" Sentence at the End**
    const finalOverall = n('p',
      'Overall, finding out the ',
      n('span', arc0.from, { class: 'verbalTextBold' }),' was ',
      n('span', arc0.fromState, { class: 'verbalTextItalic' }),'  ',
      `${colorToVerbal(arc0.color)} the probability of `,
      n('span', arc1.from, { class: 'verbalTextBold' }),' , ',
      `by making the ${colorToVerbalShorten(arc1.color).replace(/s$/, '')} from `,
      n('span', arc0.toState, { class: 'verbalTextItalic' }),'  ',
      n('span', arc0.to, { class: 'verbalTextBold' }),
      ' smaller .'
    );
    verbalListDisplay.appendChild(finalOverall);
  }
}

function buildDetailCombinedSpecial(arcsContribution, verbalListDisplay, arcInfluence, focusEvidence) {
  verbalListDisplay.innerHTML = '';

  // Basic check
  if (!arcsContribution || arcsContribution.length === 0) {
    verbalListDisplay.appendChild(n('p', '(No arcs to explain.)'));
    return;
  }

  const arc0 = arcsContribution[0];
  const arc1 = arcsContribution[1];
  const colliderNode = arc0.to;  // Node receiving two arrows (collider)
  const parent1 = arc0.from;
  const parent2 = arc1.from;

  focusEvidenceName = focusEvidence.getAttribute('data-name')

  // **Check if the clicked node is the collider or an evidence node**
  if (focusEvidenceName === colliderNode) {

    const step1 = n('p',
      n('span', '1.', { style: 'fontWeight:bold' }), ' ',
      `If we didn’t know about the`,
      n('span', parent1, { class: 'verbalTextBold' }),
      `, then finding out the`,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), ' ',
      `would greatly increase the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }),
      n('span', arc1.fromState, { class: 'verbalTextItalic' }),
      `, by direct connection.`
    );
    verbalListDisplay.appendChild(step1);

    const step2 = n('p',
      n('span', '2a.', { style: 'fontWeight:bold' }), ' ',
      `But knowing the `,
      n('span', parent1, { class: 'verbalTextBold' }), ' was ',
      n('span', arc0.fromState, { class: 'verbalTextItalic' }), ", ",
      `which has ${colorToVerbal(arc1.color, true)} the probability that `,
      n('span', arc0.toState.charAt(0).toUpperCase() + arc0.toState.slice(1), { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), ' will occur without ',
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step2);

    const step3 = n('p',
      n('span', '2b.', { style: 'fontWeight:bold' }), ' ',
      `So, finding out `,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      `now only ${colorToVerbal(arc1.color)} the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step3);

  } else {

    const step1 = n('p',
      n('span', '1.', { style: 'fontWeight:bold' }), ' ',
      `If we didn’t know about `,
      n('span', colliderNode, { class: 'verbalTextBold' }),
      `, finding out the `,
      n('span', focusEvidenceName, { class: 'verbalTextBold' }), ' was ',
      n('span', focusEvidenceName === parent1 ? arc0.fromState : arc1.fromState, { class: 'verbalTextItalic' }), ' ',
      `wouldn't change the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }),
      '.'
    );
    verbalListDisplay.appendChild(step1);

    const step2 = n('p',
      n('span', '2a.', { style: 'fontWeight:bold' }), ' ',
      `But we do already know `,
      n('span', colliderNode, { class: 'verbalTextBold' }), ' is ',
      n('span', arc0.toState, { class: 'verbalTextItalic' }), ", ",
      `which has greatly increased the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step2);

    const step3 = n('p',
      n('span', '2b.', { style: 'fontWeight:bold' }), ' ',
      `Now finding out `,
      n('span', focusEvidenceName, { class: 'verbalTextBold' }), ' was ',
      n('span', focusEvidenceName === parent1 ? arc0.fromState : arc1.fromState, { class: 'verbalTextItalic' }), " ",
      `increases the probability that `,
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      n('span', colliderNode, { class: 'verbalTextBold' }), " occurred without ",
      n('span', parent2, { class: 'verbalTextBold' }), ` — so knowing `,
      n('span', colliderNode, { class: 'verbalTextBold' }), " is ",
      n('span', arc0.toState, { class: 'verbalTextItalic' }), " ",
      `now only ${colorToVerbal(arc1.color)} the probability of `,
      n('span', parent2, { class: 'verbalTextBold' }), '.'
    );
    verbalListDisplay.appendChild(step3);
  }
}


// Generates both normal and collider-specific detailed explanations based on active paths.
function generateDetailedExplanations(activePaths, arcsContribution, colliderNodes, verbalListDisplay, arcInfluence, focusEvidence) {
  verbalListDisplay.innerHTML = '';
  // **Sort Paths into Collider and Normal Paths**
  const colliderPaths = [];
  const normalPaths = [];
  const specialPaths = [];
  activePaths.forEach((path) => {
    let foundSuperPath = false;

    for (const other of activePaths) {
      if (other !== path && other.length > path.length) {
        if (isSubpath(path, other)) {
          foundSuperPath = true;
          break;
        }
      }
    }

    if (foundSuperPath) {
      console.log('Detected special subpaths:', specialPaths);
      specialPaths.push(path);
    } else if (pathHasCollider(path, colliderNodes)) {
      console.log('Detected Collider paths:', colliderPaths);
      colliderPaths.push(path);
    } else {
      console.log("Multiple Paths Detected - Using Standard Processing");
      normalPaths.push(path);
    }
  });

  

  // **Check for Collider Paths First**
  if (colliderPaths.length > 0) {
    buildDetailCombinedExplanation(arcsContribution, verbalListDisplay, focusEvidence);
    return; // **Exit after printing collider explanation**
  }

  if (specialPaths.length > 0) {
    buildDetailCombinedSpecial(arcsContribution, verbalListDisplay, arcInfluence, focusEvidence)
    return;
  }

  // **If No Collider Paths Exist, Proceed with Normal Processing**
  const directPaths = normalPaths.filter(path => path.length === 2);
  const indirectPaths = normalPaths.filter(path => path.length > 2);

  // **Ensure Single Direct Path Only in Detail Mode**
  if (directPaths.length === 1 && indirectPaths.length === 0) {

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
          evidenceState, 
          colorContribute, targetNodeName, 
          targetState, 
          true, arcInfluence, activePaths
      );

      verbalListDisplay.appendChild(sentence);
      return;  // **Exit here to prevent further processing**
  }



  // **If Multiple Paths Exist, Use Default Processing**
  if (normalPaths.length > 0) {
    buildDetailSentenceList(normalPaths, arcsContribution, verbalListDisplay, arcInfluence);
  }
}

// Checks if a path contains any collider nodes based on the provided collider objects.
function pathHasCollider(path, colliderObjs) {
  const middleNodes = path.slice(1, -1);
  return middleNodes.some(node =>
    colliderObjs.some(colliderObj => colliderObj.node === node)
  );
}

function isSubpath(pathA, pathB) {
  if (pathA.length > pathB.length) return false;

  for (let start = 0; start <= pathB.length - pathA.length; start++) {
    let match = true;
    for (let i = 0; i < pathA.length; i++) {
      if (pathB[start + i] !== pathA[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true; 
    }
  }

  return false;
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