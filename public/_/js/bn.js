var refs = {};

var bn = {
	guiEnabled: true,
	nodes: {},
	evidence: {},
	/// For now, only 1 node can be in a given role, and only 1 state of the node be selected
	roles: {},
	selectedStates: {},
	beliefs: {},
	activePaths: {},
	colliders: {},
	// colliderDiff: {},
	ciTableEnabled: false,
	focusEvidence: null,
	dragFunc: true,
	showMenu: null,
	verbal: null,
	detail: false,
	classifiedPaths: null,
	currentDetailNode: null,
	
	drawArcs() {
		let bnView = document.querySelector('.bnView');
		for (let node of bn.model) {
			for (let parentName of node.parents) {
				let from = document.querySelector(`.node[data-name=${parentName}]`);
				let to = document.querySelector(`.node[data-name=${node.name}]`);
				//debugger;
				draw.drawArrowBetweenEls(bnView, from, to, {parent: parentName, child: node.name});
			}
		}
	},
	getNode(nodeName) {
		if (!(nodeName in this.nodes)) {
			this.nodes[nodeName] = new Node(this, nodeName);
		}

		return this.nodes[nodeName];
	},
	gui(method, ...args) {
		if (this.guiEnabled) {
			this['gui'+method](...args);
		}
	},
	initialize() {
		const urlParams = new URLSearchParams(window.location.search);
		this.limitedMode = urlParams.get('limitedMode') === 'true';
		this.menuDisplay = urlParams.get('showMenu') === 'false';
		this.verbalMode = urlParams.get('verbal') === 'false';
		this.animationMode = urlParams.get('animation') === 'false';
		// limited mode
		if (this.limitedMode) {
				this.enableLimitedMode(); 
		}
		else{
				this.disableLimitedMode(); 
		}
		// menu Dispaly
		if (this.menuDisplay) {
			showMenu = false
			console.log("Menu disbaled");
		}
		else{
			console.log("Menu abled");
			showMenu = true
		}
	
		// verbal mode
		if (this.verbalMode) {
			verbal = false
			console.log("Verbal mode disabled");

		}
		else{
			console.log("Verbal mode enabled");
			verbal = true
		}

		// animaton mode
		if (this.animationMode) {
			window.animation = false
			console.log("Animation mode disbaled");
		}
		else{
			console.log("Animation mode enabaled");
			window.animation = true
		}

    },

	enableLimitedMode() {
		console.log("Limited mode");
		dragFunc = false
	},
	disableLimitedMode() {
		console.log("Func mode");
		dragFunc = true
	},

	
	async update(evidence = {}) {
		// console.log('-----------bn.js evidence:', evidence);
		// console.log('-----------Object.entries():', Object.entries());
		for (let [k,v] of Object.entries(evidence)) {
			if (v === null) {
				delete this.evidence[k];
			}
			else {
				this.evidence[k] = v;
			}
		}
		/// We can run this in parallel
		/// er, not quite yet...
		await (async _=>{
			let reqData;

			if (this.calculateTargetChange) {										
				reqData = await (await fetch(window.location.href + '&requestType=data&returnType=targetInfluence&evidence='+JSON.stringify(this.evidence)+'&roles='+JSON.stringify(this.roles)+'&selectedStates='+JSON.stringify(this.selectedStates)+'&focusEvidence='+this.focusEvidence)).json();				
			}
			else
				reqData = await (await fetch(window.location.href + '&requestType=data&returnType=beliefs&evidence='+JSON.stringify(this.evidence)+'&roles='+JSON.stringify(this.roles)+'&selectedStates='+JSON.stringify(this.selectedStates))).json();
			//let nodeBeliefs = {};
			// console.log('reqData:', reqData)
			if (reqData.model) {
				for (let node of reqData.model) {
					this.beliefs[node.name] = node.beliefs;
				}
				this.measureResults = reqData.measureResults;
				if (reqData.influences) {
					this.influences = reqData.influences;
					this.arcInfluence = reqData.arcInfluence;
					this.colliders = reqData.colliders;
					// this.colliderDiff = reqData.colliderDiff;
					this.activePaths = reqData.activePaths;
					this.classifiedPaths = reqData.classifiedPaths;					
				} else {
					this.influences = {};
				}
				this.gui('Update');
			}
		})();
		this.guiUpdateInfoWindows();
	},
	
	async guiUpdate() {
		bnDetail.$handleUpdate({nodeBeliefs: this.beliefs, influences: this.influences, arcInfluence: this.arcInfluence, origModel:this.model, activePaths: this.activePaths, colliders: this.colliders, classifiedPaths: this.classifiedPaths, focusEvidence: this.focusEvidence, selectedStates: this.selectedStates});
	},

	guiUpdateInfoWindows() {
		q('div.infoWindow')?.remove();
		this.ciTableEnabled = !!this.roles?.effect?.length;
		if (!this.ciTableEnabled)  q('div.ciTableWindow')?.remove();
		// console.log(this.roles?.cause?.length, this.roles?.effect?.length);
		if (this.roles?.cause?.length && this.roles?.effect?.length) {
			let causes = this.roles.cause;
			let causeStates = causes.map(cause => this.selectedStates[cause] && this.getNode(cause).model.states[this.selectedStates[cause]]);
			let effect = this.roles.effect[0];
			let effectState = this.selectedStates[effect] && this.getNode(effect).model.states[this.selectedStates[effect]];
			q('.infoWindows .tip').after(n('div.infoWindow',
				n('h2', 'Measures'),
				n('div.info.infoContent',
					n('div.field',
						n('label', `Cause${causes.length>1 ? 's' : ''}:`),
						n('span.causes',
							causes.map((cause,i) => n('span.cause', cause, causeStates[i] ? `=${causeStates[i]}` : '')),
						),
					),
					n('div.field',
						n('label', 'Effect:'),
						n('span.effect', effect, effectState ? `=${effectState}` : ''),
					),
					Object.values(this.measureResults).map(measure => n('div.field', {title: measure.tooltip},
						n('label', measure.title+':'),
						n('span.value', isNaN(measure.value) ? measure.value : Math.round(measure.value*10000)/10000,
							measure.percent ? n('span.percent', ' (', Math.round(measure.percent*1000)/10, '%)') : '',
							measure.extraInfo ? n('span.extraInfo', measure.extraInfo) : ''),
					)),
				),
			));
		}
		else {
			
		}
		
		if (this.roles?.effect?.length && !q('.ciTableWindow')) {
			q('.infoWindows').append(
				n('div.ciTableWindow',
					/*n('div.showTable',
						n('button.showCiTable', 'Show CI Table', {on: {click: event => {
							if (event.target.textContent == 'Show CI Table') {
								this.ciTableEnabled = true;
								this.showCiTable();
								event.target.textContent = 'Hide CI Table';
							}
							else {
								this.ciTableEnabled = false;
								this.hideCiTable();
								event.target.textContent = 'Show CI Table';
							}
						}}}),
					),*/
					n('h2', 'Causal Information Table'),
					n('div.ciTable.infoContent'),
				)
			);
		}
		
		if (this.ciTableEnabled) {
			this.showCiTable();
		}
		else {
			this.hideCiTable();
		}
	},
	
	async showCiTable() {
		q('.ciTable').append(n('div.loadingTable', 'Loading table...'));
		let reqData = await (await fetch(window.location.href + '&requestType=data&returnType=ciTable&evidence='+JSON.stringify(this.evidence)+'&roles='+JSON.stringify(this.roles)+'&selectedStates='+JSON.stringify(this.selectedStates))).json();
		q('.ciTable table')?.remove();
		q('.ciTable .loadingTable')?.remove();
		let table = n('table', n('tr', ['Variable', 'MI', 'CI', '%'].map(s => n('th', s))));
		for (let row of reqData.ciTable) {
			let rowClass = (this.roles?.cause ?? []).includes(row.cause) ? 'cause' :
				row.cause == this.roles?.effect ? 'effect': '';
			let roundedPercent = Math.round(row.percent*1000)/10;
			table.append(n('tr', {class: rowClass},
				n('td', row.cause),
				n('td', Math.round(row.mi*10000)/10000),
				n('td', Math.round(row.value*10000)/10000),
				n('td.percentBar', {style: `--percent-bar: ${row.percent*100}%`}, roundedPercent),
			));
			let nodeEl = q(`.node[data-name="${row.cause}"]`);
			nodeEl.style.setProperty('--strength', ((100 - row.percent*100)/2 + 50) + '%');
			nodeEl.classList.add('filled');
			nodeEl.querySelector('div.strength')?.remove();
			nodeEl.append(n('div.strength', roundedPercent+'%'));
		}
		q('.ciTable').append(table);
	},
	
	hideCiTable() {
		qa('.filled').forEach(n => {
			n.classList.remove('filled');
			n.querySelector('div.strength')?.remove();
		});
		q('div.ciTable table')?.remove();
	},
};

