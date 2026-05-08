import { useMemo } from "react";
import { getAllBillets } from "../lib/billetsLoader";
import { calculateOverallProgress } from "../lib/progressMath";
import { navigateTo } from "../lib/routing";
import { useProgressStore } from "../store";
import { useErrorsStore } from "../store/errorsStore";
import {
  shouldShowArchiveReminder,
  daysUntilExam,
} from "../lib/examDate";
import BilletTile from "./BilletTile";
import Header from "./Header";

export default function Dashboard() {
  const billets = useMemo(() => getAllBillets(), []);
  const progressMap = useProgressStore((s) => s.billets);
  const archivedCount = useErrorsStore((s) => s.archived.length);

  const overall = calculateOverallProgress(billets, progressMap);
  const showReminder = shouldShowArchiveReminder(archivedCount);
  const days = daysUntilExam();

  const handleTileClick = (billetId: number) => {
    navigateTo({ kind: "billet", billetId });
  };

  return (
    <>
      <Header overallPercent={overall} />

      <main className="max-w-4xl mx-auto p-4">
        {showReminder && (
          <div className="bg-orange-900 border border-orange-700 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔔</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-orange-100">
                  {days === 0 ? "Сегодня экзамен!" : "Завтра экзамен"}
                </div>
                <div className="text-xs text-orange-200 mt-1">
                  У тебя {archivedCount} переученных карточек в архиве. Самое
                  время освежить — это ровно те темы, на которых ты раньше
                  ошибался.
                </div>
                <button
                  onClick={() => navigateTo({ kind: "errors" })}
                  className="mt-2 text-xs bg-orange-700 hover:bg-orange-600 px-3 py-1.5 rounded font-medium transition-colors"
                >
                  Открыть архив →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {billets.map((billet) => (
            <BilletTile
              key={billet.id}
              billet={billet}
              progress={progressMap[billet.id]}
              onClick={handleTileClick}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Тапни билет, чтобы начать
        </p>
      </main>
    </>
  );
}
