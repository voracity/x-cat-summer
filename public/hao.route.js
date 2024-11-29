var {n} = require('htm');

let explanation = '123'

class Hao_page {
    make() {
        let targetNodeName = 'NODE'; // 目标节点名称
        let explanation = `
            <p>Finding out <strong><span class="variable-name">${targetNodeName}</span></strong> 
            was used contributes due to 2 connections: <br><br>
            Overall, the finding <strong>greatly increases</strong> 
            the probability of <strong><span class="variable-name">${targetNodeName}</span></strong> 
            being in the target state.</p>
        `;

        // 创建一个容器节点
        let container = document.createElement('div');
        container.innerHTML = explanation;

        // 插入到页面中
        document.body.appendChild(container);
    }
}


module.exports = {
	template: 'StandardPage',
	component: Hao_page,
	noUserRequired: true,
}