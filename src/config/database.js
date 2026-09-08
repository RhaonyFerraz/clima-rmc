const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { CITIES } = require('./cities');

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(DB_DIR, 'clima_rmc.db');

// Garante que o diretório data/ existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DATABASE] Erro ao conectar ao SQLite:', err.message);
  } else {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DATABASE] Conectado ao banco SQLite em: ${DB_PATH}`);
    }
  }
});

// Promisified helpers para consultas com async/await
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Inicialização e criação das tabelas no SQLite
 */
async function initDatabase() {
  await dbRun('PRAGMA foreign_keys = ON;');

  // Tabela de cidades
  await dbRun(`
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      population INTEGER,
      description TEXT
    );
  `);

  // Tabela de leituras de clima
  await dbRun(`
    CREATE TABLE IF NOT EXISTS weather_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id TEXT NOT NULL,
      temperature REAL NOT NULL,
      apparent_temperature REAL,
      relative_humidity REAL NOT NULL,
      precipitation REAL DEFAULT 0,
      weather_code INTEGER,
      weather_description TEXT,
      wind_speed REAL,
      wind_direction REAL,
      surface_pressure REAL,
      recorded_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (city_id) REFERENCES cities (id)
    );
  `);

  // Tabela de leituras de qualidade do ar
  await dbRun(`
    CREATE TABLE IF NOT EXISTS air_quality_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id TEXT NOT NULL,
      pm2_5 REAL,
      pm10 REAL,
      ozone REAL,
      nitrogen_dioxide REAL,
      sulphur_dioxide REAL,
      carbon_monoxide REAL,
      european_aqi INTEGER,
      conama_iqar INTEGER,
      aqi_category TEXT,
      health_recommendation TEXT,
      recorded_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (city_id) REFERENCES cities (id)
    );
  `);

  // Tabela de alertas emitidos
  await dbRun(`
    CREATE TABLE IF NOT EXISTS system_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id TEXT NOT NULL,
      alert_type TEXT NOT NULL, -- 'AIR_QUALITY', 'LOW_HUMIDITY', 'HEAT_WAVE', 'RAIN'
      severity TEXT NOT NULL,   -- 'INFO', 'WARNING', 'DANGER'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (city_id) REFERENCES cities (id)
    );
  `);

  // Índices para otimizar consultas analíticas por cidade e data
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_weather_city_date ON weather_readings (city_id, recorded_at);`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_aqi_city_date ON air_quality_readings (city_id, recorded_at);`);

  // Seed das cidades iniciais se a tabela estiver vazia
  for (const city of CITIES) {
    await dbRun(`
      INSERT OR IGNORE INTO cities (id, name, state, latitude, longitude, elevation, population, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      city.id,
      city.name,
      city.state,
      city.latitude,
      city.longitude,
      city.elevation,
      city.population,
      city.description
    ]);
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
