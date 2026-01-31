const fetch = require('isomorphic-fetch');
const fs = require('fs');

async function testRaw() {
    const accessToken = fs.readFileSync('token.txt', 'utf8').trim();
    console.log('Fetching /me from Graph with clean token...');
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2));
}

testRaw();
