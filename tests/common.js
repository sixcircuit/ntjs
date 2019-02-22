
var _ = require('dry-underscore');

function async_echo(callback){ 
   var args = _.a(arguments).slice(1);
   setTimeout(function(){
      return callback.apply(null, args);
   }, Math.random() * 10);
}

var { eq, ok } = _.test;

module.exports = {
   async_echo,
   ok, eq
};
