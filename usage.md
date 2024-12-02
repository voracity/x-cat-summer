# How to use the API


The following gives an example of setting up a question. It will 
* load the bayes SVG document.
* setup the animation environment
* setup example animations (all of the currently available)
* attach them to trigger buttons

## Quickstart
The code needs to be added to the ```Qualtrics.SurveyEngine.addOnReady()``` callback

This is the content of the callback
```javascript
// The base64 encoded SVG bayes network
let testnetwork = "PHN2ZyB4bWxucz0ia..."

// Decode and add the SVG to the question body
let n = document.getElementById("bayesnetwork");
let b = atob(testnetwork)
n.innerHTML = b;

// Initialise the animation code parts
// The 'RepeaterHelper' creates animation templates that are continuously repeated
let animationcode = new AnimationCode(n, {formatLabels:true})
let helper = new RepeaterHelper(animationcode)

// Create 'Repeater' instances (they repeat an animation given to them)
// Each function inside the 'helper' is a template implementation. 
// Can be extended.

// Create an animation to switch between two states of the network. 
// The pause between animation is 2 seconds
r1 = new Repeater(helper.getFnSnapShot("no_gene", "with_gene"), 2)

// Create an animation to fade a node with opacity 60%. 
// The pause between animation is 2 seconds
r2 = new Repeater(helper.getFnFade("Peeling", 0.6), 2)

// Create an animation to animate a path on the network. 
// The pause between full path animation is 3 seconds
// The 'null' entry combined paths
r3 = new Repeater(helper.getFnPath(
    [
        "Dunkalot_sunscreen", 
        "Podunk_beach","Dermascare",  
        null, 
        "Dunkalot_sunscreen", 
        "Dermascare"
    ], 
    {hideOtherNodes:true}), // fade other nodes
    3                       // total animation time 3 seconds
    )

// Add all repeaters to an array. This is used to stop repeated animations when
// toggled off or when another animation is started, to avoid overlapping animations
repeaters = [r1,r2,r3];

// The 'QulatricsGetToggleButtonFn' creates a callback template that takes the current
// animation (repeater r1) and the list of all repeated animation (to stop the others)
// Find and attach to buttons in the question template
document.getElementById("snapshot").onclick = QulatricsGetToggleButtonFn(r1, repeaters)
document.getElementById("fade").onclick = QulatricsGetToggleButtonFn(r2, repeaters)
document.getElementById("path").onclick = QulatricsGetToggleButtonFn(r3, repeaters)
```

## AnimationCode API
Everything happens through the ```AnimationCode``` API.

It loads, sets up, and processes the SVG Bayes network. It takes DOM node of the SVG document and a parameter object
```javascript
let opt = {formatLabels:true}
let animationcode = new AnimationCode(n, opt)
```
There are some default options listed below:
```javascript
var OPTS_DEFAULT = {
	removecssrgb: true, 
	formatLabels: true,     // used to reformat the node labels
	capitaliseLabels: true, // Addtional option to 
                            // capitalise each word in the label
}
```

The animations created with this API are single shot, non-repetitive animations. The ```Repeater``` is an extension that calls the animation API and wrapps repeating code with start stop functinoality around it.

### Create a path animation
To create a path animation we first need to get a path from the network based on node labels. The following call creates finds the path between __Dunkalot_sunscreen__ and __Dermascare__
```javascript
let path = ["Dunkalot_sunscreen", "Podunk_beach","Dermascare"]
let p = animationcode.getPath(path, opts);
```
The following options (and their default values), given to the opts dictionary, are:
```javascript
{
    includeNodes : true,        // if false only arcs are animated
    cellprobability: true,      // if false the cellprobability is not animated
    barchange: true,            // if false the barchange is not animated
    flash: true,                // if false the nodes don't flash
    flashFirst: false,          // if true only the first nodes in 
                                // the path-label list flashes
    removeDuplicateNodes:true   // when combining paths remove node duplicates
                                // to avoid duplicate animation
    showDuplicateLast:true      // if there are duplicate nodes, we assume
                                // that it is the target node. If so, show it last
}
```
To combine paths, i.e. multiple paths possible between source and target, we just concatenate those paths. A __null__ entry separates those paths. The null entry helps the path generator to figure out animation specific things. The following call creates finds the path between __Dunkalot_sunscreen__ and __Dermascare__ but adds the alternative, direct edge between source and target as well
```javascript
let path = [
    "Dunkalot_sunscreen", 
    "Podunk_beach",
    "Dermascare", 
    null, 
    "Dunkalot_sunscreen", 
    "Dermascare"
    ]
let p = animationcode.getPath(path, opts);
```

