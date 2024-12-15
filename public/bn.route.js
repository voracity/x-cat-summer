var {n, toHtml} = require('htm');
var {sitePath, ...siteUtils} = require('siteUtils');
var {Net, Node} = require('../bni_smile');
var fs = require('fs');

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

var measurePlugins = {
	do: {
		calculate(nets, roles, selectedStates) {
			return 0;
		}
	},
	ci: {
		calculate(nets, roles, selectedStates, opts = {}) {
			selectedStates = selectedStates || {};
			opts.jointCause = opts.jointCause || null;
			console.log("ci sel", selectedStates);
			let net = nets.interventionNet;
			let causes = roles && roles.cause && roles.cause.length && roles.cause;
			let effect = roles && roles.effect && roles.effect.length && roles.effect[0];
			console.log("HERE IS CAUSES EFFECT:", causes, effect);
			if (causes && effect) {
				console.time('CI');
				let tempNodeName = null;
				/// XXX: To implement
				/// If there is more than 1 cause, then add a temporary child node
				/// to all cause nodes, and then use that (plus the effect node) to compute the mutual
				/// information, with just 2 inferences (but 1 compile with a potentially huge node!) as per the current method
				let cause = causes[0];
				if (causes.length > 1) {
					/*let stateList = [];
					let stateIndexes = causes.map(_=>0);
					do {
						stateList.push('s'+stateIndexes.join('_'));
					} while (Net.nextCombination(stateIndexes, causes.map(c => net.node(c))));
					/// XXX: Add support to bni_smile for deterministic nodes
					tempNodeName = 's'+String(Math.random()).slice(2);
					console.log('IDENTITY',stateList.map((_,i)=>stateList.map((_,j)=> i==j ? 1 : 0)));
					net
						.addNode(tempNodeName, null, stateList)
						.addParents(causes)
						/// Essentially, create an identity matrix for now (later, replace with det node)
						.cpt(stateList.map((_,i)=>stateList.map((_,j)=> i==j ? 1 : 0)));
					cause = tempNodeName;*/
					cause = opts.jointCause;
				}
				//console.log('XXX1');
				console.time('MI');
				//net.mi(net.node(effect));
				console.timeLog('MI');
				//console.log('XXX2');
				//net.mi(net.node(effect));
				console.timeEnd('MI');
				//let table2 = net.mi(net.node(effect));
				let table = net.mi(net.node(effect) , {
					targetStates: selectedStates[effect],
					otherStates: {[cause]: selectedStates[cause]},
				});
				console.log('picked:', selectedStates[cause]);
				//console.log('node:',cause);
				//console.log('x', table, net.node(cause).beliefs());
				let value = table.find(row => row[0] == cause)[1];
				//let effectValue = table2.find(row => row[0] == effect)[1];
				/// 2 ways to compute %:
				/// - against the entropy of the effect in the cut network
				/// - against the maximum possible entropy of the effect
				let numStates = net.node(effect).numberStates();
				let unif = 1/numStates;
				// let effectValue = net.node(effect).entropy();
				let effectValue = -unif*Math.log2(unif)*numStates;
				let percent = value/effectValue;
				
				//if (tempNodeName)  net.node(tempNodeName).delete();
				
				console.timeEnd('CI');
				return {value, percent, _effectValue: effectValue, title: 'Causal information'};
			}
			
			return null;
		}
	},
	mi: {
		calculate(nets, roles, selectedStates, opts = {}) {
			opts.jointCause = opts.jointCause || null;
			let net = nets.originalNet;
			let causes = roles && roles.cause && roles.cause.length && roles.cause;
			let effect = roles && roles.effect && roles.effect.length && roles.effect[0];
			if (causes && effect) {
				let cause = causes.length == 1 ? causes[0] : opts.jointCause;
				let table = net.mi(net.node(effect), {
					targetStates: selectedStates[effect],
					otherStates: {[cause]: selectedStates[cause]},
				});
				let table2 = net.mi(net.node(effect));
				let value = table.find(row => row[0] == cause)[1];
				let effectValue = table2.find(row => row[0] == effect)[1];
				let percent = value/effectValue;
				return {value, percent, _effectValue: effectValue, title: 'Mutual information'};
			}
			
			return null;
		}
	},
	/* Modifications:\n- Arc cutting\n- n-ary cause nodes are treated as binary with respect to "focus" states\n- Paths through other parents are left as they are */
	cheng: {
		calculate(nets, roles, selectedStates, opts = {}) {
			console.log('CHENG')
			let net = nets.interventionNet;
			let causes = roles && roles.cause && roles.cause.length && roles.cause;
			let effect = roles && roles.effect && roles.effect.length && roles.effect[0];
			let preventative = false;
			if (causes && effect) {
				console.log('CHENG2');
				let cause = causes.length == 1 ? causes[0] : opts.jointCause;
				selectedStates = selectedStates || {};
				let table2, value, effectValue, percent;
				let causeNumStates = net.node(cause).numberStates();
				let effectNumStates = net.node(effect).numberStates();
				if (selectedStates[cause] && selectedStates[effect]
						&& selectedStates[cause].length != causeNumStates
						&& selectedStates[effect].length != effectNumStates) {
					/// Only singular states supported right now
					/// XXX: Extend to support multiple states, by treating as merged states
					let causeStateNums = selectedStates[cause].map(sel => net.node(cause).state(sel).stateNum);
					let effectStateNums = selectedStates[effect].map(sel => net.node(effect).state(sel).stateNum);
					//let e = net.node(effect).state(selectedStates[effect][0]).stateNum;
					console.log('cheng',cause, effect, selectedStates, causeStateNums, effectStateNums);
					
					let origBeliefs = net.node(effect).beliefs();
					let savedCauseFinding = net.node(cause).finding();
					
					/// Turn off everything other than the selectedStates
					let numStates = net.node(cause).states().length;
					let likelihoods = Array(numStates).fill(0);
					causeStateNums.forEach(i => likelihoods[i] = 1);
					//let likelihoods = Array.from({length: numStates}, (_,i) => Number(causeStateNums.includes(i)));
					net.node(cause).likelihoods(likelihoods);
					//net.node(cause).finding(c);
					let cBeliefs = net.node(effect).beliefs();
					
					net.node(cause).retractFindings();
					net.node(cause).likelihoods(likelihoods.map(v => 1-v));
					let notCBeliefs = net.node(effect).beliefs();
					
					net.node(cause).retractFindings();
					if (savedCauseFinding) {
						console.log(savedCauseFinding);
						net.node(cause).finding(savedCauseFinding);
					}
					
					console.log(origBeliefs, cBeliefs, notCBeliefs);
					let cBelief = effectStateNums.map(e => cBeliefs[e]).reduce((a,v)=>a+v);
					let notCBelief = effectStateNums.map(e => notCBeliefs[e]).reduce((a,v)=>a+v);
					
					let deltaBelief =  cBelief - notCBelief;
					
					let causalPower = null;
					if (deltaBelief >= 0) {
						/// Equation 8 from Cheng 1997
						causalPower = deltaBelief/(1 - notCBelief);
					}
					else {
						/// Equation 14 from Cheng 1997
						causalPower = -deltaBelief/notCBelief;
						preventative = true;
					}
					
					value = causalPower;
				}
				else {
					value = '-';
				}
				return {value, title: 'Cheng', tooltip: 'Cheng\'s causal power. See the CAT Explainer for a description.', extraInfo: preventative ? '(preventative)' : ''};
			}
			
			return null;
		}
	},
	/* Modifications:\n- Arc cutting\n- n-ary cause nodes are treated as binary with respect to "focus" states\n- Paths through other parents are left as they are*/
	far: {
		calculate(nets, roles, selectedStates, opts = {}) {
			console.log('FAR')
			let net = nets.interventionNet;
			let causes = roles && roles.cause && roles.cause.length && roles.cause;
			let effect = roles && roles.effect && roles.effect.length && roles.effect[0];
			let preventative = false;
			if (causes && effect) {
				console.log('FAR2');
				let cause = causes.length == 1 ? causes[0] : opts.jointCause;
				selectedStates = selectedStates || {};
				let table2, value, effectValue, percent;
				let causeNumStates = net.node(cause).numberStates();
				let effectNumStates = net.node(effect).numberStates();
				if (selectedStates[cause] && selectedStates[effect]
						&& selectedStates[cause].length != causeNumStates
						&& selectedStates[effect].length != effectNumStates) {
					/// Only singular states supported right now
					/// XXX: Extend to support multiple states, by treating as merged states
					let causeStateNums = selectedStates[cause].map(sel => net.node(cause).state(sel).stateNum);
					let effectStateNums = selectedStates[effect].map(sel => net.node(effect).state(sel).stateNum);
					//let e = net.node(effect).state(selectedStates[effect][0]).stateNum;
					console.log('FAR3',cause, effect, selectedStates, causeStateNums, effectStateNums);
					
					let origBeliefs = net.node(effect).beliefs();
					let savedCauseFinding = net.node(cause).finding();
					
					/// Turn off everything other than the selectedStates
					let numStates = net.node(cause).states().length;
					let likelihoods = Array(numStates).fill(0);
					causeStateNums.forEach(i => likelihoods[i] = 1);
					//let likelihoods = Array.from({length: numStates}, (_,i) => Number(causeStateNums.includes(i)));
					net.node(cause).likelihoods(likelihoods);
					//net.node(cause).finding(c);
					let cBeliefs = net.node(effect).beliefs();
					
					net.node(cause).retractFindings();
					net.node(cause).likelihoods(likelihoods.map(v => 1-v));
					let notCBeliefs = net.node(effect).beliefs();
					
					net.node(cause).retractFindings();
					if (savedCauseFinding) {
						console.log(savedCauseFinding);
						net.node(cause).finding(savedCauseFinding);
					}
					
					console.log(origBeliefs, cBeliefs, notCBeliefs);
					let cBelief = effectStateNums.map(e => cBeliefs[e]).reduce((a,v)=>a+v);
					let notCBelief = effectStateNums.map(e => notCBeliefs[e]).reduce((a,v)=>a+v);
					
					let far = 1 - notCBelief/cBelief;
					
					if (far < 0) {
						far = (1 - cBelief/notCBelief);
						preventative = true;
					}
					
					value = far;
				}
				else {
					value = '-';
				}
				return {value, title: 'FAR', tooltip: 'Fraction of Attributable Risk. See the CAT Explainer for a description.', extraInfo: preventative ? '(preventative)' : ''};
			}
			
			return null;
		},
	},
};

