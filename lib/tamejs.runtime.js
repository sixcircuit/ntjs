
// TODO: include from dry bundle

if(typeof require === 'undefined'){ window.__tamejs_waiter = library(); }else{ module.exports = library(); }

function library(){

   // this can't use any _ (baseline) functions. it's needs to be able to be used independently of _.
   const _ = null;

   function waiter(options){
      if(typeof options === 'boolean'){ options = { raw: options }; }
      options = options || {};

      this._raw = (options.raw === true);
      this._pending = 0;
      this._total = 0;
      this._callback = null;
      this._rows = [];
      this._columns = [];
      this._errors = [];
      this._contexts = [];
      this._waited = false;
      this._finished = false;
   }

   function rk(prop){
      return(function(key){
         if(key !== undefined){ return(this[prop][key]); }
         else{ return(this[prop]); }
      });
   }

   waiter.prototype.pending = function(){ return(this._pending); }; 
   waiter.prototype.total = function(){ return(this._total); };
   waiter.prototype.raw = function(){ return(this._raw); };
   waiter.prototype.contexts = rk("_contexts"); 
   waiter.prototype.rows = rk("_rows");
   waiter.prototype.columns = function(index){
      if(index === undefined){ return(this._columns); }
      return(this._columns[index] || []);
   };

   waiter.prototype.errors = function(full){ 
      if(!this._errors.length){ return(null); }

      if(full){ return(this._errors); }
      else{ 
         var errs = [];
         for(let i = 0; i < this._errors.length; i++){
            errs.push(this._errors[i].error);
         } 
         return(errs);
      }
   };

   waiter.prototype._record = function(call_index, context, args){
      const self = this;

      if(context !== undefined){ self._contexts[call_index] = context; }

      const err = args[0];

      if(err){
         self._errors.push({ error: err, index: call_index, context: self.contexts(call_index) });
      }

      let offset = 1;
      if(self.raw()){ offset = 0; }

      self._rows[call_index] = [];

      for(let j = 0; j < (args.length - offset); j++){
         if(self._columns[j] === undefined){ self._columns[j] = []; }
         self._columns[j][call_index] = args[j + offset];
         self._rows[call_index][j] = args[j + offset];
      }
   }

   waiter.prototype.callback = function(context){
      const self = this;
      const call_index = self._total; // unlike pending, this always reflects the order we were called
      self._pending++; self._total++;
      let once = false;

      return(function(){
         if(once){ return; } once = true;
         self._pending--;
         if(context === false){ return self._try_finish(); }

         self._record(call_index, context, arguments);

         return self._try_finish();
      });
   };

   waiter.prototype._finish = function(){
      if(this._finished){ return; } this._finished = true;

      const errs = this.errors();

      if(!this.raw() && errs){ return this._callback(errs); }

      const args = [null];

      if(this._result_format === "callback"){
         for(let i = 0; i < this._callback.length - 1; i++){
            args.push(this.columns(i));
         }
      }else if(this._result_format === "rows"){
         args.push(this._rows);
      }else if(this._result_format === "columns"){
         args.push(this._columns);
      }

      return this._callback.apply(null, args); 
   };

   waiter.prototype._setImmediate = function(f){
      /* istanbul ignore else */
      if(typeof setImmediate === 'function'){
         setImmediate(f); 
      }else{
         setTimeout(f, 1);
      }
   };

   waiter.prototype._try_finish = function(){
      const self = this;

      let no_wait_count = 0;

      (function finish_wait(){
         if(self._pending !== 0){ return; } // if a callback got added, they'll call _try_finish again. don't keep actively waiting for no reason.

         /* istanbul ignore if */
         if(no_wait_count++ > (50 * 1000)){ throw (new Error("error: waiter: wait hasn't been called after " + (no_wait_count - 1) + " nextTicks. this is probably an error.\n")); }

         if(self._waited){ self._finish(); }
         else{ self._setImmediate(finish_wait); } // nextTick starves the await on an immediate callback, only wait again if pending === 0 and callback isn't set.
      })();
   };

   waiter.prototype.wait = function(result_format, cb){
      const self = this;

      if(typeof result_format === "function"){
         cb = result_format; result_format = null;
      }

      if(cb){
         self._waited = true;
         self._callback = cb;
         self._result_format = result_format || "callback"

         return self._try_finish();
      }

      return({ 
         then: function(on_fulfilled, on_rejected){ 
            const pcb = function(err, result){
               if(err){ 
                  if(on_rejected){ return on_rejected(err); }
                  else{ throw(err); }
               }else{ 
                  if(on_fulfilled){ return on_fulfilled(result); }
               }
            }
            self.wait(result_format || "rows", pcb);
         } 
      });
   };

   function factory(options){ return(new waiter(options)); }

   factory.library = library;

   return(factory);
}

