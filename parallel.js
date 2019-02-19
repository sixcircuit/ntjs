
function wait(ms, data) {
  return new Promise( resolve => setTimeout(resolve.bind(this, data), ms) );
}

/** 
 * This will run in series, because 
 * we call a function and immediately wait for it's result, 
 * so this will finish in 1s.
 */
async function series() {
  return {
    result1: await wait(500, 'seriesTask1'),
    result2: await wait(500, 'seriesTask2'),
  }
}

/** 
 * While here we call the functions first,
 * then wait for the result later, so 
 * this will finish in 500ms.
 */
async function parallel() {
  const task1 = wait(500, 'parallelTask1');
  const task2 = wait(500, 'parallelTask2');

  results = [];
  results[0] = await task1;
  results[1] = await task2;
  
  return(results);
  return [
    await task1,
    await task2,
  ]
}

async function taskRunner(fn, label) {
  const startTime = (new Date()).valueOf();
  console.log(`Task ${label} starting...`);
  let result = await fn();
  console.log(`Task ${label} finished in ${ Number.parseInt((new Date()).valueOf() - startTime) } miliseconds with,`, result);
}

void taskRunner(series, 'series');
void taskRunner(parallel, 'parallel');


/* 
 * The result will be:
 * Task series starting...
 * Task parallel starting...
 * Task parallel finished in 500 milliseconds with, { "result1": "parallelTask1", "result2": "parallelTask2" }
 * Task series finished in 1001 milliseconds with, { "result1": "seriesTask1", "result2": "seriesTask2" }
 */
