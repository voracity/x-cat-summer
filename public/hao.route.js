var {n} = require('htm');


class Hao_page {
    make() {
        let targetNodeName = 'NODE'; 
        let explanation = `
            <p>Finding out <strong><span class="variable-name">${targetNodeName}</span></strong> 
            was used contributes due to 2 connections: <br><br>
            Overall, the finding <strong>greatly increases</strong> 
            the probability of <strong><span class="variable-name">${targetNodeName}</span></strong> 
            being in the target state.</p>
        `;


        let container = document.createElement('div');
        container.innerHTML = explanation;
        document.body.appendChild(container);
    }
}


module.exports = {
	template: 'StandardPage',
	component: Hao_page,
	noUserRequired: true,
}