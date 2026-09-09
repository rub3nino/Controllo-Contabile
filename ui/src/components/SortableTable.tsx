/**
 * SortableTable.tsx — Tabella con sorting, filtering ed export
 * 
 * Utilizzo:
 * <SortableTable
 *   columns={[
 *     { key: "name", label: "Nome", sortable: true },
 *     { key: "status", label: "Stato", sortable: true, filterable: true },
 *   ]}
 *   data={items}
 *   getRowKey={(item) => item.id}
 * />
 */

import { useState, useMemo, useCallback } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SortDirection = "asc" | "desc" | null;

export interface SortableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: T) => React.ReactNode;
  getValue?: (row: T) => unknown;
}

interface SortableTableProps<T extends Record<string, unknown>> {
  columns: SortableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  initialSortKey?: keyof T | string;
  initialSortDir?: SortDirection;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  exportFilename?: string;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SortableTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  onRowClick,
  initialSortKey,
  initialSortDir = "asc",
  searchable = true,
  searchPlaceholder = "Cerca...",
  exportable = true,
  exportFilename = "export",
  emptyMessage = "Nessun dato.",
  className = "",
  stickyHeader = false,
  pageSize,
}: SortableTableProps<T>) {
  // ─── State ───
  const [sortKey, setSortKey] = useState<keyof T | string | null>(initialSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Sorting logic ───
  const handleSort = useCallback((key: keyof T | string) => {
    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortDir(null);
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  // ─── Get value from row ───
  const getValue = useCallback((row: T, col: SortableColumn<T>): unknown => {
    if (col.getValue) return col.getValue(row);
    return row[col.key as keyof T];
  }, []);

  // ─── Filtered and sorted data ───
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const val = getValue(row, col);
          return String(val ?? "").toLowerCase().includes(q);
        })
      );
    }

    // Apply column filters
    for (const [key, filterValue] of Object.entries(filters)) {
      if (!filterValue) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      const fv = filterValue.toLowerCase();
      result = result.filter((row) => {
        const val = getValue(row, col);
        return String(val ?? "").toLowerCase().includes(fv);
      });
    }

    // Apply sorting
    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        result.sort((a, b) => {
          const aVal = getValue(a, col);
          const bVal = getValue(b, col);

          // Handle null/undefined
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return sortDir === "asc" ? 1 : -1;
          if (bVal == null) return sortDir === "asc" ? -1 : 1;

          // String comparison
          if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDir === "asc"
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }

          // Number comparison
          if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
          }

          // Fallback
          return String(aVal).localeCompare(String(bVal)) * (sortDir === "asc" ? 1 : -1);
        });
      }
    }

    return result;
  }, [data, searchQuery, filters, sortKey, sortDir, columns, getValue]);

  // ─── Pagination ───
  const paginatedData = useMemo(() => {
    if (!pageSize) return processedData;
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const totalPages = pageSize ? Math.ceil(processedData.length / pageSize) : 1;

  // ─── Export to CSV ───
  const exportToCsv = useCallback(() => {
    const headers = columns.map((c) => c.label);
    const rows = processedData.map((row) =>
      columns.map((col) => {
        const val = getValue(row, col);
        // Escape quotes and wrap in quotes if needed
        const str = String(val ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFilename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [columns, processedData, getValue, exportFilename]);

  // ─── Render ───
  return (
    <div className={`${className}`}>
      {/* Toolbar */}
      {(searchable || exportable) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-border-subtle bg-surface text-body-sm text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors"
              />
            </div>
          )}
          {exportable && (
            <button
              type="button"
              onClick={exportToCsv}
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-border-subtle bg-surface-card hover:bg-surface-hover transition-colors text-label-sm text-ink-secondary"
            >
              <Icon name="download" size="sm" />
              <span className="hidden sm:inline">Esporta CSV</span>
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="data-table">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={`
                    ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                    ${col.sortable ? "cursor-pointer select-none hover:bg-surface-hover" : ""}
                  `}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="flex flex-col -space-y-1">
                        <Icon
                          name="arrow_drop_up"
                          size="sm"
                          className={sortKey === col.key && sortDir === "asc" ? "text-ink-primary" : "text-ink-tertiary/50"}
                        />
                        <Icon
                          name="arrow_drop_down"
                          size="sm"
                          className={sortKey === col.key && sortDir === "desc" ? "text-ink-primary" : "text-ink-tertiary/50"}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-ink-tertiary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer" : ""}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}
                    >
                      {col.render
                        ? col.render(getValue(row, col), row)
                        : String(getValue(row, col) ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-body-sm text-ink-tertiary">
            {processedData.length} risultati
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_left" size="sm" />
            </button>
            <span className="text-body-sm text-ink-primary">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_right" size="sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
