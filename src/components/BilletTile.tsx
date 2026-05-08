import type { Billet } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import {
  calculateBilletProgress,
  isBilletLearned,
} from "../lib/progressMath";
import ProgressBar from "./ProgressBar";

interface BilletTileProps {
  billet: Billet;
  progress: BilletProgress | undefined;
  onClick: (billetId: number) => void;
}

export default function BilletTile({
  billet,
  progress,
  onClick,
}: BilletTileProps) {
  const percent = calculateBilletProgress(billet, progress);
  const learned = isBilletLearned(billet, progress);
  const dupCount = billet.theory_duplicates.length;
  const numLabel = String(billet.id).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={() => onClick(billet.id)}
      className="relative flex flex-col gap-2 min-h-[96px] p-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 rounded-xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-slate-400">
        {dupCount > 0 && (
          <span title={`Дубликатов: ${dupCount}`} className="tabular-nums">
            🔗 {dupCount}
          </span>
        )}
        {learned && (
          <span
            className="text-green-400 text-base leading-none"
            title="Билет выучен"
          >
            ✓
          </span>
        )}
      </div>

      <div className="text-2xl font-semibold text-slate-100 tabular-nums leading-none">
        {numLabel}
      </div>
      <div className="text-xs text-slate-300 line-clamp-2 leading-snug pr-6">
        {billet.title}
      </div>

      <div className="mt-auto flex items-center gap-2">
        <ProgressBar percent={percent} height="sm" />
        <span className="text-xs text-slate-300 tabular-nums w-9 text-right">
          {percent}%
        </span>
      </div>
    </button>
  );
}
