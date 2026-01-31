const http = require('http');

console.log('Testing connectivity to http://localhost:3001/ ...');

const req = http.get('http://localhost:3001/', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('BODY START:', data.substring(0, 200));
        if (data.includes('<div id="root"></div>') || data.includes('<!doctype html>')) {
            console.log('SUCCESS: Server is serving the React App HTML.');
        } else {
            console.log('WARNING: Server responded, but content looks wrong.');
        }
    });
});

req.on('error', (e) => {
    console.log(`ERROR: Could not connect to server. ${e.message}`);
});
