
```
var a = [];
for(var i = 0; i < 100; i++){
   await{ some_call(_.plumb(defer(a[_]), _.once(callback))); }
}
```

```
await{
   _.each.async(a, function(v, loop){
      await{ setTimeout(defer(), 100); }
      loop.next();
   }, defer());
}
```
