const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite'); // Assuming root/database.sqlite
const db = new sqlite3.Database(dbPath);

const TOKEN = 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzY5MzI2MjYyLCJqdGkiOiI5MGYyYTUxOC01ZWU3LTRlYjUtOTUzMy1lNDljOTk5NzU1YTQiLCJ1c2VyX3V1aWQiOiIyMmM5ODViOC02ODYxLTQ5YTMtYTA1MS0zODRlMzAwZjViMGYifQ._b0XHmA8JddY7Xqoxab3ErNfb_GgCyoJijUd0y8L0SdGcjpcqnyvVyIYDSLXlGgee-ZkfuGGE3yLPU9DKY0eJA';

db.serialize(() => {
    // 1. Add Column (Wrap in try because checking if exists in SQLite is tricky without error)
    db.run("ALTER TABLE users ADD COLUMN calendly_auth_token TEXT", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('Column calendly_auth_token already exists.');
        } else if (err) {
            console.error('Error adding column:', err);
        } else {
            console.log('Added column calendly_auth_token.');
        }
    });

    // 2. Update Token
    db.run("UPDATE users SET calendly_auth_token = ? WHERE id = 1", [TOKEN], (err) => {
        if (err) {
            console.error('Failed to update token:', err);
        } else {
            console.log('Successfully saved Calendly Token for User 1.');
        }
    });
});

db.close();
