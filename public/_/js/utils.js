var {Net} = require('../../../bni_smile');
document.addEventListener('DOMContentLoaded', event => {
	document.addEventListener('click', event => {
		if (event.target.matches('button[href]')) {
			event.preventDefault();
			window.location.href = event.target.getAttribute('href');
		}
	});
});

function addJointChild(net, parentNames, tempNodeName = null) {
	let stateList = [];
	let stateIndexes = parentNames.map(_=>0);
	do {
		stateList.push('s'+stateIndexes.join('_'));
	} while (Net.nextCombination(stateIndexes, parentNames.map(c => net.node(c))));
	/// XXX: Add support to bni_smile for deterministic nodes
	tempNodeName = tempNodeName || ('s'+String(Math.random()).slice(2));
	//console.log('IDENTITY',stateList.map((_,i)=>stateList.map((_,j)=> i==j ? 1 : 0)));
	net
		.addNode(tempNodeName, null, stateList)
		.addParents(parentNames)
		/// Essentially, create an identity matrix for now (later, replace with det node)
		.cpt(stateList.map((_,i)=>stateList.map((_,j)=> i==j ? 1 : 0)));
	return tempNodeName;
}


function marginalizeParentArc(child, parentToRemove, reduce = false) {
	function getRowIndex(parIndexes) {
		let rowIndex = 0;
		for (let i=0; i<parIndexes.length; i++) {
			if (i!=0)  rowIndex *= pars[i].states().length;
			rowIndex += parIndexes[i];
		}
		return rowIndex;
	}
	
	function addWeightedVec(vec1, vec2, weight) {
		return vec1.map((v,i) => v + vec2[i]*weight);
	}

	let net = child.net;
	
	/// The CPT (we'll modify in place)
	let cpt = child.cpt();
	
	let pars = child.parents();
	let toRemoveIndex = pars.findIndex(p => p.name() == parentToRemove.name());
	
	let marginals = parentToRemove.beliefs();
	
	let parIndexes = pars.map(_=>0);
	/// For each row, do weighted average (by the weight of parentToRemove's marginals --- note: order not verified)
	do {
		let row = child.states().map(_=>0);
		for (let i=0; i<marginals.length; i++) {
			parIndexes[toRemoveIndex] = i;
			let rowI = getRowIndex(parIndexes);
			//console.log(parIndexes, rowI);
			row = addWeightedVec(row, cpt[rowI], marginals[i]);
		}
		let marginalizedRow = row;
		
		/// Replace all the matching rows with the weighted combination
		for (let i=0; i<marginals.length; i++) {
			parIndexes[toRemoveIndex] = i;
			let rowI = getRowIndex(parIndexes);
			cpt[rowI] = marginalizedRow;
		}
	} while (Net.nextCombination(parIndexes, pars, [toRemoveIndex]));
	
	if (reduce) {
		/// Resize the CPT (i.e. remove the redundant rows)
		let parIndexes = pars.map(_=>0);
		let newCpt = [];
		do {
			newCpt.push(cpt[getRowIndex(parIndexes)]);
		} while (Net.nextCombination(parIndexes, pars, [toRemoveIndex]));
		
		return newCpt;
	}
	else {
		/// Full-size CPT (with redundant rows). This will behave exactly as if the parent's been deleted,
		/// without actually removing the link. (Potentially a bit faster than changing the BN structure/recompiling.)
		return cpt;
	}
}

function pick(obj, keys) {
	let newObj = {};
	for (let key of keys) {
		if (key in obj) {
			newObj[key] = obj[key];
		}
	}
	return newObj;
}

function getQs(searchStr) {
	searchStr = searchStr || window.location.search;
	var params = {};
	if (searchStr) {
		var argSpecs = searchStr.substring(1).split('&');
		for (var i in argSpecs) {
			if (argSpecs[i]) {
				var argInfo = argSpecs[i].split('=');
				params[unescape(argInfo[0])] = unescape(argInfo[1].replace(/\+/g, ' '));
			}
		}
	}
	return params;
}

function getColor(changerate) {
  if (changerate <= -0.3) 
    return "influence-idx6";
  else if (-0.3 < changerate && changerate <= -0.15)
    return "influence-idx5";
  else if (-0.15 < changerate  && changerate < 0)
    return "influence-idx4";
  else if (changerate == 0)
    return "influence-idx3";
  else if (0 < changerate && changerate <= 0.15)
    return "influence-idx2";
  else if (0.15 < changerate && changerate <= 0.3)
    return "influence-idx1";
  else if (0.3 < changerate)
    return "influence-idx0";
}

function getTargetStateColor(baseBelief, currentBelief) {
  let diff = currentBelief - baseBelief;
  let color = getColor(diff);
  return color
}
// ---------------------------------------

