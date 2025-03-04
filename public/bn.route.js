var {n, toHtml} = require('htm');
var {sitePath, ...siteUtils} = require('siteUtils');
var {Net, Node} = require('../bni_smile');
var {addJointChild, marginalizeParentArc} = require('./_/js/utils');
var {buildUndirectedGraph, findAllPaths, filterActivePaths, classifyPaths, activePathWithRelationships} = require('./_/js/nodepath');
var fs = require('fs');
var {findAllColliders, analyzeColliders} = require("./_/js/verbals")

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
				// n('button.savesnapshot', 'Save Snapshot'),
				n('button.downloadsvg', 'Download As SVG'),
				// n('button.downloadbase64', 'Download As Base64'),
				// n('label', 
				// 	'Scale Image',
				// 	n('select.scaleimage', 
				// 		n('option', "1x", {value:1}),
				// 		n('option', "2x", {value:2}),
				// 		n('option', "3x", {value:3}),
				// 	),
				// 	),
				// n('button.save', 'Save to My Library'),
					
				n('label', 
					'Influence Frame',
					n('input.influence-as-frame', {type:"checkbox"})
				),
				n('label', 
					'Only Show Target Node',
					n('input.influence-target-node', {type:"checkbox"})
				),
				n('button.frozen-mode', 'Frozen Mode'),
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
			n('div', {class: 'bigContainer'},
			
				n('div.bnView',
					
				),
				n('div.influenceContainer',
					{id:"verbalBox", class: 'influenceContainer'},
					n('p', 'Summary: What all the findings contribute', {class: 'verbalTitle'}),
					n('p', { class: 'introSentence'}),
					n('p', { class: 'influenceList'}),
					n('p', { class: 'overallSentence'})
				),
			),

			n('div.infoWindows',
				n("div", {class:"evidence-scale"}, 
					n("div", {class:"evidence-scale-header"}, "Contribution Scale"),
					// n("div", "Colour scale showing the influence of evidence on the target."),
					n("table", {class:"influencelegend"} ,
						n("tr", n("td", "greatly increases (31-100%)", {class:`influence-idx0`})),
						n("tr", n("td", "moderately increases (16-30%)", {class:`influence-idx1`})),
						n("tr", n("td", "slightly increases (1-15%)", {class:`influence-idx2`})),
						n("tr", n("td", "doesn't changes (0%)", {class:`influence-idx3`})),
						n("tr", n("td", "slightly reduces (1-15%)", {class:`influence-idx4`})),
						n("tr", n("td", "moderately reduces (16-30%)", {class:`influence-idx5`})),
						n("tr", n("td", "greatly reduces (31-100%)", {class:`influence-idx6`})),
					),
					n("div", {style:"text-align:center; padding:3px;"}, "probability of"),
					n("div", n("div", {class:"target"}, "target state"))
				),
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
				
			),
		);
		this.titleEl = this.root.querySelector('.title');
		this.bnView = this.root.querySelector('.bnView');
	}
	
	toHtml() { return this.root.outerHTML; }

	$handleUpdate(m) {
		let barMax = 100; //px		
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
			// console.log('m.model:', m.model)
			
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

								// This show the checkbox
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
			// console.log('m.nodeBeliefs:', m.nodeBeliefs)
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
			// console.log("updating influences");
			let listTargetNodes = {}			
			let entries = Object.entries(m.influences)
			// console.log('m.influences', m.influences)					
			
			let verbalBox = this.root.querySelector('.influenceContainer');
			if (verbal){
				verbalBox.style.opacity = 1;
				verbalBox.style.display = 'inline-block';
			}
			let verbalIntroSentence = this.root.querySelector('.introSentence');
			let verbalListDisplay = this.root.querySelector('.influenceList');
			let displayDetail = false;
			let verbalTitle = this.root.querySelector('.verbalTitle');
			let verbalOverallSentence = this.root.querySelector('.overallSentence');
			let globalTargetNodeName = '';
			let globalTargetNodeState = '';			
			
			// console.log('entries.length:', entries.length)
			if (entries.length == 0) {
				verbalListDisplay.innerHTML = '';
				verbalIntroSentence.innerHTML = '';
				verbalBox.style.display = 'none';
				globalTargetNodeName = '';
				globalTargetNodeState = '';
				
				verbalOverallSentence.innerHTML = '';
				displayDetail = false;

				reset(m.arcInfluence, bn, this.bnView);

			} else {						
				// console.log('entries:', entries)
				verbalListDisplay.innerHTML = '';				
				let arcsContribution = [];
				let numsEntries = entries.length;		
				let evidenceContributions = {}		
				entries.forEach(([evidenceNodeName, value]) => {
					verbalIntroSentence.innerHTML = '';
					if (evidenceNodeName == 'overall') return;		
					// console.log('this.bnView:', this.bnView)		

					// Activate Evidence - Flash Node - Shining Node
					// console.log('displayDetail:', displayDetail)
					let focusEvidence = this.bnView.querySelector('div.node.focusEvidence')			
					// console.log('focusEvidence:', focusEvidence)	
					
					// console.log('-----focuse Evidence----- :',focusEvidence)
					let focusEvidenceName = ''
					let focusEvidenceState = ''
					if (focusEvidence && !displayDetail) {
						focusEvidenceName = focusEvidence.getAttribute('data-name')
						let focusEvidenceNode = this.bnView.querySelector(`div.node[data-name="${focusEvidenceName}"]`);
						let focusEvidenceIndex = m.nodeBeliefs[focusEvidenceName]?.indexOf(1);
						let focusEvidenceStateElem = focusEvidenceNode?.querySelector(`.state[data-index="${focusEvidenceIndex}"] .label`);
						focusEvidenceState = focusEvidenceStateElem ? focusEvidenceStateElem.textContent : "Unknown";

						displayDetail = true;
						verbalTitle.innerHTML = '';
						let { evidenceTense } = inferTenseFromArcInfluence(m.arcInfluence, focusEvidenceName, "Dermascare");
						verbalTitle.appendChild(n('p', `Detail: How finding out ${focusEvidenceName} ${evidenceTense} `, 
							n('span', `${focusEvidenceState}`, {style: 'font-style: italic'}), ' contributes'));
						
					}
					else if (focusEvidence === null){
						verbalTitle.innerHTML = ''; 
						verbalTitle.appendChild(
							n(
								'p', 
								'Summary: What all the findings contribute'
							)
						);
					}

					let targetBeliefs = value['targetBeliefs'];
					let evidenceNode = this.bnView.querySelector(`div.node[data-name=${evidenceNodeName}]`)	
					// console.log('evidenceNode:', evidenceNode)
							
					// console.log('evidenceNode:', evidenceNode)									
					// evidenceNodeLabels.add(evidenceNode.getAttribute('data-name'))

					let evidenceStateIdx = m.nodeBeliefs[evidenceNodeName].indexOf(1);
					Object.entries(targetBeliefs).forEach(([targetNodeName, beliefs]) => {	
												
						let targetNode = this.bnView.querySelector(`div.node[data-name=${targetNodeName}]`)																		
						let targetStateElem = targetNode.querySelector(".state.istarget");
						let targetStateIdx = targetStateElem.dataset.index;
						

						let targetBaseModel = m.origModel.find(item => item.name == targetNodeName)
						listTargetNodes[targetNodeName] = {targetStateElem: targetStateElem, index: targetStateIdx, model: targetBaseModel}
						
						// calculate the relative change this evidence had on the target
						// and set the change color accordingly

						let targetStateColor = getTargetStateColor(
							targetBaseModel.beliefs[targetStateIdx], 
							m.nodeBeliefs[targetNodeName][targetStateIdx]
						);

						// console.log('targetStateColor:', targetStateColor)

						// let relativeBeliefChange = (m.nodeBeliefs[targetNodeName][targetStateIdx] - beliefs[targetStateIdx]) / m.nodeBeliefs[targetNodeName][targetStateIdx];						
						let relativeBeliefChange = m.nodeBeliefs[targetNodeName][targetStateIdx] - beliefs[targetStateIdx];
						let absChange = Math.abs(relativeBeliefChange * 100);
						let stateElem = evidenceNode.querySelector(`div.state[data-index="${evidenceStateIdx}"]`);
						let stateName = stateElem.querySelector('.label').textContent;	
						
						let targetStateName = targetStateElem.querySelector('.label').textContent;
						globalTargetNodeName = targetNodeName;
						globalTargetNodeState = targetStateName;
						
						let barchangeElem = stateElem.querySelector(`span.barchange`);
						let cellProbabilityElem = stateElem.querySelector(`.cellProbability`);
						let colorClass = getColor(relativeBeliefChange);

						evidenceContributions[evidenceNodeName] = {
							contribution: absChange,
							color: colorClass,
						}

						let findingOutSentence = buildFindingOutSentence(numsEntries, evidenceNodeName, stateName, colorClass, targetNodeName, targetStateName ,displayDetail, bn.arcInfluence, bn.activePaths);
						// let outputSentence = (displayDetail && (numsEntries == 1)) ? findingOutSentence + ', by direct connection.' : findingOutSentence;
						// console.log('outputSentence:', )
						// console.log('findingOutSentence:', findingOutSentence)
						if (!displayDetail) {
							verbalListDisplay.appendChild(findingOutSentence)
							
							if (numsEntries >= 2) {
								verbalIntroSentence.appendChild(buildSummarySentence(numsEntries, evidenceNodeName, targetStateColor, targetNodeName, targetStateName, bn.arcInfluence));
							}
						}			

						// console.log('colorClass:', colorClass)						
						// set colour and width of the barchange element of finding

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
					// console.log('listTargetNodes:', listTargetNodes)					
					// console.log('m.origModel:', m.origModel)
				
					// Build up the arcs for the influence for verbal part					
					if (m.arcInfluence && m.activePaths && m.classifiedPaths) {												
						let onlyFirstOrder = false;
						let activeNodes  = extractActiveNodes(m.classifiedPaths, onlyFirstOrder);		
					
						const sortedArcInfluence = sortArcInfluenceByDiff(
							m.arcInfluence,
							m.nodeBeliefs,													
							evidenceNodeName
						);																									

						sortedArcInfluence.forEach((arcEntry) => {
							let parentNodeState = getNodeState(arcEntry.parent, globalTargetNodeName, globalTargetNodeState, m, this.bnView);
							let childNodeState = getNodeState(arcEntry.child, globalTargetNodeName, globalTargetNodeState, m, this.bnView);
					
							if (activeNodes.has(arcEntry.child) && activeNodes.has(arcEntry.parent)) {
									arcsContribution.push({
											from: arcEntry.parent,
											fromState: parentNodeState,
											to: arcEntry.child,
											toState: childNodeState,
											color: arcEntry.color,
									});
							}
						});						
					}
				})

				// color target bar every time a new evidence is added
				colorTargetBar(listTargetNodes, m)		

				// Generate detailed explaination for the focus node
				if (m.classifiedPaths && displayDetail) {					
					generateDetailedExplanations(m.activePaths, arcsContribution, m.colliders, verbalListDisplay, bn.arcInfluence, m.focusEvidence);					
					// Animation when new focus node is added
					if (window.animation) {																
						reset(m.arcInfluence, bn, this.bnView);
						resetTargetBar(listTargetNodes)
						
						const activeNodes = extractActiveNodes(m.classifiedPaths);	
						fadeNodes(activeNodes, this.bnView);	
						fadeAllArrows(activeNodes, m.arcInfluence)
											
						let animationOrderBN = generateAnimationOrder(m.classifiedPaths);									
						const arcColorDict = getArcColors(m.arcInfluence, m.nodeBeliefs)																										
						
						for (let index = 0; index < animationOrderBN.length; index++) {
							setTimeout(() => {
								const path = animationOrderBN[index];
								if (path.type == 'arrow') {
									const { arcParent, arcChildren } = getArcEndpoints(path);							
									const color = arcColorDict[`${arcParent}, ${arcChildren}`];												
									colorArrows(arcParent, arcChildren, path.direction, color);	
									
								} else if (path.type == 'node') {
									let nextPath = animationOrderBN[index + 1];
									// temporary solution
									colorNodeByColorArrow(path.name, nextPath, arcColorDict, m);				

								} else if (path.type == 'target') {
									colorTargetBarByFocusEvidence(evidenceContributions, m.focusEvidence, listTargetNodes);
								}
							}, (index + 1) * 850); // start index at 1 so the flashing go first
						}
					} 
				}	else {				
					// Summary mode	
					displayAllNodes(this.bnView)
					displayAllArrows(m.arcInfluence)
					uncolorAllArrows(m.arcInfluence)
				}								
			}					
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

		const isLimitedMode = req.query.limitedMode === 'true';

		if (isLimitedMode) {
			console.log("Limited mode is enabled on the server side.");
		}
	
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
						
					}
					// console.log('req.query:--------', req.query)

					// Initialize 'selectedStates' variable
					let selectedStates = {};
					if (req.query.selectedStates) {
						selectedStates = JSON.parse(req.query.selectedStates);
						// console.log('selectedStates:', selectedStates)
					}
				

					// set all evidence
					for (let [nodeName, stateI] of Object.entries(evidence)) {
						net.node(nodeName).finding(Number(stateI));
					}					
					net.update();

					// console.log('Object.keys(selectedStates):', Object.keys(selectedStates))

					let baselineBeliefs = {};
					// Object.keys(selectedStates).forEach(targetNodeName => {
					// 	baselineBeliefs[targetNodeName] = net.node(targetNodeName).beliefs();						
					// });
					var targetNodeName = Object.keys(selectedStates)[0];
					baselineBeliefs[targetNodeName] = net.node(targetNodeName).beliefs();												

					let relationships = [];		
					// console.log('net.nodes():', net.nodes())			

					net.nodes().forEach(node => {
						// Get all parents of the node
						node.parents().forEach(parent => {										
					
							// Add the relationship to the list
							relationships.push({
								from: parent.name(),
								to: node.name(),
								// contribute: contribute
							});
						});
					});

					// console.log("relationships",relationships)					

					const graph = buildUndirectedGraph(relationships);

					// Edge map for contribute values
					const edgeMap = {};
					relationships.forEach(rel => {
						const edgeKey = `${rel.from}->${rel.to}`;
						edgeMap[edgeKey] = rel.contribute;
					});
					

					if (req.query.evidence) {
						let evidence = JSON.parse(req.query.evidence);
						// console.log('evidence:', evidence)

						let focusEvidence = null

						if (req.query.focusEvidence) {
							focusEvidence = req.query.focusEvidence;		
							// console.log('focusEvidence:', focusEvidence)					
						}

						// the selected state is our Target
						
						if (req.query.selectedStates) {
							selectedStates = JSON.parse(req.query.selectedStates);
						}

						// get network with all evidence 
						for (let [nodeName,stateI] of Object.entries(evidence)) {
							console.log('nodeName, stateI:', nodeName, stateI);
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
						bn.colliders = {};
						// bn.colliderDiff = {};


						const colliders = findAllColliders(relationships);
						bn.colliders = colliders;
						// console.log('Collider:', bn.colliders);


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

						let pathWithRelationship = []

						// Finding the colliders and printing them
						// const colliderDiff = analyzeColliders(
						// 	net,
						// 	relationships,
						// 	evidence,
						// 	targetNodeName,
						// 	targetStateIndex,
						// 	bnKey
						// );
				
						// console.log("Detected Colliders and Differences:", collider);
						// bn.colliderDiff = colliderDiff;

						for (let evidenceNodeName of Object.keys(evidence)) {
							// Initialize a temporary array to store the sentences generated for this specific nonActiveNode.
							// let nodeSentences = [];
						
							// Create a new network instance to represent the scenario where we remove one piece of evidence.
							let netWithoutOneEvidence = new Net(bnKey);
							netWithoutOneEvidence.compile();					
						
							// Set all evidence except the one corresponding to the current evidenceNodeName.
							for (let [nodeName, stateI] of Object.entries(evidence)) {
								if (nodeName != evidenceNodeName) {
									netWithoutOneEvidence.node(nodeName).finding(Number(stateI));
								}
							}
						
							// Update the network to propagate the changes in evidence and compute new beliefs.
							netWithoutOneEvidence.update();
						
							bn.influences[evidenceNodeName] = { targetBeliefs: {} };
							let influenceData = bn.influences[evidenceNodeName];
							// console.log('influenceData:', influenceData)
							
							let newBelief = netWithoutOneEvidence.node(targetNodeName).beliefs();
							influenceData.targetBeliefs[targetNodeName] = newBelief;
						
							// Find all paths between the current nonActiveNode and the target node in the network.
							let allPaths = findAllPaths(graph, evidenceNodeName, targetNodeName);	
						
							// For each filtered path, generate a sentence describing how the current nonActiveNode influences the target.
							for (const path of allPaths) {
								bn.activePaths.push(path)				
								let pathRel = activePathWithRelationships(path, relationships)															
								pathWithRelationship.push(pathRel)																					
							}							

							if (focusEvidence !== 'null'){
								console.log('pathWithRelationship:', pathWithRelationship)	
								// console.log('allPaths:', allPaths)	
								// console.log('bn.activePaths:', bn.activePaths)
								// console.log('focusEvidence:', focusEvidence)
								// console.log('targetNodeName:', targetNodeName)								
								let classifiedPaths = classifyPaths(pathWithRelationship, focusEvidence, targetNodeName)
								bn.classifiedPaths = classifiedPaths
								const {firstOrderPaths, secondOrderPaths} = classifiedPaths
								console.log('firstOrderPaths:', firstOrderPaths)
								console.log('secondOrderPaths:', secondOrderPaths)
							}							
						}					
						// console.log('evidence:', evidence)
						// console.log('evidence.getT:', evidence['T'])				
						
						// console.log('pathWithRelationship:', pathWithRelationship)
						// classifyPaths(pathWithRelationship, evidence, focusEvidence, targetNodeName)

						// pathWithRelationship.forEach((path) => {
						// 	console.log('---------------------------')	
						// 	for (let [node, type] of path) {															
						// 		console.log('node:', node, 'type:', type)								
						// 	}
						// })

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
						// console.log('bn.activePaths:', bn.activePaths)
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