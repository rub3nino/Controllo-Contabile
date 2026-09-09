/**
 * EmptyState.tsx — Componenti per stati vuoti
 * 
 * Utilizzo:
 * <EmptyState
 *   icon="folder_open"
 *   title="Nessun documento"
 *   description="Carica il primo documento per iniziare"
 *   action={{ label: "Carica", onClick: () => {} }}
 * />
 */

import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Size mappings
// ─────────────────────────────────────────────────────────────────────────────

const sizeStyles = {
  sm: {
    container: "py-8",
    iconBg: "w-12 h-12",
    iconSize: "md" as const,
    title: "text-label-md",
    description: "text-body-sm",
  },
  md: {
    container: "py-12",
    iconBg: "w-16 h-16",
    iconSize: "lg" as const,
    title: "text-heading-sm",
    description: "text-body-md",
  },
  lg: {
    container: "py-16",
    iconBg: "w-20 h-20",
    iconSize: "xl" as const,
    title: "text-heading-md",
    description: "text-body-lg",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className = "",
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${styles.container} ${className}`}>
      {/* Icon container with subtle pattern */}
      <div
        className={`
          ${styles.iconBg} rounded-2xl
          bg-surface-recessed
          flex items-center justify-center
          mb-4
        `}
      >
        <Icon name={icon} size={styles.iconSize} className="text-ink-tertiary" />
      </div>

      {/* Title */}
      <h3 className={`${styles.title} text-ink-primary mb-1`}>{title}</h3>

      {/* Description */}
      {description && (
        <p className={`${styles.description} text-ink-secondary max-w-sm`}>{description}</p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink-primary text-surface text-label-md hover:bg-ink-primary/90 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border-subtle text-ink-secondary text-label-md hover:bg-surface-hover transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset Empty States
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyDocuments({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon="folder_open"
      title="Nessun documento"
      description="Non ci sono ancora documenti in questa pratica. Seleziona una cartella per iniziare la scansione."
      action={onUpload ? { label: "Seleziona cartella", onClick: onUpload } : undefined}
    />
  );
}

export function EmptyClients({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="business"
      title="Nessun cliente"
      description="Inizia creando il tuo primo cliente per organizzare le pratiche."
      action={onCreate ? { label: "Nuovo cliente", onClick: onCreate } : undefined}
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search_off"
      title="Nessun risultato"
      description={`Nessun elemento trovato per "${query}". Prova con termini diversi.`}
      size="sm"
    />
  );
}

export function EmptyError({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon="error_outline"
      title="Si è verificato un errore"
      description="Non è stato possibile caricare i dati. Verifica la connessione e riprova."
      action={onRetry ? { label: "Riprova", onClick: onRetry } : undefined}
    />
  );
}
