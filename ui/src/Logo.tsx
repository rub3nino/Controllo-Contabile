/**
 * Logo.tsx — Logo Quadra (migrato ad Atelier Document System)
 */

export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-ink-primary" />
      <path
        d="M8.2 16.6 13.4 21.6 23.8 10.8"
        fill="none"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
