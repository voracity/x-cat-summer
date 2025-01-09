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
  console.log('allPaths:', allPaths)						

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

module.exports = {
  getColor,
  isActivePath,
  buildUndirectedGraph,
  findAllPaths,
  filterActivePaths
};