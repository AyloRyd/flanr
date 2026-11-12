import type { TransactionSql } from 'postgres';
import type { Sql } from './db.ts';

export async function cityExists(sql: Sql | TransactionSql, cityId: number): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM cities WHERE id = ${cityId}`;
  return rows.length > 0;
}
