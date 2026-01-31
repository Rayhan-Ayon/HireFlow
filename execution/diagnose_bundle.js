const http = require('http');
const fs = require('fs');
const path = require('path');

const bundlePath = 'assets/index-DKLnWdgm.js';
const bundleUrl = `http://localhost:3001/${bundlePath}`;

console.log(`--- DIAGNOSING BUNDLE DELIVERY: ${bundleUrl} ---`);

const req = http.get(bundleUrl, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`CONTENT-TYPE: ${res.headers['content-type']}`);

    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        if (body.length < 500) body += chunk;
    });

    res.on('end', () => {
        console.log(`BODY (First 200 chars): ${body.substring(0, 200)}`);
        if (body.startsWith('<!doctype html>')) {
            console.log('CRITICAL ERROR: Server is returning HTML for a JS file request!');
            console.log('Reason: Catch-all route is likely running before static middleware.');
        } else if (res.statusCode === 200 && body.length > 0) {
            console.log('SUCCESS: JS content appears properly served.');
        } else {
            console.log('FAILURE: Unknown issue with bundle delivery.');
        }
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
});
