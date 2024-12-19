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

// function buildDetailSentenceList(arcsContributionArr, verbalListDisplay) {
//   arcsContributionArr.forEach((arc) => {
//     if (arc.targetNodeName == arc.to) {
//       let simpleSentence = n(
//         'p',
//         '● By direct connection, it ',
//         n('span', colorToVerbal(arc.color), { class: 'verbalText' }),
//         ' the probability of ',
//         n('span', arc.to, { class: 'verbalTextBold' }),
//         '.'
//       );
//       verbalListDisplay.appendChild(simpleSentence);
//     } else {
//       let findingSentence = n(
//         'p', `● It ${colorToVerbalShorten(arc.color)} the probability that `,
//         n('span', arc.to, {class: 'verbalTextBold'}),
//         ' was ',
//         n('span', arc.toState, {class: 'verbalTextItalic'}),
//         ', which in turn ',
//         n('span', colorToVerbal(arc.color)),
//         ` the probability of `,
//         n('span', arc.to, {class: 'verbalTextBold'}),
//         '.'
//       );
//       verbalListDisplay.appendChild(findingSentence);
//     }
//   });
//   return detailSentence;
// }

function buildDetailSentenceList(arcsContributionArr, verbalListDisplay) {
  arcsContributionArr.forEach((arc, index) => {
    // Check if it's a simple sentence (ends in this arc)
    if (arc.endSentence) {
      let simpleSentence = n(
        'p',
        '● By direct connection, it ',
        n('span', colorToVerbal(arc.color), { class: 'verbalText' }),
        ' the probability of ',
        n('span', arc.to, { class: 'verbalTextBold' }),
        '.'
      );
      verbalListDisplay.appendChild(simpleSentence);
    } else {
      // If it's a multi-part sentence
      let findingSentence = n(
        'p',
        '● It ',
        n('span', colorToVerbalShorten(arc.color), { class: 'verbalText' }),
        ' the probability that ',
        n('span', arc.from, { class: 'verbalTextBold' }),
        ' was ',
        n('span', arc.fromState, { class: 'verbalTextItalic' }),
        ','
      );

      // Check if it continues or ends
      if (arc.endSentence) {
        findingSentence.appendChild(
          n(
            'span',
            ' which in turn ',
            n(
              'span',
              colorToVerbal(arc.color),
              { class: 'verbalText' }
            ),
            ' the probability of ',
            n('span', arc.targetNodeName, { class: 'verbalTextBold' }),
            '.'
          )
        );
      } else {
        findingSentence.appendChild(
          n(
            'span',
            ' which in turn ',
            n(
              'span',
              colorToVerbalShorten(arc.color),
              { class: 'verbalText' }
            ),
            ' the probability that ',
            n('span', arc.to, { class: 'verbalTextBold' }),
            ' was ',
            n('span', arc.toState, { class: 'verbalTextItalic' }),
            '.'
          )
        );
      }
      verbalListDisplay.appendChild(findingSentence);
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