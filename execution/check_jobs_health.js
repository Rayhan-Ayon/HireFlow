const http = require('http');

const checkUrl = (url) => {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject('Invalid JSON');
                    }
                } else {
                    reject(`Status ${res.statusCode}: ${data}`);
                }
            });
        }).on('error', err => reject(err.message));
    });
};

async function test() {
    try {
        console.log('Checking /api/jobs...');
        const jobs = await checkUrl('http://localhost:3001/api/jobs');
        console.log('Jobs OK, count:', jobs.jobs ? jobs.jobs.length : 'N/A');
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}

test();
