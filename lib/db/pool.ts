import { Pool, PoolConfig } from 'pg'

// Singleton pool instance
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
    pool = new Pool(config)
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  return pool
}

export { Pool }
