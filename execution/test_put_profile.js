const http = require('http');

const data = JSON.stringify({
    name: 'Test User',
    role: 'Recruiter',
    company_name: 'Test Co',
    company_description: 'Description',
    company_website: 'https://example.com',
    company_logo: null,
    whatsapp_number: '+1234567890'
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/user/profile',
    method: 'PUT',
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
        console.log('BODY:', body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
