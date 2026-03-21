/**
 * Supabase-compatible query builder for local PostgreSQL
 * Supports: .from().select().insert().update().delete().upsert()
 *           .eq().neq().gt().gte().lt().lte().in().is().not().or().ilike()
 *           .order().limit().range().single().maybeSingle()
 *           .rpc()
 */

import { Pool, PoolClient } from 'pg'
import { getPool } from './pool'

// ---------- types ----------

interface QueryResult<T = any> {
  data: T | null
  error: PostgrestError | null
  count?: number | null
}

interface PostgrestError {
  message: string
  details?: string
  hint?: string
  code?: string
}

type FilterOp = { col: string; op: string; val: any }

// ---------- QueryBuilder ----------

class QueryBuilder<T = any> {
  private pool: Pool
  private tableName: string
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private selectColumns: string = '*'
  private selectJoins: { alias: string; table: string; columns: string }[] = []
  private filters: FilterOp[] = []
  private orFilters: string[] = []
  private notFilters: { col: string; op: string; val: string }[] = []
  private insertData: Record<string, any> | Record<string, any>[] | null = null
  private updateData: Record<string, any> | null = null
  private upsertConflictCol: string = ''
  private orderClauses: { col: string; asc: boolean }[] = []
  private limitVal: number | null = null
  private offsetVal: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private returnSingle: boolean = false
  private returnMaybeSingle: boolean = false
  private headOnly: boolean = false
  private doSelect: boolean = false
  private countExact: boolean = false
  private ignoreDuplicates: boolean = false

  constructor(pool: Pool, tableName: string) {
    this.pool = pool
    this.tableName = tableName
  }

  // ---- operation starters ----

  select(columns?: string, options?: { count?: string; head?: boolean }): this {
    this.operation = 'select'
    if (options?.count === 'exact') {
      this.countExact = true
    }
    if (options?.head) {
      this.headOnly = true
    }
    if (columns && columns !== '*') {
      // Parse join-style selects like "*, list:lists(*)"
      const parts = this.parseSelectColumns(columns)
      this.selectColumns = parts.cols
      this.selectJoins = parts.joins
    }
    return this
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.operation = 'insert'
    this.insertData = data
    return this
  }

  update(data: Record<string, any>): this {
    this.operation = 'update'
    this.updateData = data
    return this
  }

