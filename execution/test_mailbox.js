const http = require('http');

const data = JSON.stringify({
    filterByCandidates: true
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/gmail/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';

    res.on('data', (chunk) => {
        body += chunk;
    });

    res.on('end', () => {
        console.log('BODY snippet:', body.substring(0, 500));
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
