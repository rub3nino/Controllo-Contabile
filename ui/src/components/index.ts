/**
 * Componenti UI riutilizzabili — Atelier Document System
 */

// Core components
export { Icon } from "./Icon";
export { StatusBadge, mapStatusToVariant } from "./StatusBadge";
export { Card, CardHeader, Callout } from "./Card";
export { DataTable } from "./DataTable";
export { Sidebar, useSidebarWidth, type SectionId } from "./Sidebar";
export { PlaceholderSection } from "./PlaceholderSection";

// Feedback & Notifications
export { ToastProvider, useToast, type ToastVariant } from "./Toast";

// Loading states
export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonList, SkeletonStats } from "./Skeleton";

// Empty states
export { EmptyState, EmptyDocuments, EmptyClients, EmptySearch, EmptyError } from "./EmptyState";

// Command palette & shortcuts
export { CommandPaletteProvider, useCommandPalette, type Command } from "./CommandPalette";
export { ShortcutsModal } from "./ShortcutsModal";

// User & Avatar
export { Avatar, AvatarMenu } from "./Avatar";

// Connection status
export { ConnectionStatus, ConnectionBanner } from "./ConnectionStatus";

// Theme
export { ThemeToggle, ThemeSelector } from "./ThemeToggle";

// Onboarding
export { OnboardingProvider, OnboardingTooltips, WelcomeModal, useOnboarding } from "./Onboarding";

// Breadcrumb
export { Breadcrumb, SimpleBreadcrumb, type BreadcrumbItem } from "./Breadcrumb";

// Sortable Table
export { SortableTable, type SortableColumn } from "./SortableTable";