/// Get node from el
refs.Node = function(el) {
	let nodeName = el.closest('.node').dataset.name;
	return bn.getNode(nodeName);
}

class Node {
	constructor(bn, nodeName) {
		this.bn = bn;
		this.nodeName = nodeName;
		this.role = null;
		this.guiEnabled = true;
		this.model = bn.model.find(n => n.name == nodeName);
	}
	
	el() {
		return q(`.node[data-name="${this.nodeName}"]`).raw;
	}
	gui(method, ...args) {
		if (this.guiEnabled) {
			this['gui'+method](...args);
		}
	}
	
	setRole(role) {
		if (role == this.role)  return;
		
		/// Make sure any other node with this role is cleared, and their selected states cleared
		/// Just for effects now. Causes can conjoin.
		if (role != 'cause' && this.bn.roles[role]) {
			this.bn.roles[role].forEach(nodeName => this.bn.nodes[nodeName].setRole(null));
		}
		
		/// Delete current role if present
		if (this.role) {
			let i = this.bn.roles[this.role].indexOf(this.nodeName);
			if (i > -1)  this.bn.roles[this.role].splice(i, 1);
			delete this.bn.selectedStates[this.nodeName];
		}
		
		this.role = role;
		if (role) {
			if (!this.bn.roles[role])  this.bn.roles[role] = [];
			this.bn.roles[role].push(this.nodeName);
		}
		this.gui('SetRole');
	}
	guiSetRole() {
		let removedCause = this.el().dataset.role == 'cause' && this.role != 'cause';
		if (this.role) {
			this.el().dataset.role = this.role;
		}
		else {
			//onsole.log(this.el().dataset.role);
			delete this.el().dataset.role;
		}
		/// Update selected states
		let selStates = this.bn.selectedStates[this.nodeName] || [];
		this.el().querySelectorAll('.target input').forEach((inp,i) => inp.checked = selStates.includes(i));		
	
		Node.reset();  // **调用 reset() 方法**his.bn.gui('UpdateInfoWindows');
		/// Update view
		this.el().querySelectorAll('.setCause, .setEffect').forEach(e => e.classList.remove('on'));
		if (this.role) {
			this.el().querySelector(`.set${this.role.replace(/./, s=>s.toUpperCase())}`).classList.toggle('on');
		}
		
		if (this.role == 'cause' || removedCause) {
			/// Since arcs track from/to els, run through arcs to find incoming arcs
			let myEl = this.el();
			let matchedArcs = [];
			$(this.el().closest('.bnView')).find('path[data-can-redraw]').each(function() {
				var {outputEl, fromEl, toEl} = $(this).data('redraw');
				if (toEl == myEl) {
					matchedArcs.push(this);
				}
			});
			for (let arc of matchedArcs) {
				$(arc).data('opts').isBlocked = !removedCause;
			}
			/// Update with something more efficient
			draw.updateArrows(document.querySelector('.bnView'));
		}
	}
	
