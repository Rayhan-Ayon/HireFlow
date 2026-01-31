const http = require('http');

const data = JSON.stringify({
    name: "Antonia Welcome",
    company_name: "Antonia Corp",
    company_website: "antonia.com",
    role: "Recruiter",
    email: "antoniaantoniatwelcome@gmail.com",
    password: "password123"
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/signup',
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
        console.log('RESPONSE:', body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
