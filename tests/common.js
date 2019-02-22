
var _ = require('dry-underscore');

function async_echo(callback){ 
   var args = _.a(arguments).slice(1);
   setTimeout(function(){
      return callback.apply(null, args);
   }, (Math.random() * 10));
}

function async_inc(callback, i){ 
   setTimeout(function(){
      return callback(i+1);
   }, (Math.random() * 10));
}

var { eq, ok } = _.test;
var async = { echo: async_echo, inc: async_inc };

module.exports = {
   _,
   async,
   ok, eq
};
