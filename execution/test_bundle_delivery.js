const http = require('http');

const bundleUrl = 'http://localhost:3001/assets/index-DKLnWdgm.js';
console.log(`Testing delivery of: ${bundleUrl}`);

const req = http.get(bundleUrl, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`TYPE: ${res.headers['content-type']}`);
    console.log(`SIZE: ${res.headers['content-length']}`);

    let bytes = 0;
    res.on('data', (chunk) => {
        bytes += chunk.length;
    });

    res.on('end', () => {
        console.log(`Downloaded ${bytes} bytes.`);
        if (res.statusCode === 200 && bytes > 500000) {
            console.log('SUCCESS: JS Bundle delivered correctly.');
        } else {
            console.log('FAILURE: Bundle delivery incomplete or failed.');
        }
    });
});

req.on('error', (e) => {
    console.log(`ERROR: ${e.message}`);
});
