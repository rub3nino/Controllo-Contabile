/**
 * Avatar.tsx — Componente avatar utente
 * 
 * Utilizzo:
 * <Avatar name="Mario Rossi" />
 * <Avatar name="Mario Rossi" src="/avatar.jpg" />
 * <AvatarMenu user={{ name: "Mario Rossi", email: "mario@example.com" }} />
 */

import { useState } from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

interface User {
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

interface AvatarMenuProps {
  user: User;
  onSettings?: () => void;
  onLogout?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Size mappings
// ─────────────────────────────────────────────────────────────────────────────

const sizeClasses = {
  sm: "w-7 h-7 text-caption",
  md: "w-9 h-9 text-label-sm",
  lg: "w-12 h-12 text-label-md",
};

// ─────────────────────────────────────────────────────────────────────────────
// Color palette for initials
// ─────────────────────────────────────────────────────────────────────────────

const colors = [
  "bg-tint-blue-bg text-tint-blue-text",
  "bg-tint-green-bg text-tint-green-text",
  "bg-tint-orange-bg text-tint-orange-text",
  "bg-tint-red-bg text-tint-red-text",
  "bg-tint-yellow-bg text-tint-yellow-text",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar Component
// ─────────────────────────────────────────────────────────────────────────────

export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClasses[size]} ${getColorForName(name)}
        rounded-full flex items-center justify-center font-medium
        ${className}
      `}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar with Dropdown Menu
// ─────────────────────────────────────────────────────────────────────────────

export function AvatarMenu({ user, onSettings, onLogout }: AvatarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
      >
        <Avatar name={user.name} src={user.avatar} size="sm" />
        <div className="hidden sm:block text-left min-w-0">
          <div className="text-label-sm text-ink-primary truncate max-w-[120px]">{user.name}</div>
          {user.role && (
            <div className="text-caption text-ink-tertiary truncate">{user.role}</div>
          )}
        </div>
        <Icon name="expand_more" size="sm" className="text-ink-tertiary" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface-card rounded-lg border border-border-subtle shadow-dropdown z-50 overflow-hidden animate-dropdown-in">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-border-muted">
              <div className="text-label-md text-ink-primary">{user.name}</div>
              {user.email && (
                <div className="text-body-sm text-ink-secondary truncate">{user.email}</div>
              )}
            </div>

            {/* Menu items */}
            <div className="py-1">
              {onSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSettings();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-label-sm text-ink-primary hover:bg-surface-hover transition-colors"
                >
                  <Icon name="settings" size="sm" className="text-ink-tertiary" />
                  Impostazioni
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-label-sm text-ink-primary hover:bg-surface-hover transition-colors"
              >
                <Icon name="help_outline" size="sm" className="text-ink-tertiary" />
                Aiuto
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-label-sm text-ink-primary hover:bg-surface-hover transition-colors"
              >
                <Icon name="keyboard" size="sm" className="text-ink-tertiary" />
                Scorciatoie
                <kbd className="ml-auto px-1.5 py-0.5 rounded bg-surface-recessed text-caption text-ink-tertiary">⌘/</kbd>
              </button>
              {onLogout && (
                <>
                  <div className="my-1 border-t border-border-muted" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-label-sm text-status-red-text hover:bg-status-red-bg/50 transition-colors"
                  >
                    <Icon name="logout" size="sm" />
                    Esci
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
