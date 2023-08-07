ntjs - new tamejs
======

This package is a completely rewritten and modernized version of the original tamejs by Max Krohn @maxtaco. Tamejs was a JavaScript language extension developed in 2011 (long, long before native support for `await` and promises landed in the language). Tamejs adds one feature to JavaScript: an `await` keyword that allows asynchronous *callback* style code to work almost exactly like `await` does today. This is what setTimeout would look like:

```
   console.log("1");
   await{ setTimeout(defer(), 100); }
   console.log("2");

   // output:
   // 1
   // * waits 100 ms *
   // 2
```

The best way to get a sense of how it works is to take a look at all the tests. If you want to understand what the compiled files look like, run the tests and examine the .js files that are built and stored next to the corresponding .tjs test files.

Tamejs was the best way to avoid callback hell for years, and I used it on all my projects. The goal of this project is to support legacy codebases that use tamejs, and for me to have some fun with transpilers. Also, if you're still attached to callbacks over promises, this is a hugely helpful project. It also supports a much more elegant parallelism (with a higher degree of control) than `await Promise.all`

Tamejs is fully compatible with existing JS code bases. You can incrementally use tamejs if you'd like.  Tamejs is a strict superset of JavaScript. All JavaScript is valid Tamejs. You can mix the modern `await` and the tamejs version in the same file (but not the same function).

The goal of modernizing the package is two fold: supporting modern JavaScript as the input language (the old version only supported JavaScript circa 2011). Also, because of the addition of a native `await` keyword the transpiling process becomes significantly easier and the resulting code is readable and produces manageable errors. The old version compiled code using a continuation passing style which worked but produced output files that were basically unreadable gobbledygook. The error stack traces were worse than gobbledygook. The costs were worth the benefit of readable maintainable input code, but you don't have to make that trade off anymore.

It works in the browser if you include lib/tamejs.runtime.js on the page before your transpiled files. 

There's a lot of test coverage. If you'd like syntax examples, check the test cases in /tests. It should be a drop in for the old tamejs. If you run into any compatibility issues, let me know.

The rest of the README is mostly taken from the original tamejs project.

There are a few new keywords and features I need to write up (you can see them in the tests), but they are extensions of the syntax so this should be a drop in replacement for the original tamejs package.

to run tests:

1. npm install
2. ./test

Code Examples
--------
Here is a simple example that prints "hello" 10 times, with 100ms delay slots in between:

```javascript  
for (var i = 0; i < 10; i++) {
    await{ setTimeout (defer(), 100); }
    console.log ("hello");
}
```

There is one new language addition here, the `await { ... }` block, and also one new primitive function, `defer`.  The two of them work in concert.  A function must "wait" at the close of a `await` block until all `defer`rals made in that `await` block are fulfilled.  The function `defer` returns a callback, and a callee in an `await` block can fulfill a deferral by simply calling the callback it was given.  In the code above, there is only one deferral produced in each iteration of the loop, so after it's fulfilled by `setTimer` in 100ms, control continues past the `await` block, onto the log line, and back to the next iteration of the loop.  The code looks and feels like threaded code, but is still in the asynchronous idiom (if you look at the rewritten code output by the *tamejs* compiler).

This next example does the same, while showcasing power of the `await{..}` language addition.  In the example below, the two timers are fired in parallel, and only when both have fulfilled their deferrals (after 100ms), does progress continue...

```javascript
for (var i = 0; i < 10; i++) {
    await { 
        setTimeout(defer(), 100); 
        setTimeout(defer(), 10); 
    }
    console.log ("hello");
}
```

Now for something more useful. Here is a parallel DNS resolver that will exit as soon as the last of your resolutions completes:

```javascript
var dns = require("dns");

function do_one (cb, host) {
    var err, ip;
    await{ dns.resolve (host, "A", defer (err, ip)); }
    if (err) { console.log ("ERROR! " + err); } 
    else { console.log (host + " -> " + ip); }
    cb();
}

function do_all (lst) {
    await {
        for (var i = 0; i < lst.length; i++) {
            do_one (defer (), lst[i]);
        }
    }
}

do_all (process.argv.slice (2));
```

You can run this on the command line like so:

    node src/13out.js yahoo.com google.com nytimes.com okcupid.com tinyurl.com

And you will get a response:

    yahoo.com -> 72.30.2.43,98.137.149.56,209.191.122.70,67.195.160.76,69.147.125.65
    google.com -> 74.125.93.105,74.125.93.99,74.125.93.104,74.125.93.147,74.125.93.106,74.125.93.103
    nytimes.com -> 199.239.136.200
    okcupid.com -> 66.59.66.6
    tinyurl.com -> 195.66.135.140,195.66.135.139

If you want to run these DNS resolutions in serial (rather than parallel), then the change from above is trivial: just switch the order of the `await` and `for` statements above:

```javascript  
function do_all (lst) {
    for (var i = 0; i < lst.length; i++) {
        await {
            do_one (defer (), lst[i]);
        }
    }
}
```

Composing Serial And Parallel Patterns
--------------------------------------

In Tame, arbitrary composition of serial and parallel control flows is possible with just normal functional decomposition.  Therefore, we don't allow direct `await` nesting.  With inline anonymous JavaScript functions, you can consicely achieve interesting patterns.  The code below launches 10 parallel computations, each of which must complete two serial actions before finishing:

```javascript
function f(cb) {
    await {
        for (var i = 0; i < n; i++) {
            (function (cb) {
                await { setTimeout (defer (), 5*Math.random ()); }
                await { setTimeout (defer (), 4*Math.random ()); }
                cb();
             })(defer ());
        }
    }
    cb();
}
```

API and Documentation
---------------------

### defer

`defer` can be called in one of two ways.


#### Inline Variable Declaration

The first allows for inline declaration of the callback slot
variables:

```javascript

await { dns.resolve ("okcupid.com", defer (var err, ip)); }

```

In the tamed output code, the variables `err` and `ip` will be
declared right before the start of the `await` block that contains them.


#### Generic LHS Assignment w/ "Rest" Parameters

The second approach does not auto-declare the callback slot variables, but
allows more flexibility:

```javascript
var d = {};
var err = [];
await { dns.resolve ("okcupid.com", defer (err[0], d.ip)); }
```
This second version allows anything you'd normally put on the
left-hand side of an assignment.

