"use strict";

let _ = require('dry-underscore');


function keywords_class(source){
   this.source = source;
   this.runtime = { token: "", word: "" };
   this.blocks = {
      tokens: {},
      ordered: []
   }
   this.declarations = {
      tokens: {},
      words: {},
      ordered: [],
   }
   this.init();
};

keywords_class.prototype.tokenize = function(word){ word = _.ea(word); return("__tame_" + word.join("_")); }

keywords_class.prototype.is_token = function(token){ return(token.indexOf(this.tokenize("")) === 0); };

keywords_class.prototype.init = function(){
   var self = this;

   const source = self.source;

   self.runtime.word = source.runtime;
   self.runtime.match = source.runtime;
   self.runtime.token = self.tokenize(source.runtime);

   _.each(self.source.blocks, function(word){
      var token = self.tokenize("await");
      self.blocks.tokens[word] = token;
      self.blocks.ordered.push({ token, word, match: word });
   });
   
   function add_declaration(_word, _mod){
      let word, match, token;

      if(_mod){
         word = _word + " " + _mod;
         match = _word + "\\s+" + _mod;
         token = self.tokenize([_word, _mod]);
      }else{
         word = _word;
         match = _word;
         token = self.tokenize(_word);
      }

      self.declarations.tokens[word] = token;
      self.declarations.words[token] = word;
      self.declarations.ordered.push({ token, word, match });
   }

   _.each(self.source.declaration, function(word){
      // this order matters. "" must be after the modifiers otherwise the replacement will do the short strings before the long strings -- and not do the longer strings
      // for instance: let raw (the let gets changed, leaving the raw)
      _.each(_.concat(self.source.modifiers, ""), function(mod){
         add_declaration(word, mod);
      });
   });

   // make raw an independent keyword
   _.each(self.source.modifiers, function(mod){
      add_declaration(mod);
   });
}

function count_lines_to(code, pos){
   var count = 0;
   for(var i = 0; i <= pos; i++){
      if(code[i] === "\n"){ count++; }
   }
   return(count);
}

// replace this with dry/baseline _.indexOf
const indexOf = function(str, regex, start_pos) {
   if(_.isRegExp(regex)){
      var indexOf = str.substring(start_pos || 0).search(regex);
      return (indexOf >= 0) ? (indexOf + (start_pos || 0)) : indexOf;
   }else if(_.isString(regex)){ 
      return(str.indexOf(regex, start_pos || 0));
   }else{
      _.fatal("_.indexOf takes a string or a regex. we got: ", regex);
   }
}

keywords_class.prototype._replace_defer_array = function(code){

   var cursor = 0;
   var original_code = code;

   const defer_regex = /[(,\s]\s*defer\s*\(/;

   while((cursor = indexOf(code, defer_regex, cursor)) > 0){
      let start = -1;
      let end;
      let stack = [];
      let brace_stack = []; 

      for(let i = cursor; ; i++){
         var c = code[i];
         // _.p("code[", i, "]: '", c, "'");

         if(c === "("){ 
            stack.push("(");
            start = i;
         }else if(c === "{"){  brace_stack.push("{"); }
         else if(c === "}"){  
            if(!brace_stack.length){ throw _.error("syntax_error", "(near line " + count_lines_to(code, i) + "): missing matching parenthesis for defer statement (probably). got an unmatched close brace."); }
            brace_stack.pop();
         }else if(c === ")"){ stack.pop();
            if(stack.length === 0){
               if(start < 0){ throw _.error("syntax_error", "(near line " + count_lines_to(code, i) + "): found close parenthesis without matching open parenthesis in defer statement."); }
               end = i;
               let new_code = code.substring(start, end+1);
               new_code = _.replace(new_code, "[]", "[__tame_array]");
               code = code.substring(0, start) + new_code + code.substring(end+1);
               cursor = (start + new_code.length)
               // _.p("defer: ", new_code);
               break;
            }
         }
         if(c === ";"){
            throw _.error("syntax_error", "(near line " + count_lines_to(code, i) + "): missing matching parenthesis for defer statement (probably). got a semicolon.");
         }
      }
   }

   return(code);
};

keywords_class.prototype.replace = function(code){
   var self = this;

   _.each(self.blocks.ordered, function({ match, token }){
      var regex = "\\b" + match + "\\s*{"
      code = code.replace(_.regex(regex, "g"), "while(" + token + "){");
   });

   _.each(self.declarations.ordered, function({ match, token }){
      var regex = "\\b" + "defer" + "\\s*\\(\\s*" + match + "\\b";
      code = code.replace(_.regex(regex, "g"), "defer(" + token + ",");
   });

   code = self._replace_defer_array(code);

   return(code);
};

keywords_class.prototype.deplace = function(code){
   var self = this;

   _.each(self.blocks.ordered, function({ word, token }){
      code = _.replace(code, "while(" + token + "){", word + "{");
   });

   _.each(self.declarations.ordered, function({ word, token }){
      code = _.replace(code, token + ",", word);
   });

   code = _.replace(code, "__tame_array", "");
   return(code);
}

keywords_class.prototype.declaration = function(token){
   if(!this.is_token(token)){ return(null); }

   token = this.declarations.words[token];
   token = token.split(" ");

   let raw = false;
   let type = null;

   if(token[0] === "raw"){ raw = true; }
   else{
      type = token[0];
      raw = (token[1] === "raw");
   }

   return({ type, raw });
};


module.exports = new keywords_class({
   runtime: "waiter",
   blocks: ["await"],
   declaration: ["var", "let", "const"],
   modifiers: ["raw"]
});



