import type { Status } from "./api";

export function pill(status: Status | string) {
  const map: Record<string, string> = {
    "✓": "bg-emerald-100 text-emerald-900",
    wip: "bg-yellow-300 text-yellow-950",
    "✗": "bg-rose-100 text-rose-800",
    "N/A": "bg-neutral-200 text-neutral-600",
    "": "bg-neutral-50 text-neutral-400",
  };
  const label: Record<string, string> = {
    "✓": "Ricevuto",
    wip: "Mancante / WIP",
    "✗": "Skip",
    "N/A": "N/A",
    "": "—",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || map[""]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label[status] || status}
    </span>
  );
}
