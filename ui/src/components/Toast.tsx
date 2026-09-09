/**
 * Toast.tsx — Sistema di notifiche toast
 * 
 * Utilizzo:
 * 1. Wrappa l'app con <ToastProvider>
 * 2. Usa il hook useToast() per mostrare toast
 * 
 * const { toast } = useToast();
 * toast.success("Operazione completata");
 * toast.error("Si è verificato un errore");
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, { bg: string; icon: string; iconColor: string }> = {
  success: {
    bg: "bg-status-green-bg border-status-green-text/20",
    icon: "check_circle",
    iconColor: "text-status-green-text",
  },
  error: {
    bg: "bg-status-red-bg border-status-red-text/20",
    icon: "error",
    iconColor: "text-status-red-text",
  },
  warning: {
    bg: "bg-status-yellow-bg border-status-yellow-text/20",
    icon: "warning",
    iconColor: "text-status-yellow-text",
  },
  info: {
    bg: "bg-tint-blue-bg border-tint-blue-text/20",
    icon: "info",
    iconColor: "text-tint-blue-text",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast Component
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = variantStyles[item.variant];

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-dropdown
        ${style.bg}
        animate-toast-in
      `}
      role="alert"
    >
      <Icon name={style.icon} size="sm" className={style.iconColor} />
      <div className="flex-1 min-w-0">
        <p className="text-label-md text-ink-primary">{item.title}</p>
        {item.description && (
          <p className="mt-1 text-body-sm text-ink-secondary">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded hover:bg-ink-primary/10 transition-colors"
        aria-label="Chiudi"
      >
        <Icon name="close" size="sm" className="text-ink-tertiary" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = variant === "error" ? 6000 : 4000;

    setToasts((prev) => [...prev, { id, variant, title, description, duration }]);

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (title: string, description?: string) => addToast("success", title, description),
    error: (title: string, description?: string) => addToast("error", title, description),
    warning: (title: string, description?: string) => addToast("warning", title, description),
    info: (title: string, description?: string) => addToast("info", title, description),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container - fixed bottom-right */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <Toast item={item} onDismiss={() => dismiss(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