  delete(): this {
    this.operation = 'delete'
    return this
  }

  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.operation = 'upsert'
    this.insertData = data
    this.upsertConflictCol = options?.onConflict || ''
    this.ignoreDuplicates = options?.ignoreDuplicates || false
    return this
  }

  // ---- filters ----

  eq(col: string, val: any): this {
    this.filters.push({ col, op: '=', val })
    return this
  }

  neq(col: string, val: any): this {
    this.filters.push({ col, op: '!=', val })
    return this
  }

  gt(col: string, val: any): this {
    this.filters.push({ col, op: '>', val })
    return this
  }

  gte(col: string, val: any): this {
    this.filters.push({ col, op: '>=', val })
    return this
  }

  lt(col: string, val: any): this {
    this.filters.push({ col, op: '<', val })
    return this
  }

  lte(col: string, val: any): this {
    this.filters.push({ col, op: '<=', val })
    return this
  }

  in(col: string, vals: any[]): this {
    this.filters.push({ col, op: 'IN', val: vals })
    return this
  }

  is(col: string, val: any): this {
    if (val === null || val === 'null') {
      this.filters.push({ col, op: 'IS NULL', val: null })
    } else if (val === true || val === 'true') {
      this.filters.push({ col, op: 'IS TRUE', val: null })
    } else if (val === false || val === 'false') {
      this.filters.push({ col, op: 'IS FALSE', val: null })
    }
    return this
  }

  not(col: string, op: string, val: string): this {
    this.notFilters.push({ col, op, val })
    return this
  }

  ilike(col: string, val: string): this {
    this.filters.push({ col, op: 'ILIKE', val })
    return this
  }

  overlaps(col: string, val: any[]): this {
    this.filters.push({ col, op: '&&', val })
    return this
  }

  contains(col: string, val: any[]): this {
    this.filters.push({ col, op: '@>', val })
    return this
  }

  or(filterString: string): this {
    this.orFilters.push(filterString)
    return this
  }

  // ---- modifiers ----

  order(col: string, options?: { ascending?: boolean }): this {
    this.orderClauses.push({ col, asc: options?.ascending !== false })
    return this
  }

  limit(n: number): this {
    this.limitVal = n
    return this
  }

  range(from: number, to: number): this {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  single(): this {
    this.returnSingle = true
    this.limitVal = 1
    return this
  }

  maybeSingle(): this {
    this.returnMaybeSingle = true
    this.limitVal = 1
    return this
  }

  // ---- execute ----

  async then(resolve: (value: QueryResult<T>) => void, reject?: (reason: any) => void) {
    try {
      const result = await this.execute()
      resolve(result)
    } catch (err: any) {
      if (reject) reject(err)
      else resolve({ data: null, error: { message: err.message } })
    }
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      switch (this.operation) {
        case 'select': return await this.executeSelect()
        case 'insert': return await this.executeInsert()
        case 'update': return await this.executeUpdate()
        case 'delete': return await this.executeDelete()
        case 'upsert': return await this.executeUpsert()
        default: return { data: null, error: { message: 'Unknown operation' } }
      }
    } catch (err: any) {
      return { data: null, error: { message: err.message, details: err.detail, code: err.code } }
    }
  }

  // ---- internal ----

  private parseSelectColumns(columns: string): { cols: string; joins: { alias: string; table: string; columns: string }[] } {
    const joins: { alias: string; table: string; columns: string }[] = []
    // Match patterns like "list:lists(*)" or "sender:campaign_senders(*)"
    const joinRegex = /(\w+):(\w+)\(([^)]*)\)/g
    let cleaned = columns
    let match
    while ((match = joinRegex.exec(columns)) !== null) {
      joins.push({ alias: match[1], table: match[2], columns: match[3] || '*' })
      cleaned = cleaned.replace(match[0], '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')
    }
    cleaned = cleaned.trim().replace(/,\s*$/, '') || '*'
    return { cols: cleaned, joins }
  }

  private buildWhereClause(params: any[]): string {
    const conditions: string[] = []

    for (const f of this.filters) {
      if (f.op === 'IS NULL' || f.op === 'IS TRUE' || f.op === 'IS FALSE') {
        conditions.push(`"${f.col}" ${f.op}`)
      } else if (f.op === 'IN') {
        if (Array.isArray(f.val) && f.val.length > 0) {
          const placeholders = f.val.map((_: any, i: number) => `$${params.length + i + 1}`).join(', ')
          params.push(...f.val)
          conditions.push(`"${f.col}" IN (${placeholders})`)
        } else {
          conditions.push('FALSE') // empty IN clause
        }
      } else if (f.op === '&&' || f.op === '@>') {
        // Array overlap (&&) or contains (@>) operators
        if (Array.isArray(f.val) && f.val.length > 0) {
          params.push(f.val)
          conditions.push(`"${f.col}" ${f.op} $${params.length}`)
        }
      } else {
        params.push(f.val)
        conditions.push(`"${f.col}" ${f.op} $${params.length}`)
      }
    }

    // NOT filters like .not('status', 'in', '("pending","failed")')
    for (const nf of this.notFilters) {
      if (nf.op === 'in') {
        // Parse Supabase-style tuple: '("pending","failed","removed")'
        const vals = nf.val.replace(/[()]/g, '').split(',').map((v: string) => v.trim().replace(/"/g, ''))
        if (vals.length > 0) {
          const placeholders = vals.map((_: string, i: number) => `$${params.length + i + 1}`).join(', ')
          params.push(...vals)
          conditions.push(`"${nf.col}" NOT IN (${placeholders})`)
        }
      }
    }

    // OR filters like "full_name.ilike.%search%,email.ilike.%search%"
    for (const orFilter of this.orFilters) {
      const orParts = orFilter.split(',').map(part => {
        const segments = part.trim().split('.')
        if (segments.length >= 3) {
          const col = segments[0]
          const op = segments[1]
          const val = segments.slice(2).join('.')
          if (op === 'ilike') {
            params.push(val)
            return `"${col}" ILIKE $${params.length}`
          } else if (op === 'eq') {
            params.push(val)
            return `"${col}" = $${params.length}`
          } else if (op === 'neq') {
            params.push(val)
            return `"${col}" != $${params.length}`
          }
        }
        return null
      }).filter(Boolean)
      if (orParts.length > 0) {
        conditions.push(`(${orParts.join(' OR ')})`)
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }

  private buildOrderClause(): string {
    if (this.orderClauses.length === 0) return ''
    return 'ORDER BY ' + this.orderClauses.map(o => `"${o.col}" ${o.asc ? 'ASC' : 'DESC'}`).join(', ')
  }

  private buildLimitOffset(): string {
    let clause = ''
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      clause += `LIMIT ${this.rangeTo - this.rangeFrom + 1} OFFSET ${this.rangeFrom}`
    } else {
      if (this.limitVal !== null) clause += `LIMIT ${this.limitVal}`
      if (this.offsetVal !== null) clause += ` OFFSET ${this.offsetVal}`
    }
    return clause
  }

  private async executeSelect(): Promise<QueryResult<T>> {
    const params: any[] = []
    const where = this.buildWhereClause(params)
    const order = this.buildOrderClause()
    const limitOffset = this.buildLimitOffset()

    const mainTable = `"${this.tableName}"`
    const sql = `SELECT ${mainTable}.* FROM ${mainTable} ${where} ${order} ${limitOffset}`

    const result = await this.pool.query(sql, params)
    let rows = result.rows

    // Handle joins — do sub-queries for each join
    if (this.selectJoins.length > 0) {
      for (const join of this.selectJoins) {
        // Guess the FK: if tableName=leads and join.table=lists, FK is list_id
        const fkCol = join.alias + '_id'
        const ids = rows.map(r => r[fkCol]).filter(Boolean)
        if (ids.length > 0) {
          const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(', ')
          const joinSql = `SELECT * FROM "${join.table}" WHERE "id" IN (${placeholders})`
          const joinResult = await this.pool.query(joinSql, ids)
          const joinMap = new Map(joinResult.rows.map(r => [r.id, r]))
          rows = rows.map(r => ({
            ...r,
            [join.alias]: joinMap.get(r[fkCol]) || null
          }))
        } else {
          rows = rows.map(r => ({ ...r, [join.alias]: null }))
        }
      }
    }

    // Count
    let count: number | null = null
    if (this.countExact) {
      const countSql = `SELECT COUNT(*) FROM "${this.tableName}" ${where}`
      const countResult = await this.pool.query(countSql, params)
      count = parseInt(countResult.rows[0].count)
    }

    if (this.returnSingle) {
      if (rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      return { data: rows[0] as T, error: null, count }
    }
    if (this.returnMaybeSingle) {
      return { data: (rows[0] || null) as T, error: null, count }
    }
    return { data: rows as T, error: null, count }
  }

  private async executeInsert(): Promise<QueryResult<T>> {
    if (!this.insertData) return { data: null, error: { message: 'No data to insert' } }

    const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData]
    if (rows.length === 0) return { data: [] as any, error: null }

    // Filter out undefined values, keep null
    const cleanRows = rows.map(row => {
      const clean: Record<string, any> = {}
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined) clean[k] = v
      }
      return clean
    })

    const columns = Object.keys(cleanRows[0])
    const params: any[] = []
    const valueGroups: string[] = []

    for (const row of cleanRows) {
      const placeholders = columns.map(col => {
        params.push(row[col] ?? null)
        return `$${params.length}`
      })
      valueGroups.push(`(${placeholders.join(', ')})`)
    }

    const colNames = columns.map(c => `"${c}"`).join(', ')
    const sql = `INSERT INTO "${this.tableName}" (${colNames}) VALUES ${valueGroups.join(', ')} RETURNING *`

    const result = await this.pool.query(sql, params)

    if (this.returnSingle || this.returnMaybeSingle) {
      return { data: (result.rows[0] || null) as T, error: null }
    }
    return { data: result.rows as T, error: null }
  }

  private async executeUpdate(): Promise<QueryResult<T>> {
    if (!this.updateData) return { data: null, error: { message: 'No data to update' } }

    const params: any[] = []
    const setClauses: string[] = []

    for (const [col, val] of Object.entries(this.updateData)) {
      if (val !== undefined) {
        params.push(val ?? null)
        setClauses.push(`"${col}" = $${params.length}`)
      }
    }

    const where = this.buildWhereClause(params)
    const sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} ${where} RETURNING *`

    const result = await this.pool.query(sql, params)

    if (this.returnSingle) {
      if (result.rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      return { data: result.rows[0] as T, error: null }
    }
    if (this.returnMaybeSingle) {
      return { data: (result.rows[0] || null) as T, error: null }
    }
    return { data: result.rows as T, error: null }
  }

  private async executeDelete(): Promise<QueryResult<T>> {
    const params: any[] = []
    const where = this.buildWhereClause(params)
    const sql = `DELETE FROM "${this.tableName}" ${where} RETURNING *`

    const result = await this.pool.query(sql, params)
    return { data: result.rows as T, error: null }
  }

  private async executeUpsert(): Promise<QueryResult<T>> {
    if (!this.insertData) return { data: null, error: { message: 'No data to upsert' } }

    const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData]
    if (rows.length === 0) return { data: [] as any, error: null }

    const cleanRows = rows.map(row => {
      const clean: Record<string, any> = {}
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined) clean[k] = v
      }
      return clean
    })

    const columns = Object.keys(cleanRows[0])
    const params: any[] = []
    const valueGroups: string[] = []

    for (const row of cleanRows) {
      const placeholders = columns.map(col => {
        params.push(row[col] ?? null)
        return `$${params.length}`
      })
      valueGroups.push(`(${placeholders.join(', ')})`)
    }

    const colNames = columns.map(c => `"${c}"`).join(', ')
    const conflictCols = this.upsertConflictCol
      ? this.upsertConflictCol.split(',').map(c => `"${c.trim()}"`).join(', ')
      : '"id"'

    let onConflictAction: string
    if (this.ignoreDuplicates) {
      onConflictAction = 'DO NOTHING'
    } else {
      const updateCols = columns.filter(c => !this.upsertConflictCol.split(',').map(x => x.trim()).includes(c))
      onConflictAction = updateCols.length > 0
        ? `DO UPDATE SET ${updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
        : 'DO NOTHING'
    }

    const sql = `INSERT INTO "${this.tableName}" (${colNames}) VALUES ${valueGroups.join(', ')} ON CONFLICT (${conflictCols}) ${onConflictAction} RETURNING *`

    const result = await this.pool.query(sql, params)

    if (this.returnSingle || this.returnMaybeSingle) {
      return { data: (result.rows[0] || null) as T, error: null }
    }
    return { data: result.rows as T, error: null }
  }
}

// ---------- DbClient — the main interface ----------

export class DbClient {
  private pool: Pool

  constructor(pool?: Pool) {
    this.pool = pool || getPool()
  }

  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.pool, table)
  }

  async rpc(funcName: string, params: Record<string, any> = {}): Promise<QueryResult> {
    try {
      const keys = Object.keys(params)
      const vals = Object.values(params)
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      // Named params: SELECT func(p_name := $1, ...)
      const namedArgs = keys.map((k, i) => `${k} := $${i + 1}`).join(', ')
      const sql = `SELECT * FROM ${funcName}(${namedArgs})`
      const result = await this.pool.query(sql, vals)
      return { data: result.rows.length === 1 ? result.rows[0] : result.rows, error: null }
    } catch (err: any) {
      return { data: null, error: { message: err.message, details: err.detail, code: err.code } }
    }
  }

  /** Direct SQL query for cases that don't fit the builder */
  async query(sql: string, params?: any[]) {
    return this.pool.query(sql, params)
  }

  getPool(): Pool {
    return this.pool
  }
}