class BnDetail {
	constructor(drawOptions = {}) {
		
		const DEFAULT_OPTS = {
			drawFrame:false,
			drawChangeBar:true
		}
		this.drawOptions = Object.assign({}, drawOptions)
		Object.keys(DEFAULT_OPTS).forEach(key => {
			if (this.drawOptions[key] == undefined)
				this.drawOptions[key] = DEFAULT_OPTS[key]
		})
	}
	make(root) {
		this.root = root || n('div.bnDetail',
			n('script', {src: 'https://code.jquery.com/jquery-3.4.1.slim.min.js'}),
			n('script', {src: sitePath('/_/js/arrows.js')}),
			n('script', {src: sitePath('/_/js/bn.js')}),
			n('div.controls',
				// n('button.downloadpng', 'Download As PNG'),
				n('button.savesnapshot', 'Save Snapshot'),
				n('button.downloadsvg', 'Download As SVG'),
				n('button.downloadbase64', 'Download As Base64'),
				n('label', 
					'Scale Image',
					n('select.scaleimage', 
						n('option', "1x", {value:1}),
						n('option', "2x", {value:2}),
						n('option', "3x", {value:3}),
					),
					),
				// n('button.save', 'Save to My Library'),
					
				n('label', 
					'Influence Frame',
					n('input.influence-as-frame', {type:"checkbox"})
				),
				n('label', 
					'Only Show Target Node',
					n('input.influence-target-node', {type:"checkbox"})
				),
				n('button.publish', 'Publish to Public Library'),
				n('span.gap'),
				n('span.scenarioControls',
					n('span', 'Scenario:'),
					this.scenarioBox = n('select.scenario',
						n('option.none', 'None'),
					),
					n('button.saveScenario', 'Save'),
					n('button.removeScenario', 'Remove'),
					n('button.renameScenario', 'Rename'),
				),
			),
			n('div.bnView',
			),

			n('div.influenceContainer',
				{class: 'influenceContainer'},
				n('h2', 'Influence Descriptions'),
				n('ul', {class: 'influenceList'})
			),

			n('div.infoWindows',
				/*	
				n('div.help',
					n('h2', 'Help'),
					n('div.tip.infoContent',
						n('p', `Hover over a node and click 'E' to set an effect, which will display the causal information with all other nodes below.`),
						n('p', `To see the effect of a `, n('em', 'combined'), ` set of causes, click 'C' (Cause) on one or more other nodes, which will display an information window below.`),
						n('p', `To focus on the causal information for just specific states, click the checkbox next to the state name. To select multiple such states, hold down 'Shift'.`),
					),
				),
				*/
				n("div", {class:"evidence-scale"}, 
					n("div", {class:"evidence-scale-header"}, "Evidence impact scale"),
					// n("div", "Colour scale showing the influence of evidence on the target."),
					n("table", {class:"influencelegend"} ,
						n("tr", n("td", "greatly increases", {class:`influence-idx0`})),
						n("tr", n("td", "moderately increases", {class:`influence-idx1`})),
						n("tr", n("td", "slightly increases", {class:`influence-idx2`})),
						n("tr", n("td", "barely changes", {class:`influence-idx3`})),
						n("tr", n("td", "slightly reduces", {class:`influence-idx4`})),
						n("tr", n("td", "moderately reduces", {class:`influence-idx5`})),
						n("tr", n("td", "greatly reduces", {class:`influence-idx6`})),
					),
					n("div", {style:"text-align:center; padding:3px;"}, "probability of"),
					n("div", n("div", {class:"target"}, "target state"))
				)
			),
		);
		this.titleEl = this.root.querySelector('.title');
		this.bnView = this.root.querySelector('.bnView');
	}
	
	toHtml() { return this.root.outerHTML; }
	
