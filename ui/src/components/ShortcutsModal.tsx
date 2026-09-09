/**
 * ShortcutsModal.tsx — Modale con elenco scorciatoie da tastiera
 * 
 * Utilizzo:
 * const [showShortcuts, setShowShortcuts] = useState(false);
 * <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
 */

import { useEffect } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Shortcut definitions
// ─────────────────────────────────────────────────────────────────────────────

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Generale",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Apri ricerca rapida" },
      { keys: ["⌘", "/"], description: "Mostra scorciatoie" },
      { keys: ["⌘", "S"], description: "Salva pratica corrente" },
      { keys: ["Esc"], description: "Chiudi modale/pannello" },
    ],
  },
  {
    title: "Navigazione",
    shortcuts: [
      { keys: ["1"], description: "Vai a Controllo Contabile" },
      { keys: ["2"], description: "Vai a JET (ISA 240)" },
      { keys: ["3"], description: "Vai a Sezione 3" },
      { keys: ["4"], description: "Vai a Sezione 4" },
      { keys: ["5"], description: "Vai a Sezione 5" },
      { keys: ["["], description: "Comprimi/espandi sidebar" },
    ],
  },
  {
    title: "Documenti",
    shortcuts: [
      { keys: ["⌘", "O"], description: "Seleziona cartella" },
      { keys: ["⌘", "↵"], description: "Avvia scansione" },
      { keys: ["⌘", "F"], description: "Cerca nei documenti" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-primary/20 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-surface-card rounded-xl border border-border-subtle shadow-dropdown overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-muted">
          <div className="flex items-center gap-3">
            <Icon name="keyboard" size="md" className="text-ink-tertiary" />
            <h2 className="text-heading-sm text-ink-primary">Scorciatoie da tastiera</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Icon name="close" size="sm" className="text-ink-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid gap-8 md:grid-cols-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-label-md text-ink-secondary mb-3">{group.title}</h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <span className="text-body-sm text-ink-primary">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <kbd
                            key={j}
                            className="min-w-[24px] h-6 px-1.5 rounded bg-surface-recessed border border-border-subtle text-caption text-ink-secondary flex items-center justify-center"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-muted bg-surface text-center">
          <p className="text-caption text-ink-tertiary">
            Premi <kbd className="px-1.5 py-0.5 mx-1 rounded bg-surface-recessed text-ink-secondary">⌘/</kbd> per mostrare/nascondere questa finestra
          </p>
        </div>
      </div>
    </div>
  );
}
