
const types = require('babel-types');
const generate = require("babel-generator").default;
const keywords = require("./keywords.js");
const { _, node_error } = require("./common.js");

function declaration(node){

   if(!types.isIdentifier(node)){ return(null); }

   return keywords.declaration(node.name);
}

function make_lhs(call, node){

   if(call.args.length === 0){ return(""); }

   let lhs = "";
   
   if(call.declare && call.declare.type){ lhs += call.declare.type + " "; }

   if(call.raw){
      lhs += call.args[0] || "";
      if(call.args.length > 1){ throw node_error(node, "raw declaration can't have more than one variable referenced. for instance: raw x[], y[]. the y would get lost, and doesn't make sense."); }
   }else{
      lhs += "[" + call.args.join(",") + "]";
   }

   return(lhs);
}

function throw_array_consistency_error(node){
   throw node_error(node, "if one variable is declared with an array syntax (x[]) then all variables must be declared with an array syntax (x[]). raw variables must also be declared with an array syntax (x[]).");
}

function enforce_array_notation_consistency(call, flags, seen_array_notation, node){
   if(!flags.array_notation && seen_array_notation){
      throw_array_consistency_error(node);
   }else if(flags.array_notation && !seen_array_notation){
      if(call.args.length){ throw_array_consistency_error(node); }
   }
}



// I need to break this out, otherwise babel moves it around and I can't reference it.

const arg_transformer_MemberExpression = function(path){
   if(path.node.property.name === "__tame_array"){
      this.flags.array_notation = true; 
      path.replaceWith(path.node.object);
   }
};

const arg_transformer = {
   MemberExpression: arg_transformer_MemberExpression
}

const defer_visitor = {
   WhileStatement(path, state){
      if(types.isIdentifier(path.node.test, { name: keywords.blocks.tokens["await"] })){ return path.skip(); }
   },
   CallExpression(path){
      if(path.node.callee.name !== "defer"){ return; }

      if(this._seen_array_notation && this.calls.length){
         throw node_error(path.node, "await statements with array syntax like defer(x[], y[]) can only contain one defer statement. there is a work around -- see the documentation.");
      }

      let call = {
         raw: false,
         unzip: false,
         args: [],
         lhs: null,
         node: path.node
      };

      this.calls.push(call);

      let arg_paths = path.get("arguments");

      if(!arg_paths.length){
         // this.index++;
         path.replaceWithSourceString(this.waiter_id + ".callback(false)");
         return;
      }

      let declare = null;
      let seen_array_notation = false;

      _.for(arg_paths.length, function(i){
         arg_path = arg_paths[i];

         if(i === 0){ 
            declare = call.declare = declaration(arg_path.node);
            call.raw = declare ? declare.raw : false;
            if(declare){ return; }
         }

         var flags = {};

         if(types.isMemberExpression(arg_path.node)){
            arg_transformer_MemberExpression.call({ flags }, arg_path);
         }else{
            arg_path.traverse(arg_transformer, { flags });
         }

         if(declare && declare.type && !types.isIdentifier(arg_path.node)){
            throw node_error(arg_path.node, "declarations inside defer statements can only be identifiers and array syntax.");
         }

         if(call.raw){ seen_array_notation = true; }

         if(flags.array_notation && !call.raw){ call.unzip = true; }

         enforce_array_notation_consistency(call, flags, seen_array_notation, arg_path.node);

         seen_array_notation = flags.array_notation; 

         let code = generate(arg_path.node).code; 

         call.args.push(code);

      });

      call.lhs = make_lhs(call, path.node);

      this._seen_array_notation = seen_array_notation;

      path.replaceWithSourceString(this.waiter_id + ".callback()");
   }
};

module.exports = defer_visitor;







