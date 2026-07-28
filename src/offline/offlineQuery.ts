import { getOfflineIdentity, readTable } from "@/offline/offlineDb";

type Filter = (row: Record<string, any>) => boolean;
type OrderRule = { column: string; ascending: boolean };
type QueryResult = { data: any; error: Error | null; count?: number | null };

const WRITE_ERROR = new Error(
  "Você está offline. Alterações não são permitidas até a conexão ser restabelecida.",
);

function likePattern(pattern: string) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function selectFields(row: Record<string, any>, columns: string) {
  if (!columns || columns.trim() === "*" || /[():]/.test(columns)) return row;
  const selected: Record<string, any> = {};
  columns.split(",").map((item) => item.trim()).filter(Boolean).forEach((column) => {
    selected[column] = row[column];
  });
  Object.keys(row).filter((column) => column.startsWith("offline_")).forEach((column) => {
    selected[column] = row[column];
  });
  return selected;
}

function splitOrExpression(expression: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of expression) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export class OfflineQueryBuilder implements PromiseLike<QueryResult> {
  private operation: "select" | "write" = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private orders: OrderRule[] = [];
  private maximum: number | null = null;
  private singular: "single" | "maybeSingle" | null = null;
  private head = false;
  private countMode = false;

  constructor(private table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.head = Boolean(options?.head);
    this.countMode = Boolean(options?.count);
    return this;
  }

  insert(..._args: unknown[]) { this.operation = "write"; return this; }
  update(..._args: unknown[]) { this.operation = "write"; return this; }
  upsert(..._args: unknown[]) { this.operation = "write"; return this; }
  delete(..._args: unknown[]) { this.operation = "write"; return this; }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const expression = likePattern(pattern);
    this.filters.push((row) => expression.test(String(row[column] ?? "")));
    return this;
  }

  contains(column: string, values: unknown[]) {
    this.filters.push((row) => Array.isArray(row[column]) && values.every((value) => row[column].includes(value)));
    return this;
  }

  match(values: Record<string, unknown>) {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  or(expression: string) {
    const alternatives = splitOrExpression(expression).map((part) => {
      const [column, operator, ...rawValue] = part.split(".");
      const value = rawValue.join(".");
      if (operator === "eq") return (row: Record<string, any>) => String(row[column]) === value;
      if (operator === "is") {
        const expected = value === "null" ? null : value;
        return (row: Record<string, any>) => row[column] === expected;
      }
      if (operator === "in") {
        const values = value.replace(/^\(|\)$/g, "").split(",");
        return (row: Record<string, any>) => values.includes(String(row[column]));
      }
      if (operator === "ilike") {
        const matcher = likePattern(value);
        return (row: Record<string, any>) => matcher.test(String(row[column] ?? ""));
      }
      return () => false;
    });
    this.filters.push((row) => alternatives.some((filter) => filter(row)));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.maximum = value;
    return this;
  }

  single() { this.singular = "single"; return this; }
  maybeSingle() { this.singular = "maybeSingle"; return this; }

  private async execute(): Promise<QueryResult> {
    if (this.operation === "write") return { data: null, error: WRITE_ERROR };
    const userId = getOfflineIdentity();
    if (!userId) return { data: null, error: new Error("Nenhum dado offline foi preparado para esta conta.") };

    let rows = (await readTable(userId, this.table)).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    if (this.orders.length) {
      rows = [...rows].sort((left, right) => {
        for (const rule of this.orders) {
          const a = left[rule.column];
          const b = right[rule.column];
          if (a === b) continue;
          const result = a == null ? 1 : b == null ? -1 : a < b ? -1 : 1;
          return rule.ascending ? result : -result;
        }
        return 0;
      });
    }

    const count = rows.length;
    if (this.maximum != null) rows = rows.slice(0, this.maximum);
    const dataRows = this.head ? null : rows.map((row) => selectFields(row, this.columns));

    if (this.singular) {
      if (rows.length === 0 && this.singular === "maybeSingle") return { data: null, error: null, count };
      if (rows.length !== 1) return { data: null, error: new Error("Registro offline não encontrado ou não é único."), count };
      return { data: selectFields(rows[0], this.columns), error: null, count };
    }

    return { data: dataRows, error: null, count: this.countMode ? count : null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
