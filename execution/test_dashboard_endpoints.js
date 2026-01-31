const http = require('http');

const testEndpoint = (path) => {
    return new Promise((resolve) => {
        http.get(`http://localhost:3001${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Endpoint: ${path}`);
                console.log(`Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    console.log(`Response: ${JSON.stringify(json).substring(0, 100)}...`);
                } catch (e) {
                    console.log(`Response: ${data.substring(0, 100)}...`);
                }
                console.log('---');
                resolve();
            });
        }).on('error', err => {
            console.log(`Endpoint: ${path}`);
            console.log(`Error: ${err.message}`);
            console.log('---');
            resolve();
        });
    });
};

async function runTests() {
    await testEndpoint('/api/health');
    await testEndpoint('/api/user/profile');
    await testEndpoint('/api/jobs');
    await testEndpoint('/api/interviews');
}

runTests();
