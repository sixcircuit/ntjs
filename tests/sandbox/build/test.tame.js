let __tame_waiter = null;

if (typeof require !== undefined) {
   __tame_waiter = require('tamejs').runtime;
} else if (typeof window !== undefined) {
   __tame_waiter = window.tamejs.runtime;
}

exports.run = async function (delay, callback) {
   const _tame_w = __tame_waiter(true);

   {
      setTimeout(_tame_w.callback(false), delay);
   }

   await _tame_w.wait();
   return callback();
};
//# sourceMappingURL=test.tame.js.map