
let _ = require('dry-underscore');

var types = require("babel-types");
var babylon = require("babylon");
var generate = require("babel-generator").default;
var traverse = require("babel-traverse").default;
let template = require("babel-template");

let make_ast = function(t){ return template(t)(); }

function node_error(node, message){
   let loc = node.loc || {};
   loc = loc.start || { line: "", column: "" };
   return _.error("syntax_error", "(input " + loc.line + ":" + loc.column + "): " + message);
}

function get_declaration(node){

   if(!types.isIdentifier(node)){ return(null); }

   let raw = false;
   let unzip = false;
   let type = null;

   if(node.name === "__tame_let__"){
      type = "let";
   }else if(node.name === "__tame_var__"){
      type = "let";
   }else if(node.name === "__tame_raw__"){
      type = "let";
      raw = true;
   }else if(node.name === "__tame_for__"){
      type = "let";
      unzip = true;
   }else{ return(null); }

   return({ type, unzip, raw });
}

function make_lhs(declaration, args){

   var lhs = "";
   
   if(declaration){ 
      lhs += declaration.type + " ";
   }
      
   lhs += "[" + args.join(",") + "]";

   return(lhs);
}

function defer_results_lhs(call){

   if(call.arguments.length === 0){ return(null); }

   let declaration = null;
   var args = [];

   _.each(call.arguments, function(node, i){

      if(i == 0){ 
         if((declaration = get_declaration(node))){ return; } 
      }

      // _.p("node: ", node);
      // _.p("node: ", generate(node));
     
      if(declaration && !types.isIdentifier(node)){
         throw node_error(node, "declarations inside defer statements can only be identifiers.");
      }

      args.push(generate(node).code);
   });

   return({ 
      lhs: make_lhs(declaration, args),
      ...declaration 
   });
}

function handle_results_ast(results_id, waiter_id, defer_calls){

   function get_function_body(node){
      return node.expression.callee.body.body
   }

   function await_results_ast(assign){
      // parser hack. need to wrap it with async function or it's not happy

      let ast;
      if(assign){
         if(assign.raw){ assign.index = false; }

         if(assign.unzip){
            throw new Error("unzip not implemented");
            /*
            ast = make_ast(`(async function(){ 
               ${assign.lhs} = __tamejs_waiter.unzip((await ${waiter_id}.promise()));
            })();`);
            */
         }else if(assign.index !== undefined && assign.index !== false){
            ast = make_ast(`(async function(){ 
               ${assign.lhs} = (await ${waiter_id}.promise())[${assign.index}];
            })();`);
         }else{
            ast = make_ast(`(async function(){ 
               ${assign.lhs} = (await ${waiter_id}.promise());
            })();`);
         }
      }else{
         ast = make_ast(`(async function(){ 
            await ${waiter_id}.promise();
         })();`);
      }

      ast = _.first(get_function_body(ast));

      return(ast);
   }

   if(defer_calls.length === 1){

      var call = _.first(defer_calls);

      let lhs = defer_results_lhs(call);

      var ast = await_results_ast({ ...lhs, index: 0 });

      return(ast);

   }else{

      let ast = [];

      ast.push(await_results_ast({ lhs: `const ${results_id}`, index: false }));

      // unzip also works like this
      _.each(defer_calls, function(call, index){
         let lhs = defer_results_lhs(call);
         if(lhs){
            let assignment_ast = make_ast(`${lhs.lhs} = ${results_id}[${index}];`);
            ast.push(assignment_ast);
         }
      });

      return(ast);
   }
}

const defer_visitor = {
   WhileStatement(path, state){
      if(types.isIdentifier(path.node.test, { name: "__tame_await__" })){ return path.skip(); }
   },
   CallExpression(path){
      if(path.node.callee.name !== "defer"){ return; }

      this.nodes.push(path.node);

      if(path.node.arguments.length){
         path.replaceWithSourceString(this.waiter_id + ".cb(true)");
      }else{
         path.replaceWithSourceString(this.waiter_id + ".cb()");
      }
      this.index++;
   }
};

const transform_visitor = {
   WhileStatement(path, state){
      if(!types.isIdentifier(path.node.test, { name: "__tame_await__" })){ return; }
      path.getFunctionParent().node.async = true;

      let waiter_id = path.scope.generateUidIdentifier("tame_w").name;

      let body = path.get("body");

      if(!types.isBlockStatement(body.node)){ 
         throw node_error(body.node, "await statements must have braces around them.");
      }

      var defer_calls = [];

      body.traverse(defer_visitor, { index: 0, waiter_id, nodes: defer_calls });

      let create_waiter = make_ast(`const ${waiter_id} = __tamejs_waiter();`);

      let results_id = path.scope.generateUidIdentifier("tame_r").name;

      let handle_results = handle_results_ast(results_id, waiter_id, defer_calls);

      var new_body = _.concat(create_waiter, path.node.body, handle_results);

      path.replaceWithMultiple(new_body);

      // doesn't work or is redundant
      // var new_block = types.blockStatement(new_body);
      // path.replaceWith(new_block); // excludes access to the new variables so it doesn't work
      // path.replaceWithMultiple(new_block.body); // is redundant, given you can just add the new nodes directly as above

      /* this doesn't work. an if without braces breaks it.
      path.insertBefore(create_waiter);
      path.insertAfter(handle_results);
      path.replaceWithMultiple(path.node.body);
      */
   }
};

var steps = {};

function print_steps(){
   _.p("");
   _.each(steps, function(step, key){ _.p("code ", key, ": ", step); });
}

function parse(code, options){
   var options = _.extend({
       sourceType: "module",
       strictMode: false,
       plugins: []
   }, options);

   try{
      return babylon.parse(code, options);
   }catch(e){
      if(e.message.indexOf("await is a reserved word") === 0){
         e.message = "tame await statements must have braces {} around them. If you're using native await (without braces) you probably forgot to mark the function as async. original error message: " + e.message;
         throw(e);
      }else{ throw(e); }
   }
}


function tame_source(code, options){

   var block_keywords = ["tame", "await"];
   var var_keywords = ["var", "let", "raw", "for"];

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

   var ast = parse(code, options.parser);

   traverse(ast, transform_visitor);

   var runtime_ast = make_ast(`
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
   options.parser = _.extend({}, options.parser, { sourceFilename: file_name });

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
