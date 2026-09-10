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
  variant?: "default" | "notion";
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyMessage = "Nessun dato.",
  className = "",
  variant = "default",
}: DataTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (data.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-[#9b9a97] text-center">
        {emptyMessage}
      </div>
    );
  }

  const notion = variant === "notion";

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={notion ? "w-full border-collapse text-left text-xs notion-table" : "data-table"}>
        <thead>
          <tr className={notion ? "bg-[#f7f6f3] text-[#787774] font-medium" : undefined}>
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
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                  : undefined
              }
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
