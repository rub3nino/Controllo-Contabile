/**
 * Breadcrumb.tsx — Breadcrumb interattivo
 * 
 * Utilizzo:
 * <Breadcrumb 
 *   items={[
 *     { label: "Home", onClick: () => {} },
 *     { label: "Clienti", onClick: () => {} },
 *     { label: "ACME Corp" }
 *   ]}
 * />
 */

import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  icon?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: "slash" | "chevron";
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Breadcrumb({ items, separator = "slash", className = "" }: BreadcrumbProps) {
  const separatorElement = separator === "chevron" 
    ? <Icon name="chevron_right" size="sm" className="text-ink-tertiary" />
    : <span className="text-ink-tertiary">/</span>;

  return (
    <nav className={`flex items-center gap-1.5 text-body-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = !isLast && item.onClick;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {/* Separator (except for first item) */}
              {index > 0 && separatorElement}

              {/* Item */}
              {isClickable ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 text-ink-secondary hover:text-ink-primary transition-colors press-effect"
                >
                  {item.icon && <Icon name={item.icon} size="sm" />}
                  <span>{item.label}</span>
                </button>
              ) : (
                <span
                  className={`flex items-center gap-1.5 ${
                    isLast ? "text-ink-primary font-medium" : "text-ink-secondary"
                  }`}
                >
                  {item.icon && <Icon name={item.icon} size="sm" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple string-based breadcrumb (backward compatible)
// ─────────────────────────────────────────────────────────────────────────────

interface SimpleBreadcrumbProps {
  items: string[];
  onItemClick?: (index: number) => void;
  className?: string;
}

export function SimpleBreadcrumb({ items, onItemClick, className = "" }: SimpleBreadcrumbProps) {
  const breadcrumbItems: BreadcrumbItem[] = items.map((label, index) => ({
    label,
    onClick: onItemClick && index < items.length - 1 ? () => onItemClick(index) : undefined,
  }));

  return <Breadcrumb items={breadcrumbItems} className={className} />;
}
