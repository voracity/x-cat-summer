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

function clearAllArcs(arcInfluence, bn) {
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
  }
}

function sortArcInfluenceByDiff(arcInfluence, nodeBeliefs) {
  return arcInfluence
    .map((arcEntry) => {
      // Calculate max diff for this arcEntry
      const maxDiff = Math.max(
        ...Object.entries(arcEntry.targetBelief).map(
          ([targetNodeName, arcBeliefs]) => {
            const targetNode = document.querySelector(
              `div.node[data-name=${targetNodeName}]`
            );
            const targetStateElem = targetNode.querySelector(".state.istarget");
            const targetStateIdx = targetStateElem.dataset.index;

            return (
              nodeBeliefs[targetNodeName][targetStateIdx] -
              arcBeliefs[targetStateIdx]
            );
          }
        )
      );

      // Attach the maxDiff to arcEntry for sorting
      return { ...arcEntry, maxDiff };
    })
    .sort((a, b) => b.maxDiff - a.maxDiff) // Sort by maxDiff in descending order
    .map(({ maxDiff, ...arcEntry }) => arcEntry); // Remove the maxDiff property
}
