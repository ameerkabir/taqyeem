import {
  getTableColumnDefinitions, getTableName, getTablePrimaryKey,
  type DataManipulationOperation, type DatabaseDriver, type Predicate,
  type AnyTable,
} from "remix/data-table";

// SQL compilation/encoding patterns informed by Sergio Xalambrí’s MIT-licensed
// data-table-d1 (2026.10.24). See LICENSE.data-table-d1. Maintained locally.
// Cloudflare-specific code stays under bootstrap/. No runtime Cloudflare imports.
// This adapter targets the DatabaseDriver contract installed with Remix 3.1.0.
function identifier(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}
function path(name: string): string {
  return name.split(".").map((part) => part === "*" ? "*" : identifier(part)).join(".");
}

function compileD1Operation(operation: DataManipulationOperation) {
  let values: unknown[] = [];
  function bind(value: unknown): string {
    values.push(typeof value === "boolean" ? Number(value) : value ?? null);
    return "?";
  }
  function predicate(p: Predicate): string {
    if (p.type === "logical") {
      if (!p.predicates.length) return p.operator === "and" ? "1=1" : "1=0";
      return p.predicates.map((child) => `(${predicate(child)})`).join(` ${p.operator} `);
    }
    let column = path(p.column);
    if (p.type === "null") return `${column} is ${p.operator === "notNull" ? "not " : ""}null`;
    if (p.type === "between") return `${column} between ${bind(p.lower)} and ${bind(p.upper)}`;
    if (p.operator === "in" || p.operator === "notIn") {
      if (!Array.isArray(p.value)) throw new Error("IN requires an array");
      if (!p.value.length) return p.operator === "in" ? "1=0" : "1=1";
      return `${column} ${p.operator === "in" ? "in" : "not in"} (${p.value.map(bind).join(", ")})`;
    }
    if (p.valueType === "value" && p.value == null && (p.operator === "eq" || p.operator === "ne")) {
      return `${column} is ${p.operator === "ne" ? "not " : ""}null`;
    }
    let right = p.valueType === "column" ? path(p.value) : bind(p.value);
    if (p.operator === "ilike") return `lower(${column}) like lower(${right})`;
    let operators = { eq: "=", ne: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like" };
    return `${column} ${operators[p.operator]} ${right}`;
  }
  function where(predicates: Predicate[], keyword = "where"): string {
    return predicates.length ? ` ${keyword} ${predicates.map((p) => `(${predicate(p)})`).join(" and ")}` : "";
  }
  function encode(table: AnyTable, row: Record<string, unknown>) {
    let columns = getTableColumnDefinitions(table);
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
      columns[key]?.type === "json" && value != null ? JSON.stringify(value) : value,
    ]));
  }
  function assignments(table: AnyTable, row: Record<string, unknown>) {
    return Object.entries(encode(table, row)).map(([key, value]) => `${identifier(key)} = ${bind(value)}`).join(", ");
  }
  let text: string;
  if (operation.kind === "raw") return { text: operation.sql.text, values: operation.sql.values.map((value) => typeof value === "boolean" ? Number(value) : value) };
  if (operation.kind === "upsert") throw new Error("D1 driver upsert is not implemented");
  let table = path(getTableName(operation.table));
  if (operation.kind === "select" || operation.kind === "count" || operation.kind === "exists") {
    let from = ` from ${table}`;
    if (operation.joins.length || operation.groupBy.length || operation.having.length) {
      throw new Error("D1 driver joins, grouping and HAVING are not implemented");
    }
    from += where(operation.where);
    if (operation.kind !== "select") {
      text = `select count(*) as "count" from (select 1${from})`;
    } else {
      let selection = operation.select === "*" ? "*" : operation.select.map((c) => `${path(c.column)} as ${identifier(c.alias)}`).join(", ");
      text = `select ${operation.distinct ? "distinct " : ""}${selection}${from}`;
      if (operation.orderBy.length) text += ` order by ${operation.orderBy.map((c) => `${path(c.column)} ${c.direction}`).join(", ")}`;
      if (operation.limit !== undefined || operation.offset !== undefined) text += ` limit ${bind(operation.limit ?? -1)}`;
      if (operation.offset !== undefined) text += ` offset ${bind(operation.offset)}`;
    }
  } else {
    if (operation.kind === "delete") text = `delete from ${table}${where(operation.where)}`;
    else if (operation.kind === "update") {
      if (!Object.keys(operation.changes).length) throw new Error("UPDATE requires changes");
      text = `update ${table} set ${assignments(operation.table, operation.changes)}${where(operation.where)}`;
    } else {
      let rows = (operation.kind === "insertMany" ? operation.values : [operation.values]).map((row) => encode(operation.table, row));
      let columns = Object.keys(rows[0] ?? {});
      if (rows.some((row) => Object.keys(row).length !== columns.length || columns.some((key) => !(key in row)))) {
        throw new Error("Bulk inserts require the same columns in every row");
      }
      if (!rows.length) return { text: "select 1 where 0", values };
      if (!columns.length && rows.length > 1) throw new Error("Bulk default-only inserts are unsupported");
      text = columns.length
        ? `insert into ${table} (${columns.map(identifier).join(", ")}) values ${rows.map((row) => `(${columns.map((key) => bind(row[key])).join(", ")})`).join(", ")}`
        : `insert into ${table} default values`;
    }
    if (operation.returning) text += ` returning ${operation.returning === "*" ? "*" : operation.returning.map(identifier).join(", ")}`;
  }
  return { text, values };
}

