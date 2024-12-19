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

function colorToVerbalShorten(color) {
  if (color == "influence-idx6" || color == "influence-idx5" || color == "influence-idx4")
    return "reduces";
  else if (color == "influence-idx3")
    return "doesn't change";
  else if (color == "influence-idx2" || color == "influence-idx1" || color == "influence-idx0")
    return "increases";
}

function buildFindingOutSentence(numsFinding, evidenceNodeName, evidenceState, colorContribute, targetNodeName, targetState, detail=false) {    
  let findingSentence = n('p', `${numsFinding > 1 ? '● ' : ''}Finding out `, 
    n('span', evidenceNodeName, {class: 'verbalTextBold'}), ' was ', 
    n('span', evidenceState, {class: 'verbalTextItalic'}),' ', 
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderline'}), ' the probability of ', 
    n('span', targetNodeName, {class: 'verbalTextBold'}), ' is ', 
    n('span', targetState, {class: 'verbalTextItalic'}), detail ? ', by direct connection.' : ' .'); 
    
  return findingSentence;
}

function buildDetailSentenceList(activePaths, arcsContribution, verbalListDisplay) {
  let index = 0;

  console.log('activePaths', activePaths);

  activePaths.forEach((path) => {
    console.log('path', path);
    const arc = arcsContribution[index]; // Access the arc using the current index
    if (path.length == 2) { 
      // Direct connection: only one arc      
      const sentence = n(
        'p',
        '● By direct connection, it ',
        n('span', colorToVerbal(arc.color), { class: 'verbalText' }),
        ' the probability of ',
        n('span', path[1], { class: 'verbalTextBold' }),
        '.'
      );
      verbalListDisplay.appendChild(sentence); // Append the generated sentence to the display
    } else {
      // Indirect connection: multiple arcs
      const sentence = n('p', '● It ');

      path.forEach((node, i) => {
        if (i < path.length - 1) {
          let toState = path[index + 1] == arc.to ? arc.toState : arc.fromState;
          // Not the last node in the path          
          if (i === 0) {
            // First step in the path
            sentence.appendChild(
              n('span', colorToVerbalShorten(arc.color), { class: 'verbalText' })
            );
            sentence.appendChild(n('span', ' the probability that '));
            sentence.appendChild(
              n('span', path[index + 1], { class: 'verbalTextBold' })
            );
            sentence.appendChild(n('span', ' was '));
            sentence.appendChild(
              n('span', toState, { class: 'verbalTextItalic' })
            );
            sentence.appendChild(n('span', ','));
          } 
          // else {
          //   // Intermediate steps
          //   sentence.appendChild(n('span', ' which in turn '));
          //   sentence.appendChild(
          //     n('span', colorToVerbalShorten(arc.color), { class: 'verbalText' })
          //   );
          //   sentence.appendChild(n('span', ' the probability that '));
          //   sentence.appendChild(
          //     n('span', arc.to, { class: 'verbalTextBold' })
          //   );
          //   sentence.appendChild(n('span', ' was '));
          //   sentence.appendChild(
          //     n('span', arc.toState, { class: 'verbalTextItalic' })
          //   );
          //   sentence.appendChild(n('span', ','));
          // }
        } else {
          // Last step in the path  
          // console.log('path[i]', path[i]); 
          
          sentence.appendChild(n('span', ' which in turn '));
          sentence.appendChild(
            n('span', colorToVerbal(arc.color), { class: 'verbalText' })
          );
          sentence.appendChild(n('span', ' the probability of '));
          sentence.appendChild(
            n('span', path[i], { class: 'verbalTextBold' })
          );
          sentence.appendChild(n('span', '.'));
        }        
      });
      index++; // Move to the next arc
      verbalListDisplay.appendChild(sentence); // Append the generated sentence
    }
  });
}
  
function buildSummarySentence(numsFinding, colorContribute, targetNodeName, targetState) {
  let findings = numsFinding == 2 ? 'Both' : 'All';
  return n('p', 
    n('span', `${findings} findings`, {class: 'verbalTextBold'}),
    ' combined ',
    n('span', colorToVerbal(colorContribute), {class: 'verbalTextUnderline'}),
    ' the probability that ',
    n('span', targetNodeName, {class: 'verbalTextBold'}),
    ' is ',
    n('span', targetState, {class: 'verbalTextItalic'}),
    '.',
    n('br'),
    n('br'),
    'The ',
    n('span', 'contribution', {style: 'text-decoration: underline;'}),
    ' of each finding is:',
   )
}

function numberToWord(num) {
  if (num == 0) return "zero";
  if (num == 1) return "one";
  if (num == 2) return "two";
  if (num == 3) return "three";
  if (num == 4) return "four";
  if (num == 5) return "five";
  if (num == 6) return "six";
  if (num == 7) return "seven";
  if (num == 8) return "eight";
  if (num == 9) return "nine";
  if (num == 10) return "ten";
  return num;
}