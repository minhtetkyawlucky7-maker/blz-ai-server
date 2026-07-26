const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'blz_ai.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    prediction TEXT NOT NULL,
    possible_number INTEGER,
    result INTEGER,
    result_type TEXT,
    status TEXT,
    calculation TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS patterns (
    pattern_key TEXT PRIMARY KEY,
    total INTEGER DEFAULT 0,
    next_big INTEGER DEFAULT 0,
    next_small INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

const dbOps = {
  getAllPatterns: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM patterns', (err, rows) => {
        if (err) reject(err);
        const map = {};
        rows.forEach(row => {
          map[row.pattern_key] = { total: row.total, nextBig: row.next_big, nextSmall: row.next_small };
        });
        resolve(map);
      });
    });
  },
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
  getHistory: (limit = 100) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM history ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
  },
  clearAllHistory: () => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM history', (err) => { if (err) reject(err); resolve(); });
    });
  }
};

module.exports = dbOps;
