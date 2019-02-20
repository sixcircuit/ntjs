
let _ = require('dry-underscore');

var types = require("babel-types");
var babylon = require("babylon");
var generate = require("babel-generator").default;
var traverse = require("babel-traverse").default;
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

   if(call.arguments.length === 0){ return(null); }

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

      let ast;
      if(lhs){
         ast = parse(`(async function(){ 
            ${lhs} = await ${waiter_id}.promise();
         })();`);
      }else{
         ast = parse(`(async function(){ 
            await ${waiter_id}.promise();
         })();`);
      }

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
         if(lhs){
            let assignment_ast = parse(`${lhs} = ${results_id}[${index}];`);
            ast.push(assignment_ast);
         }
      });

      return(ast);
   }
}

const transform_visitor = {
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

      let results_id = path.scope.generateUidIdentifier("tame_r").name;

      let handle_results = handle_results_ast(results_id, waiter_id, defer_calls);

      let new_ast = _.concat(create_waiter_ast, deferred_calls, handle_results);

      path.replaceWithMultiple(new_ast);
   }
};

var steps = {};

function print_steps(){
   _.p("");
   _.each(steps, function(step, key){ _.p("code ", key, ": ", step); });
}

function tame_source(code, options){

   var block_keywords = ["tame", "await"];
   var var_keywords = ["var", "let"];

   steps.in = code;

   _.each(block_keywords, function(word){
      code = code.replace(_.regex("\\b" + word + "\\s*{", "g"), "while(__tame_await__){");
   });

   _.each(var_keywords, function(word){
      var match = "\\b" + "defer" + "\\s*\\(\\s*" + word + "\\b";
      code = code.replace(_.regex(match, "g"), "defer(__tame_" + word + "__,");
   });

   steps.replaced = code;

   // print_steps();

   var ast = babylon.parse(code, _.extend({
       sourceType: "module",
       plugins: []
   }, options.parser));

   traverse(ast, transform_visitor);

   var runtime_ast = parse(`
      let __tamejs_waiter = null;
      if(typeof require !== undefined){ __tamejs_waiter = require('tamejs'); }else{ __tamejs_waiter = window.__tamejs_waiter; }
   `);

   for(var i = runtime_ast.length; i >= 0; i--){
      ast.program.body.unshift(runtime_ast[i]);
   }

   var gen = generate(ast, _.extend({}, options.generator), code);

   code = gen.code;

   code = _.replace(code, "while(__tame_await__){", "await{");
   code = _.replace(code, "__tame_var__,", "let");
   code = _.replace(code, "__tame_let__,", "let");

   steps.out = code;

   // print_steps();

   gen.code = code;

   return(gen);
}

function tame_file(options, callback){
   if(_.isString(options)){ options = { path: options }; }
   var file_name = _.path.file(options.path);

   options.generator = _.extend({}, options.generator, { filename: file_name, sourceFileName: file_name });

   if(callback){
      _.fs.read(options.path, _.plumb(function(code){
         try{
            const gen = tame_source(code, options);
            return callback(null, gen);
         }catch(e){
            return callback(e);
         }
      }, callback));
   }else{
      const code = _.fs.read_file.sync(options.path);
      const gen = tame_source(code, options);
      return(gen);
   }
}


module.exports = {
   file: tame_file,
   source: tame_source,
}
