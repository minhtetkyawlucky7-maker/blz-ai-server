const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'blz_ai.db'));

db.serialize(() => {
    // History Table - Unlimited (3000+)
    db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        prediction TEXT,
        possible_number INTEGER,
        result INTEGER,
        result_type TEXT,
        status TEXT,
        calculation TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Pattern DB - Unlimited
    db.run(`CREATE TABLE IF NOT EXISTS patterns (
        pattern_key TEXT PRIMARY KEY,
        total INTEGER DEFAULT 0,
        next_big INTEGER DEFAULT 0,
        next_small INTEGER DEFAULT 0
    )`);

    // Number Stats - Unlimited
    db.run(`CREATE TABLE IF NOT EXISTS number_stats (
        number INTEGER PRIMARY KEY,
        count INTEGER DEFAULT 0,
        last_seen DATETIME,
        avg_gap REAL
    )`);
});

const dbOps = {
    // Get Pattern
    getPattern: (key) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM patterns WHERE pattern_key = ?', [key], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },
    
    // Update Pattern
    updatePattern: (key, total, nextBig, nextSmall) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO patterns (pattern_key, total, next_big, next_small)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(pattern_key) DO UPDATE SET
                 total = total + excluded.total,
                 next_big = next_big + excluded.next_big,
                 next_small = next_small + excluded.next_small`,
                [key, total, nextBig, nextSmall],
                (err) => { if (err) reject(err); resolve(); }
            );
        });
    },
    
    // Get All Patterns
    getAllPatterns: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM patterns', (err, rows) => {
                if (err) reject(err);
                const map = {};
                rows.forEach(row => {
                    map[row.pattern_key] = {
                        total: row.total,
                        nextBig: row.next_big,
                        nextSmall: row.next_small
                    };
                });
                resolve(map);
            });
        });
    },
    
    // Add History
    addHistory: (entry) => {
        return new Promise((resolve, reject) => {
            const { period, prediction, possible_number, result, result_type, status, calculation } = entry;
            db.run(
                `INSERT INTO history (period, prediction, possible_number, result, result_type, status, calculation)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [period, prediction, possible_number, result || null, result_type || null, status || 'Pending', calculation || null],
                function(err) { if (err) reject(err); resolve(this.lastID); }
            );
        });
    },
    
    // Get History (Unlimited - 3000+)
    getHistory: (limit = 3000) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM history ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    },
    
    // Clear Current History ONLY (Keep Patterns)
    clearCurrentHistory: () => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM history', (err) => { if (err) reject(err); resolve(); });
        });
    },
    
    // Clear All (History + Patterns)
    clearAllHistory: () => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM history', (err) => { if (err) reject(err); resolve(); });
        });
    },
    clearPatterns: () => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM patterns', (err) => { if (err) reject(err); resolve(); });
        });
    },
    
    // Update Number Stats
    updateNumberStats: (number) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO number_stats (number, count, last_seen)
                 VALUES (?, 1, CURRENT_TIMESTAMP)
                 ON CONFLICT(number) DO UPDATE SET
                 count = count + 1,
                 last_seen = CURRENT_TIMESTAMP`,
                [number],
                (err) => { if (err) reject(err); resolve(); }
            );
        });
    }
};

module.exports = dbOps;
