import { Tooltip } from "@/components/tooltip";

const UNITS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.34524, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelative(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (Math.abs(seconds) < 30) return "just now";

  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [step, u] of UNITS) {
    if (Math.abs(value) < step) {
      unit = u;
      break;
    }
    value /= step;
    unit = u;
  }
  // RelativeTimeFormat takes negative values for past
  return rtf.format(-Math.round(value), unit);
}

function formatAbsolute(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Server-rendered relative time — "2 hours ago" / "yesterday" / "3 weeks ago".
 * Hover shows the full absolute timestamp. Drop-in replacement for
 * `{new Date(x).toLocaleString()}` everywhere.
 */
export function TimeAgo({
  date,
  className,
}: {
  date: Date | string | number | null | undefined;
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  const relative = formatRelative(date);
  const absolute = formatAbsolute(date);
  return (
    <Tooltip text={absolute} className={className}>
      <span className="cursor-default">{relative}</span>
    </Tooltip>
  );
}
