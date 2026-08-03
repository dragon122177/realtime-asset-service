import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const { Pool } = pg;

export class Database {
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 12,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'forgeflow-control-plane',
    });
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(text, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ready(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
