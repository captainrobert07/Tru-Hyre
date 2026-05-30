import { cn } from "@/lib/utils";

const PALETTE = [
  "from-emerald-400 to-emerald-700",
  "from-blue-400 to-blue-700",
  "from-amber-400 to-amber-700",
  "from-purple-400 to-purple-700",
  "from-rose-400 to-rose-700",
  "from-cyan-400 to-cyan-700",
  "from-orange-400 to-orange-700",
  "from-indigo-400 to-indigo-700",
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "?";
  const parts = cleaned.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE: Record<string, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-base",
};

export function Avatar({
  name,
  email,
  size = "md",
  className,
  title,
}: {
  name?: string | null;
  email?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  title?: string;
}) {
  const display = (name || email || "?").trim();
  const seed = email || name || "?";
  const tone = PALETTE[hashCode(seed) % PALETTE.length];
  return (
    <span
      title={title || display}
      className={cn(
        SIZE[size],
        "rounded-full inline-flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br shadow-card",
        tone,
        className,
      )}
      aria-hidden={!title}
    >
      {initials(display)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = "sm",
  className,
}: {
  people: Array<{ name?: string | null; email?: string | null }>;
  max?: number;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  if (people.length === 0) return null;
  const visible = people.slice(0, max);
  const overflow = people.length - max;
  return (
    <div className={cn("inline-flex -space-x-1.5", className)}>
      {visible.map((p, i) => (
        <Avatar key={i} name={p.name} email={p.email} size={size} className="ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            SIZE[size],
            "rounded-full inline-flex items-center justify-center font-medium text-ink-soft bg-canvas border border-hairline ring-2 ring-surface",
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
