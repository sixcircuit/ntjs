
(function(){

    function waiter(){
        this._pending = 0;
        this._callback = null;
        this._results = [];
    }

    waiter.prototype.cb = function(i){
        var self = this;
        self._pending++;
        var once = false;
        return(function(){
            if(once){ return; } once = true;
            self._pending--;
            self._results[i || 0] = arguments;
            self._try_finish();
        });
    };

    waiter.prototype._try_finish = function(){
        var self = this;
        if(self._pending !== 0){ return; }

        var once = false;
        (function finish(){
            if(self._callback){ return self._callback(self._results); }
            else{ 
                if(!once){ once = true;
                    console.log("error: tamejs: no callback to call back. nextTick'n till we get one.\n"); 
                }
                if(typeof process !== undefined){
                    process.nextTick(finish);
                }else{
                    setTimeout(finish, 1);
                }
            }
        })();
    };

    waiter.prototype.promise = function(){
        var self = this;
        return({ then: function(cb, err_cb){ 
            self._callback = cb;
            self._try_finish();  // if cb() is never called, make sure we don't hang
        } });
    };

    function factory(){ return(new waiter()); }

    if(typeof require === undefined){
        window.__tamejs_waiter = factory;
    }else{
        module.exports = factory;
    }

})();

