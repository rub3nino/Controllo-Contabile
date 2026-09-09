/**
 * useKeyboardShortcuts.ts — Hook per gestire scorciatoie da tastiera
 * 
 * Utilizzo:
 * useKeyboardShortcuts({
 *   'cmd+k': () => openCommandPalette(),
 *   'cmd+s': () => save(),
 *   '1': () => goToSection(1),
 * });
 */

import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;
type ShortcutMap = Record<string, ShortcutHandler>;

interface Options {
  /** Disable shortcuts when an input is focused */
  ignoreInputs?: boolean;
  /** Enable shortcuts */
  enabled?: boolean;
}

/**
 * Parse a shortcut string like "cmd+k" or "ctrl+shift+s"
 */
function parseShortcut(shortcut: string): {
  key: string;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    meta: parts.includes("cmd") || parts.includes("meta"),
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
  };
}

/**
 * Check if an element is an input-like element
 */
function isInputElement(el: Element | null): boolean {
  if (!el) return false;
  const tagName = el.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: Options = {}
) {
  const { ignoreInputs = true, enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if focused on input and ignoreInputs is true
      if (ignoreInputs && isInputElement(document.activeElement)) {
        // But still allow cmd/ctrl shortcuts in inputs
        if (!event.metaKey && !event.ctrlKey) return;
      }

      // Check each shortcut
      for (const [shortcutStr, handler] of Object.entries(shortcuts)) {
        const shortcut = parseShortcut(shortcutStr);

        const keyMatch =
          event.key.toLowerCase() === shortcut.key ||
          event.code.toLowerCase() === `key${shortcut.key}` ||
          event.code.toLowerCase() === `digit${shortcut.key}`;

        const metaMatch =
          shortcut.meta === (event.metaKey || event.ctrlKey) ||
          (!shortcut.meta && !event.metaKey && !event.ctrlKey);

        const shiftMatch = shortcut.shift === event.shiftKey;
        const altMatch = shortcut.alt === event.altKey;

        // Special handling for single-key shortcuts (numbers)
        const isSingleKey =
          !shortcut.meta && !shortcut.ctrl && !shortcut.shift && !shortcut.alt;

        if (isSingleKey) {
          // For single keys, require no modifiers
          if (
            keyMatch &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            handler();
            return;
          }
        } else {
          // For combo shortcuts
          if (keyMatch && metaMatch && shiftMatch && altMatch) {
            event.preventDefault();
            handler();
            return;
          }
        }
      }
    },
    [shortcuts, enabled, ignoreInputs]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Format a shortcut for display (platform-aware)
 */
export function formatShortcut(shortcut: string): string {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  return shortcut
    .replace(/cmd\+/gi, isMac ? "⌘" : "Ctrl+")
    .replace(/ctrl\+/gi, isMac ? "⌃" : "Ctrl+")
    .replace(/alt\+/gi, isMac ? "⌥" : "Alt+")
    .replace(/shift\+/gi, isMac ? "⇧" : "Shift+")
    .replace(/meta\+/gi, isMac ? "⌘" : "Win+");
}
