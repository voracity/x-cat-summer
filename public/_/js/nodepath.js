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
  let allPaths = null;

  function dfs(currentNode, endNode, path, visited) {

    visited.add(currentNode);
    path.push(currentNode);

    if (currentNode === endNode) {
      allPaths = [...path];
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
    result.push([paths[i], rel]);
  }  
  return result;
}

function classifyBNStructure(node1ToNode2Type, node2ToNode3Type) {
  if (node1ToNode2Type === node2ToNode3Type) {
    return 'chain';
  } else if (node1ToNode2Type === 'parent' && node2ToNode3Type === 'child') {
    return 'v-structure';
  } else {
    return 'common-cause';
  }
}

function classifyPaths(pathWithRelationship, evidence, focusNode, targetNode) {
    pathWithRelationship.forEach((path) => {
      // console.log('---------------------------')	
      i = 0
      j = 1

      while (j < path.length) {
        structure = classifyBNStructure(path[i][1], path[j][1])
        console.log('structure:', structure)
        i++        
      }
    }) 
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