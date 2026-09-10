import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { NOTION_ICON, NOTION_TAG, type NotionTone } from "../components/NotionTag";

export type PageTag = string | { label: string; tone?: NotionTone };

function tagLabel(tag: PageTag) {
  return typeof tag === "string" ? tag : tag.label;
}

function tagTone(tag: PageTag): NotionTone {
  return typeof tag === "string" ? "gray" : tag.tone || "gray";
}

/** Chrome pagina — variant page = code.html; compact = densità operativa. */
export function PageHeader({
  icon = "assignment",
  tags = [],
  title,
  meta,
  toolbar,
  primaryAction,
  variant = "compact",
  iconAccent = "gray",
}: {
  icon?: string;
  tags?: PageTag[];
  title: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  primaryAction?: ReactNode;
  variant?: "compact" | "page";
  iconAccent?: NotionTone;
}) {
  if (variant === "page") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`w-12 h-12 rounded-lg border shadow-sm flex items-center justify-center shrink-0 ${NOTION_ICON[iconAccent]}`}
            aria-hidden
          >
            <Icon name={icon} size="lg" />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tagLabel(tag)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded ${NOTION_TAG[tagTone(tag)]}`}
                >
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-[#2f3437] tracking-tight">{title}</h1>
          {meta && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#787774]">
              {meta}
            </div>
          )}
        </div>
        {(toolbar || primaryAction) && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-b border-[#eeede9]">
            <div className="flex flex-wrap items-center gap-1.5">{toolbar}</div>
            {primaryAction}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-md bg-surface-card border border-border-subtle flex items-center justify-center shrink-0 mt-0.5"
            aria-hidden
          >
            <Icon name={icon} size="sm" className="text-ink-secondary" />
          </div>
          <div className="min-w-0">
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                {tags.map((tag) => (
                  <span
                    key={tagLabel(tag)}
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${NOTION_TAG[tagTone(tag)]}`}
                  >
                    {tagLabel(tag)}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-xl font-semibold text-ink-primary tracking-tight leading-snug">
              {title}
            </h1>
            {meta && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[13px] leading-5 text-ink-secondary">
                {meta}
              </div>
            )}
          </div>
        </div>
        {(toolbar || primaryAction) && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 pt-0.5">
            {toolbar}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

const toolClass =
  "px-2.5 py-1 min-h-8 text-xs text-[#55534e] hover:text-[#2f3437] hover:bg-[#ebebea] border border-[#e3e2de] rounded-md transition-colors flex items-center gap-1.5 bg-white shadow-xs cursor-pointer";

export function ToolButton({
  icon,
  children,
  onClick,
  href,
}: {
  icon: string;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Icon name={icon} size="sm" className="text-[#787774]" />
      <span>{children}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={toolClass}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={toolClass}>
      {inner}
    </button>
  );
}

export function GhostButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 min-h-8 text-xs text-[#55534e] hover:text-[#2f3437] hover:bg-[#ebebea] border border-[#e3e2de] rounded-md transition-colors flex items-center gap-1.5 bg-white shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon ? <Icon name={icon} size="sm" className="text-[#787774]" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function PrimaryButton({
  icon,
  children,
  onClick,
  disabled,
  title,
}: {
  icon?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-3 py-1 min-h-8 text-xs font-medium bg-[#2f3437] text-white hover:bg-[#1a1c1b] rounded-md transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      <span>{children}</span>
    </button>
  );
}
