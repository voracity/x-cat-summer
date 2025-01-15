const e = require("express");

class NodePath {
  constructor(nodeName, pathType) {
    this.nodeName = nodeName;
    this.pathType = pathType;
  }
}

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
  console.log('buildUndirectedGraph:', graph)
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

function buildParentMap(relationships) {
  const parentMap = {};
  relationships.forEach(({ from, to }) => {
    if (!parentMap[to]) {
      parentMap[to] = [];
    }
    parentMap[to].push(from);
  });
  return parentMap;
}

function buildAdjacencyMap(relationships) {
  const adjacencyMap = {};
  relationships.forEach(({ from, to }) => {
    if (!adjacencyMap[from]) {
      adjacencyMap[from] = [];
    }
    adjacencyMap[from].push(to);
  });
  return adjacencyMap;
}

function isCollider(node, prevNode, nextNode, parentMap) {
  if (!parentMap[node]) return false;
  const parents = parentMap[node];
  return parents.includes(prevNode) && parents.includes(nextNode);
}

function getDescendants(node, adjacencyMap) {
  const visited = new Set();
  const descendants = new Set();
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!adjacencyMap[current]) continue;

    for (const child of adjacencyMap[current]) {
      if (!visited.has(child)) {
        visited.add(child);
        descendants.add(child);
        stack.push(child);
      }
    }
  }
  return descendants;
}

function hasDescendantInEvidence(node, adjacencyMap, evidence) {
  const ds = getDescendants(node, adjacencyMap);
  for (const d of ds) {
    if (Object.prototype.hasOwnProperty.call(evidence, d)) {
      return true;
    }
  }
  return false;
}

function isActivePath(path, relationships, evidence) {
  // Build helper maps. If you call isActivePath repeatedly,
  const parentMap = buildParentMap(relationships);
  const adjacencyMap = buildAdjacencyMap(relationships);

  // Iterate over the "middle" nodes in the path
  for (let i = 1; i < path.length - 1; i++) {
    const node = path[i];
    const prevNode = path[i - 1];
    const nextNode = path[i + 1];

    if (isCollider(node, prevNode, nextNode, parentMap)) {
      // A collider requires: node ∈ evidence OR at least one descendant in evidence
      const isNodeInEvidence = Object.prototype.hasOwnProperty.call(evidence, node);
      if (!isNodeInEvidence) {
        // Then check the descendants
        if (!hasDescendantInEvidence(node, adjacencyMap, evidence)) {
          return false; 
        }
      }
    } else {
      // If it's not a collider, 'node' must NOT be in evidence
      if (Object.prototype.hasOwnProperty.call(evidence, node)) {
        return false;
      }
    }
  }

  return true;
}

function filterActivePaths(allPaths, relationships, evidence) {
  return allPaths.filter(path => isActivePath(path, relationships, evidence));
}

function activePathWithRelationships(paths, relationships) {
  let result = [];
  let len = paths.length;
  for (let i = 0; i < len; i++) {
    let rel = null;
    console.log('!!!!!paths[i]:', paths[i]);
    for (let j = 0; j < relationships.length; j++) {
      let r = relationships[j];
      if (i + 1 === len) {
        rel = 'target';
        break;
      }
      if (r.from === paths[i] && r.to === paths[i + 1]) {
        rel = 'parent';
        continue;
      }
      if (r.from === paths[i + 1] && r.to === paths[i]) {
        rel = 'child';
        continue;
      }
    }
    // Output the node with the relationship of the next node
    result.push([paths[i], rel]);
  }  
  return result;
}

function classifyBNStructure(first2MiddleNodeType, third2MiddleNodeType) {
  if (first2MiddleNodeType == 'parent' && third2MiddleNodeType == 'parent') {
    return 'v-structure';
  } else if (first2MiddleNodeType === 'child' && third2MiddleNodeType === 'child') {
    return 'common-cause';
  } else {
    return 'chain';
  }
}

function isBlockedByBNStructure(structure) {
  if (structure === 'v-structure') {
    return false;
  } 
  return true;
}

function classifyPaths(pathWithRelationship, pathNoRelationship, focusNode, targetNode) {
    let firstOrderPaths = [];
    let secondOrderPaths = [];
  
    pathWithRelationship.forEach((path) => {
      if (path[0][0] == focusNode && path[path.length-1][0] == targetNode) {
        firstOrderPaths.push(path)
      }      
    }) 
    
    for (let i = 0; i < pathWithRelationship.length; i++) {      
      let lenPathRel = pathWithRelationship[i].length;
      if (pathWithRelationship[i][0][0] == focusNode && pathWithRelationship[i][lenPathRel-1][0] == targetNode) {
        continue;
      }
            
      for (let j = 0; j < firstOrderPaths.length; j++) {
        let lenFirstOrd = firstOrderPaths[j].length;
        let focusNodePathType = firstOrderPaths[j][lenFirstOrd-2][1];
        
        let relCurrPathWithFocusNodePath = classifyBNStructure(focusNodePathType, pathWithRelationship[i][lenPathRel-2][1]);
        if (!isBlockedByBNStructure(relCurrPathWithFocusNodePath)) {
          secondOrderPaths.push(pathNoRelationship[i]);
        }
      }      
    }
    
    return {
      firstOrderPaths: firstOrderPaths,
      secondOrderPaths: secondOrderPaths
    };
}



module.exports = {
  isActivePath,
  buildUndirectedGraph,
  findAllPaths,
  filterActivePaths,
  activePathWithRelationships,
  classifyBNStructure,
  classifyPaths
};