	setEvidence(stateIndex, o = {}) {
		let nodeName = this.nodeName;
		let evidence = {};
		let nodeEl = this.el();		
    let allStateElem = nodeEl.querySelectorAll(".state");

		allStateElem.forEach((elem) => {
			elem.style.backgroundColor = "";
		});

		nodeEl.style.boxShadow = "";

		if (nodeName in bn.evidence && bn.evidence[nodeName] == stateIndex) {
			//delete bn.evidence[nodeName];
			evidence[nodeName] = null;
			nodeEl.classList.remove('hasEvidence');
			let influenceBars = nodeEl.querySelectorAll("span.barchange");
			Array.from(influenceBars).forEach(elem => {
				elem.style.width = "0%";
			})
			let stateElem = nodeEl.querySelector(`div[data-index="${stateIndex}"]`);
			if (!stateElem.classList.contains('istarget'))
				Array.from(stateElem.querySelectorAll(":scope>span:not(.barParent)")).forEach(elem=>
					Array.from(elem.classList).forEach(classname=> {
						if (classname.indexOf("influence-idx") == 0)
							elem.classList.remove(classname);
					})
				)
		}
		else {
			//bn.evidence[nodeName] = state.dataset.index;
			evidence[nodeName] = stateIndex;
			this.el().classList.add('hasEvidence');
		}
		if (o.update)  bn.update(evidence);
	}
	
