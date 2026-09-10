/**
 * Switch — Toggle Notion-like, 36×20, etichetta a fianco.
 */

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  hideLabel?: boolean;
};

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center text-left min-h-9 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        hideLabel ? "justify-end" : "gap-3"
      }`}
    >
      <span
        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors duration-150 ${
          checked ? "bg-ink-primary" : "bg-[#e3e2de]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      {!hideLabel && (
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink-primary">{label}</span>
          {description && (
            <span className="block text-xs text-ink-secondary leading-4">{description}</span>
          )}
        </span>
      )}
    </button>
  );
}
