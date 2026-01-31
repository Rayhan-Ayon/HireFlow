const { spawn, exec } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'diagnostic_log.txt');
const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    console.log(entry);
    fs.appendFileSync(LOG_FILE, entry + '\n');
};

log('--- STARTING DEEP DIAGNOSTIC ---');

// 1. Check Files
log('Checking critical files...');
['server/index.js', 'server/database.js', '.env', 'client/dist/index.html'].forEach(f => {
    const exists = fs.existsSync(path.resolve(__dirname, '..', f));
    log(`File ${f}: ${exists ? 'EXISTS' : 'MISSING'}`);
});

// 2. Check Port 3001
log('Checking if Port 3001 is currently in use...');
const server = net.createServer();
server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        log('PORT 3001 IS BUSY (Something is already running!)');
    } else {
        log(`Port check error: ${err.code}`);
    }
});
server.once('listening', () => {
    log('Port 3001 is FREE.');
    server.close();
    startServerTest();
});
server.listen(3001);

function startServerTest() {
    log('Attempting to spawn server...');
    const serverProcess = spawn('node', ['server/index.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: process.env,
        shell: true
    });

    let serverPid = serverProcess.pid;
    let healthy = false;

    serverProcess.stdout.on('data', (data) => {
        const str = data.toString().trim();
        if (str) log(`[SERVER STDOUT]: ${str}`);
        if (str.includes('Server running on port')) {
            log('Server signaled readiness. Testing HTTP connection...');
            setTimeout(testHttpCallback, 2000); // Give it 2s to settle
        }
    });

    serverProcess.stderr.on('data', (data) => {
        log(`[SERVER STDERR]: ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
        log(`Server process exited prematurely with code ${code}`);
        if (!healthy) {
            log('FAILURE: Server crashed before health check passed.');
            process.exit(1);
        }
    });

    function testHttpCallback() {
        const req = http.get('http://localhost:3001/api/health', (res) => {
            log(`Health Check Status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                log('SUCCESS: /api/health returned 200 OK.');
                healthy = true;

                // Test Root
                http.get('http://localhost:3001/', (res2) => {
                    log(`Root Status: ${res2.statusCode}`);
                    serverProcess.kill();
                    process.exit(0);
                });
            }
        });
        req.on('error', (e) => {
            log(`Health Check request failed: ${e.message}`);
            serverProcess.kill();
            process.exit(1);
        });
    }

    // Timeout
    setTimeout(() => {
        if (!healthy) {
            log('TIMEOUT: Server hung or did not respond in time.');
            serverProcess.kill();
            process.exit(1);
        }
    }, 15000);
}
