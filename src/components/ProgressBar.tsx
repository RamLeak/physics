import { progressColor } from "../lib/progressMath";

type Height = "sm" | "md" | "lg";

interface ProgressBarProps {
  percent: number;
  colorClass?: string;
  height?: Height;
  showLabel?: boolean;
}

const HEIGHT_CLASS: Record<Height, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export default function ProgressBar({
  percent,
  colorClass,
  height = "md",
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = colorClass ?? progressColor(clamped);
  const trackHeight = HEIGHT_CLASS[height];

  return (
    <div className="flex items-center gap-2 w-full">
      <div
        className={`flex-1 ${trackHeight} bg-slate-700 rounded-full overflow-hidden`}
      >
        <div
          className={`${trackHeight} ${color} rounded-full transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-300 tabular-nums w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
