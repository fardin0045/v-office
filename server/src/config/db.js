const mongoose = require('mongoose');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./env');

mongoose.set('strictQuery', true);

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 20,
};

// Development convenience only: start a local mongod on Windows if one is installed but not running.
async function trySpawnLocalMongod() {
  const possiblePaths = [
    'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
  ];

  const exePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!exePath) return false;

  const dbPath = path.resolve(__dirname, '../../data/db');
  fs.mkdirSync(dbPath, { recursive: true });

  console.log(`[DB] Spawning local mongod from: ${exePath}`);
  console.log(`[DB] Database directory: ${dbPath}`);

  const mongodProcess = spawn(exePath, ['--dbpath', dbPath, '--port', '27017', '--bind_ip', '127.0.0.1'], {
    stdio: 'ignore',
    detached: true,
  });
  mongodProcess.unref();

  // Give mongod a moment to bind its port.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return true;
}

async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongoUri, CONNECT_OPTIONS);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (!config.autoStartLocalMongo) {
      console.error('[DB] MongoDB connection failed:', error.message);
      throw error;
    }

    console.warn('[DB] Could not connect. Attempting to launch a local mongod...');
    if (!(await trySpawnLocalMongod())) {
      console.error('[DB] MongoDB connection failed and no local mongod binary was found:', error.message);
      throw error;
    }

    const conn = await mongoose.connect(config.mongoUri, CONNECT_OPTIONS);
    console.log(`[DB] MongoDB connected after starting local service: ${conn.connection.host}`);
    return conn;
  }
}

module.exports = connectDB;
