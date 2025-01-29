# ts2py
A library to create interfaces from TypeScript to Python3

## Installation

```
npm i ts2py
```

## Usage 

```ts
// Import factory function
import { makePythonInterface } from "ts2py";

// Create the interface
const {call, cleanup} = makePythonInterface({
    // Supply an array of custom function definitions, note the argument (*)
    processFunctions: [
        `process_func = lambda line: 'Hello at ' + line`
    ]
});

// Use the interface
async function main() {
    for(let i = 0; i < 100; ++i) {
        // Call your function from the interface: 
        // - process_func is the name of the function inside Python3 script
        // - new Date().toISOString() will be passd as `line` to the Python function
        // - as for now, arguments must be JSON.stringify()'able!
        const result = await call('process_func', new Date().toISOString());

        // Use the results
        console.log(i, result);
    }
}

// Do not forget to cleanup to not leave your node process stuck at exit
main().then(cleanup);
```