/**
 * ConnectionStatus.tsx — Indicatore di stato connessione backend
 * 
 * Utilizzo:
 * <ConnectionStatus />
 * 
 * Mostra un indicatore visivo dello stato della connessione al server.
 */

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionState = "connected" | "disconnected" | "checking";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionStatusProps {
  /** Check interval in ms (default: 30000 = 30s) */
  checkInterval?: number;
  /** Show label text */
  showLabel?: boolean;
  /** Compact mode (just the dot) */
  compact?: boolean;
  className?: string;
}

export function ConnectionStatus({
  checkInterval = 30000,
  showLabel = false,
  compact = false,
  className = "",
}: ConnectionStatusProps) {
  const [state, setState] = useState<ConnectionState>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  async function checkConnection() {
    setState("checking");
    try {
      const res = await fetch("/api/health", { method: "GET" });
      setState(res.ok ? "connected" : "disconnected");
    } catch {
      setState("disconnected");
    }
    setLastCheck(new Date());
  }

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, checkInterval);
    return () => clearInterval(interval);
  }, [checkInterval]);

  // Styling based on state
  const stateStyles = {
    connected: {
      dot: "bg-status-green-text",
      text: "text-status-green-text",
      label: "Connesso",
      icon: "cloud_done",
    },
    disconnected: {
      dot: "bg-status-red-text",
      text: "text-status-red-text",
      label: "Disconnesso",
      icon: "cloud_off",
    },
    checking: {
      dot: "bg-status-yellow-text animate-pulse",
      text: "text-status-yellow-text",
      label: "Verifica...",
      icon: "sync",
    },
  };

  const style = stateStyles[state];

  if (compact) {
    return (
      <div
        className={`w-2 h-2 rounded-full ${style.dot} ${className}`}
        title={`${style.label}${lastCheck ? ` — ${lastCheck.toLocaleTimeString()}` : ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={checkConnection}
      className={`
        inline-flex items-center gap-2 px-2 py-1 rounded
        hover:bg-surface-hover transition-colors
        ${className}
      `}
      title={`Clicca per verificare — Ultimo controllo: ${lastCheck?.toLocaleTimeString() || "mai"}`}
    >
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      {showLabel && (
        <span className={`text-caption ${style.text}`}>{style.label}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Connection Banner (for errors)
// ─────────────────────────────────────────────────────────────────────────────

export function ConnectionBanner() {
  const [isDisconnected, setIsDisconnected] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/health");
        setIsDisconnected(!res.ok);
      } catch {
        setIsDisconnected(true);
      }
    }
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!isDisconnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-status-red-bg border-b border-status-red-text/20 px-4 py-2 flex items-center justify-center gap-3">
      <Icon name="cloud_off" size="sm" className="text-status-red-text" />
      <span className="text-label-sm text-status-red-text">
        Connessione al server persa. Verifica la connessione e ricarica la pagina.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-3 py-1 rounded bg-status-red-text text-white text-label-sm hover:bg-status-red-text/90 transition-colors"
      >
        Ricarica
      </button>
    </div>
  );
}
