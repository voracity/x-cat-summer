var {n} = require('htm');

function colorToVerbal(color) {
  if (color == "influence-idx6")
    return "greatly reduces";
  else if (color == "influence-idx5")
    return "moderately reduces";
  else if (color == "influence-idx4")
    return "slightly reduces";
  else if (color == "influence-idx3")
    return "doesn't change";
  else if (color == "influence-idx2")
    return "slightly increases";
  else if (color == "influence-idx1")
    return "moderately increases";
  else if (color == "influence-idx0")
    return "greatly increases";
}

function buildFindingOutSentence(numsFinding, evidenceNodeName, evidenceState, colorContribute, targetNodeName, targetState) {  
  let findingSentence = n('p', `${numsFinding > 1 ? '● ' : ''}Finding out `, 
    n('span', evidenceNodeName, {class: 'verbalTextBold'}), ' was ', 
    n('span', evidenceState, {class: 'verbalTextUnderItalic'}),' ', 
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderLine'}), ' the probability of ', 
    n('span', targetNodeName, {class: 'verbalTextBold'}), ' is ', 
    n('span', targetState, {class: 'verbalTextUnderItalic'}), ' .');
    
  return findingSentence;
}
  
function buildSummarySentence(numsFinding, colorContribute, targetNodeName, targetState) {
  let findings = numsFinding == 2 ? 'Both' : 'All';
  return n('p', 
    n('span', `${findings} findings`, {class: 'verbalTextBold'}),
    ' combined ',
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderLine'}),
    ' the probability that ',
    n('span', targetNodeName, {class: 'verbalTextBold'}),
    ' is ',
    n('span', targetState, {class: 'verbalTextUnderItalic'}),
    '.',
    n('br'),
    n('br'),
    'The ',
    n('span', 'contribution', {style: 'text-decoration: underline;'}),
    ' of each finding is:',
   )
}