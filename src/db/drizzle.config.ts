import { defineConfig, type Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

function buildConfig(): Config {
  if (connectionUrl) {
    // Bolt-provisioned connection string; parse it for drizzle-kit push/migrate.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(connectionUrl);
    } catch {
      throw new Error('SUPABASE_DB_URL / DATABASE_URL is set but not a valid Postgres connection URL.');
    }
    const dbUser = parsedUrl.username;
    const dbPassword = decodeURIComponent(parsedUrl.password || '');
    const database = parsedUrl.pathname.replace(/^\//, '');
    if (!parsedUrl.hostname || !dbUser || !database) {
      throw new Error('Database connection URL is incomplete: host, user and database name are required.');
    }
    const useSsl = parsedUrl.searchParams.get('sslmode') !== 'disable';
    return defineConfig({
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'postgresql',
      schemaFilter: ['public'],
      dbCredentials: {
        host: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
        user: dbUser,
        password: dbPassword,
        database,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      },
      verbose: true,
    });
  }

  const sqlHost = process.env.SQL_HOST;
  const sqlDbName = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_ADMIN_PASSWORD;

  if (!sqlHost) {
    throw new Error('SQL_HOST must be set in environment variables.');
  }
  if (!sqlDbName) {
    throw new Error('SQL_DB_NAME must be set in environment variables.');
  }
  if (!user) {
    throw new Error('SQL_ADMIN_USER must be set in environment variables.');
  }
  if (!password) {
    throw new Error('SQL_ADMIN_PASSWORD must be set in environment variables.');
  }

  return defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    schemaFilter: ['public'],
    dbCredentials: {
      host: sqlHost,
      user,
      password,
      database: sqlDbName,
      ssl: false,
    },
    verbose: true,
  });
}

export default buildConfig();
