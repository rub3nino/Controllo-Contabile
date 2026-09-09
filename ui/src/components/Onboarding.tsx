/**
 * Onboarding.tsx — Sistema di tutorial/onboarding
 * 
 * Utilizzo:
 * <OnboardingProvider>
 *   <App />
 *   <OnboardingTooltips />
 * </OnboardingProvider>
 * 
 * Mostra tooltip guida per i nuovi utenti.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface OnboardingContextValue {
  isActive: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  hasCompleted: boolean;
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default steps
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "sidebar",
    target: "[data-onboarding='sidebar']",
    title: "Menu di navigazione",
    description: "Usa la barra laterale per passare tra le diverse sezioni dell'applicazione. Puoi comprimerla per avere più spazio.",
    position: "right",
  },
  {
    id: "search",
    target: "[data-onboarding='search']",
    title: "Ricerca rapida",
    description: "Premi ⌘K per aprire la ricerca rapida. Puoi cercare clienti, documenti e azioni.",
    position: "bottom",
  },
  {
    id: "folder",
    target: "[data-onboarding='folder']",
    title: "Seleziona cartella",
    description: "Inizia selezionando una cartella con i documenti del cliente da analizzare.",
    position: "bottom",
  },
  {
    id: "scan",
    target: "[data-onboarding='scan']",
    title: "Avvia scansione",
    description: "Dopo aver compilato i dati, avvia la scansione per analizzare automaticamente i documenti.",
    position: "left",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage key
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "quadra-onboarding-completed";

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingProviderProps {
  children: ReactNode;
  steps?: OnboardingStep[];
  autoStart?: boolean;
}

export function OnboardingProvider({
  children,
  steps = DEFAULT_STEPS,
  autoStart = true,
}: OnboardingProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // Auto-start for new users
  useEffect(() => {
    if (autoStart && !hasCompleted) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, hasCompleted]);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsActive(false);
      setHasCompleted(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [currentStep, steps.length]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const complete = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const reset = useCallback(() => {
    setHasCompleted(false);
    setCurrentStep(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        start,
        next,
        prev,
        skip,
        complete,
        hasCompleted,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip Component
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingTooltips() {
  const { isActive, currentStep, steps, next, prev, skip } = useOnboarding();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive || !step) {
      setVisible(false);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      // Skip this step if target not found
      next();
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const padding = 12;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "top":
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
      case "right":
      default:
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
    }

    // Keep in viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setPosition({ top, left });
    setVisible(true);

    // Highlight the target element
    el.classList.add("onboarding-highlight");
    return () => el.classList.remove("onboarding-highlight");
  }, [isActive, step, currentStep, next]);

  if (!isActive || !step || !visible) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[90] bg-ink-primary/30 backdrop-blur-[2px] pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-[95] w-80 bg-surface-card rounded-xl border border-border-subtle shadow-dropdown animate-tooltip-in"
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-label-md text-ink-primary">{step.title}</h4>
            <span className="text-caption text-ink-tertiary">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Description */}
          <p className="text-body-sm text-ink-secondary mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? "w-4 bg-ink-primary"
                    : i < currentStep
                    ? "w-1.5 bg-ink-tertiary"
                    : "w-1.5 bg-surface-recessed"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={skip}
              className="text-label-sm text-ink-tertiary hover:text-ink-secondary transition-colors"
            >
              Salta tutorial
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="px-3 py-1.5 rounded-md border border-border-subtle text-label-sm text-ink-secondary hover:bg-surface-hover transition-colors"
                >
                  Indietro
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="px-3 py-1.5 rounded-md bg-ink-primary text-surface text-label-sm hover:bg-ink-primary/90 transition-colors"
              >
                {currentStep === steps.length - 1 ? "Fine" : "Avanti"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome Modal (alternative to tooltips)
// ─────────────────────────────────────────────────────────────────────────────

export function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-primary/30 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative w-full max-w-md bg-surface-card rounded-2xl border border-border-subtle shadow-dropdown overflow-hidden animate-modal-in">
        {/* Header illustration */}
        <div className="h-32 bg-gradient-to-br from-tint-blue-bg to-tint-green-bg flex items-center justify-center">
          <Icon name="school" size="xl" className="text-tint-blue-text" />
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h2 className="text-heading-md text-ink-primary mb-2">Benvenuto in Quadra</h2>
          <p className="text-body-md text-ink-secondary mb-6">
            Vuoi fare un breve tour per scoprire le funzionalità principali?
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onStart}
              className="w-full py-3 rounded-lg bg-ink-primary text-surface text-label-md hover:bg-ink-primary/90 transition-colors"
            >
              Inizia il tour
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="w-full py-3 rounded-lg border border-border-subtle text-label-md text-ink-secondary hover:bg-surface-hover transition-colors"
            >
              Salta, conosco già
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
