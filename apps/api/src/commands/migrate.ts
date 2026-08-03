import { loadConfig } from '../config.js';
import { Database } from '../database/client.js';
import { migrateDatabase } from '../database/migrator.js';

const config = loadConfig();
const database = new Database(config.databaseUrl);

try {
  const applied = await migrateDatabase(database);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} finally {
  await database.close();
}
