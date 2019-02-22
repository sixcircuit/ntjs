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

   return(code);
}

module.exports = keywords_class;