	clearEvidence(o = {}) {
		delete bn.evidence[this.nodeName];
		this.el().classList.remove('hasEvidence');
		if (o.update)  bn.update(bn.evidence);
	}
	
	/*guiSetRole already does this
	guiSelectedStates() {
		
	}*/
	
	guiPopupMenu() {
		let menu = new Menu({type:"contextMenu", items: [
			new MenuAction('Make Cause', _=>{this.setRole('cause'); this.bn.update(); menu.dismiss()}),
			new MenuAction('Make Effect', _=>{this.setRole('effect'); this.bn.update(); menu.dismiss()}),
			new MenuAction('Clear Role', _=>{this.setRole(null); this.bn.update({[this.nodeName]:null}); menu.dismiss()}),
		]});
		let {left,bottom} = this.el().querySelector('a.menu').getBoundingClientRect();
		menu.popup({left,top:bottom});
	}
	

	static flashNode(nodeElement) {
		let flashes = 2; 
		let flashDuration = 200;
		let count = flashes * 2;

		function toggleFlash() {
			if (count > 0) {
				nodeElement.style.boxShadow = count % 2 === 0 ? '0 0 12px rgba(255,0,0,0.9)' : '';
				count--;
				setTimeout(toggleFlash, flashDuration);
			} 
			else {
				nodeElement.style.boxShadow = "0px 0px 12px rgba(255,0,0,0.9)"
			}
		}
		if (window.animation) {
			toggleFlash(); 		
		}
	}

	static removeFlashNode(nodeElement) {
		nodeElement.style.boxShadow = "";
	}

	static setFocusEvidence(nodeElement, bn) {		
		nodeElement.classList.add("focusEvidence");
		bn.focusEvidence = nodeElement.dataset.name;
	}

	static removeFocusEvidence(nodeElement,bn){
		bn.focusEvidence = nodeElement.dataset.name;
		nodeElement.classList.remove("focusEvidence");
		document.querySelectorAll(".play-button").forEach(button => button.remove());

	}


