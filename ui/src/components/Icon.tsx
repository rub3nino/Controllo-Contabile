/**
 * Icon component wrapping Material Symbols Outlined.
 * Ensures consistent sizing and styling throughout the app.
 */

type IconSize = "sm" | "md" | "lg" | "xl";

interface IconProps {
  name: string;
  size?: IconSize;
  className?: string;
}

const sizeClasses: Record<IconSize, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
};

export function Icon({ name, size = "md", className = "" }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
