"use strict";

let _ = require('dry-underscore');

_.merge = function(){
   var args = _.a(arguments);
   args.unshift({});
   return _.extend.apply(null, args);
};

const types = require("babel-types");
const babylon = require("babylon");
const generate = require("babel-generator").default;
const _traverse = require("babel-traverse").default;
const template = require("babel-template");
const hub_class = require('babel-traverse').Hub;
const node_path = require('babel-traverse').NodePath;


const keywords = require("./keywords.js");

const defer_visitor = require("./defer_visitor.js");

const common = require("./common.js");
const { node_error } = common;

function make_ast(t){ return template(t)(); }

function get_function_body(node){ return node.expression.callee.body.body }

function make_await_ast(t){
   let ast = make_ast(`(async function(){ ${t} })();`); // parser hack. need to wrap it with async function or it's not happy
   return(_.first(get_function_body(ast)));
};

function await_ast(waiter_id, call, index){

   // _.p("call: ", call);

   if(call.raw){ index = undefined; }

   if(!call.lhs){ return make_await_ast(`await ${waiter_id}.rows();`); }

   if(call.unzip){
      return make_await_ast(`${call.lhs} = (await ${waiter_id}.columns());`);
   }else if(index !== undefined){ 
      return make_await_ast(`${call.lhs} = (await ${waiter_id}.rows())[${index}];`);
   }else{
      return make_await_ast(`${call.lhs} = (await ${waiter_id}.rows());`);
   }
}

function handle_results_ast(waiter_id, results_id, calls){

   if(calls.length === 1){

      let call = _.first(calls);

      return await_ast(waiter_id, call, 0);

   }else{

      let ast = [];

      ast.push(await_ast(waiter_id, { lhs: `const ${results_id}` }));

      // unzip also works like this
      _.each(calls, function(call, index){
         if(call.lhs){
            ast.push(make_ast(`${call.lhs} = ${results_id}[${index}];`));
         }
      });

      return(ast);
   }
}

const transform_visitor = {

   WhileStatement(path, state){

      if(!types.isIdentifier(path.node.test, { name: keywords.blocks.tokens["await"] })){ return; }

      path.getFunctionParent().node.async = true;

      let waiter_id = path.scope.generateUidIdentifier("tame_w").name;

      let body = path.get("body");

      if(!types.isBlockStatement(body.node)){ 
         throw node_error(body.node, "await statements must have braces around them.");
      }

      var calls = [];

      body.traverse(defer_visitor, { index: 0, waiter_id, calls });

      let create_waiter = make_ast(`const ${waiter_id} = ${keywords.runtime.token}();`);

      let results_id = path.scope.generateUidIdentifier("tame_r").name;

      let handle_results = handle_results_ast(waiter_id, results_id, calls);

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

function print_stages(stages){
   _.p("");
   _.each(stages, function(step, key){ _.p("code ", key, ": ", step); });
}

function parse(code, options){
   var options = _.merge({
       sourceType: "module",
       strictMode: false,
       plugins: []
   }, options);

   try{
      return babylon.parse(code, options);
   }catch(e){
      if(e.message.indexOf("await is a reserved word") === 0){
         e.message = common.error_message(e.loc, `tame await statements must have braces {} around them. If you're using native await (without braces) you probably forgot to mark the function as async. original error message: ` + e.message);
         throw(e);
      }else{ throw(e); }
   }
}

function traverse(ast, visitor){

   var hub = new hub_class({
       buildCodeFrameError(node, message, Error) {
          if(node){
             return node_error(node, message);
          }else{
             return new Error(common.error_message(null, message));
          }
       }
   })

   var path = node_path.get({
       hub: hub,
       parentPath: null,
       parent: ast,
       container: ast,
       key: "program",
   }).setContext();

   var scope = path.scope;

   return _traverse(ast, visitor, scope);
}

function tame_source(code, options){

   var stages = options.stages ? {} : null;

   if(stages){ stages.in = code; }

   code = keywords.replace(code);

   if(stages){ stages.replaced = code; }

   // print_stages(stages);
   
   var parser_options = {};

   if(options.file_name){
      parser_options.sourceFilename = options.file_name;
   }

   var ast = parse(code, parser_options);

   traverse(ast, transform_visitor);

   var runtime_ast = make_ast(`
      let ${keywords.runtime.token} = null;
      if(typeof require !== undefined){ ${keywords.runtime.token} = require('tamejs'); }else{ ${keywords.runtime.token} = window.${keywords.runtime.token}; }
   `);

   for(var i = runtime_ast.length; i >= 0; i--){
      ast.program.body.unshift(runtime_ast[i]);
   }


   var generator_options = { compact: false };

   if(options.maps){ generator_options.sourceMaps = true; }

   if(options.file_name){
      generator_options.sourceFilename = options.file_name;
      generator_options.filename = options.file_name;
   }

   var gen = generate(ast, generator_options, code);

   code = gen.code;

   if(stages){ stages.parsed = code; }

   code = keywords.deplace(code);

   if(stages){ stages.out = code; }

   // print_stages(stages);

   gen.stages = stages;

   gen.code = code;

   return(gen);
}

function tame_file(options, callback){
   if(_.isString(options)){ options = { path: options }; }

   const file_name = common.file_name = _.path.file(options.path);
   common.file_path = _.path.resolve(options.path);

   options = _.merge(options, { file_name });

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
};
