import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { NOTION_ICON, type NotionTone } from "../components/NotionTag";

export const jetInputClass =
  "w-full h-9 px-3 rounded-md border border-[#e9e8e4] bg-white text-sm text-[#2f3437] outline-none focus:border-[#9b9a97] focus-visible:ring-2 focus-visible:ring-[#2f3437] focus-visible:ring-offset-0";

export const jetPrimaryClass =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1 min-h-8 text-xs font-medium bg-[#2f3437] text-white hover:bg-[#1a1c1b] rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

export const jetGhostClass =
  "inline-flex items-center justify-center gap-1.5 px-2.5 py-1 min-h-8 text-xs text-[#55534e] hover:text-[#2f3437] hover:bg-[#ebebea] border border-[#e3e2de] rounded-md transition-colors bg-white shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

export function JetSection({
  icon,
  title,
  hint,
  trailing,
  padded = false,
  accent = "gray",
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  trailing?: ReactNode;
  padded?: boolean;
  accent?: NotionTone;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col bg-white rounded-lg border border-[#e9e8e4] shadow-xs overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#e9e8e4] flex flex-wrap items-center justify-between gap-3 bg-[#faf9f7]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${NOTION_ICON[accent]}`}
          >
            <Icon name={icon} size="sm" />
          </span>
          <h2 className="text-sm font-semibold text-[#2f3437]">{title}</h2>
          {hint ? (
            <span className="text-xs text-[#9b9a97] font-normal hidden md:inline">
              · {hint}
            </span>
          ) : null}
        </div>
        {trailing ? <div className="flex items-center gap-1.5">{trailing}</div> : null}
      </div>
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function JetMetric({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: string;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "alert" | "pending" | "ok" | "info";
}) {
  const shell =
    tone === "alert"
      ? "bg-[#fff7f6] border-[#f5c6cb]/60 hover:border-[#f5c6cb]"
      : tone === "pending"
      ? "bg-[#fffcf5] border-[#fde68a]/60 hover:border-[#fde68a]"
      : tone === "ok"
      ? "bg-[#f4faf5] border-[#d4ead9] hover:border-[#b7dcc0]"
      : tone === "info"
      ? "bg-[#f4f9fb] border-[#d3e5ed] hover:border-[#b9d4e0]"
      : "bg-[#f7f6f3] border-[#e9e8e4] hover:border-[#dfdeda]";
  const glyph =
    tone === "alert"
      ? "bg-[#fce8e6] text-[#c5221f]"
      : tone === "pending"
      ? "bg-[#fef7e0] text-[#b06000]"
      : tone === "ok"
      ? "bg-[#e6f4ea] text-[#137333]"
      : tone === "info"
      ? "bg-[#e7f3f8] text-[#337ea9]"
      : "bg-[#e8eaed] text-[#5f6368]";
  const figure =
    tone === "alert"
      ? "text-[#c5221f]"
      : tone === "pending"
      ? "text-[#b06000]"
      : tone === "ok"
      ? "text-[#137333]"
      : tone === "info"
      ? "text-[#337ea9]"
      : "text-[#2f3437]";

  return (
    <div className={`p-3.5 rounded-md border flex items-start gap-3 transition-colors ${shell}`}>
      <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${glyph}`}>
        <Icon name={icon} size="sm" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#787774]">
          {label}
        </span>
        <div className={`text-xl font-bold mt-0.5 font-mono tabular-nums ${figure}`}>
          {value}
        </div>
        {hint ? (
          <p className="text-[11px] text-[#787774] mt-0.5 truncate">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
