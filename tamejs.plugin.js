
let _ = require('dry-underscore');

let types = require("babel-types");
let template = require("babel-template");

let ast = function(t){ return template(t)(); }

function node_error(node, message){
   let loc = node.loc.start;
   return _.error("syntax_error", "(input " + loc.line + ":" + loc.column + "): " + message);
}

const main_visitor = {
   WhileStatement(path, state){
      
      if(!types.isIdentifier(path.node.test, { name: "__tame_await__" })){ return; }
      path.getFunctionParent().node.async = true;

      let waiter_id = path.scope.generateUidIdentifier("tame_w").name;
      let results_id = path.scope.generateUidIdentifier("tame_r").name;

      let body = path.get("body");

      if(!types.isBlockStatement(body.node)){ 
         throw node_error(body.node, "await statements must have braces around them.");
      }

      body = body.get("body");

      _.for(body.length, function(i){
         let expression = body[i];

         if(!types.isExpressionStatement(expression.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         let call = expression.get("expression");
         if(!types.isCallExpression(call.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         const call_updater = {
            CallExpression(path){
               if(path.node.callee.name !== "defer"){ return; }
               path.replaceWithSourceString(this.waiter_id + ".cb()");

               let defer_call = path.node;

               // _.p("CallExpression: (waiter_id: ", this.waiter_id, ") ", path.node.type);
            }
         };

         call.traverse(call_updater, { waiter_id });

      });

      let calls = _.pluck(body, "node");

      let create_waiter_ast = ast(`const ${waiter_id} = __tamejs_waiter();`);

      // parser hack.
      let wait_for_results_ast;
      
      // wait_for_results_ast = ast(`(async function(){ const ${results_id} = await ${waiter_id}.promise(); })();`);
      wait_for_results_ast = ast(`(async function(){ const ${results_id} = await ${waiter_id}.promise(); })();`);
      wait_for_results_ast = wait_for_results_ast.expression.callee.body.body;

      let spread_results = [];

      /*
      let [x, y, z] = _results[0];
      let [err, b] = _results[1];
      */
      
      // let [x, y, z] = await __awaiter("uuid").promise();
      // ast(`const ${waiter_id} = __tamejs_waiter();`);

      // _.p(wait_for_results_ast);

      let new_ast = _.concat(create_waiter_ast, calls, wait_for_results_ast);

      path.replaceWithMultiple(new_ast);
   }
};


module.exports = function(babel){

   let plugin = {};

   plugin.visitor = main_visitor;

   return(plugin);
};