	static guiSetupEvents() {
		bn.initialize();

		const controlsDiv = document.querySelector('.controls');
		const headerDiv = document.querySelector('.header')
		const verbalPart = document.querySelector('#verbalBox')


		if (!showMenu) {
			controlsDiv.style.display = 'none';
			headerDiv.style.display = 'none';
		} else {
			controlsDiv.style.display = 'block'; 
			headerDiv.style.removeProperty('display')
		}

		if (!verbal) {

			verbalPart.style.display = 'none';

		} else {
			verbalPart.style.display = 'block'; 
		}

		q(".bnView").addEventListener("click", (event) => {
			// console.log("move");
			event.stopPropagation();
			let evidenceNodeTitle = event.target.closest('.node h3');
			let focusEvidenceNode =  event.target.closest('.node');

			document.querySelectorAll(".node h3").forEach((nodeHeader) => {
				nodeHeader.addEventListener("mouseenter", () => {
					nodeHeader.style.cursor = "pointer"; 
				});

				nodeHeader.addEventListener("mouseleave", () => {
					nodeHeader.style.cursor = "default"; 
				});
			});

			if (!evidenceNodeTitle) { 
				if (!bn.isFrozen) {  
					document.querySelectorAll(".play-button").forEach(button => button.remove());
				}
				return;
			}

	
			if (evidenceNodeTitle && focusEvidenceNode.classList.contains("hasEvidence")) {  
				// console.log('evidenceNodeTitle', evidenceNodeTitle);

				if (window.animation) {
					document.querySelectorAll(".play-button").forEach(button => button.remove());
			
					const playButton = document.createElement("button");
					playButton.textContent = "▶";
					playButton.className = "play-button";
					playButton.style.position = "absolute";
			
					playButton.addEventListener("click", () => {
						// console.log("Play Button Clicked!");
						Node.flashNode(focusEvidenceNode);
						bn.update();
					});
					
					let rect = evidenceNodeTitle.getBoundingClientRect();

					playButton.style.left = `${window.scrollX + rect.left - 30}px`;
					playButton.style.top = `${window.scrollY + rect.top + rect.height / 2}px`;
					playButton.style.transform = "translateY(-50%)";
					
					document.body.appendChild(playButton);
				}				
						
				// If a different node is in detail mode, deactivate it first
				if (bn.detail && bn.currentDetailNode && bn.currentDetailNode !== focusEvidenceNode) {
					Node.removeFlashNode(bn.currentDetailNode);
					document.querySelectorAll(".play-button").forEach(button => button.remove());
					Node.removeFocusEvidence(bn.currentDetailNode, bn);
					bn.detail = false; // Reset detail mode
				}
		
				// activate detail mode for the selected node
				if (!bn.detail || bn.currentDetailNode !== focusEvidenceNode) {
						Node.flashNode(focusEvidenceNode);
						Node.setFocusEvidence(focusEvidenceNode, bn);
						bn.detail = true;
						bn.currentDetailNode = focusEvidenceNode; // Store the currently active detail node
				} else {
						// If the same node is clicked again, deactivate detail mode
						bn.detail = false;
						Node.removeFlashNode(focusEvidenceNode);
						document.querySelectorAll(".play-button").forEach(button => button.remove());
						Node.removeFocusEvidence(focusEvidenceNode, bn);
						bn.currentDetailNode = null;
				}

				bn.update();
				if (focusEvidenceNode.classList.contains("hasEvidence")) {
					document.body.appendChild(playButton);
				}
		
				const node = refs.Node(focusEvidenceNode);
				node.bn.update();                                                                 
			} else {
				if (!bn.isFrozen) {  // **Frozen Mode 下不删除 PlayButton**
					document.querySelectorAll(".play-button").forEach(button => button.remove());
				}
			}
					
			
			let menuButton = event.target.closest("a.menu");
			if (menuButton) {
				refs.Node(event.target).guiPopupMenu();
			}
			menuButton = event.target.closest("a.setCause, a.setEffect");
			if (menuButton) {
				let node = refs.Node(event.target);
				if (menuButton.matches(".on")) {
					node.setRole(null);
					/// Not sure why I was clearing evidence on this node?
					//node.bn.update({[node.nodeName]: null});
					node.bn.update();
				} else if (menuButton.matches(".setCause")) {
					node.setRole("cause");
					node.bn.update();
				} else if (menuButton.matches(".setEffect")) {
					node.setRole("effect");
					node.bn.update();
				}

				/// Arrows need updating, and since there's an animation,
				/// least visually ugly thing to do is sync it with the animation
				let arrowDraw;
				node.el().addEventListener(
					"transitionend",
					(_) => {
						cancelAnimationFrame(arrowDraw);
					},
					{ once: true }
				);
				let nextFrame = (_) => {
					draw.updateArrows(document.querySelector(".bnView"));
					arrowDraw = requestAnimationFrame(nextFrame);
				};
				nextFrame();
			}
		});

	

		document.querySelectorAll(".node").forEach((setMoveEl) => {
			setMoveEl.addEventListener("mousedown", (event) => {

				// console.log('dragfunc:',dragFunc)
				if (!dragFunc){
					console.log('Drag func disbaled')
					return
				}

				// console.log("Mousedown triggered");
				let target = event.target.closest(".node");
				// console.log('target:', target);
				

				if (target) {
					let targetNode = target.closest(".node");
					event.stopPropagation();
					event.preventDefault();
					// console.log("start dragging");
					// console.log('targetNode.classList:', targetNode.classList);

					// define init pos
					let origX = event.clientX,
						origY = event.clientY;
					let origLeft = parseFloat(targetNode.style.left),
						origTop = parseFloat(targetNode.style.top);
					let mm, mu;

					document.addEventListener(
						"mousemove",
						(mm = (event) => {
							let deltaX = event.clientX - origX,
								deltaY = event.clientY - origY;
							//onsole.log(origLeft, deltaX);
							target.style.cursor = 'grabbing';
							targetNode.style.left = origLeft + deltaX + "px";
							targetNode.style.top = origTop + deltaY + "px";
							/// Update with something more efficient
							draw.updateArrows(document.querySelector(".bnView"));
						})
					);
					document.addEventListener(
						"mouseup",
						(mu = (event) => {
							target.closest(".bnView").classList.remove("grabbing");
							/// Update with something more efficient
							draw.updateArrows(document.querySelector(".bnView"));
							document.removeEventListener("mousemove", mm);
							document.removeEventListener("mouseup", mu);

						})
					);
				}
			});
		});
	}
}

