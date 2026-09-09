/**
 * Sidebar — Navigazione principale a sinistra.
 * Stato espanso/collassato persistito in localStorage.
 */

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SectionId =
  | "controllo-contabile"
  | "jet"
  | "sezione-3"
  | "sezione-4"
  | "sezione-5";

interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
  badge?: string;
  badgeType?: "neutral" | "muted";
}

interface SidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation items config
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: "controllo-contabile",
    label: "Controllo Contabile",
    icon: "fact_check",
    badge: "250B",
    badgeType: "neutral",
  },
  {
    id: "jet",
    label: "JET (ISA 240)",
    icon: "account_balance",
    badge: "Testing",
    badgeType: "neutral",
  },
  {
    id: "sezione-3",
    label: "Sezione 3",
    icon: "inventory_2",
    badge: "In arrivo",
    badgeType: "muted",
  },
  {
    id: "sezione-4",
    label: "Sezione 4",
    icon: "folder_supervised",
    badge: "In arrivo",
    badgeType: "muted",
  },
  {
    id: "sezione-5",
    label: "Sezione 5",
    icon: "history_edu",
    badge: "In arrivo",
    badgeType: "muted",
  },
];

const STORAGE_KEY = "quadra-sidebar-collapsed";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 flex flex-col
        bg-surface-sidebar border-r border-border-subtle
        transition-[width] duration-200 ease-out
        ${collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"}
      `}
    >
      {/* ─── Header: Logo + Nome ─── */}
      <div
        className={`
          flex items-center gap-md px-md py-base
          border-b border-border-muted
          hover:bg-surface-sidebar-hover transition-colors-fast cursor-default
          ${collapsed ? "justify-center" : ""}
        `}
      >
        {/* Logo box */}
        <div className="w-7 h-7 rounded bg-ink-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-label-md font-semibold">Q</span>
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className="text-label-md font-semibold text-ink-primary truncate">
              Quadra Revisione
            </div>
            <div className="text-body-sm text-ink-tertiary truncate">
              SA Italia 250B · art. 2409-ter
            </div>
          </div>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto px-sm py-md">
        {!collapsed && (
          <div className="px-sm pb-sm">
            <span className="text-label-sm text-ink-tertiary uppercase tracking-wide">
              Procedure di Audit
            </span>
          </div>
        )}

        <ul className="space-y-xxs">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center gap-md rounded
                    transition-colors-fast
                    ${collapsed ? "justify-center px-sm py-sm" : "px-md py-sm"}
                    ${
                      isActive
                        ? "bg-surface-sidebar-hover text-ink-primary"
                        : "text-ink-secondary hover:bg-surface-sidebar-hover hover:text-ink-primary"
                    }
                  `}
                >
                  <Icon
                    name={item.icon}
                    size="md"
                    className={isActive ? "text-ink-primary" : "text-ink-secondary"}
                  />

                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-label-md truncate">
                        {item.label}
                      </span>

                      {item.badge && (
                        <span
                          className={`
                            text-label-sm px-xs py-xxs rounded
                            ${
                              item.badgeType === "muted"
                                ? "text-ink-tertiary"
                                : "bg-tint-gray-bg text-tint-gray-text"
                            }
                          `}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ─── Footer: Session indicator + Collapse button ─── */}
      <div className="mt-auto border-t border-border-muted">
        {/* Session indicator */}
        <div
          className={`
            bg-surface-recessed px-md py-md
            ${collapsed ? "text-center" : ""}
          `}
        >
          {collapsed ? (
            <div className="w-2 h-2 rounded-full bg-status-green-text mx-auto" title="Sessione attiva" />
          ) : (
            <>
              <div className="text-body-sm text-ink-secondary mb-xs">
                Sessione di Revisione
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-status-green-text flex-shrink-0" />
                <span className="text-body-sm text-ink-primary truncate">
                  Incarico Fiscale Attivo
                </span>
              </div>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`
            w-full flex items-center gap-md px-md py-md
            text-ink-secondary hover:text-ink-primary hover:bg-surface-sidebar-hover
            transition-colors-fast
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <Icon
            name={collapsed ? "chevron_right" : "chevron_left"}
            size="sm"
          />
          {!collapsed && (
            <span className="text-body-sm">Riduci barra laterale</span>
          )}
        </button>
      </div>
    </aside>
  );
}

/**
 * Hook per ottenere la larghezza attuale della sidebar.
 * Utile per il layout dell'area contenuto.
 */
export function useSidebarWidth(): string {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    const handleStorage = () => {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    };

    window.addEventListener("storage", handleStorage);
    // Polling leggero per aggiornamenti nella stessa tab
    const interval = setInterval(() => {
      const current = localStorage.getItem(STORAGE_KEY) === "true";
      if (current !== collapsed) setCollapsed(current);
    }, 200);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [collapsed]);

  return collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded";
}
