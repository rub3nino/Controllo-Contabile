/**
 * CommandPalette.tsx — Spotlight-style command palette (⌘K)
 * 
 * Utilizzo:
 * 1. Wrappa l'app con <CommandPaletteProvider>
 * 2. Registra comandi con useCommandPalette().registerCommands()
 * 3. L'utente può aprire con ⌘K o Ctrl+K
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  shortcut?: string;
  section?: string;
  onSelect: () => void;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommands: (commands: Command[]) => () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerCommands = useCallback((newCommands: Command[]) => {
    setCommands((prev) => [...prev, ...newCommands]);
    return () => {
      setCommands((prev) => prev.filter((c) => !newCommands.some((nc) => nc.id === c.id)));
    };
  }, []);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q) ||
        c.section?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Group by section
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      const section = cmd.section || "Azioni";
      if (!groups[section]) groups[section] = [];
      groups[section].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Flatten for index navigation
  const flatCommands = useMemo(() => filteredCommands, [filteredCommands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Open with ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      if (!isOpen) return;

      // Navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = flatCommands[selectedIndex];
        if (selected) {
          selected.onSelect();
          close();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggle, close, flatCommands, selectedIndex]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, toggle, registerCommands }}>
      {children}

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={close}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink-primary/20 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="relative w-full max-w-lg bg-surface-card rounded-xl border border-border-subtle shadow-dropdown overflow-hidden animate-command-palette-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-muted">
              <Icon name="search" size="sm" className="text-ink-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca comandi, clienti, documenti..."
                className="flex-1 bg-transparent text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-recessed text-caption text-ink-tertiary">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {flatCommands.length === 0 ? (
                <div className="py-8 text-center text-body-sm text-ink-tertiary">
                  {query ? "Nessun risultato trovato" : "Inizia a digitare per cercare..."}
                </div>
              ) : (
                Object.entries(groupedCommands).map(([section, cmds]) => (
                  <div key={section} className="mb-2 last:mb-0">
                    <div className="px-2 py-1.5 text-caption text-ink-tertiary uppercase tracking-wider">
                      {section}
                    </div>
                    {cmds.map((cmd) => {
                      const globalIndex = flatCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => {
                            cmd.onSelect();
                            close();
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                            transition-colors
                            ${isSelected ? "bg-surface-hover" : "hover:bg-surface-hover"}
                          `}
                        >
                          {cmd.icon && (
                            <Icon
                              name={cmd.icon}
                              size="sm"
                              className={isSelected ? "text-ink-primary" : "text-ink-tertiary"}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-label-md text-ink-primary truncate">{cmd.title}</div>
                            {cmd.subtitle && (
                              <div className="text-caption text-ink-tertiary truncate">{cmd.subtitle}</div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-recessed text-caption text-ink-tertiary">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border-muted bg-surface text-caption text-ink-tertiary">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-recessed">↑↓</kbd>
                <span>naviga</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-recessed">↵</kbd>
                <span>seleziona</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-recessed">esc</kbd>
                <span>chiudi</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </CommandPaletteContext.Provider>
  );
}
