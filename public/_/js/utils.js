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
