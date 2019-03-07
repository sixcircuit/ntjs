
var _ = require('dry-underscore');

var { eq, ok } = _.test;

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

// replace this with _.test.timer
function timer(abs){
   let start = _.timestamp();
   return(function(expected_diff, margin){
      margin = margin || 0;
      const diff = _.timestamp() - start;
      if(diff < expected_diff){
         let err = _.error("not_eq", `timer expected: ${diff} >= ${expected_diff}`);
         err.actual = diff;
         err.expected = expected_diff;
         throw err;
      }else if(diff > (expected_diff + margin)){
         let err = _.error("not_eq", `timer expected: ${diff} < ${ expected_diff + margin } (${expected_diff} + margin(${margin}))`);
         err.actual = diff;
         err.expected = expected_diff;
         throw err;
      }
      if(abs !== true){ start = _.timestamp(); }
   });
}


var async = { echo: async_echo, inc: async_inc, wait: async_wait };

module.exports = {
   _,
   async,
   timer,
   immediate,
   ok, eq
};
