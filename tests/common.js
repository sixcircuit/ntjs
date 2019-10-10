
var _ = require('dry-underscore');

var { eq, ne, ok } = _.test;

// TODO: replace all of this with _.test.no, _.test.ne, _.test.timer, _.test.echo and _.test.inc

function no(v){ return ok(!v); }
var ne = function(actual, expected, message){
   var diff = _.diff(actual, expected);
   if(!diff){
      message = message || _.format("actual and expected are equal. we expected not equal. actual: ", actual);
      var err = _.error("is_eq", message);
      throw(err);
   }
};



function async_echo(callback){ 
   var args = _.a(arguments).slice(1);

   var delay = (Math.random() * 10);

   if(_.isNumber(callback)){ 
      delay = callback;
      callback = args[0];
      args.shift();
   }

   if(delay < 0){ return callback.apply(null, args); }

   setTimeout(function(){
      return callback.apply(null, args);
   }, delay);
}

function async_inc(callback, i){ 
   setTimeout(function(){
      return callback(i+1);
   }, (Math.random() * 10));
}

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

var async = { echo: async_echo, inc: async_inc };

module.exports = {
   _,
   async,
   timer,
   ok, eq, no, ne
};