export function createD1Driver(binding: D1Database): DatabaseDriver<"sqlite"> {
  function unsupported(): never {
    throw new Error("D1 does not support driver transactions, savepoints, or wipe; use one atomic SQL statement");
  }
  return {
    dialect: "sqlite",
    capabilities: Object.freeze({ returning: true, upsert: false, savepoints: false, transactionalDdl: false, migrationLock: false }),
    async execute({ operation, transaction }) {
      if (transaction) unsupported();
      if (operation.kind === "insertMany" && operation.values.length === 0) return { rows: [], affectedRows: 0 };
      let compiled = compileD1Operation(operation);
      // all() handles both reads and writes, including WITH/RETURNING, without SQL regex classification.
      let result = await binding.prepare(compiled.text).bind(...compiled.values).all<Record<string, unknown>>();
      if (!result.success) throw new Error(result.error ?? "D1 statement failed");
      let rows = result.results.map((row) => ({ ...row }));
      if (operation.kind !== "raw" && operation.kind !== "count" && operation.kind !== "exists") {
        let definitions = getTableColumnDefinitions(operation.table);
        let fields = operation.kind === "select" && operation.select !== "*"
          ? operation.select.map((field) => [field.alias, definitions[field.column.split(".").at(-1)!]] as const)
          : Object.entries(definitions);
        for (let row of rows) for (let [key, definition] of fields) {
          if (!definition) continue;
          if (row[key] == null) continue;
          if (definition.type === "json" && typeof row[key] === "string") row[key] = JSON.parse(row[key]);
          if (definition.type === "boolean") row[key] = Boolean(row[key]);
        }
      }
      if (operation.kind === "select" || operation.kind === "count" || operation.kind === "exists") return { rows };
      let insertId: unknown;
      if (operation.kind === "insert" || operation.kind === "insertMany") {
        let keys = getTablePrimaryKey(operation.table);
        if (keys.length === 1) insertId = rows.at(-1)?.[keys[0]] ?? result.meta.last_row_id;
      }
      return { rows, affectedRows: result.meta.changes, insertId };
    },
    async executeScript(sql, transaction) {
      if (transaction) unsupported();
      await binding.exec(sql);
    },
    async hasTable(table) {
      let schema = table.schema ? `${identifier(table.schema)}.` : "";
      let result = await binding.prepare(`select 1 from ${schema}sqlite_master where type = 'table' and name = ?`).bind(table.name).all();
      return result.results.length > 0;
    },
    async hasColumn(table, column) {
      let schema = table.schema ? `${identifier(table.schema)}.` : "";
      let result = await binding.prepare(`pragma ${schema}table_info(${identifier(table.name)})`).all<{ name: string }>();
      return result.results.some((entry) => entry.name === column);
    },
    async beginTransaction() { return unsupported(); },
    async commitTransaction() { unsupported(); },
    async rollbackTransaction() { unsupported(); },
    async createSavepoint() { unsupported(); },
    async rollbackToSavepoint() { unsupported(); },
    async releaseSavepoint() { unsupported(); },
    async wipe() { unsupported(); },
    close() { /* The Worker runtime owns the binding. */ },
  };
}
