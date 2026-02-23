export type WidgetHeaderSize = "sm" | "md" | "lg";

export const WIDGET_HEADER_PADDING: Record<WidgetHeaderSize, string> = {
  sm: "pb-1 pt-1.5 px-3",
  md: "pb-1.5 pt-2 px-3",
  lg: "pb-2 pt-2.5 px-3",
};

export const WIDGET_TITLE_TEXT: Record<WidgetHeaderSize, string> = {
  sm: "text-[11px]",
  md: "text-sm",
  lg: "text-sm md:text-base",
};

export const widgetTitleClass = (size: WidgetHeaderSize) =>
  `${WIDGET_TITLE_TEXT[size]} font-semibold tracking-[0.02em]`;
