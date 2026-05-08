import { useProgressStore } from "../store";
import { useErrorsStore } from "../store/errorsStore";
import { navigateTo } from "../lib/routing";
import ProgressBar from "./ProgressBar";

interface HeaderProps {
  overallPercent: number;
}

export default function Header({ overallPercent }: HeaderProps) {
  const errorsCount = useErrorsStore((s) => s.entries.length);

  const handleExport = () => {
    const json = useProgressStore.getState().exportProgress();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `physics-progress-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-slate-400 shrink-0">
          Physics Trainer
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs text-slate-300 shrink-0 tabular-nums">
            {overallPercent}%
          </span>
          <ProgressBar percent={overallPercent} height="sm" />
        </div>

        <button
          type="button"
          onClick={() => navigateTo({ kind: "practice" })}
          className="shrink-0 px-3 py-1.5 text-xs font-medium bg-green-900 hover:bg-green-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Тренировка как в ПДД — случайные карточки из всех билетов"
        >
          🎯<span className="hidden sm:inline ml-1">Тренировка</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo({ kind: "errors" })}
          className="relative shrink-0 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Журнал ошибок"
        >
          📓<span className="hidden sm:inline ml-1">Ошибки</span>
          {errorsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {errorsCount > 99 ? "99+" : errorsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="shrink-0 px-2 py-1.5 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Экспорт прогресса"
        >
          ⤓<span className="hidden sm:inline ml-1">Экспорт</span>
        </button>
      </div>
    </header>
  );
}