To start a path animation we call
```javascript
let a = animationcode.showPath(p, opts);
```
The function returns a reference to the path animator. The animator provides a ```stop``` function to stop the animation any time.

The following options for ```showPath``` are supported
```javascript
{
    combine : false, 
    
    time : 2,                   // the total runtime of the animation in seconds
    
    highlightNodes : true,      // if false the highlight is suppressed
    
    nodeHighlightTime : 1,      // the standard time for a node animation in seconds
    
    onlyArcs : false,           // only animate the arcs
    
    arrowHeadTime : 0.3,        // animation time to fade in arrow heads

    hideOtherNodes: true        // Fade out nodes not part of the path
    
    normaliseTime : true,       // If true the total runtime value will be taken
                                // if false each node and head animation is 
                                // added and the total runtime is longer
    
    showFirstNodeInfluenceOnTarget: false,  // shows the actual influence value of 
                                            // the first node on the target node
    
    showTargetNodeLast: true,               // When animating multiple paths show the
                                            // actual target node animation last
    
    useScenarioAsStart:undefined            // show another scenario (name of the scenario)
                                            // first before starting the animation
    
    showTargetBeliefFromOtherScenario:false // when using another scenario, start
                                            // the animation with the target node showing
                                            // the belief change bar of the previous 
                                            // scenario
}
```

#### Path Animation From Other Scenario

A special case where the "from" scenario is briefly shown and then "overdrawn" with the current scenario's values

For that we use the same ```getFnPath``` function but add the ```useScenarioAsStart``` parameter which will take the name of the "other" scenario.
The options available are a combination of options from ```getPath``` and ```showPath``` methods

```javascript

let opts = {
        hideOtherNodes:true,            // hide other nodes not part of the path
        useScenarioAsStart:"no_gene",   // briefly show the 'no_gene' scenario
        time:1.5                        // total animation time 1.5s
    }
let r = new Repeater(helper.getFnPath(
            ["Gene", "Peeling","Dermascare"],   // The nodes to include in the path
            opts
            ), 3)                              // 3 seconds until the loop restarts

```

### Highlight Node
To highlight a node with a border box
```javascript
animationcode.highlightNode(
    <nodename>, 
    highlight=[true,false], 
    color=<CSS color>
)
```


### Fade Node
To fade a node
```javascript
animationcode.fadeNode(
    <nodename>, 
    includeArcs=[true,false], 
    fade=[true,false], 
    opacity=[0..1]
    )
```

### Show Basic Evidence Network
This network will only show the influence as colour code on each evidence node and the bar change on the target node
```javascript
animationcode.showBasicEvidenceNetwork(true) // show basic network

animationcode.showBasicEvidenceNetwork(false) // restore full network
```

# Examples

To show a path animation from Gene to Dermascare via Peeling __and__ also starting from the scenario where _gene_ is not evident __and__ hiding other nodes.

```javascript
r = new Repeater(helper.getFnPath(["Gene", "Peeling", "Dermascare"], {hideOtherNodes:true, showTargetBeliefFromOtherScenario:true, useScenarioAsStart:"no_gene", time:4}), 6)
```

To show a path animation from Sunscree to Dermascare via Peeling __and__ also starting from the scenario where _gene_ is not evident __and__ hiding other nodes.
```javascript
r = new Repeater(helper.getFnPath(["Dunkalot_sunscreen", "Podunk_beach","Dermascare", null, "Dunkalot_sunscreen", "Dermascare"], {hideOtherNodes:true, showFirstNodeInfluenceOnTarget:true, time:1.5}), 5)
```