function setupScenarioEvents() {
	let scenarioBox = q('.scenario');
	let saveScenario = q('.saveScenario');
	let removeScenario = q('.removeScenario');
	let renameScenario = q('.renameScenario');
	
	scenarioBox.addEventListener('input', async event => {
		let opt = scenarioBox.options[scenarioBox.selectedIndex];
		if (opt.matches('.none')) {
			/// Clear scenario (evidence only? or roles as well?)
			//bn.update({});
			for (let node of bn.model) {
				let n = bn.getNode(node.name);
				n.clearEvidence();
				n.setRole(null);
			}
			bn.update(bn.evidence);
		}
		else {
			/// Load scenario
			let scenario = JSON.parse(opt.dataset.scenario);
			console.log(scenario);
			for (let node of bn.model) {
				let n = bn.getNode(node.name);
				n.clearEvidence();
				n.setRole(null);
				if (scenario.evidence[node.name]) {
					bn.getNode(node.name).setEvidence(scenario.evidence[node.name]);
				}
			}
			if (scenario.selectedStates) {
				bn.selectedStates = scenario.selectedStates;
			}
			if (scenario.roles)  for (let [role,nodeNames] of Object.entries(scenario.roles)) {
				for (let nodeName of nodeNames) {
					bn.getNode(nodeName).setRole(role);
				}
			}
			bn.update(scenario.evidence);
		}
	});
	saveScenario.addEventListener('click', async event => {
		let name = '';
		let sep = '';
		for (let [k,v] of Object.entries(bn.evidence)) {
			name += sep + `${k}=${v}`;
			sep = ', ';
		}
		if (!name) { name = '(No evidence)'; }
		let upd = {evidence:bn.evidence, roles:bn.roles, selectedStates: bn.selectedStates, name};
		let qs = getQs();
		let res = await fetch('/bn?updateScenario=1&requestType=data&id='+qs.id, {method:'POST', body: JSON.stringify(upd), headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		}}).then(r => r.json());
		scenarioBox.append(n('option', upd.name, {value: res.scenarioId, dataScenario: JSON.stringify(upd)}));
		scenarioBox.value = res.scenarioId;
	});
	removeScenario.addEventListener('click', event => {
		let scenarioId = event.target.closest('.controls').querySelector('.scenario').value;
		let qs = getQs();
		fetch('/bn?deleteScenario=1&requestType=data&id='+qs.id+'&scenarioId='+scenarioId, {method:'POST', headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		}});
		scenarioBox.querySelector(`[value="${scenarioId}"]`).remove();
	});
	renameScenario.addEventListener('click', event => {
		let scenarioId = event.target.closest('.controls').querySelector('.scenario').value;
		let qs = getQs();
		let opt = scenarioBox.querySelector(`[value="${scenarioId}"]`);
		let newName = prompt('New scenario name:', opt.text);
		let upd = {name: newName};
		fetch('/bn?renameScenario=1&requestType=data&id='+qs.id+'&scenarioId='+scenarioId, {method:'POST', body: JSON.stringify(upd), headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		}});
		opt.text = newName;
	});
}


document.addEventListener("DOMContentLoaded", function() {
    let influenceBox = document.querySelector(".influenceContainer"); 
    let nodes = document.querySelectorAll(".node"); 
    let windowWidth = window.innerWidth; 

    if (influenceBox && nodes.length > 0) {
        let maxRight = 0;
        let rightmostNode = null;

        nodes.forEach(node => {
            let nodeRect = node.getBoundingClientRect();
            if (nodeRect.right > maxRight) {
                maxRight = nodeRect.right;
                rightmostNode = node;
            }
        });

        if (rightmostNode) {
            let nodeRect = rightmostNode.getBoundingClientRect();


            let newLeft = nodeRect.right;

            if (newLeft + influenceBox.offsetWidth > windowWidth) {
                newLeft = windowWidth - influenceBox.offsetWidth - 20;
                console.log("⚠ Influence box hit right edge, adjusting position.");
            }

            influenceBox.style.position = "absolute";
            influenceBox.style.left = `${newLeft}px`;
        } else {
            console.log("⚠ No rightmost node found!");
        }
    } else {
        console.log("⚠ No nodes or influenceBox found!");
    }
});

