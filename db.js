const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'blz_ai.db'));

// Create tables with 3000+ record support
db.serialize(() => {
  // History table - unlimited records
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

  // Pattern DB - stores historical patterns (NEVER deleted)
  db.run(`CREATE TABLE IF NOT EXISTS patterns (
    pattern_key TEXT PRIMARY KEY,
    total INTEGER DEFAULT 0,
    next_big INTEGER DEFAULT 0,
    next_small INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Deep Analysis Results
  db.run(`CREATE TABLE IF NOT EXISTS deep_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_records INTEGER,
    mean REAL,
    std_dev REAL,
    cusum REAL,
    hot_numbers TEXT,
    cold_numbers TEXT,
    patterns TEXT
  )`);
});

const dbOps = {
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
  getHistory: (limit = 3000) => {
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
  },
  // Pattern DB functions - NEVER delete patterns
  getPattern: (key) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM patterns WHERE pattern_key = ?', [key], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },
  updatePattern: (key, total, nextBig, nextSmall) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO patterns (pattern_key, total, next_big, next_small, last_updated)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(pattern_key) DO UPDATE SET
         total = total + excluded.total,
         next_big = next_big + excluded.next_big,
         next_small = next_small + excluded.next_small,
         last_updated = CURRENT_TIMESTAMP`,
        [key, total, nextBig, nextSmall],
        (err) => { if (err) reject(err); resolve(); }
      );
    });
  },
  getAllPatterns: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM patterns ORDER BY total DESC', (err, rows) => {
        if (err) reject(err);
        const map = {};
        rows.forEach(row => {
          map[row.pattern_key] = { total: row.total, nextBig: row.next_big, nextSmall: row.next_small };
        });
        resolve(map);
      });
    });
  },
  // Deep Analysis
  saveDeepAnalysis: (data) => {
    return new Promise((resolve, reject) => {
      const { totalRecords, mean, stdDev, cusum, hotNumbers, coldNumbers, patterns } = data;
      db.run(
        `INSERT INTO deep_analysis (total_records, mean, std_dev, cusum, hot_numbers, cold_numbers, patterns)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [totalRecords, mean, stdDev, cusum, JSON.stringify(hotNumbers), JSON.stringify(coldNumbers), JSON.stringify(patterns)],
        (err) => { if (err) reject(err); resolve(); }
      );
    });
  }
};

module.exports = dbOps;
