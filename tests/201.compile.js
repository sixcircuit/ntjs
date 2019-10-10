
var { _, eq, ne, ok, no, timer, async } = require('./common.js');

const fs = require('fs');
//
// TODO: add these to _.fs
_.fs.cp = fs.copyFile;
_.fs.cp.sync = fs.copyFileSync;

_.fs.touch = function(){};
_.fs.touch.sync = function(path, time){
   time = time || _.timestamp();
   if(_.isNumber(time)){ time /= 1000; }
   try{
      fs.utimesSync(path, time, time);
   }catch(err){
      fs.closeSync(fs.openSync(path, 'w'));
   }
};

// TODO: make this _.path when you update dry-underscore
const pfun = _.path.fun;

const tamejs = require('../');

const data = pfun(_.path.normalize(__dirname + "/sandbox/"));

test("require", function(done){
   
   store = pfun(data("in_place"));

   // TODO: make this _.fs.rm.sync

   try{ _.fs.rmdir.sync(store()); }catch(e){ _.p(e); }

   _.fs.mkdir.sync(store());

   _.fs.cp.sync(data("test.tjs"), store("test.tjs"));

   const gen = tamejs.require({ in: store("test.tjs"), cache: false }) // out: ./.test.tame.js

   ok(gen.code);

   no(_.fs.exists.sync(store(".test.tame.js")));

   tamejs.require({ in: store("test.tjs") }) // out: ./.test.tame.js

   ok(_.fs.exists.sync(store(".test.tame.js")));
   eq(_.fs.read_file.sync(store(".test.tame.js")), gen.code);

   const old_stats = _.fs.stat.sync(store(".test.tame.js"));

   const cached = tamejs.require({ in: store("test.tjs") }) // out: ./.test.tame.js

   ok(cached.cached);
   eq(cached.code, gen.code);

   let new_stats = _.fs.stat.sync(store(".test.tame.js"));

   eq(old_stats, new_stats);

   _.fs.touch.sync(store("test.tjs"), (_.timestamp() + _.ms.minute(1)));

   ok(_.fs.stat.sync(store(".test.tame.js")).mtime < _.fs.stat.sync(store("test.tjs")).mtime);

   // we have to wait one second, because mtimes are epoch times. 
   setTimeout(function(){

      tamejs.require({ in: store("test.tjs") }) // out: ./.test.tame.js

      new_stats = _.fs.stat.sync(store(".test.tame.js"));

      ne(old_stats, new_stats);

      done();

   }, 1100);

});


/*
test("compile out root", function(done){

   tamejs.compile({ in: "somefile.tjs", out: "./build" }) // ./build/somefile.js

   ok(false);

   done();

});

test("compile out path", function(done){

   tamejs.compile({ in: "somefile.tjs", out: "./build/new_name.blah.foo" }) // ./build/somefile.blah.foo

   ok(false);

   done();

});

*/

