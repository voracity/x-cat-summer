const { NewPage } = require('./pages');

module.exports = {
    template: NewPage,
    prepareData(req, res, db) {
        return { h1: "Dynamic Page", body: "This is loaded dynamically!" };
    },
};
