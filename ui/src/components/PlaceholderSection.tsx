import { Icon } from "./Icon";
import { PageHeader } from "../shell/PageHeader";

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
    <div className="flex flex-col gap-4 min-w-0 w-full h-full overflow-y-auto">
      <PageHeader
        icon={icon}
        tags={["In arrivo"]}
        title={title}
        meta={<span>{description}</span>}
      />
      <section className="bg-surface-card rounded-lg border border-border-subtle p-8 text-center">
        <Icon name="schedule" size="lg" className="text-ink-tertiary" />
        <p className="mt-3 text-sm text-ink-secondary">Modulo nel piano CRM, non ancora operativo.</p>
      </section>
    </div>
  );
}