document.addEventListener('DOMContentLoaded', event => {
	let showMenu = false; 
	let verbal = false;
	let animation = false;


	const siteLinksDiv = document.querySelector('.siteLinks');

	if (!showMenu) {
		siteLinksDiv.remove(); 
	} else {
		const header = document.querySelector('.header');
		const newDiv = document.createElement('div');
		newDiv.className = 'siteLinks';
		header.appendChild(newDiv); 
	}


	window.bnDetail = new BnDetail;
	bnDetail.make(document.querySelector('.bnDetail'));
	document.querySelector('.bnView').addEventListener('click', async event => {
		
		let target = event.target.closest('.target');
		if (target) {
			// target.classList.toggle('selected');
			let possibleEvidenceNode = target.closest('.node.hasEvidence');

			if (!possibleEvidenceNode) {
				document.querySelectorAll(".play-button").forEach(button => button.remove());
			}
	
			
			// Don't react, if node is an evidence node
			if (possibleEvidenceNode)
				return;
			

			target.closest('.state').classList.toggle('istarget');
			target.closest('.node').classList.toggle('istargetnode');

			// Add event listener to checkboxes
			document.querySelectorAll('.hiddencheckbox').forEach(checkbox => {
				checkbox.addEventListener('change', function () {
						if (this.checked) {
		
								// Add 'not-checked' class to other checkboxes
								document.querySelectorAll('.hiddencheckbox').forEach(cb => {
										if (cb !== this) {
												cb.classList.add('not-checked');
										}
								});
						} else {
								// Remove 'not-checked' class from other checkboxes
								document.querySelectorAll('.hiddencheckbox').forEach(cb => {
										cb.classList.remove('not-checked');
								});
						}
				});
			});

			let stateI = Number(target.closest('.state').dataset.index);
			let nodeName = target.closest('.node').dataset.name;
			let thisInput = target.querySelector('input');
			let node = target.closest('.node');
			
			
			/// If shift key held, then allow multi-select; otherwise, clear old selects
			// if (!event.shiftKey) {
			// 	node.querySelectorAll('.target input').forEach(i => i != thisInput && (i.checked = false));
			// }
			
			let states = [...node.querySelectorAll('.state.istarget')].map(el => Number(el.closest('.state').dataset.index));
			
			// clean up if we have not target selected
			if (!states.length) {
				delete bn.selectedStates[nodeName];

				// reset background colors for every evidence node 
				Array.from(document.querySelectorAll("span.barchange")).forEach(elem=>{
					elem.style.width = "";
					Array.from(elem.classList).forEach(classname=> {
						if (classname.indexOf("influence-") == 0)
							elem.classList.remove(classname);
					})
				})
				Array.from(document.querySelectorAll(".node span:not(.barParent)")).forEach(elem=>
					Array.from(elem.classList).forEach(classname=> {
						if (classname.indexOf("influence-") == 0)
							elem.classList.remove(classname);
					})
				)
			}
			else {
				bn.selectedStates[nodeName] = states;
			}
			if (Object.keys(bn.selectedStates).length > 0)
				bn.calculateTargetChange = true;
			else
				bn.calculateTargetChange = false;
				// bn.update(bn.evidence);
			
			if (Object.keys(bn.evidence).length > 0)
				bn.update(bn.evidence);
			return;
		}
		let state = event.target.closest('.state');
		if (state) {
			refs.Node(state).setEvidence(state.dataset.index, {update:true});
			/*let nodeName = state.closest('.node').dataset.name;
			let evidence = {};
			if (nodeName in bn.evidence && bn.evidence[nodeName] == state.dataset.index) {
				//delete bn.evidence[nodeName];
				evidence[nodeName] = null;
				state.closest('.node').classList.remove('hasEvidence');
			}
			else {
				//bn.evidence[nodeName] = state.dataset.index;
				evidence[nodeName] = state.dataset.index;
				state.closest('.node').classList.add('hasEvidence');
			}
			bn.update(evidence);*/
		}
	});

	setupScenarioEvents();
	
	Node.guiSetupEvents();
	
	q('h1 .text').setAttribute('contenteditable', 'true');
	q('h1 .text').setAttribute('spellcheck', 'false');
	// q('button.save').addEventListener('click', event => {
	// 	let doSave = async _=> {
	// 		let qs = new URLSearchParams(location.search);
	// 		let bnName = dlg.querySelector('[name=bnName]').value;
	// 		let bnDescription = dlg.querySelector('[name=description]').value;
	// 		bnDetail.$handleUpdate({title: bnName, temporary: false});
	// 		let fd = new FormData();
	// 		fd.append('name', bnName);
	// 		fd.append('description', bnDescription);
	// 		fd.append('key', qs.get('tempId'));
	// 		fd.append('type', qs.get('type'));
	// 		ui.dismissDialogs();
	// 		let res = await fetch('/upload?step=2&requestType=data', {method:'POST', body: fd}).then(r => r.json());
	// 		let usp = new URLSearchParams({id: res.id});
	// 		history.replaceState(null, '', '?'+usp.toString());
	// 	};
	// 	let dlg = ui.popupDialog([
	// 		n('h2', 'Save BN'),
	// 		n('div',
	// 			n('label', 'Name:'),
	// 			n('input', {type: 'text', name: 'bnName', value: q('h1 .text').textContent}),
	// 		),
	// 		n('div',
	// 			n('textarea', {name:'description', placeholder: 'Description'}),
	// 		),
	// 	], {buttons: [
	// 		n('button.save', 'Save', {on: {click: doSave}}),
	// 		n('button.cancel', 'Cancel', {on:{click:ui.dismissDialogs}}),
	// 	]});
	// 	q(dlg).querySelector('[name=bnName]').select().focus();
	// });
	q('button.publish').addEventListener('click', event => {
		let doPublish = async _=> {
			let qs = new URLSearchParams(location.search);
			let res = await fetch('/bn?requestType=data&updateBn=1', {method:'POST',
				body: q(new FormData).append('updates', JSON.stringify({visibility:'public',id: qs.get('id')})).unchain()
			});
			bnDetail.$handleUpdate({visibility:'public'});
			ui.dismissDialogs();
		};
		let dlg = ui.popupDialog([
			n('h2', 'Publish BN'),
		], {buttons: [
			n('button.doPublish', 'Publish', {on: {click: doPublish}}),
			n('button.cancel', 'Cancel', {on: {click:ui.dismissDialogs}}),
		]});
	});
	// q('button.downloadpng').addEventListener('click', () => {
	// 	let scaling = q('select.scaleimage').value
	// 	render.Network(Number(scaling), "png");
	// })
	// q('button.savesnapshot').addEventListener('click', () => {
	// 	bnDetail.saveSnapshot()
	// })
	q('button.downloadsvg').addEventListener('click', () => {
		let scaling = q('select.scaleimage').value
		render.Network(Number(scaling), "svg");
	})
	// q('button.downloadbase64').addEventListener('click', () => {
	// 	let scaling = q('select.scaleimage').value
	// 	render.Network(Number(scaling), "base64");
	// })
	q('input.influence-as-frame').addEventListener('click', (event) => {
		bnDetail.drawFrame = event.target.checked
		bnDetail.$handleUpdate({updateFrameMode:""});
	})
	q('input.influence-target-node').addEventListener('click', (event) => {
		bnDetail.onlyTargetNode = event.target.checked
		bnDetail.$handleUpdate({updateShowBarChange:""});
	})

	document.querySelector('button.frozen-mode').addEventListener('click', function() {
		if (!bn.isFrozen) {
			bn.isFrozen = true;
			document.querySelector(".bnView").classList.add("frozen");
			this.classList.add('frozen_box'); 

		} else {
			bn.isFrozen = false;
			console.log("Frozen Mode: Only Play Button is clickable.");
			document.querySelector(".bnView").classList.remove("frozen");
			this.classList.remove('frozen_box');
			let verbalBox = document.querySelector("#verbalBox");
			if (verbalBox) {
				verbalBox.classList.add("influenceContainer");
				console.log("Frozen Mode: verbalBox class remains:", verbalBox.classList);
			}
			
		}
	
	});

});





