import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

export default function ConnectedRecallMode({ billet, onClose }: Props) {
  const markOralRecall = useProgressStore((s) => s.markOralRecall);
  const currentlyDone = useProgressStore(
    (s) => s.billets[billet.id]?.oralRecallDone ?? false,
  );

  const [stage, setStage] = useState<"hidden" | "revealed">("hidden");

  const finalize = (passed: boolean) => {
    markOralRecall(billet.id, passed);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            🎤 Связный пересказ
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold">
          Билет {billet.id}: {billet.title}
        </h2>

        {stage === "hidden" && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed">
              <p className="mb-2">
                <strong>Шаг 1.</strong> Расскажи билет вслух — голосом, как на
                экзамене. Не подглядывай.
              </p>
              <p className="mb-2">
                <strong>Шаг 2.</strong> Когда закончишь — нажми кнопку ниже,
                чтобы открыть чек-лист.
              </p>
              <p>
                <strong>Шаг 3.</strong> Сверь свой рассказ с чек-листом — что
                упустил, что сказал хорошо.
              </p>
            </div>
            <button
              onClick={() => setStage("revealed")}
              className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
            >
              Я закончил рассказывать — показать чек-лист
            </button>
          </div>
        )}

        {stage === "revealed" && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">
              Чек-лист — что должно было прозвучать:
            </div>
            <ul className="space-y-2">
              {billet.connected_recall.checklist.map((item, i) => (
                <li
                  key={i}
                  className="bg-slate-800 rounded-lg p-3 text-sm flex items-start gap-2"
                >
                  <span className="text-slate-500 mt-0.5">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="text-sm text-slate-400 pt-2">
              Как прошло? Без подсказок — это значит ты не подглядывал во время
              рассказа.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => finalize(false)}
                className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
              >
                Ещё не готов
              </button>
              <button
                onClick={() => finalize(true)}
                className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
              >
                {currentlyDone ? "Снова прошёл" : "Прошёл без подсказок"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
