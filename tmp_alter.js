const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'campus.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error(err); return; }
    db.run("ALTER TABLE users ADD COLUMN google_email TEXT;", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error:', err.message);
        } else {
            console.log('Successfully altered users table to include google_email.');
        }
        db.close();
    });
});
