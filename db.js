const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("prices.db");

db.run(`
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  vegetable TEXT,
  wholesale_price INTEGER,
  retail_max_price TEXT,
  retail_min_price TEXT,
  shopmall_max_price TEXT,
  shopmall_min_price TEXT,
  unit TEXT,
  image TEXT,
  city TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS EmailQueue (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  EmailTo TEXT NOT NULL,
  Subject TEXT NOT NULL,
  HtmlBody TEXT NOT NULL,
  EmailCc TEXT DEFAULT NULL,
  AttachmentPath TEXT DEFAULT NULL,
  IsSent INTEGER DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  SentOn DATETIME DEFAULT NULL
)
`);

module.exports = db;
