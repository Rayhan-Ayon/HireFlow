const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/user/profile',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Response Details:', res.statusCode);
        console.log('Response Body:', data);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
