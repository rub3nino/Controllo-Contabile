/**
 * DataTable — Wrapper di stile per tabelle dati.
 * Intestazione su surface-sidebar, celle con bordo hairline, hover leggero.
 */

import type { ReactNode } from "react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Funzione per ottenere una chiave univoca per ogni riga */
  getRowKey: (row: T, index: number) => string | number;
  /** Callback click su riga */
  onRowClick?: (row: T) => void;
  /** Messaggio se nessun dato */
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyMessage = "Nessun dato.",
  className = "",
}: DataTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (data.length === 0) {
    return (
      <div className="px-base py-lg text-body-md text-ink-tertiary text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={alignClasses[col.align || "left"]}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={getRowKey(row, rowIndex)}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={`${getRowKey(row, rowIndex)}-${String(col.key)}`}
                  className={alignClasses[col.align || "left"]}
                >
                  {col.render
                    ? col.render(row, rowIndex)
                    : (row[col.key as keyof T] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
