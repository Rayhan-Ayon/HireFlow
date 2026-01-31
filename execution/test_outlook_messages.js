const fetch = require('isomorphic-fetch');
const fs = require('fs');

async function testMessages() {
    const accessToken = fs.readFileSync('token.txt', 'utf8').trim();
    console.log('Fetching /me/messages from Graph...');
    const res = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=5', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    console.log('Status:', res.status);
    const bodyStr = await res.text();
    console.log('Raw Body:', bodyStr);
    try {
        const data = JSON.parse(bodyStr);
        console.log('Parsed Body:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('Body is not JSON');
    }
}

testMessages();
