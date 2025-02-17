var {Net} = require('../../../bni_smile');

// Event Listener for Navigation:
// Listens for clicks on buttons with `href` attributes and navigates to the specified URL.
document.addEventListener('DOMContentLoaded', event => {
	document.addEventListener('click', event => {
		if (event.target.matches('button[href]')) {
			event.preventDefault();
			window.location.href = event.target.getAttribute('href');
		}
	});
});

// Adds a synthetic node to a Bayesian Network that combines multiple parent nodes, creating an identity matrix for its CPT.
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

// Removes a parent's influence on a child node in the Bayesian Network by marginalizing its CPT; optionally reduces the CPT size.
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

// Extracts specified keys from an object and returns a new object containing only those key-value pairs.
function pick(obj, keys) {
	let newObj = {};
	for (let key of keys) {
		if (key in obj) {
			newObj[key] = obj[key];
		}
	}
	return newObj;
}

// Parses query parameters from a URL and returns them as a key-value object.
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

// Maps a change rate to a predefined color code based on its magnitude and direction.
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

// Calculates the color code for a target node state based on the difference between its baseline and current beliefs.
function getTargetStateColor(baseBelief, currentBelief) {
  let diff = currentBelief - baseBelief;
  let color = getColor(diff);
  return color
}

module.exports = {
  addJointChild,
  marginalizeParentArc,
  getColor,
};