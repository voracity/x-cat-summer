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

function buildFindingOutSentence(evidenceNodeName, evidenceState, colorContribute, targetNodeName, targetState) {
  let contribution = colorToVerbal(colorContribute);
  return n('p', 'Finding out ', 
    n('span', evidenceNodeName, {class: 'verbalTextbold'}), ' was ', 
    n('span', evidenceState, {class: 'verbalTextUnderItalic'}),' ', 
    n('span', contribution, {class: 'verbalTextUnderLine'}), ' the probability of ', 
    n('span', targetNodeName, {class: 'verbalTextbold'}), ' is ', 
    n('span', targetState, {class: 'verbalTextUnderItalic'}), ' .');
}
  