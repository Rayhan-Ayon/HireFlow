/**
 * hello_world.js
 * A simple deterministic script to demonstrate the execution layer.
 */

const fs = require('fs');
const path = require('path');

function main() {
    console.log("Hello from the Execution Layer!");
    console.log("Current Directory:", process.cwd());
    
    // Example of writing to .tmp
    const tmpPath = path.join(process.cwd(), '.tmp', 'hello.txt');
    try {
        fs.writeFileSync(tmpPath, 'Hello World at ' + new Date().toISOString());
        console.log(`Successfully wrote to ${tmpPath}`);
    } catch (err) {
        console.error("Error writing to .tmp:", err);
    }
}

main();
