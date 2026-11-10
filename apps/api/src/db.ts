import postgres from 'postgres';

export type Sql = postgres.Sql;

export function createSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 10 });
}

export async function isDatabaseReachable(sql: Sql): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
