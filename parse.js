
// import * as babylon from "babylon";

var _ = require('dry-underscore');

var all_time = _.time();

var babylon = require("babylon");
var generate = require("babel-generator").default;
var traverse = require("babel-traverse").default;
var types = require("babel-types");

var fs = require('fs');

var steps = {};

function print_steps(){
   _.p("");
   _.each(steps, function(step, key){ _.p("code ", key, ": ", step); });
}

(function(){

   var code = fs.readFileSync("./samples/simple_call.tjs", "utf8");

   var block_keywords = ["tame", "await"];
   var var_keywords = ["var", "let"];

   steps.in = code;

   _.each(block_keywords, function(word){
      code = code.replace(_.regex("\\b" + word + "\\s*{", "g"), "while(___tame_await___){");
   });

   _.each(var_keywords, function(word){
      // var find_defer = /\bdefer[\s]*\(/gm;
      // \bdefer\s*\(\s*var\b
      var match = "\\b" + "defer" + "\\s*\\(\\s*" + word + "\\b";
      _.p("match: ", match);
      code = code.replace(_.regex(match, "g"), "defer(___tame_" + word + "___,");

   });

   steps.replaced = code;

   print_steps();

   var plugin = require('./tamejs.plugin.js')({
      types: types,
   });


   for(var i = 0; i < 1; i++){
      var ast = babylon.parse(code, {
          sourceType: "module",
          plugins: []
      });

      traverse(ast, plugin.visitor);
   }

   var code = generate(ast, {}, code);

   all_time("transform took:");

   steps.out = code.code;

})();
