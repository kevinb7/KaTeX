/* eslint no-console:0 */

var render = require('./src/render');
var spxRender = require('./src/spxRender');

module.exports = {
    render: render.render,
    renderToString: render.renderToString,
    /**
     * NOTE: This method is not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __parse: render.generateParseTree,
    ParseError: render.ParseError,
    spxPreprocessText: spxRender.preprocessText,
    spxPreprocessMath: spxRender.preprocessMath,
    spxRenderMathToString: spxRender.renderMathToString,
    spxRenderMixedTextToString: spxRender.renderMixedTextToString,
    spxRenderMathInElement: spxRender.renderMathInElement,
};