// Verbal		
// Build the undirectedGraph
function buildUndirectedGraph(relationships) {
  const graph = {};
  relationships.forEach(rel => {
    if (!graph[rel.from]) {
      graph[rel.from] = [];
    }
    if (!graph[rel.to]) {
      graph[rel.to] = [];
    }
    graph[rel.from].push(rel.to);
    graph[rel.to].push(rel.from); 
  });
  console.log('graph:', graph)
  return graph;
}


function findAllPaths(graph, startNode, endNode) {
  const allPaths = [];

  function dfs(currentNode, endNode, path, visited) {

    visited.add(currentNode);
    path.push(currentNode);

    if (currentNode === endNode) {
      allPaths.push([...path]);
    } else if (graph[currentNode]) {
      for (const neighbor of graph[currentNode]) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, endNode, path, visited);
        }
      }
    }

    path.pop();
    visited.delete(currentNode);
  }

  dfs(startNode, endNode, [], new Set());
  // console.log('allPaths:', allPaths)						

  return allPaths;
}



function isActivePath(path, relationships, evidence) {
  // Helper function to check if a node is a collider
  function isCollider(node, prevNode, nextNode) {
    const incomingToNode = relationships.filter(rel => rel.to === node);
    return incomingToNode.some(rel => rel.from === prevNode) && incomingToNode.some(rel => rel.from === nextNode);
  }

  // Helper function to get all descendants of a node
  function getDescendants(node) {
    const descendants = [];
    const stack = [node];

    while (stack.length > 0) {
      const current = stack.pop();
      const children = relationships.filter(rel => rel.from === current).map(rel => rel.to);

      for (const child of children) {
        if (!descendants.includes(child)) {
          descendants.push(child);
          stack.push(child);
        }
      }
    }

    return descendants;
  }

  // Helper function to check if a node has a descendant in the evidence
  function hasDescendantInEvidence(node) {
    const descendants = getDescendants(node);
    return descendants.some(descendant => evidence.hasOwnProperty(descendant));
  }

  // Check the path step by step, excluding the start and end nodes
  for (let i = 1; i < path.length - 1; i++) {
    const current = path[i];
    const prevNode = path[i - 1];
    const nextNode = path[i + 1];

    if (isCollider(current, prevNode, nextNode)) {
      // If the current node is a collider, it must be in the evidence or have a descendant in the evidence
      if (!evidence.hasOwnProperty(current) && !hasDescendantInEvidence(current)) {
        return false;
      }
    } else {
      // If the current node is not a collider, it must not be in the evidence
      if (evidence.hasOwnProperty(current)) {
        return false;
      }
    }
  }

  return true;
}

function filterActivePaths(allPaths, relationships, evidence) {
  return allPaths.filter(path => isActivePath(path, relationships, evidence));
}

function classifyPaths(relationships, activePaths, focusNode, targetNode, evidenceList) {
  // function buildGraph(relationships) {
  //     const graph = {};
  //     relationships.forEach(({ from, to }) => {
  //         if (!graph[from]) graph[from] = [];
  //         graph[from].push(to);
  //     });
  //     return graph;
  // }

  // function isBlockedPath(path, evidenceList, targetNode) {
  //     for (let i = 0; i < path.length - 1; i++) {
  //         const currentNode = path[i];
  //         const nextNode = path[i + 1];

  //         // If the current node is evidence but not the target node or its child, it blocks
  //         if (
  //             evidenceList.includes(currentNode) &&
  //             currentNode !== targetNode &&
  //             !evidenceList.includes(nextNode)
  //         ) {
  //             return true;
  //         }
  //     }
  //     return false;
  // }

  // function isFirstOrderPath(path, focusNode, targetNode) {
  //     return path[0] === focusNode && path[path.length - 1] === targetNode;
  // }

  // function isSecondOrderPath(path, focusNode, targetNode, evidenceList) {
  //     return (
  //         path.includes(targetNode) &&
  //         path[0] !== focusNode &&
  //         !isBlockedPath(path, evidenceList, targetNode)
  //     );
  // }

  // const graph = buildGraph(relationships);
  // const firstOrderPaths = [];
  // const secondOrderPaths = [];

  // activePaths.forEach((path) => {
  //     if (isFirstOrderPath(path, focusNode, targetNode)) {
  //         firstOrderPaths.push(path);
  //     } else if (isSecondOrderPath(path, focusNode, targetNode, evidenceList)) {
  //         secondOrderPaths.push(path);
  //     }
  // });

  return {
      firstOrder: firstOrderPaths,
      secondOrder: secondOrderPaths,
  };
}

module.exports = {
  addJointChild,
  marginalizeParentArc,
  getColor,
  isActivePath,
  buildUndirectedGraph,
  findAllPaths,
  filterActivePaths,
  classifyPaths
};