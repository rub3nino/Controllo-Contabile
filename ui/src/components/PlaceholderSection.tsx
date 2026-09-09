/**
 * PlaceholderSection — Pagina segnaposto per sezioni non ancora implementate.
 * Non deve sembrare un errore: trasmette che fa parte di un piano.
 */

import { Icon } from "./Icon";

interface PlaceholderSectionProps {
  title: string;
  icon: string;
  description?: string;
}

export function PlaceholderSection({
  title,
  icon,
  description = "Questa funzionalità sarà disponibile in una prossima versione.",
}: PlaceholderSectionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-base">
      <div className="mb-lg">
        <Icon name={icon} size="xl" className="text-ink-tertiary text-[64px]" />
      </div>

      <h1 className="text-headline-md text-ink-primary mb-sm">{title}</h1>

      <p className="text-body-md text-ink-secondary max-w-md">{description}</p>

      <div className="mt-lg flex items-center gap-xs text-body-sm text-ink-tertiary">
        <Icon name="schedule" size="sm" />
        <span>In sviluppo</span>
      </div>
    </div>
  );
}
