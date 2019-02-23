"use strict";

let _ = require('dry-underscore');


function keywords_class(source){
   this.source = source;
   this.in = {
      blocks: {},
      declarations: {}
   }
   this.out = {
      blocks: {},
      declarations: {}
   }
   this.init();
};

keywords_class.prototype.tokenize = function(word){ word = _.ea(word); return("__tame_" + word.join("_")); }

keywords_class.prototype.is_token = function(token){ return(token.indexOf(this.tokenize("")) === 0); };

keywords_class.prototype.init = function(){
   var self = this;

   _.each(self.source.runtime, function(word){
      var token = self.tokenize(word);
      self.in[word] = token
      self.out[token] = word;
   });

   _.each(self.source.blocks, function(word){
      var token = self.tokenize("await");
      self.in[word] = token
      self.in.blocks[word] = token
      self.out[token] = word;
      self.out.blocks[token] = word;
   });

   _.each(self.source.declaration, function(word){
      _.each(_.concat("", self.source.modifiers), function(mod){
         if(mod){
            let key = word + "\\s+" + mod;
            let val = self.tokenize([word, mod]);
            self.in[key] = val;
            self.in.declarations[key] = val;
            self.out[val] = word + " " + mod;
            self.out.declarations[val] = word + " " + mod;
         }else{
            let key = word;
            let val = self.tokenize(word);
            self.in[key] = val;
            self.in.declarations[key] = val;
            self.out[val] = key;
            self.out.declarations[val] = key;
         }
      });
   });
}

function count_lines_to(code, pos){
   var count = 0;
   for(var i = 0; i <= pos; i++){
      if(code[i] === "\n"){ count++; }
   }
   return(count);
}

keywords_class.prototype._replace_defer_array = function(code){

   var cursor = 0;
   var original_code = code;
   

   while((cursor = code.indexOf("defer(", cursor)) > 0){
      let start;
      let end;
      let stack = [];
      for(let i = cursor; ; i++){
         // _.p("code[", i, "]: '", code[i], "'");
         if(code[i] === "("){ 
            stack.push("(");
            start = i;
         }else if(code[i] === ";" || code[i] === "}"){
            throw _.error("syntax_error", "(near line " + count_lines_to(code, i) + "): missing matching parenthesis for defer statement.");
         }else if(code[i] === ")"){ 
            if(stack.length){ stack.pop(); }
            else{ 
            } 
            if(stack.length === 0){
               end = i;
               let new_code = code.substring(start, end+1);
               new_code = _.replace(new_code, "[]", "[__tame_array]");
               code = code.substring(0, start) + new_code + code.substring(end+1);
               cursor = (start + new_code.length)
               // _.p("defer: ", new_code);
               break;
            }
         }
      }
   }

   return(code);
};

keywords_class.prototype.replace = function(code){
   var self = this;

   _.each(self.in.blocks, function(token, word){
      var match = "\\b" + word + "\\s*{"
      code = code.replace(_.regex(match, "g"), "while(" + token + "){");
   });

   _.each(self.in.declarations, function(token, word){
      var match = "\\b" + "defer" + "\\s*\\(\\s*" + word + "\\b";
      code = code.replace(_.regex(match, "g"), "defer(" + token + ",");
   });

   code = self._replace_defer_array(code);

   return(code);
};

keywords_class.prototype.deplace = function(code){
   var self = this;

   _.each(self.out.blocks, function(word, token){
      code = _.replace(code, "while(" + token + "){", word + "{");
   });

   _.each(self.out.declarations, function(word, token){
      code = _.replace(code, token + ",", word);
   });

   code = _.replace(code, "__tame_array", "");
   return(code);
}

module.exports = keywords_class;





