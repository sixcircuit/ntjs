
let _ = require('dry-underscore');

let types = require("babel-types");
let template = require("babel-template");

let parse = function(t){ return template(t)(); }

function node_error(node, message){
   let loc = node.loc.start;
   return _.error("syntax_error", "(input " + loc.line + ":" + loc.column + "): " + message);
}

const defer_visitor = {
   CallExpression(path){
      if(path.node.callee.name !== "defer"){ return; }

      this.nodes.push(path.node);

      path.replaceWithSourceString(this.waiter_id + ".cb(" + this.index + ")");
   }
};

function defer_results_lhs(call){
   var declaration_type = "";
   var args = [];

   _.each(call.arguments, function(node, i){
      if(i == 0){
         if(node.name === "__tame_let__"){
            declaration_type = "let";
            return;
         }else if(node.name === "__tame_var__"){
            declaration_type = "var";
            return;
         }
      }
      if(declaration_type && !types.isIdentifier(node)){
         throw node_error(node, "declarations inside defer statements can only be identifiers.");
      }
      args.push(node.name);
   });

   return(declaration_type + "[" + args.join(",") + "]");
}

function handle_results_ast(results_id, waiter_id, defer_calls){

   function get_function_body(node){
      return node.expression.callee.body.body
   }

   function await_results_ast(lhs){
      // parser hack. need to wrap it with async function or it's not happy
      //
      var ast = parse(`(async function(){ 
         ${lhs} = await ${waiter_id}.promise();
      })();`);

      ast = _.first(get_function_body(ast));

      return(ast);
   }

   if(defer_calls.length === 1){

      var call = _.first(defer_calls);

      let lhs = defer_results_lhs(call);

      var ast = await_results_ast(lhs);

      return(ast);

   }else{

      let ast = [];

      ast.push(await_results_ast(`const ${results_id}`));

      _.each(defer_calls, function(call, index){
         let lhs = defer_results_lhs(call);
         let assignment_ast = parse(`${lhs} = ${results_id}[${index}];`);
         ast.push(assignment_ast);
      });

      return(ast);
   }
}

const main_visitor = {
   WhileStatement(path, state){
      
      if(!types.isIdentifier(path.node.test, { name: "__tame_await__" })){ return; }
      path.getFunctionParent().node.async = true;

      let waiter_id = path.scope.generateUidIdentifier("tame_w").name;

      let body = path.get("body");

      if(!types.isBlockStatement(body.node)){ 
         throw node_error(body.node, "await statements must have braces around them.");
      }

      body = body.get("body");

      var defer_calls = [];

      _.for(body.length, function(i){
         let expression = body[i];

         if(!types.isExpressionStatement(expression.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         let call = expression.get("expression");
         if(!types.isCallExpression(call.node)){ throw node_error(expression, "await statements may only contain function calls."); }

         call.traverse(defer_visitor, { index: i, waiter_id, nodes: defer_calls });

      });

      let deferred_calls = _.pluck(body, "node");

      let create_waiter_ast = parse(`const ${waiter_id} = __tamejs_waiter();`);

      _.p("defer_calls: ", defer_calls);

      let results_id = path.scope.generateUidIdentifier("tame_r").name;

      let handle_results = handle_results_ast(results_id, waiter_id, defer_calls);

      let new_ast = _.concat(create_waiter_ast, deferred_calls, handle_results);
      console.dir(handle_results);

      path.replaceWithMultiple(new_ast);
   }
};


module.exports = function(babel){

   let plugin = {};

   plugin.visitor = main_visitor;

   return(plugin);
};

