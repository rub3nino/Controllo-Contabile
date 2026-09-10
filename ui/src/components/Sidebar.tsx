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
  badgeType?: "neutral" | "muted" | "blue" | "yellow";
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
    badgeType: "blue",
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
  { id: "verbali", label: "Verbali Collegio Sindacale", icon: "description" },
  { id: "riconciliazioni", label: "Riconciliazioni Q1 - Q2", icon: "calculate" },
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
  disabled,
}: {
  icon: string;
  label: string;
  badge?: string;
  badgeType?: "neutral" | "muted" | "blue" | "yellow";
  collapsed: boolean;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || (collapsed ? label : undefined)}
      className={`
        w-full flex items-center gap-2 rounded-md text-xs
        transition-colors
        ${collapsed ? "justify-center px-2 py-2" : "px-2 py-1.5"}
        ${disabled ? "opacity-60 cursor-default hover:bg-transparent hover:text-ink-secondary" : ""}
        ${
          active
            ? "bg-surface-sidebar-hover text-ink-primary font-medium"
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
          <span className="flex-1 text-left truncate">{label}</span>
          {badge && (
            <span
              className={`
                text-[10px] px-1.5 py-0.5 rounded font-mono
                ${
                  badgeType === "muted"
                    ? "text-ink-tertiary"
                    : badgeType === "blue"
                      ? "bg-[#e7f3f8] text-[#337ea9]"
                      : badgeType === "yellow"
                        ? "bg-[#fbf3db] text-[#9f6b00]"
                    : active
                      ? "bg-[#e0deda] text-[#55534e]"
                      : "bg-surface-hover text-ink-secondary"
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
        <div className="w-6 h-6 rounded bg-ink-primary text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs">
          Q
        </div>
        {!collapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink-body truncate leading-tight">
                Quadra Revisione
              </div>
              <div className="text-xs text-ink-secondary truncate">
                SA Italia 250B · art. 2409-ter
              </div>
            </div>
            <Icon name="unfold_more" size="sm" className="text-ink-tertiary shrink-0" />
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
              badge="⌘K"
              badgeType="muted"
              collapsed={collapsed}
              onClick={onSearch}
            />
          </li>
          <li>
            <NavButton
              icon="update"
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
                collapsed={collapsed}
                disabled
                title="In arrivo — non ancora collegato"
                badge="In arrivo"
                badgeType="muted"
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border-subtle bg-surface-sidebar">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded-md bg-[#eeede9] border border-[#e2e1dc] mb-1.5">
            <div className="text-[10px] font-medium text-ink-secondary uppercase tracking-wider">
              Sessione di Revisione
            </div>
            <div className="text-xs font-semibold text-ink-body truncate flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Incarico Fiscale Attivo
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`
            w-full flex items-center justify-between px-2 py-1.5 text-xs
            text-ink-secondary hover:bg-surface-sidebar-hover hover:text-ink-primary
            rounded-md transition-colors
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <span className="flex items-center gap-1.5">
            <Icon name={collapsed ? "dock_to_left" : "dock_to_right"} size="sm" />
            {!collapsed && <span>Riduci Barra Laterale</span>}
          </span>
          {!collapsed && <span className="text-[10px] text-ink-tertiary font-mono">⌥\\</span>}
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
