
// TODO: remove this
var _ = require('dry-underscore');

(function(){

   function waiter(){
      this._pending = 0;
      this._total = 0;
      this._callback = null;
      this._rows = [];
      this._columns = [];
      this._state = "";
   }

   waiter.prototype.cb = function(save){
      var self = this;
      var i = self._total; // unlike pending, this always reflects the order we were called
      self._pending++; self._total++;
      var once = false;
      return(function(){
         if(once){ return; } once = true;
         self._pending--;
         if(save){ 
            // if we're iterating for columns anyway, we might as well turn rows into a proper array
            // given it doesn't cost much, consistency is good.
            // alternative is self._rows[i] = arguments; // which it was, before we added column support.
            self._rows[i] = [];
            for(let j = 0; j < arguments.length; j++){
               if(self._columns[j] === undefined){ self._columns[j] = []; }
               self._columns[j][i] = arguments[j];
               self._rows[i][j] = arguments[j];
            }
         }
         self._try_finish();
      });
   };

   waiter.prototype._finish = function(){
      if(this._state === "finished"){ return; } this._state = "finished";
      if(this._return_columns){
         return this._callback(this._columns); 
      }else{
         return this._callback(this._rows); 
      }
   };

   // TODO: use _.defer if you can
   waiter.prototype._setImmediate = function(f){
      if(typeof setImmediate !== undefined){
         setImmediate(f); 
      }else{
         setTimeout(f, 1);
      }
   };

   waiter.prototype._try_finish = function(deferred){
      var self = this;

      var no_callback = 0;

      (function finish_wait(){
         if(self._pending !== 0){ return; } // if a callback got added, they'll call _try_finish again. don't keep actively waiting for no reason.

         if(no_callback++ > (50 * 1000)){ throw (new Error("error: tamejs: no callback to call back after " + (no_callback - 1) + " nextTicks. this is probably an error.\n")); }

         if(self._callback){ self._finish(); }
         else{ self._setImmediate(finish_wait); } // nextTick starves the await on an immediate callback, only wait again if pending === 0 and callback isn't set.
      })();
   };

   waiter.prototype.columns = function(){
      this._return_columns = true;
      return this.promise()
   };

   waiter.prototype.rows = function(){
      return this.promise()
   };

   waiter.prototype.promise = function(){
      var self = this;
      return({ then: function(cb, err_cb){ 
         self._callback = cb;
         // if cb() is never called, or was called immediately, make sure we don't hang
         // we always wait one cycle. weird stuff can happen if the caller immediately calls back a cb() with a multiple defer block: we can think we got all our callbacks when other callbacks haven't be registered yet.
         self._setImmediate(function(){ self._try_finish(); });
      } });
   };

   function factory(){ return(new waiter()); }

   if(typeof require === undefined){ window.__tamejs_waiter = factory; }else{ module.exports = factory; }

})();

