
const { _ } = require("./common.js");

var module_class = require('module');

// TODO: make this _.path when you update dry-underscore
const pfun = _.path.fun;
_.path.has_slash = function(path){ return(_.last(path) === "/"); }

const tamejs = {
   parse: require('./parser.js'),
   runtime: require('./tamejs.runtime.js'),
};

function default_name(file_name){ return _.path.extension(file_name, "tame.js", "tjs"); }

function get_file_info(options){

   const in_path = options.in;

   let file = { 
      in: { path: in_path, root: pfun(_.path.dir(in_path)), name: _.path.file(in_path) } 
   };


   if(options.out){

      let out_root = file.in.root;
      let out_name = default_name(file.in.name);

      if(_.isString(options.out)){
         if(_.path.has_slash(options.out)){
            out_root = pfun(options.out);
         }else{
            out_root = pfun(_.path.dir(options.out));
            out_name = _.path.file(options.out);
         }
      }

      file.out = { path: out_root(out_name), root: out_root, name: out_name };
   }

   return(file);
}

tamejs.compile = function(options, callback){

   if(callback){ return _.fatal("async compile not implemented."); }

   let total_time = _.time();

   const file = get_file_info(options);

   var parse_options = _.pick(options, ["inline_map", "map", "stages", "runtime"]);
   parse_options = _.merge(parse_options, { path: file.in.path });

   const gen = tamejs.parse.file(parse_options);

   if(file.out){
      if(options.map){ 
         file.map = { path: file.out.path + ".map", root: file.out.root, name: file.out.name + ".map" };
         _.fs.write_file.sync(file.map.path, _.inspect(gen.map));
         gen.code = gen.code + `\n//# sourceMappingURL=${file.map.name}`
      }

      _.fs.write_file.sync(file.out.path, gen.code);

      if(options.stages){
         file.stages = {};

         // TODO: update this with { index }
         _.each(gen.stages, function(stage, index){
            // const stage_file = _.path.extension(file.out.path, name + ".js", "js");
            const stage_file = file.out.path + `.${index}.${stage.name}`
            _.fs.write_file.sync(stage_file, stage.code);
            file.stages[stage.name] = { path: stage_file, root: file.out.root, name: _.path.file(stage_file) };
         });
      }
   }

   return _.merge(gen, { files: file, time: total_time() });
};


// TODO: move this to _.fs.dirty
// add async version as well

function dirty(src_file, built_file){

   try {
      const built_stats = _.fs.stat.sync(built_file);
      const src_stats = _.fs.stat.sync(src_file);
      return(built_stats.mtime <= src_stats.mtime || built_stats.size === 0);
   }catch(e){}

   return(true);
}

function get_cache_file_info(options){

   var file = get_file_info(options);

   delete file.out;

   let cache_name = default_name(file.in.name);
   let cache_root;

   if(options.cache === true){
      cache_root = file.in.root;
      cache_name = _.path.hide(cache_name);
   }else if(_.isString(options.cache)){
      if(_.path.has_slash(options.cache)){
         cache_root = pfun(options.cache);
      }else{
         cache_root = pfun(_.path.dir(options.cache));
         cache_name = pfun(_.path.file(options.cache));
      }
   }

   if(cache_root){
      file.cache = { root: cache_root, path: cache_root(cache_name), name: cache_name };
   }

   return(file);
}

tamejs.require = function(options){

   let total_time = _.time();

   if(options.cache === undefined){
      options = _.merge(options, { cache: true });
   }

   var file = get_cache_file_info(options);

   if(file.cache && !dirty(file.in.path, file.cache.path)){
      try{ 
         let cache = _.fs.read_file.sync(file.cache.path);
         return({ code: cache, cached: true, time: total_time() });
      }catch(e){}
   }

   // TODO: make this out: _.get(file, "cache.path"));
   const gen = tamejs.compile({ 
      in: file.in.path, 
      out: file.cache ? file.cache.path : null, 
      runtime: options.runtime 
   });

   if(options.code === true){ return(gen); }
   else{
      var mod = new module_class();
      mod._compile(gen.code, file.in.path);
      return(mod.exports);
   }
};

tamejs.register = function(options){
   options = options || {};

   const ext = options.extension || "tjs";

   require.extensions["." + ext] = function(module, file_path){
      const gen = tamejs.require(_.merge(options, { in: file_path, code: true }));
      module._compile(gen.code, file_path);
   };
};


module.exports = tamejs;
