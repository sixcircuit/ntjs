
var _ = require('dry-underscore');

var src = require('fs').readFileSync('./sample.tjs', 'utf8');

var find_await_block = /\bawait[\s]*{((?:.|\s)*?)}/gm;

// console.log(src);
var find_defer = /\bdefer[\s]*\(/gm;

var match = find_await_block.exec(src);

// don't forget to do this recursively after you do the outer await match

/*
for(var i = 0; match !== null; i++){

    _.p("match[", i, "][0]: ", match[0]);
    _.p("match[", i, "][1]: ", match[1]);

    var defer_match = find_defer.exec(match[1]);
    _.p("defer_match[", i, "][0]: ", defer_match[0]);
    _.p("defer_match[", i, "][1]: ", defer_match[1]);
    _.p("defer_match[", i, "][2]: ", defer_match[2]);

    break;
    match = find_await_block.exec(src);
}


try{
await{
   for(var i = 0; i < 10; i++){
       try{
           call(1, 2, _.plumb(defer(var x[i], y[i], z[i]), callback));
       }catch(e){}
   }
}
}catch(e){
}

try{
(async function(){
   var x, y, z; // the "," is imperitive so you don't make global variables

   for(var i = 0; i < 10; i++){
       try{
       call(1, 2, _.plumb(__awaiter("uuid").wait(i), callback));
       }catch(e){}
   }

    var [x, y, z] = await __awaiter("uuid").promise();
})();
}catch(e){

}
*/

/*
try{
(async function(){
   var x, y, z; // the "," is imperitive so you don't make global variables

   for(var i = 0; i < 10; i++){
       try{
       call(1, 2, _.plumb(__waiter.get("uuid").wait(i), callback));
       }catch(e){}
   }

    var [x, y, z] = await { then: function(cb, err_cb){
        __waiter.get("uuid").wait_f(cb);
    } };
})();
}catch(e){
}
*/

var __waiter = (function(){

    function waiter(key){
        this._key = key;
        this._pending = 0;
        this._callback = null;
        this._results = [];
    }

    var factory = {};
    var _waiters = {};

    factory.get = function(key){
        var w = _waiters[key];
        if(!w){ w = _waiters[key] = new waiter(key) };
        return(w);
    };

    factory.destroy = function(key){ delete _waiters[key]; };

    waiter.prototype.cb = function(i){
        var self = this;
        return(function(){
            if(i === undefined){
                self._results = arguments;
            }else{
                self._results[i] = arguments;
            }
            if(self._pending === 0){
                var first = true;
                (function finish(){
                    factory.destroy(self._key);
                    if(self._callback){ return self._callback(self._results); }
                    else{ 
                        if(first){ 
                            first = false;
                            process.stderr.write("error: tamejs: no callback to call back nextTicking till we get one.\n"); 
                        }
                        process.nextTick(finish);
                    }
                })();
            }
        });
    };

    waiter.prototype.promise = function(){
        var self = this;
        return({ then: function(cb, err_cb){ self._callback = cb; } });
    };

    return(factory);
})();

function echo(callback){
    var args = _.a(arguments);
    args.shift();
    setTimeout(function(){
        callback.apply(null, args);
    }, 3000);
}

(async function(){
    _.p("waiting.");
    for(var i = 0; i < 10; i++){
        echo(__waiter.get("test_key").cb(i), 1, 2, 3);
    }
    var results = await __waiter.get("test_key").promise();
    _.p("results: ", results);
    _.p("done.");
})();

/*
(async function(){
    _.p("waiting.");
    var x = await { then: function(f, e){ setTimeout(e, 3000); } }
    _.p("back.");
})();
*/

/*
var count = 0;

function foo(it) {
    setTimeout(function(){
        it.next();
    }, 20000);
}

const iterator = foo(i);

for(var i = 0; i < 3; i++){
    _.p("waiting.");
    (function* it(){
        foo(it);
        yeild
    })();
    _.p("back.");
}
*/

