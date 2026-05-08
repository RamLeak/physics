import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

export default function ProblemMode({ billet, onClose }: Props) {
  const markProblemSolved = useProgressStore((s) => s.markProblemSolved);
  const currentlySolved = useProgressStore(
    (s) => s.billets[billet.id]?.problemSolved ?? false,
  );

  const [showSolution, setShowSolution] = useState(false);

  const finalize = (solved: boolean) => {
    markProblemSolved(billet.id, solved);
    onClose();
  };

  const imageSrc = billet.problem.image
    ? `${import.meta.env.BASE_URL}${billet.problem.image.replace(/^\//, "")}`
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            📐 Задача
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold">{billet.problem.title}</h2>

        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {billet.problem.condition}
        </div>

        {imageSrc && (
          <img
            src={imageSrc}
            alt="Схема задачи"
            className="rounded-lg border border-slate-700 max-w-full"
          />
        )}

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-2">Дано:</div>
          <ul className="text-sm text-slate-200 space-y-0.5">
            {billet.problem.given.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <div className="text-xs text-slate-400 mt-3 mb-1">Найти:</div>
          <div className="text-sm text-slate-200">{billet.problem.find}</div>
        </div>

        {!showSolution ? (
          <button
            onClick={() => setShowSolution(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Я решил — показать ход решения
          </button>
        ) : (
          <>
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="text-xs text-slate-400">Ход решения:</div>
              <ol className="text-sm text-slate-200 space-y-1.5 list-decimal pl-5">
                {billet.problem.solution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="text-sm text-green-400 pt-2 font-medium">
                Ответ: {billet.problem.answer}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => finalize(false)}
                className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium"
              >
                Не справился
              </button>
              <button
                onClick={() => finalize(true)}
                className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
              >
                {currentlySolved ? "Снова решил" : "Решил правильно"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
