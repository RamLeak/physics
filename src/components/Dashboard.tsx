import { useMemo } from "react";
import { getAllBillets } from "../lib/billetsLoader";
import { calculateOverallProgress } from "../lib/progressMath";
import { navigateTo } from "../lib/routing";
import { useProgressStore } from "../store";
import BilletTile from "./BilletTile";
import Header from "./Header";

export default function Dashboard() {
  const billets = useMemo(() => getAllBillets(), []);
  const progressMap = useProgressStore((s) => s.billets);

  const overall = calculateOverallProgress(billets, progressMap);

  const handleTileClick = (billetId: number) => {
    navigateTo({ kind: "billet", billetId });
  };

  return (
    <>
      <Header overallPercent={overall} />

      <main className="max-w-4xl mx-auto p-4">
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
