const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'blz_ai.db'));

db.serialize(() => {
  // History - Unlimited storage
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

  // Pattern DB - Unlimited (can store 3000+ patterns)
  db.run(`CREATE TABLE IF NOT EXISTS patterns (
    pattern_key TEXT PRIMARY KEY,
    total INTEGER DEFAULT 0,
    next_big INTEGER DEFAULT 0,
    next_small INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add index for faster queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_period ON history(period)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_status ON history(status)`);
});

const dbOps = {
  // === PATTERN DB ===
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
        `INSERT INTO patterns (pattern_key, total, next_big, next_small)
         VALUES (?, ?, ?, ?)
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
          map[row.pattern_key] = {
            total: row.total,
            nextBig: row.next_big,
            nextSmall: row.next_small,
            lastUpdated: row.last_updated
          };
        });
        resolve(map);
      });
    });
  },
  getPatternCount: () => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM patterns', (err, row) => {
        if (err) reject(err);
        resolve(row ? row.count : 0);
      });
    });
  },

  // === HISTORY ===
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
  updateHistoryResult: (id, result, resultType, status) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE history SET result = ?, result_type = ?, status = ? WHERE id = ?`,
        [result, resultType, status, id],
        (err) => { if (err) reject(err); resolve(); }
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
  getHistoryForAnalysis: (limit = 30) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM history WHERE result IS NOT NULL ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
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
  clearPatterns: () => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM patterns', (err) => { if (err) reject(err); resolve(); });
    });
  },
  getTotalHistoryCount: () => {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM history', (err, row) => {
        if (err) reject(err);
        resolve(row ? row.count : 0);
      });
    });
  }
};

module.exports = dbOps;
