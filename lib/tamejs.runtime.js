
(function(){

   function waiter(){
      this._pending = 0;
      this._callback = null;
      this._results = [];
      this._finished = false;
      this._waiting_for_cb = false;
   }

   waiter.prototype.cb = function(save){
      var self = this;
      var i = self._pending++;
      var once = false;
      return(function(){
         if(once){ return; } once = true;
         self._pending--;
         if(save){ self._results[i] = arguments; }
         self._try_finish();
      });
   };

   waiter.prototype._finish = function(){
      if(this._finished){ return; } this._finish = true;
      return this._callback(this._results); 
   };

   waiter.prototype._try_finish = function(){
      var self = this;

      if(self._pending !== 0 || self._waiting_for_cb){ return; }

      self._waiting_for_cb = true;

      var no_callback = 0;

      (function wait_for_cb(){
         if(self._callback){ self._finish(); }
         else{ 
            no_callback++;
            if(no_callback > (50 * 1000)){ 
               throw (new Error("error: tamejs: no callback to call back after " + no_callback + " nextTicks. this is probably an error.\n"));
            }
            if(typeof setImmediate !== undefined){
               setImmediate(wait_for_cb); // nextTick starves the await on an immediate callback
            }else{
               setTimeout(wait_for_cb, 1);
            }
         }
      })();
   };

   waiter.prototype.promise = function(){
      var self = this;
      return({ then: function(cb, err_cb){ 
         self._callback = cb;
         self._try_finish();  // if cb() is never called, or was called immediately, make sure we don't hang
      } });
   };

   function factory(){ return(new waiter()); }

   if(typeof require === undefined){ window.__tamejs_waiter = factory; }else{ module.exports = factory; }

})();

