import type { ReactNode } from "react";

export type NotionTone =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple";

export const NOTION_TAG: Record<NotionTone, string> = {
  gray: "bg-[#f1f1ef] text-[#787774]",
  blue: "bg-[#e7f3f8] text-[#337ea9]",
  green: "bg-[#edf3ec] text-[#448361]",
  yellow: "bg-[#fbf3db] text-[#9f6b00]",
  orange: "bg-[#faebdd] text-[#d9730d]",
  red: "bg-[#fdebec] text-[#c4554d]",
  purple: "bg-[#f6f3f9] text-[#9065b0]",
};

export const NOTION_ICON: Record<NotionTone, string> = {
  gray: "bg-[#ebebea] text-[#5f5e5b]",
  blue: "bg-[#e7f3f8] text-[#337ea9]",
  green: "bg-[#e6f4ea] text-[#137333]",
  yellow: "bg-[#fef7e0] text-[#b06000]",
  orange: "bg-[#faebdd] text-[#d9730d]",
  red: "bg-[#fce8e6] text-[#c5221f]",
  purple: "bg-[#f6f3f9] text-[#9065b0]",
};

export function NotionTag({
  tone = "gray",
  children,
  className = "",
}: {
  tone?: NotionTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${NOTION_TAG[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
