
const _ = require('dry-underscore');

var common = {
   file_path: "input",
   node_error,
   error_message
}


function error_message(loc, message){
   return(`${message} \n    in file: (${common.file_path}:${loc.line}:${loc.column})\n\nparser error:`);
}

function node_error(node, message){
   let loc = (node && node.loc) || {};
   loc = loc.start || { line: "", column: "" };
   return _.error("syntax_error", error_message(loc, message));
}


module.exports = common;
