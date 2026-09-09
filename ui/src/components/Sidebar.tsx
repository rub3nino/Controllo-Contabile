/**
 * Sidebar — Navigazione principale a sinistra, stile Atelier / Notion.
 * Stato espanso/collassato persistito in localStorage.
 */

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

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

interface ArchiveItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

interface SidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  onSearch?: () => void;
}

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

const ARCHIVE_ITEMS: ArchiveItem[] = [
  {
    id: "verbali",
    label: "Verbali Collegio Sindacale",
    icon: "gavel",
  },
];

const STORAGE_KEY = "quadra-sidebar-collapsed";

function NavButton({
  icon,
  label,
  badge,
  badgeType,
  collapsed,
  active,
  onClick,
  title,
}: {
  icon: string;
  label: string;
  badge?: string;
  badgeType?: "neutral" | "muted";
  collapsed: boolean;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? title || label : undefined}
      className={`
        w-full flex items-center gap-3 rounded-md
        transition-colors
        ${collapsed ? "justify-center px-2 py-2" : "px-3 py-1.5"}
        ${
          active
            ? "bg-surface-sidebar-hover text-ink-primary"
            : "text-ink-secondary hover:bg-surface-sidebar-hover hover:text-ink-primary"
        }
      `}
    >
      <Icon
        name={icon}
        size="sm"
        className={active ? "text-ink-primary" : "text-ink-secondary"}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-[13px] font-medium truncate">{label}</span>
          {badge && (
            <span
              className={`
                text-[11px] px-1.5 py-0.5 rounded
                ${
                  badgeType === "muted"
                    ? "text-ink-tertiary"
                    : "bg-tint-gray-bg text-tint-gray-text"
                }
              `}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export function Sidebar({ activeSection, onSectionChange, onSearch }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      data-onboarding="sidebar"
      className={`
        fixed inset-y-0 left-0 z-40 flex flex-col
        bg-surface-sidebar border-r border-border-subtle
        transition-[width] duration-200 ease-out
        ${collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"}
      `}
    >
      {/* Brand */}
      <div
        className={`
          flex items-center gap-3 px-3 py-3
          ${collapsed ? "justify-center" : ""}
        `}
      >
        <div className="w-7 h-7 rounded bg-ink-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[13px] font-semibold">Q</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink-primary truncate leading-tight">
              Quadra Revisione
            </div>
            <div className="text-[11px] text-ink-tertiary truncate">
              SA Italia 250B · art. 2409-ter
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {/* Utility */}
        <ul className="space-y-0.5 mb-4">
          <li>
            <NavButton
              icon="search"
              label="Cerca"
              collapsed={collapsed}
              onClick={onSearch}
            />
          </li>
          <li>
            <NavButton
              icon="notifications_none"
              label="Aggiornamenti"
              collapsed={collapsed}
            />
          </li>
          <li className="relative">
            <NavButton
              icon="settings"
              label="Impostazioni & Membri"
              collapsed={collapsed}
              active={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            />
            {settingsOpen && !collapsed && (
              <div className="mx-2 mt-1 mb-2 p-2 rounded-md border border-border-subtle bg-surface-card">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-secondary">Tema</span>
                  <ThemeToggle />
                </div>
              </div>
            )}
          </li>
        </ul>

        {/* Procedure */}
        {!collapsed && (
          <div className="px-3 pb-1.5">
            <span className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider">
              Procedure di Audit
            </span>
          </div>
        )}
        <ul className="space-y-0.5 mb-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavButton
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                badgeType={item.badgeType}
                collapsed={collapsed}
                active={activeSection === item.id}
                onClick={() => onSectionChange(item.id)}
              />
            </li>
          ))}
        </ul>

        {/* Archivio */}
        {!collapsed && (
          <div className="px-3 pb-1.5">
            <span className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider">
              Archivio Cartelle
            </span>
          </div>
        )}
        <ul className="space-y-0.5">
          {ARCHIVE_ITEMS.map((item) => (
            <li key={item.id}>
              <NavButton
                icon={item.icon}
                label={item.label}
                badge="In arrivo"
                badgeType="muted"
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-border-muted">
        <div className={`px-3 py-3 ${collapsed ? "text-center" : ""}`}>
          {collapsed ? (
            <div className="w-2 h-2 rounded-full bg-status-green-text mx-auto" title="Sessione attiva" />
          ) : (
            <>
              <div className="text-[12px] text-ink-secondary mb-1">Sessione di Revisione</div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-green-text flex-shrink-0" />
                <span className="text-[12px] text-ink-primary truncate">Incarico Fiscale Attivo</span>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`
            w-full flex items-center gap-2 px-3 py-2.5
            text-ink-secondary hover:text-ink-primary hover:bg-surface-sidebar-hover
            transition-colors
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size="sm" />
          {!collapsed && <span className="text-[12px]">Riduci barra laterale</span>}
        </button>
      </div>
    </aside>
  );
}

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
