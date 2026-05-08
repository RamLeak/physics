import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";
import { useErrorsStore } from "../store/errorsStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

type Stage = "writing" | "comparing";

export default function ProblemMode({ billet, onClose }: Props) {
  const markProblemSolved = useProgressStore((s) => s.markProblemSolved);
  const addError = useErrorsStore((s) => s.addError);
  const removeByProblemId = useErrorsStore((s) => s.removeByProblemId);
  const currentlySolved = useProgressStore(
    (s) => s.billets[billet.id]?.problemSolved ?? false,
  );

  const [stage, setStage] = useState<Stage>("writing");
  const [mySolution, setMySolution] = useState("");

  const finalize = (solved: boolean) => {
    markProblemSolved(billet.id, solved);
    if (solved) {
      removeByProblemId(billet.id, billet.problem.id);
    } else {
      addError({
        billetId: billet.id,
        cardId: null,
        problemId: billet.problem.id,
        what: billet.problem.title,
      });
    }
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

        {stage === "writing" && (
          <>
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                Твой ход решения (формулы, шаги):
              </label>
              <textarea
                value={mySolution}
                onChange={(e) => setMySolution(e.target.value)}
                rows={8}
                className="w-full p-3 bg-slate-800 rounded-lg text-sm text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 font-mono"
                placeholder="Распиши решение по шагам — как делал бы на бумаге..."
              />
            </div>
            <button
              onClick={() => setStage("comparing")}
              className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
            >
              Сравнить с эталоном
            </button>
          </>
        )}

        {stage === "comparing" && (
          <>
            {mySolution.trim() && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">Твой ход:</div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                  {mySolution}
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-lg p-3 space-y-2 border border-slate-700">
              <div className="text-xs text-green-400 uppercase tracking-wider">
                Эталон
              </div>
              <ol className="text-sm text-slate-200 space-y-1.5 list-decimal pl-5">
                {billet.problem.solution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="text-sm text-green-400 pt-2 font-medium">
                Ответ: {billet.problem.answer}
              </div>
            </div>

            <div className="text-sm text-slate-400">
              Сравни честно — твой ход совпал по логике с эталоном?
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