function onMouseUp() {
  isDragging = false;

  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

// drag and drop
document.addEventListener('DOMContentLoaded', (event) => {

	function handleDragEnter(e) {
	  this.classList.add('over');

	  this.currentZoom = Math.trunc((window.outerWidth-10)/window.innerWidth*100)/100
	}
  
	function handleDragLeave(e) {
	  this.classList.remove('over');
	}


	function handleDragMove(e) {
		if (this.classList.contains('over')) {
			// console.log(e.movementX, e.movementY, window.devicePixelRatio, e.movementX / window.devicePixelRatio)
			let matrix = new WebKitCSSMatrix(window.getComputedStyle(this).getPropertyValue('transform'))
			let moved = matrix.translate(e.movementX /  this.currentZoom, e.movementY /  this.currentZoom)
			this.style.transform = moved.toString()
		}
		
	}
	
  
	let items = document.querySelector('.evidence-scale');
	items.onmousedown = handleDragEnter
	items.onmouseup = handleDragLeave
	items.onmouseleave = handleDragLeave
	items.onmousemove = handleDragMove

	let verbalBox = document.querySelector('.influenceContainer');
	verbalBox.onmousedown = handleDragEnter
	verbalBox.onmouseup = handleDragLeave
	verbalBox.onmouseleave = handleDragLeave
	verbalBox.onmousemove = handleDragMove
});



