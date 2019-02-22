
var _ = require('dry-underscore');

function async_wait(callback, msec){ 
   setTimeout(function(){
      return callback(msec);
   }, msec);
}

function async_echo(callback){ 
   var args = _.a(arguments).slice(1);

   var delay = (Math.random() * 10);

   if(_.isNumber(callback)){ 
      delay = callback;
      callback = args[0];
      args.shift();
   }

   setTimeout(function(){
      return callback.apply(null, args);
   }, delay);
}

function async_inc(callback, i){ 
   setTimeout(function(){
      return callback(i+1);
   }, (Math.random() * 10));
}

function immediate(callback, x){ 
   var args = _.a(arguments).slice(1);
   return callback.apply(null, args);
}

var { eq, ok } = _.test;
var async = { echo: async_echo, inc: async_inc, wait: async_wait };

module.exports = {
   _,
   async,
   immediate,
   ok, eq
};
