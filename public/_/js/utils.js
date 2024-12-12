document.addEventListener('DOMContentLoaded', event => {
	document.addEventListener('click', event => {
		if (event.target.matches('button[href]')) {
			event.preventDefault();
			window.location.href = event.target.getAttribute('href');
		}
	});
});

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

function reset(arcInfluence, bn, bnView) {
  if (arcInfluence) {
    arcInfluence.forEach((arcEntry) => {
      let arc = document.querySelector(
        `[data-child=${arcEntry.child}][data-parent=${arcEntry.parent}]`
      );
      if (arc) {
        arc.remove();
        bn.drawArcs();
      }
    });
    bnView.querySelectorAll(`div.node`).forEach(node => {						
      node.style.opacity = 1
    });
  }
}

function sortArcInfluenceByDiff(arcInfluence, nodeBeliefs, getColor) {
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
      
      return { ...arcEntry, maxDiff, color };      
    })
    .sort((a, b) => b.maxDiff - a.maxDiff) // Sort by maxDiff in descending order
    .map(({ maxDiff, color, ...arcEntry }) => ({...arcEntry, color})); // Remove the maxDiff property
}
// ---------------------------------------

// Verbal
function mapInfluencePercentageToScale(influencePercentage) {
  const absPercentage = Math.abs(influencePercentage);
  let scale = 0;

  if (absPercentage >= 0 && absPercentage <= 0.01) {
    scale = 0;
  } else if (absPercentage > 0.01 && absPercentage <= 0.15) {
    scale = 1;
  } else if (absPercentage > 0.15 && absPercentage <= 0.3) {
    scale = 2;
  } else if (absPercentage > 0.3) {
    scale = 3;
  }

  // Adjust sign based on influence percentage
  if (influencePercentage < 0) {
    scale = -scale;
  }

  return scale;
}

// Define calculateInfluenceBetweenNodes function
function calculateInfluenceBetweenNodes(parentNodeName, childNodeName) {
  // Create a new network instance to avoid altering the main network
  let tempNet = new Net(bnKey);

  // Get nodes
  let parentNode = tempNet.node(parentNodeName);
  let childNode = tempNet.node(childNodeName);

  // Update the network without any findings to get baseline beliefs
  tempNet.update();
  let baselineBelief = childNode.beliefs();

  // Initialize variables to track maximum influence
  let maxInfluence = 0;

  // Iterate over all states of the parent node
  let parentStates = parentNode.states();
  for (let parentStateIndex = 0; parentStateIndex < parentStates.length; parentStateIndex++) {
    // Set parent node to a specific state
    parentNode.finding(parentStateIndex);
    tempNet.update();
    let beliefGivenParentState = childNode.beliefs();

    // Calculate the difference in the child's beliefs
    for (let childStateIndex = 0; childStateIndex < childNode.states().length; childStateIndex++) {
      let baselineProb = baselineBelief[childStateIndex];
      let newProb = beliefGivenParentState[childStateIndex];
      let diff = Math.abs(newProb - baselineProb);

      if (diff > maxInfluence) {
        maxInfluence = diff;
      }
    }

    // Reset the parent node's finding
    parentNode.retractFindings();
  }

  // Return the maximum observed influence (a value between 0 and 1)
  return maxInfluence;
}

function calculateIndirectInfluence(nonActiveNodeName, targetNodeName) {
  // Create a new network instance to avoid altering the main network
  let tempNet = new Net(bnKey);
  tempNet.compile();

  // Ensure the network is initialized correctly
  if (!tempNet || typeof tempNet.node !== 'function') {
    console.error("Network instance not initialized correctly.");
    return 0;
  }

  // Get the parent and target nodes
  let nonActiveNode = tempNet.node(nonActiveNodeName);
  if (!nonActiveNode) {
    console.error(`Node ${nonActiveNodeName} not found in the network.`);
    return 0;
  }

  let targetNode = tempNet.node(targetNodeName);
  if (!targetNode) {
    console.error(`Target node ${targetNodeName} not found in the network.`);
    return 0;
  }

  // Get the state index for the parent node
  let nonActiveNodeStateIndex = evidence[nonActiveNodeName];
  if (nonActiveNodeStateIndex === null || nonActiveNodeStateIndex === undefined) {
    console.error(`State index for node ${nonActiveNodeName} is undefined.`);
    return 0;
  }

  // Get the state index for the target node
  let targetStateIndexArray = selectedStates[targetNodeName];
  if (!targetStateIndexArray || !Array.isArray(targetStateIndexArray) || targetStateIndexArray.length === 0) {
    console.error(`No selected states for target node ${targetNodeName}`);
    return 0;
  }
  let targetStateIndex = targetStateIndexArray[0];

  // Set evidence for all nodes except the nonActiveNodeName
  for (let [nodeName, stateI] of Object.entries(evidence)) {
    if (nodeName != nonActiveNodeName) {
      tempNet.node(nodeName).finding(Number(stateI));
    }
  }

  // Update the network to get the baseline belief
  tempNet.update();
  let baselineBelief = targetNode.beliefs()[targetStateIndex];

  // Set the nonActiveNode to the specific state
  try {
    nonActiveNode.finding(Number(nonActiveNodeStateIndex));
  } catch (error) {
    console.error(`Error setting finding for node ${nonActiveNodeName}:`, error);
    return 0;
  }

  tempNet.update();

  // Get the target node's belief after setting the nonActiveNode's state
  let beliefGivenParentState = targetNode.beliefs()[targetStateIndex];

  // Calculate the influence percentage
  let influencePercentage = (beliefGivenParentState - baselineBelief) / baselineBelief;

  // Return the influence percentage
  return influencePercentage; 
}
  

function calculatePathContribution(path) {
  let totalInfluence = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const fromNode = path[i];
    const toNode = path[i + 1];
    const influence = calculateIndirectInfluence(fromNode, toNode);

    totalInfluence += influence;
  }
  console.log(`totalInfluence for path ${path.join(' -> ')}:`, totalInfluence);

  // Map the total influence to the scale
  let scale = mapInfluencePercentageToScale(totalInfluence);

  return scale;
}


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

  return allPaths;
}


function getAttribute(nodeName) {
  let node = net.node(nodeName);
  let state = node.states();
  let stateNames = node._stateNames;
  let NodeAttribute = ""
  if(evidence[nodeName] != null){
  NodeAttribute = stateNames[evidence[nodeName]];
  }
  else{
    NodeAttribute = stateNames[0]
  }
  console.log(stateNames)
  return NodeAttribute

}

function filterPathsByDirectConnection(allPaths) {
  let pathGroups = {};
  for (let path of allPaths) {
    if (path.length < 2) {
      continue;
    }
    let fromNode = path[0];
    let toNode = path[path.length - 1];
    let key = `${fromNode}|${toNode}`;
    if (!pathGroups[key]) {
      pathGroups[key] = [];
    }
    pathGroups[key].push(path);
  }

  let filteredPaths = [];

  // Find the shortest path for each group
  for (let key in pathGroups) {
    let paths = pathGroups[key];
    
    paths.sort((a, b) => a.length - b.length);
    filteredPaths.push(paths[0]);
  }

  return filteredPaths;
}
