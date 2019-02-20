
var _ = require('dry-underscore');

var template = require("babel-template");

var types = require("babel-types");

/*
var defer_block = template(`
  var IMPORT_NAME = require(SOURCE);
`);
*/

var f = `(async function(){
   __tamejs_waiter.wait();
   existing_block
   var results = await __tamejs_waiter.promise();
})()`

var f = `(async function(){
   __tamejs_waiter.wait();
   existing_block
   var results = await __tamejs_waiter.promise();
})()`
/*
path.replaceWithSourceString(`function add(a, b) {
    return a + b;
  }`);
  */
// path.scope.generateUidIdentifier("_w").name

var defer_block = template(f)


var a = defer_block({ });
/*
const ast = defer_block({
  IMPORT_NAME: t.identifier("myModule"),
  SOURCE: t.stringLiteral("my-module")
});
*/

function node_error(node, message){
   var loc = node.loc.start;
   return _.error("syntax_error", "(input " + loc.line + ":" + loc.column + "): " + message);
}

const call_updater = {
   CallExpression(path){
      if(path.node.callee.name !== "defer"){ return; }
      path.replaceWithSourceString(this.waiter_id + ".cb()");

      var defer_call = path.node;

      // _.p("CallExpression: (waiter_id: ", this.waiter_id, ") ", path.node.type);
   }
};

const main_visitor = {
   WhileStatement(path, state){
      // _.p("while: ", path.node);
      if(!types.isIdentifier(path.node.test, { name: "___tame_await___" })){ return; }
      _.p("FOUND TAME AWAIT");
      path.getFunctionParent().node.async = true;

      // if(!t.isBlockStatement(path.node.body)){ return; }
      // var deferals = path.node.body.body;

      var waiter_id = path.scope.generateUidIdentifier("_w").name;

      var body = path.get("body");

      _.p(body.node);

      if(!types.isBlockStatement(body.node)){ 
         throw node_error(body.node, "await statements must have braces around them.");
      }

      body = body.get("body");

      _.for(body.length, function(i){
         var expression = body[i];

         if(!types.isExpressionStatement(expression.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         var call = expression.get("expression");
         if(!types.isCallExpression(call.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         call.traverse(call_updater, { waiter_id });
      });

      var calls = _.pluck(body, "node");
      path.replaceWithMultiple(calls);
   }
};


module.exports = function(babel){

   var plugin = {};

   plugin.visitor = main_visitor;

   return(plugin);
};

