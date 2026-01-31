const http = require('http');

http.get('http://localhost:3001/api/public/jobs/7', (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
        console.log(resp.statusCode);
        console.log(data);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
