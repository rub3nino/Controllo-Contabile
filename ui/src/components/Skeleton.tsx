/**
 * Skeleton.tsx — Componenti skeleton per stati di caricamento
 * 
 * Utilizzo:
 * <Skeleton className="h-4 w-32" />
 * <SkeletonCard />
 * <SkeletonTable rows={5} />
 */

import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Base Skeleton
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-recessed rounded ${className}`}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Text (multiple lines)
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Card
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  hasHeader?: boolean;
  lines?: number;
  className?: string;
}

export function SkeletonCard({ hasHeader = true, lines = 3, className = "" }: SkeletonCardProps) {
  return (
    <div className={`p-6 rounded-lg border border-border-subtle bg-surface-card ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      )}
      <SkeletonText lines={lines} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Table
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = "" }: SkeletonTableProps) {
  return (
    <div className={`rounded-lg border border-border-subtle overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-4 bg-surface-recessed border-b border-border-muted">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 p-4 border-b border-border-muted last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={`h-4 flex-1 ${colIdx === 0 ? "max-w-[200px]" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton List
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonListProps {
  items?: number;
  className?: string;
}

export function SkeletonList({ items = 5, className = "" }: SkeletonListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Stats Grid
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonStatsProps {
  count?: number;
  className?: string;
}

export function SkeletonStats({ count = 4, className = "" }: SkeletonStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border border-border-subtle bg-surface-card">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
