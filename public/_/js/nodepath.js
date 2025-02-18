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

function classifyPaths(pathWithRelationship, focusNode, targetNode) {
  let firstOrderPathsSet = new Set();
  let secondOrderPathsSet = new Set();

  let firstOrderPaths = [];
  let secondOrderPaths = [];

  console.log('------------classifyPaths:--------------')

  pathWithRelationship.forEach((path) => {
    console.log('path:', path)  
      if (path[0][0] === focusNode && path[path.length - 1][0] === targetNode) {
          let pathString = JSON.stringify(path); 
          if (!firstOrderPathsSet.has(pathString)) {
              firstOrderPathsSet.add(pathString);
              firstOrderPaths.push(path);
          }
      }
  });

  for (let i = 0; i < pathWithRelationship.length; i++) {
      let lenPathRel = pathWithRelationship[i].length;
      let currPath = pathWithRelationship[i];
      if (firstOrderPathsSet.has(currPath)) {
          continue;
      }

      // v-structure with focus node is the common cause
      if (currPath[lenPathRel - 2][0] == focusNode && currPath[lenPathRel - 1][0] == targetNode && (currPath[lenPathRel - 2][1] === 'child')) {        
        let pathStr = JSON.stringify(currPath);
        if (!secondOrderPathsSet.has(pathStr)) {
          secondOrderPathsSet.add(pathStr);
          secondOrderPaths.push(currPath);                
        }
      }      

      for (let j = 0; j < firstOrderPaths.length; j++) {
          let lenFirstOrd = firstOrderPaths[j].length;
          let focusNodePathType = firstOrderPaths[j][lenFirstOrd - 2][1];          

          let relCurrPathWithFocusNodePath = classifyBNStructure(focusNodePathType, currPath[lenPathRel - 2][1]);
          if (!isBlockedByBNStructure(relCurrPathWithFocusNodePath)) {
              let pathString = JSON.stringify(currPath); 
              if (!secondOrderPathsSet.has(pathString)) {
                  secondOrderPathsSet.add(pathString);
                  secondOrderPaths.push(currPath);
              }
          }
      }
  }

  return {
      firstOrderPaths,
      secondOrderPaths
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