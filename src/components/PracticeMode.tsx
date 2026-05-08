import { useMemo, useState } from "react";
import { useProgressStore } from "../store/progressStore";
import {
  buildPracticeQueue,
  type PracticeItem,
  type PracticeMode as PMode,
} from "../lib/practiceQueue";
import MultipleChoiceMethod from "./methods/MultipleChoiceMethod";
import ClozeMethod from "./methods/ClozeMethod";
import FreeAnswerMethod from "./methods/FreeAnswerMethod";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";

const SESSION_SIZE = 10;

type Phase =
  | { kind: "select" }
  | { kind: "running"; queue: PracticeItem[]; index: number }
  | { kind: "results" };

export default function PracticeMode() {
  const progressMap = useProgressStore((s) => s.billets);
  const [mode, setMode] = useState<PMode>("all");
  const [phase, setPhase] = useState<Phase>({ kind: "select" });
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  const previewQueue = useMemo(
    () => buildPracticeQueue(progressMap, mode, SESSION_SIZE),
    [progressMap, mode],
  );

  const start = () => {
    const fresh = buildPracticeQueue(progressMap, mode, SESSION_SIZE);
    if (fresh.length === 0) return;
    setScore({ correct: 0, wrong: 0 });
    setPhase({ kind: "running", queue: fresh, index: 0 });
  };

  const handleResult = (knew: boolean) => {
    setScore((s) => ({
      correct: s.correct + (knew ? 1 : 0),
      wrong: s.wrong + (knew ? 0 : 1),
    }));
    setPhase((p) => {
      if (p.kind !== "running") return p;
      const next = p.index + 1;
      if (next >= p.queue.length) return { kind: "results" };
      return { ...p, index: next };
    });
  };

  const handleAbort = () => {
    setPhase((p) => {
      if (p.kind === "running" && (score.correct > 0 || score.wrong > 0)) {
        return { kind: "results" };
      }
      return { kind: "select" };
    });
  };

  // Стартовый экран
  if (phase.kind === "select") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateTo({ kind: "dashboard" })}
            className="text-sm text-slate-300 hover:text-slate-100"
          >
            ← Назад
          </button>
        </div>
        <h1 className="text-xl font-semibold">🎯 Тренировка</h1>
        <p className="text-sm text-slate-400">
          {SESSION_SIZE} случайных карточек из всех билетов. Метод подбирается
          автоматически по уровню освоения карточки.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setMode("all")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${
              mode === "all"
                ? "bg-slate-700"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <div className="font-medium">Все карточки</div>
            <div className="text-xs text-slate-400 mt-1">
              Из всех билетов, любой коробки.{" "}
              {previewQueue.length === 0
                ? "(нет карточек)"
                : `Будет ${previewQueue.length}.`}
            </div>
          </button>
          <button
            onClick={() => setMode("weak")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${
              mode === "weak"
                ? "bg-slate-700"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <div className="font-medium">Только слабые</div>
            <div className="text-xs text-slate-400 mt-1">
              Только из коробок 1-2 (то, что ещё не выучил).{" "}
              {previewQueue.length === 0
                ? "(всё выучено или ничего не учил — переключись на «Все карточки»)"
                : `Будет ${previewQueue.length}.`}
            </div>
          </button>
        </div>

        <button
          onClick={start}
          disabled={previewQueue.length === 0}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-4 text-lg font-medium"
        >
          Начать
        </button>
      </div>
    );
  }

  // Экран результатов
  if (phase.kind === "results") {
    const total = score.correct + score.wrong;
    const percent =
      total > 0 ? Math.round((score.correct / total) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Сессия завершена</h1>
        <div className="bg-slate-800 rounded-lg p-6 text-center space-y-2">
          <div className="text-5xl font-bold tabular-nums">{percent}%</div>
          <div className="text-sm text-slate-400">
            {score.correct} правильно из {total}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setScore({ correct: 0, wrong: 0 });
              setPhase({ kind: "select" });
            }}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Ещё раз
          </button>
          <button
            onClick={() => navigateTo({ kind: "dashboard" })}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg py-3 font-medium"
          >
            На дашборд
          </button>
        </div>
      </div>
    );
  }

  // Активная сессия
  const item = phase.queue[phase.index];
  if (!item) return null;
  const billet = getBilletById(item.billetId);
  if (!billet) return null;

  const allCardsOfBillet = [
    ...billet.theory_q1.cards,
    ...billet.theory_q2.cards,
  ];

  const progressBar = (
    <div className="fixed top-0 left-0 right-0 z-30 p-2 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={handleAbort}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ✕ Завершить
        </button>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${(phase.index / phase.queue.length) * 100}%`,
            }}
          />
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          {phase.index + 1}/{phase.queue.length}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pt-12">
      {progressBar}
      {item.method === "multiple_choice" && (
        <MultipleChoiceMethod
          billetId={item.billetId}
          card={item.card}
          allCards={allCardsOfBillet}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
      {item.method === "cloze" && (
        <ClozeMethod
          billetId={item.billetId}
          card={item.card}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
      {item.method === "free_answer" && (
        <FreeAnswerMethod
          billetId={item.billetId}
          card={item.card}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
    </div>
  );
}
