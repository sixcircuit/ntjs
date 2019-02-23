
const _ = require('dry-underscore');

function node_error(node, message){
   let loc = node.loc || {};
   loc = loc.start || { line: "", column: "" };
   return _.error("syntax_error", "(input " + loc.line + ":" + loc.column + "): " + message);
}


module.exports = {
   node_error
};