	getColor(changerate) {
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

	$handleUpdate(m) {
		let barMax = 100; //px
		console.log('---------------------------------------')
		console.log('m:', m)
		console.log('---------------------------------------')
		if (m.title) {
			/// XXX Hack: Find a way of getting the page component
			console.log('m.title:', m.title)
			if (document.body) {
				q('h1 .text').innerHTML = m.title;
			}
			else {
				this.titleEl.textContent = m.title;
			}
		}
		
		if (m.model) {
			console.log('m.model:', m.model)
			
			this.bnView.querySelectorAll('.node').forEach(n => n.remove());
			let nodes = m.model.map(node => n('div.node',
				{dataName: node.name},
				/* Use transform, so that alignment is the same as what GeNIe thinks it is (i.e. based on centre point) */
				// {style: `left: ${node.pos[0]}px; top: ${node.pos[1]}px; transform:translate(-50%,-50%)`},
				/* MK: The example files don't have an offset */
				
				{style: `left: ${node.pos[0]}px; top: ${node.pos[1]}px; `},
				n('div.controls',
					n('a.setCause', {href: 'javascript:void(0)'}, 'C'),
					n('a.setEffect', {href: 'javascript:void(0)'}, 'E'),
					//n('a.menu', {href: 'javascript:void(0)'}, '\u22EF'),
				),
				n('h3', node.name),
				
				n('div.states',
					node.states.map((s,i) => n('div.state',
						{dataIndex: i},
						// n('span.target', n('input', {type: 'checkbox'})),
						
						n('div.cellProbability',
							n('div.propWrapper',

								n('div.hiddencheckboxcontainer.target', 
									n('input', {type: 'checkbox'},{class:`hiddencheckbox`})
								),
								n('span.label', s),
								n('span.prob', Math.trunc(Math.round(node.beliefs[i]*100).toFixed(1))),
							)
						),
						
						n('div.cellBar',
							n('div.barParent', 
								n('span.bar', {style: `width: ${node.beliefs[i]*100}%`}),
								n('span.barchange')
							)
						),
					)) // states.map
				)
			)); // model.map
			this.bnView.append(...nodes);
			this.bnView.append(n('script', `
				bn.model = ${JSON.stringify(m.model)};
				bn.drawArcs();
			`));
		}
		if (m.nodeBeliefs) {
			for (let [nodeName,beliefs] of Object.entries(m.nodeBeliefs)) {
				let nodeEl = this.bnView.querySelector(`div.node[data-name=${nodeName}]`);
				nodeEl.querySelectorAll('.state').forEach((state,i) => {
					state.querySelector('.prob').textContent =  Math.trunc(Math.round(beliefs[i]*100).toFixed(1));
					state.querySelector('.bar').style.width = (beliefs[i]*barMax)+'%';
				});
			}
		}
		/** != null is false only if value is null or undefined **/
		if (m.scenariosEnabled != null) {
			this.root.querySelector('.scenarioControls').style.display = m.scenariosEnabled ? 'inline' : 'none';
		}
		if (m.scenarios) {
			for (let scenario of m.scenarios) {
				this.scenarioBox.append(n('option', scenario.name, {value: scenario.id, dataScenario: JSON.stringify(scenario)}));
			}
		}
		if (m.temporary != null) {
			this.root.querySelector('button.publish').style.display = m.temporary ? 'none' : 'inline';
			if (!m.temporary) {
				this.root.querySelector('button.save').textContent = 'Save';
			}
		}
		if (m.visibility != null) {
			this.root.querySelector('button.publish').style.display = m.visibility == 'public' ? 'none' : 'inline';
		}

		if (m.updateFrameMode != null) {
			// clear all influences first, as we set them anyway
			Array.from(this.bnView.querySelectorAll(`span.barchange`)).forEach(node => {
				Array.from(node.classList).forEach(classname => {
					if (classname.indexOf("influence-") == 0) {

						node.classList.remove(classname);
						let boxidx = classname.indexOf('-box')
						if (this.drawFrame) {
							node.classList.add('frame');
							if (boxidx < 0)
								classname = classname + '-box'
						} else {
							node.classList.remove('frame');
							if (boxidx > 0)
								classname = classname.substring(0, boxidx)
						}
						node.classList.add(classname);
					}									
				})
			
			})
		}
		// else {

		// 	// clear all influences first, as we set them anyway
		// 	Array.from(this.bnView.querySelectorAll(`span.barchange`)).forEach(node => {
		// 		Array.from(node.classList).forEach(classname => {
		// 			if (classname.indexOf("influence-") == 0) {
		// 				node.classList.remove(classname);
		// 			}									
		// 		})
		// 		node.classList.remove('frame');
			
		// 	})
		// }
		if (m.updateShowBarChange != null) {
			let evidencenodes = this.bnView.querySelectorAll(`div.node.hasEvidence`)

			Array.from(evidencenodes).forEach(node=>
				Array.from(node.querySelectorAll('span.barchange'))
					.forEach(e=>e.style.display = this.onlyTargetNode ? 'none' : "inline-block")
			)
			
		} 

		if (m.influences) {
			let influenceListEl = this.root.querySelector('.influenceList');
			influenceListEl.innerHTML = '';
		
			// First, display the overall explanation if it exists
			if (m.influences['overall']) {
				let overallExplanation = m.influences['overall'].explanation;
				let listItem = n('p', html(overallExplanation));
				influenceListEl.appendChild(listItem);
			}
		
			// Now, iterate over the other influences and display them
			for (let [nodeName, influenceData] of Object.entries(m.influences)) {
				if (nodeName === 'overall') continue; // Skip the 'overall' key as it's already displayed
		
				let explanation = influenceData.explanation;
				let listItem = n('p',html(explanation));
				influenceListEl.appendChild(listItem);
			}
		}
		// Update all evidence nodes and show the influence (as a bar overlayed of the evidence state)
		// they have on the target node

		Array.from(this.bnView.querySelectorAll(`.barchange`)).forEach(node=>node.style.width = "0%")
		Array.from(this.bnView.querySelectorAll(`.cellProbability`)).forEach(node=>{
			Array.from(node.classList).forEach(classname => {
				if (classname.indexOf("influence-") == 0) {
					node.classList.remove(classname);
					node.classList.remove('frame');
				}									
			})
		})
		
		// NODES
		if (m.influences) {			
			let asFrame = true;
			console.log("updating influences");
			let listTargetNodes = {}
			let entries = Object.entries(m.influences)
			console.log('m.influences', m.influences)

			// Nodes that have evidence that contribute to the target node		
			let importantMiddleNodes = new Set();
			let evidenceNodeLabels = new Set();
			let importantArcs = new Set();
			let targetNodeLabel = null;

			// Changed to fixed arc size
			let arcSize = 8;			
			
			if (entries.length == 0) {
				reset(m.arcInfluence, bn, this.bnView);				
			} else {
				entries.forEach(([evidenceNodeName, value]) => {
					let targetBeliefs = value['targetBeliefs'];
					let evidenceNode = this.bnView.querySelector(`div.node[data-name=${evidenceNodeName}]`)	
					// console.log('evidenceNode:', evidenceNode)									
					evidenceNodeLabels.add(evidenceNode.getAttribute('data-name'))

					let evidenceStateIdx = m.nodeBeliefs[evidenceNodeName].indexOf(1);
					Object.entries(targetBeliefs).forEach(([targetNodeName, beliefs]) => {	
						
						let targetNode = this.bnView.querySelector(`div.node[data-name=${targetNodeName}]`)												
						targetNodeLabel = targetNode.getAttribute('data-name')

						let targetStateElem = targetNode.querySelector(".state.istarget");
						let targetStateIdx = targetStateElem.dataset.index;

						let targetBaseModel = m.origModel.find(item => item.name == targetNodeName)
						listTargetNodes[targetNodeName] = {targetStateElem: targetStateElem, index: targetStateIdx, model: targetBaseModel}
						// calculate the relative change this evidence had on the target
						// and set the change color accordingly

						// let relativeBeliefChange = (m.nodeBeliefs[targetNodeName][targetStateIdx] - beliefs[targetStateIdx]) / m.nodeBeliefs[targetNodeName][targetStateIdx];
						let relativeBeliefChange = m.nodeBeliefs[targetNodeName][targetStateIdx] - beliefs[targetStateIdx];
						let absChange = Math.abs(relativeBeliefChange * 100);
						let stateElem = evidenceNode.querySelector(`div.state[data-index="${evidenceStateIdx}"]`);
						let barchangeElem = stateElem.querySelector(`span.barchange`);
						let cellProbabilityElem = stateElem.querySelector(`.cellProbability`);
						let colorClass = this.getColor(relativeBeliefChange);
						// set colour and width of the barchange element

						if (this.drawOptions.drawChangeBar) {
							barchangeElem.style.width = absChange+"%";
							barchangeElem.style.marginLeft = "-"+absChange+"%";
							// barchangeElem.style.left = `${100 - absChange}%`;
	
	
							Array.from(barchangeElem.classList).forEach(classname => {
								if (classname.indexOf("influence-idx") == 0) {
									cellProbabilityElem.classList.remove(classname);
	
									barchangeElem.classList.remove(classname);
									barchangeElem.classList.remove(colorClass+"-box");
									barchangeElem.classList.remove("frame");
								}
							})
	
							barchangeElem.style.display = this.onlyTargetNode ? 'none' : "inline-block";
							
							barchangeElem.classList.add(colorClass);
						}
						
						cellProbabilityElem.classList.add(colorClass);

						// for all elements not being part of the bar set backgroundcolor
						Array.from(stateElem.querySelectorAll(":scope>span:not(.barParent)")).forEach(elem=> {
							Array.from(elem.classList).forEach(classname=> {
								if (classname.indexOf("influence-idx") == 0)
									elem.classList.remove(classname);
							});
							elem.classList.add(colorClass);
						})

					})

				})
				// ARCS

				if (m.arcInfluence) {
					let delay = 0;
					console.log("arcInfluence:", m.arcInfluence);			
				
					reset(m.arcInfluence, bn, this.bnView);

					// console.log('---------------------------------------AAAAAAA')
					// Fade Nodes					
					if (m.activePaths) {
						console.log('m.activePaths is activated: ', m.activePaths)
						let activeNodes = new Set(m.activePaths.flat())
						console.log('bnView:', this.bnView)
						console.log('activeNodes: ', activeNodes)
						this.bnView.querySelectorAll('div.node').forEach(node => {
							let nodeName = node.getAttribute('data-name')
							if (!activeNodes.has(nodeName)) {
								node.style.opacity = 0.3
							}
						})						
						console.log('AAAAAAA---------------------------------------')
					}
				
					const sortedArcInfluence = sortArcInfluenceByDiff(
						m.arcInfluence,
						m.nodeBeliefs,
						this.getColor,
					);
				
					// console.log("importantMiddleNodes", importantMiddleNodes);
					// console.log("evidenceNodeLabels", evidenceNodeLabels);
					// console.log("targetNodeLabel", targetNodeLabel);
				
					// console.log("sortedArcInfluence:", sortedArcInfluence);
				
					sortedArcInfluence.forEach((arcEntry) => {
						// console.log("arcEntry:", arcEntry);
						let arc = document.querySelector(
							`[data-child=${arcEntry.child}][data-parent=${arcEntry.parent}]`,
						);
						
						// console.log("arcEntry:", arcEntry);
						// console.log("arcEntry.color:", arcEntry.color);
						// console.log('arcEntry[child]', arcEntry.child)
						// console.log('arcEntry[parent]', arcEntry.parent)
					
						// console.log("Block of log: ", arcEntry.child, arcEntry.parent, diff, arcSize, arcEntry.color);
						

						// we know the first child is the colour arc
						// coloring order of arrows
						if (arcEntry.color != 'influence-idx3') {
							let influeceArcBodyElems = arc.querySelectorAll("[data-influencearc=body]");
							let influeceArcHeadElems = arc.querySelectorAll("[data-influencearc=head]");						

							let combinedElems = Array.from(influeceArcBodyElems).map(
								(bodyElem, index) => {
									return {
										body: bodyElem,
										head: influeceArcHeadElems[index],
									};
								},
							);

							setTimeout(() => {														
								combinedElems.forEach((pair, index) => {
									let bodyElem = pair.body;
									let headElem = pair.head;
							
									let bodyColor = getComputedStyle(
										document.documentElement,
									).getPropertyValue(`--${arcEntry.color}`);

									
									bodyElem.style.stroke = bodyColor;
									bodyElem.style.strokeWidth = arcSize;
							
									let bodyLength = bodyElem.getTotalLength();
									bodyElem.style.strokeDasharray = bodyLength;
									bodyElem.style.strokeDashoffset = bodyLength;
									bodyElem.style.transition = "none";
							
									bodyElem.getBoundingClientRect();
							
									bodyElem.style.transition = "stroke-dashoffset 1s ease-in-out";
							
									bodyElem.style.strokeDashoffset = "0";
							
									setTimeout(() => {
										let headColor = getComputedStyle(
										document.documentElement,
										).getPropertyValue(`--${arcEntry.color}`);
										headElem.style.stroke = headColor;
										headElem.style.strokeWidth = arcSize;
							
										let headLength = headElem.getTotalLength();
										headElem.style.strokeDasharray = headLength;
										headElem.style.strokeDashoffset = headLength;
										headElem.style.transition = "none";
							
										headElem.getBoundingClientRect();
							
										headElem.style.transition = "stroke-dashoffset 1s ease-in-out";										
							
										setTimeout(() => {
											headElem.style.strokeDashoffset = "0";
										}, 0);
									}, 1000);
								});
							}, delay);					
							delay += 500;
						} else {	
							// Fade arrows						
							// console.log("arc:", arc);
							let arcBodys = arc.querySelectorAll('path.line')							
							arcBodys[1].setAttribute('stroke', '#ffffff')
							// console.log("arcBodys[1]:", arcBodys[1]);

							let arcHeads = arc.querySelectorAll('g.head')							
							arcHeads[1].setAttribute('fill', '#fafafa')																
							arcHeads[1].setAttribute('stroke', '#fafafa')	
							// console.log("arcHeads[1]:", arcHeads[1]);	
							// arcBodys[1].style.opacity = 0.1
							// console.log("arcBodys after changing color:", arcBodys[1]);
						}
					});
				}
			}
			Object.entries(listTargetNodes).forEach(([targetNodeName, data]) => {
				let baseBelief = data.model.beliefs[data.index];
				let currentBelief = m.nodeBeliefs[targetNodeName][data.index];
				let diff = currentBelief - baseBelief
				let absDiff = 100*Math.abs(diff)
				let colorClass = this.getColor(diff)
				let barchangeElem = data.targetStateElem.querySelector(`span.barchange`);

				Array.from(barchangeElem.classList).forEach(classname=> {
					if (classname.indexOf("influence-idx") == 0) {
						barchangeElem.classList.remove(classname);
						barchangeElem.classList.remove(`${colorClass}-box`);
						barchangeElem.classList.remove(`influence-box`);
					}
				})

				if (diff > 0) {
					barchangeElem.style.marginLeft = `-${absDiff}%`;
					barchangeElem.style.width = `${absDiff}%`;
				} else {
					barchangeElem.style.marginLeft = `-${absDiff}%`;
					barchangeElem.style.width = `${absDiff}%`;

				}
				// shadow-boxes with width 0 still show their glow
				if (Math.abs(diff)>0)
					barchangeElem.classList.add(colorClass+"-box");

			})
			
			if (this.drawOptions.drawChangeBar)
				// Now set the change of belief for all remaining nodes, so show how their states
				// changed given all evidence VS no evidence
				Array.from(document.querySelectorAll(".node")).filter(n=>!n.classList.contains("hasEvidence") && !n.classList.contains("istargetnode")).forEach(node => {
					let nodelabel = node.getAttribute("data-name");
					
					let currentBelief = m.nodeBeliefs[nodelabel];
					let origBeliefs = m.origModel.find(entry => entry.name == nodelabel).beliefs;

					currentBelief.forEach((curBelief, idx) => {
						let diff = curBelief - origBeliefs[idx]
						let absDiff = diff * 100;
						
						// let colorClass = this.getColor(/curBelief/origBeliefs[idx])
						let colorClass = this.getColor(diff)

						let barchangeElem = node.querySelector(`.state[data-index="${idx}"] .barchange`)
						barchangeElem.classList.add(colorClass)

						if (absDiff > 0) {
							// overlay change over the current belief bar
							barchangeElem.style.marginLeft = `-${absDiff}%`;
							barchangeElem.style.width = `${absDiff}%`;
						} else {
							// the change will be placed right next to the original belief bar
							barchangeElem.style.width = `${absDiff}%`;
						}
					})
				})

		} else {


			// Array.from(this.bnView.querySelectorAll(".node.istargetnode")).forEach(targetNode => {
			// 	let barchange = targetNode.querySelector(".barchange");
			// 	barchange.style.width = ""
			// })

		}
	}

	saveSnapshot() {
		
		let btnOK = n("button", "OK", {type:'button', on:{click: () => {
			// let snapshotNode = document.querySelector('.bnView .snapshots')
			let snapshots = {};
			let bnView = document.querySelector('.bnView')
			if (bnView.dataset.snapshots != undefined) {
				snapshots = JSON.parse(atob(bnView.dataset.snapshots))
			}
			let snapshotname = document.getElementById("snapshotname").value
			snapshots[snapshotname] = {
				model : bn.model,
				nodeBeliefs : bn.beliefs,
				influences: bn.influences,
				arcInfluence: bn.arcInfluence
			}
			let encoded = btoa(JSON.stringify(snapshots));
			bnView.setAttribute("data-snapshots",encoded);
			ui.dismissDialog(dlg)
		}}})
		let btnCANCEL = n("button", "Canel", {type:'button', on:{click: () => {
			ui.dismissDialog(dlg)
		}}})
		let dlg = ui.popupDialog([
			n('h2', "Enter Snapshot Name"),
			n('input', {id:"snapshotname", autofocus:""})
		], {buttons:[btnOK, btnCANCEL]})
		document.getElementById("snapshotname").focus()
		// dlg.querySelector('.controls').append(n('button', 'Cancel', {type: 'button', on: {click: ui.dismissDialogs}}));
		
	}

}

module.exports = {
	template: 'BnPage',
	component: BnDetail,
	noUserRequired: true,
	async prepareData(req,res,db,cache) {
		// Probably don't need to get this as in server already
		let userInfo = await db.get('select userId from user_sessions where sessionId = ?', req.cookies.sessionId);
		console.log('x');
		if (req.query.updateScenario) {
			await db.run('insert into scenarios (userId, bnId, name, evidence, roles, selectedStates) values (?, ?, ?, ?, ?, ?)', userInfo.userId, req.query.id, req.body.name, JSON.stringify(req.body.evidence), JSON.stringify(req.body.roles), JSON.stringify(req.body.selectedStates));
			return {scenarioId: (await db.get('select last_insert_rowid() as id')).id};
		}
		else if (req.query.deleteScenario) {
			await db.run('delete from scenarios where userId = ? and id = ?', userInfo.userId, req.query.scenarioId);
		}
		else if (req.query.renameScenario) {
			await db.run('update scenarios set name = ? where userId = ? and id = ?', req.body.name, userInfo.userId, req.query.scenarioId);
		}
		else if (req.query.updateBn) {
			console.log('UPDATING');
			let updates = JSON.parse(req.body.updates);
			let updParams = {};
			for (let [k,v] of Object.entries(updates)) {
				updParams['$'+k] = v;
			}
			let ok = await db.get('select 1 from bns where userId = ? and id = ?', userInfo.userId, Number(updates.id));
			console.log(ok, userInfo.userId, updates.id);
			if (ok) {
				//updates
				/// XXX: Validate update entries
				db.run('update bns set visibility = $visibility where id = $id', updParams);
			}
		}
		
		else {
			let net = null;
			let origNet = null;
			try {
				console.log('prepareData');
				/// tbd
				let bnKey;
				let bn =  {};
				console.time('netLoad');
				console.log('HI');
				if (req.query.tempId) {
					let bnType = req.query.type || 'xdsl';
					bnKey = `public/bns/temp_${req.query.tempId}.${bnType}`;
					bn.temporary = true;
				}
				else {
					bn = await db.get('select name, url, visibility from bns where id = ?', req.query.id);
					bn.temporary = false;
					bnKey = `public/bns/${bn.url}`;
				}
				
				/// Make sure we use .xdsl, when available
				let bnKeyXdsl = bnKey.replace(/\.[^.]*$/, '.xdsl');
				if (fs.existsSync(bnKeyXdsl)) {
					bnKey = bnKeyXdsl;
				}
				
				console.log('bnKey:',bnKey);
				let doClone = false;
				if (doClone) {
					if (!cache.bns)  cache.bns = {};
					if (!cache.bns[bnKey]) {
						let origNet = new Net(bnKey);
						// origNet.autoUpdate(false);
						origNet.compile();
						cache.bns[bnKey] = origNet;
						/// Delete oldest cache entry if > 20 BNs
						let bnKeys = Object.keys(cache.bns);
						if (bnKeys.length > 20) {
							cache.bns[bnKeys[0]].close();
							delete cache.bns[bnKeys[0]];
						}
					}
					else {
						console.log('Serving from cache...');
					}
					/// Create copy
					console.time('clone');
					net = cache.bns[bnKey].clone();
					console.timeEnd('clone');
				}
				else {
					net = new Net(bnKey);
					origNet = new Net(bnKey);
				}
				console.timeEnd('netLoad');
				
				/// Set a page title (if we're linked to a page)
				if (req._page) {
					req._page.$handleUpdate({h1: (bn || {}).name || '(unsaved)'});
				}
				
				let measures = ['ci','mi','cheng','far'];
				let calculateOpts = {jointCause: null};
				
				let backupCpts = {};
				let roles = null;
				if (req.query.roles) {
					roles = JSON.parse(req.query.roles);
					for (let [role,nodeNames] of Object.entries(roles)) {
						for (let nodeName of nodeNames) {
							if (role == 'cause') {
								let orig = net.node(nodeName).cpt1d().slice();
								// console.log('---------------------------- Cause role ----------------------------')
								console.log('orig', orig);
								backupCpts[nodeName] = orig;
								let numStates = net.node(nodeName).states().length;
								net.node(nodeName).cpt1d(Array.from({length: orig.length}, _=> 1/numStates));
							}
						}
					}
					if (roles.cause && roles.cause.length > 1) {
						calculateOpts.jointCause = addJointChild(net, roles.cause);
						addJointChild(origNet, roles.cause, calculateOpts.jointCause);
					}
				}
				
				if (req.query.returnType == 'targetInfluence') {

					// Initialize 'evidence' variable
					let evidence = {};
					if (req.query.evidence) {
						evidence = JSON.parse(req.query.evidence);
						// console.log('evidence:', evidence)
					}

					// Initialize 'selectedStates' variable
					let selectedStates = {};
					if (req.query.selectedStates) {
						selectedStates = JSON.parse(req.query.selectedStates);
					}
					
					const Contribute_DESCRIPTIONS = {
						"-3": "greatly reduces",
						"-2": "moderately reduces",
						"-1": "slightly reduces",
						"0": "barely changes",
						"1": "slightly increases",
						"2": "moderately increases",
						"3": "greatly increases"
					};

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

					function calculateIndirectInfluence(path) {
						console.log(`\nCalculating influence along path ${path.join(' -> ')}`);
						
						// Create a temporary network instance to avoid altering the main network
						let tempNet = new Net(bnKey);
						tempNet.compile();
					
						// Check if all nodes in the path exist
						for (let nodeName of path) {
							if (!tempNet.node(nodeName)) {
								console.error(`Node ${nodeName} does not exist`);
								return 0;
							}
						}
					
						// Get the target node and its state index
						let targetNodeName = path[path.length - 1];
						let targetNode = tempNet.node(targetNodeName);
						let targetStateIndexArray = selectedStates[targetNodeName];
						if (!targetStateIndexArray || targetStateIndexArray.length === 0) {
							console.error(`No selected states for target node ${targetNodeName}`);
							return 0;
						}
						let targetStateIndex = targetStateIndexArray[0];
						console.log(`Target state index for node ${targetNodeName} is ${targetStateIndex}`);
					
						// Clear all evidence
						tempNet.retractFindings();
						console.log("Cleared all evidence");
					
						// Set evidence for all nodes in the path except the first one (baseline scenario)
						for (let i = 1; i < path.length; i++) {
							let nodeName = path[i];
							let nodeStateIndex = evidence[nodeName];
							if (nodeStateIndex !== undefined) {
								tempNet.node(nodeName).finding(Number(nodeStateIndex));
								console.log(`In baseline scenario, set node ${nodeName} to state ${nodeStateIndex}`);
							}
						}
					
						// Also set evidence for all neighbors of the first node in the path
						let firstNodeName = path[0];
						let neighbors = getNeighbors(firstNodeName, relationships);
						for (let neighbor of neighbors) {
							if (neighbor !== path[1] && evidence.hasOwnProperty(neighbor)) {
								tempNet.node(neighbor).finding(Number(evidence[neighbor]));
								console.log(`Set neighbor node ${neighbor} to state ${evidence[neighbor]}`);
							}
						}
					
						// Get the baseline belief
						tempNet.update();
						let baselineBelief = targetNode.beliefs()[targetStateIndex];
						console.log(`Baseline belief: ${baselineBelief}`);
					
						// Set the state for the first node in the path
						let firstNodeStateIndex = evidence[firstNodeName];
						if (firstNodeStateIndex === undefined) {
							console.error(`State index for node ${firstNodeName} is undefined`);
							return 0;
						}
						tempNet.node(firstNodeName).finding(Number(firstNodeStateIndex));
						console.log(`Set node ${firstNodeName} to state ${firstNodeStateIndex}`);
					
						// Update the network and get the new belief
						tempNet.update();
						let newBelief = targetNode.beliefs()[targetStateIndex];
						console.log(`After setting ${firstNodeName}, new belief for ${targetNodeName} is ${newBelief}`);
					
						// Calculate the influence percentage
						let influencePercentage;
						if (baselineBelief !== 0) {
							influencePercentage = (newBelief - baselineBelief) ;
							console.log(`Influence percentage: (${newBelief} - ${baselineBelief}) = ${influencePercentage}`);
						} else {
							influencePercentage = newBelief !== 0 ? Infinity : 0;
							console.log(`Baseline belief is 0, influence percentage is ${influencePercentage}`);
						}
					
						// Return the influence percentage
						return influencePercentage;
					}
					
					// Helper function to get all neighbors of a node
					function getNeighbors(node, relationships) {
						const neighbors = [];
						for (let rel of relationships) {
							if (rel.from === node) {
								neighbors.push(rel.to);
							} else if (rel.to === node) {
								neighbors.push(rel.from);
							}
						}
						return neighbors;
					}
					
					function calculatePathContribution(path) {
						let totalInfluence = calculateIndirectInfluence(path);
						console.log(`Total influence for path ${path.join(' -> ')}:`, totalInfluence);
					
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
						console.log('graph:', graph)
						return graph;
					}

					// function filterShortestPaths(paths) {
					// 	const filteredPaths = [];
					// 	const visitedNodes = new Set();
					
					// 	paths.forEach(path => {
					// 		const toNode = path[path.length - 1];
					// 		if (!visitedNodes.has(toNode)) {
					// 			filteredPaths.push(path);
					// 			visitedNodes.add(toNode);
					// 		}
					// 	});
					
					// 	return filteredPaths;
					// }
					

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

					// set all evidence
					for (let [nodeName, stateI] of Object.entries(evidence)) {
						net.node(nodeName).finding(Number(stateI));
					}
					console.log("evidence",evidence)
					net.update();

					let baselineBeliefs = {};
					Object.keys(selectedStates).forEach(targetNodeName => {
						baselineBeliefs[targetNodeName] = net.node(targetNodeName).beliefs();
					});

					let relationships = [];					

					net.nodes().forEach(node => {
						// Get all parents of the node
						node.parents().forEach(parent => {
							// Calculate the influence percentage between parent and node
							let influencePercentage = calculateInfluenceBetweenNodes(parent.name(), node.name());
					
							// Map influence percentage to contribute value [-3, 3]
							let contribute = mapInfluencePercentageToScale(influencePercentage);
							
					
							// Add the relationship to the list
							relationships.push({
								from: parent.name(),
								to: node.name(),
								contribute: contribute
							});
						});
					});

					console.log("relationships",relationships)
					


					const graph = buildUndirectedGraph(relationships);


					// Edge map for contribute values
					const edgeMap = {};
					relationships.forEach(rel => {
						const edgeKey = `${rel.from}->${rel.to}`;
						edgeMap[edgeKey] = rel.contribute;
					});
					

					if (req.query.evidence) {
						let evidence = JSON.parse(req.query.evidence);

						// the selected state is our Target
						

						if (req.query.selectedStates) {
							selectedStates = JSON.parse(req.query.selectedStates);
						}

						// get network with all evidence 
						for (let [nodeName,stateI] of Object.entries(evidence)) {
							console.log(nodeName, stateI);
							net.node(nodeName).finding(Number(stateI));
							// origNet.node(nodeName).finding(Number(stateI));
						}
					
						
						console.time('update');
						net.update();
						baselineModel = net.nodes().map(n => ({name: n.name(), beliefs: n.beliefs()}));
						// origNet.update();
						bn.model = baselineModel;
						
						if (Object.keys(evidence).length == 0) {
							return bn;
						}
						bn.influences = {};
						bn.activePaths = [];


						// Ensure only one selected target node
						const targetNames = Object.keys(selectedStates);
						if (targetNames.length !== 1) {
							throw new Error("Only one selected state is allowed.");
						}
						const targetNodeName = targetNames[0];
						let targetStateIndexArray = selectedStates[targetNodeName];
						if (!targetStateIndexArray || !Array.isArray(targetStateIndexArray) || targetStateIndexArray.length === 0) {
							console.error(`No selected states for target node ${targetNodeName}`);
							
						}
						const targetStateIndex = targetStateIndexArray[0];

						// Get the baseline beliefs with all evidence applied
						let netWithAllEvidence = new Net(bnKey);
						netWithAllEvidence.compile();
						for (let [nodeName, stateI] of Object.entries(evidence)) {
							netWithAllEvidence.node(nodeName).finding(Number(stateI));
						}
						netWithAllEvidence.update();
						const baselineBelief = netWithAllEvidence.node(targetNodeName).beliefs();
						const baselineProb = baselineBelief[targetStateIndex];
						console.log('baselineProb:', baselineProb)

						let sentences = [];
						let totalInfluencePercentage = 0; 

						for (let nonActiveNodeName of Object.keys(evidence)) {
							// Initialize a temporary array to store the sentences generated for this specific nonActiveNode.
							let nodeSentences = [];
						
							// Create a new network instance to represent the scenario where we remove one piece of evidence.
							let netWithoutOneEvidence = new Net(bnKey);
							netWithoutOneEvidence.compile();					
						
							// Set all evidence except the one corresponding to the current nonActiveNodeName.
							for (let [nodeName, stateI] of Object.entries(evidence)) {
								if (nodeName != nonActiveNodeName) {
									netWithoutOneEvidence.node(nodeName).finding(Number(stateI));
								}
							}
						
							// Update the network to propagate the changes in evidence and compute new beliefs.
							netWithoutOneEvidence.update();
						
							bn.influences[nonActiveNodeName] = { targetBeliefs: {} };
							let influenceData = bn.influences[nonActiveNodeName];
							
							let newBelief = netWithoutOneEvidence.node(targetNodeName).beliefs();
							influenceData.targetBeliefs[targetNodeName] = newBelief;
							console.log('influenceData:', influenceData)
						
							// Calculate the new probability of the selected target state and determine the influence percentage.
							let newProb = newBelief[targetStateIndex];
							console.log('newProb:', newProb)
							let influencePercentage = (baselineProb - newProb) / baselineProb;
							influenceData.influencePercentage = influencePercentage;
							console.log('influenceData after:', influenceData)
							totalInfluencePercentage += influencePercentage;
							console.log('influencePercentage:', influencePercentage)
						
							// Map the influence percentage to a descriptive phrase (e.g., "slightly increases", "greatly reduces").
							let scale = mapInfluencePercentageToScale(influencePercentage);
							let description = Contribute_DESCRIPTIONS[scale.toString()];
						
							// Find all paths between the current nonActiveNode and the target node in the network.
							let allPaths = findAllPaths(graph, nonActiveNodeName, targetNodeName);						
						
							// filterActivePaths
							let ActivePaths = filterActivePaths(allPaths,relationships,evidence);		
											
							// ActivePaths = filterShortestPaths(ActivePaths);							
						
							const nonActiveNodes = Object.keys(evidence);
							console.log("ActivePaths: ", ActivePaths);
						
							// For each filtered path, generate a sentence describing how the current nonActiveNode influences the target.
							for (const path of ActivePaths) {
								bn.activePaths.push(path)	
								let pathScale = calculatePathContribution(path);
								const contributionPhrase = Contribute_DESCRIPTIONS[pathScale.toString()];
						
								// Identify the fromNode (start) and toNode (target) from the path.
								const fromNode = path[0];     
								const toNode = path[path.length - 1];  
								let fromNodeAttribute = getAttribute(fromNode);
						
								// Retrieve the target node attribute (e.g., selected state name).
								let node = netWithAllEvidence.node(targetNodeName);
								let state = node.states();
								let stateNames = node._stateNames;
								const targetNodeAttribute = stateNames[targetStateIndex];
						
								// Identify any intermediate nonActiveNodes (excluding the start and end of the path).
								let intermediateNodes = path.slice(1, -1)
									.filter(node => nonActiveNodes.includes(node))
									.map(node => {
										let nodeAttribute = getAttribute(node);
										return `<span style="font-weight:900; font-size:18px">${node}</span> is <span style="font-style:italic">${nodeAttribute}</span>`;
									});
						
								let isDirectPath = (path.length === 2);
								let sentence;
						
								// construct an appropriate sentence describing the influence.
								if (isDirectPath && intermediateNodes.length === 0) {
									// Direct path with no intermediate node.
									const neighbors = graph[fromNode] || [];
									let adjacentNonActiveNodes = neighbors.filter(n => nonActiveNodes.includes(n) && n !== toNode);
						
									if (adjacentNonActiveNodes.length > 0) {
										// we consider it as an indirect influence scenario.
										let intermediateNodesStr = adjacentNonActiveNodes.map(node => {
											let nodeAttribute = getAttribute(node);
											return `<span style="font-weight:900; font-size:18px">${node}</span> is <span style="font-style:italic">${nodeAttribute}</span>`;
										}).join(', ');
										sentence = `<li style="margin-left: 20px;">Finding out <span style="font-weight:900; font-size:18px">${fromNode}</span> is <span style="font-style:italic">${fromNodeAttribute}</span> <span style="text-decoration:underline">${contributionPhrase}</span> the probability of <span style="font-weight:900; font-size:18px">${toNode}</span> is <span style="font-style:italic">${targetNodeAttribute}</span>, given that ${intermediateNodesStr}.</li>`;
									} else {
										// No adjacent nonActiveNodes, this is a straightforward direct influence sentence.
										sentence = `<li style="margin-left: 20px;">Finding out <span style="font-weight:900; font-size:18px">${fromNode}</span> is <span style="font-style:italic">${fromNodeAttribute}</span> <span style="text-decoration:underline">${contributionPhrase}</span> the probability of <span style="font-weight:900; font-size:18px">${toNode}</span> is <span style="font-style:italic">${targetNodeAttribute}</span>.</li>`;
									}
								} else {
									// Indirect path or a path with intermediate nodes.
									if (intermediateNodes.length === 0) {
										sentence = `<li style="margin-left: 20px;">Finding out <span style="font-weight:900; font-size:18px">${fromNode}</span> is <span style="font-style:italic">${fromNodeAttribute}</span> <span style="text-decoration:underline">${contributionPhrase}</span> the probability of <span style="font-weight:900; font-size:18px">${toNode}</span> is <span style="font-style:italic">${targetNodeAttribute}</span>.</li>`;
									} else {
										const intermediateNodesStr = intermediateNodes.join(', ');
										sentence = `<li style="margin-left: 20px;">Finding out <span style="font-weight:900; font-size:18px">${fromNode}</span> is <span style="font-style:italic">${fromNodeAttribute}</span> <span style="text-decoration:underline">${contributionPhrase}</span> the probability of <span style="font-weight:900; font-size:18px">${toNode}</span> is <span style="font-style:italic">${targetNodeAttribute}</span>, given that ${intermediateNodesStr}.</li>`;
									}
								}
						
								// Add the constructed sentence to nodeSentences for this nonActiveNode.
								nodeSentences.push(sentence);
							}
							
							nodeSentences = [...new Set(nodeSentences)];
							
							influenceData.explanation = nodeSentences.join('\n');
						
							sentences.push(...nodeSentences);
						}
						
						// After processing all nonActiveNodes, remove duplicates from the global sentences array.
						sentences = [...new Set(sentences)];						
						
						// If there are multiple sentences, we generate an overall summary sentence.
						if (sentences.length > 1) {
							let overallContribution = mapInfluencePercentageToScale(totalInfluencePercentage);
							const overallDescription = Contribute_DESCRIPTIONS[overallContribution.toString()];
							let node = netWithAllEvidence.node(targetNodeName);
							let state = node.states();
							let stateNames = node._stateNames;
							const targetNodeAttribute = stateNames[targetStateIndex];
						
							let start = '<span style="font-size:18px; font-weight:900">Summary: what all the findings contribute</span><br>';
							let overallSentence = `
							${start} <br><span style="font-weight:900; font-size:18px;">All findings</span> 
									combined
									<span style="font-size:18px; text-decoration: underline; font-style: italic;">${overallDescription}</span> 
									the probability that 
									<span style="font-weight:900; font-size:18px;">${targetNodeName}</span> 
									is 
									<span style="font-style: italic; font-size:18px;">${targetNodeAttribute}.</span><br>
								`;
						
							let explanation = `${overallSentence}<br>The <span style="text-decoration:underline">contribution</span> of each finding is:`;
							bn.influences['overall'] = {
								explanation: explanation
							};
						}
						

						// calculate arc importances
						let arcs = []
						// reset network
						net = new Net(bnKey);
						net.nodes().forEach(child => {
							let childname = child.name();
							child.parents().forEach(parent => {
								let parentname = parent.name();
								
								let netWithnewCPT = new Net(bnKey);
								let newcpt = marginalizeParentArc(child, parent, true);
								
								let newchild = netWithnewCPT.node(childname);
								let removeparentnode = netWithnewCPT.node(parentname);
								newchild.removeParents([removeparentnode]);
								newchild.cpt(newcpt);
								
								for (let [nodeName,stateI] of Object.entries(evidence)) {
									netWithnewCPT.node(nodeName).finding(Number(stateI));
								}

								netWithnewCPT.update();

								let entry = {
									child:childname,
									parent:parentname,
									targetBelief:{}
									
								}
								Object.keys(selectedStates).forEach(targetNodeName => {
									entry.targetBelief[targetNodeName] = netWithnewCPT.node(targetNodeName).beliefs()
								})
								
								arcs.push(entry)								
							})
						})						
						bn.arcInfluence = arcs;
						console.log('bn.activePaths:', bn.activePaths)
						// console.log('bn:', bn)

						return bn;
					}
				} else {
					if (req.query.evidence) {
						let evidence = JSON.parse(req.query.evidence);
						for (let [nodeName,stateI] of Object.entries(evidence)) {
							console.log(nodeName, stateI);
							net.node(nodeName).finding(Number(stateI));
							origNet.node(nodeName).finding(Number(stateI));
						}
					}
					
					let selectedStates = null;
					if (req.query.selectedStates) {
						selectedStates = JSON.parse(req.query.selectedStates);
					}
					console.log({selectedStates});
					
					/// Update selected states if there are joint causes
					console.log({roles});
					let hasSelStates = false;
					for (let k in selectedStates) { hasSelStates = true; break; }
					if (roles && roles.cause && roles.cause.length > 1 && hasSelStates) {
						let jointSelStates = ['s'];
						for (let cause of roles.cause) {
							let newJointSelStates = [];
							let selCauseStates = cause in selectedStates ? selectedStates[cause] : net.node(cause).states().map(s => s.stateNum);
							for (let selCauseState of selCauseStates) {
								for (let i=0; i<jointSelStates.length; i++) {
									let s = jointSelStates[i]=='s' ? '' : '_';
									newJointSelStates.push(jointSelStates[i] + s + selCauseState);
								}
							}
							jointSelStates = newJointSelStates;
						}
						//let newSelectedStates = {[calculateOpts.jointCause]: jointSelStates};
						//console.log({newSelectedStates});
						//selectedStates = newSelectedStates;
						selectedStates[calculateOpts.jointCause] = jointSelStates;
						/// Remove other selectedStates for causes, to avoid issues
						for (let cause of roles.cause) {
							delete selectedStates[cause];
						}
						console.log('states:', net.node(calculateOpts.jointCause).stateNames());
						console.log('selected of these states:', jointSelStates);
					}
					
					console.time('update');
					net.update();
					origNet.update();
					console.timeEnd('update');
					
					let measureResults = {};
					for (let measure of measures) {
						measureResults[measure] = measurePlugins[measure].calculate({
							interventionNet: net,
							originalNet: origNet,
						}, roles, selectedStates, calculateOpts);
					}
					bn.measureResults = measureResults;
					console.log('Done calculations');
				}


				if (req.query.returnType == 'beliefs') {
					console.log('Getting beliefs');
					bn.model = net.nodes().map(n => ({name: n.name(), beliefs: n.beliefs()}));
					console.log('Done beliefs');
				}
				else if (req.query.returnType == 'ciTable') {
					console.log('Creating CI Table');
					let roles2 = {...roles};
					let allResults = []
					/// Reset specified cause to its original CPT
					/// Actually, the CI table will reflect what's entered into the graph now
					/*if (roles2.cause && roles2.cause[0]) {
						let causeName = roles2.cause[0];
						net.node(causeName).cpt1d(origNet.node(causeName).cpt1d().slice());
					}*/
					for (let node of net.nodes()) {
						/** NOTE: IT MAY BE THE CASE that GeNIe doesn't like having its CPT changed from
						under it, when there's evidence already in the net. (But I'm not sure; it was producing funny,
						temperamental results that looked like it wasn't "seeing" the new CPT.) SO ALWAYS: retract findings,
						then set CPTs, then add back any findings. Alternatively, set/clear evidence on one node seems to
						be enough. **/
						/// Skip the added node
						if (node.name() == calculateOpts.jointCause)  continue;
						//node = net.node('either');
						//onsole.time('findings');
						let findings = net.findings();
						//onsole.timeLog('findings');
						net.retractFindings();
						//onsole.timeLog('findings');
						let causeName = node.name();
						roles2.cause = [causeName];
						//onsole.timeLog('findings');
						let cptLength = node.cpt1d().length;
						let numStates = node.states().length;
						//onsole.timeLog('findings');
						////onsole.log("CPT 1:", node.cpt1d());
						let uniformCpt = new Array(cptLength);
						//onsole.timeLog('findings');
						uniformCpt.fill(1/numStates);
						//onsole.timeLog('findings');
						node.cpt1d(uniformCpt);
						//node.cpt1d(Array.from({length: cptLength}, _=> 1/numStates));
						//net.update(true);
						////onsole.log("CPT 2:", node.cpt1d());
						net.findings(findings);
						//onsole.log(node.name(), findings);
						//onsole.timeEnd('findings');
						
						allResults.push( {cause: causeName, ...measurePlugins.ci.calculate({interventionNet:net}, roles2, selectedStates)} );

						node.cpt1d(origNet.node(causeName).cpt1d().slice());
					}
					let effect = roles?.effect?.[0];
					let miTable = origNet.mi(origNet.node(effect), {
						targetStates: selectedStates[effect],
					});
					for (let row of miTable) {
						let matchingRow = allResults.find(row2 => row2.cause == row[0]);
						if (matchingRow)  matchingRow.mi = row[1];
					}
					bn.ciTable = allResults;
					console.log('Done CI Table');
				}
				
				else {
					console.log('Returning BN info');
					//console.log('HI2');
					net.nodes();
					//console.log('Hi$');
					let p = x => (console.log(x),x);
					bn.model = 
						net.nodes().map(node => ({
							type: 'node',
							name: p(node.name()),
							pos: node.position(),
							size: node.size(),
							parents: node.parents().map(p => p.name()),
							states: node.states().map(s => s.name()),
							beliefs: node.beliefs(),
							//beliefs: [],
						}));
					//console.log('HI3');
					console.log('Done BN info');
				}

				for (let [nodeName,cpt] of Object.entries(backupCpts)) {
					//console.log(cpt);
					net.node(nodeName).cpt1d(cpt);
				}
				
				/*bn.model = [
					{type: 'node', name: 'Visit to Asia', pos: [10,10]},
					{type: 'node', name: 'Tuberculosis', pos: [10,100], parents: ['Visit to Asia']},
				];*/
				
				bn.scenarios = [];
				if (userInfo) {
					/** Load the BN scenarios if available **/
					bn.scenarios = await db.all('select id, name, evidence, roles, selectedStates from scenarios where userId = ? and bnId = ?', userInfo.userId, req.query.id);
					/// Fix jsons
					for (let scenario of bn.scenarios) {
						scenario.evidence = JSON.parse(scenario.evidence);
						scenario.roles = JSON.parse(scenario.roles);
						scenario.selectedStates = JSON.parse(scenario.selectedStates);
					}
				}
				else {
					bn.scenariosEnabled = false;
				}
				
				return bn;
			}
			finally {
				if (net)  net.close();
				if (origNet)  origNet.close();
			}
		}
	},
}
