import { useMemo, useState } from "react";
import type { Billet, TheoryCard } from "../types/billets";
import { navigateTo } from "../lib/routing";

import ClozeMethod from "./methods/ClozeMethod";
import MatchMethod from "./methods/MatchMethod";
import FreeAnswerMethod from "./methods/FreeAnswerMethod";

type Method = "cloze" | "match" | "free";

interface TestItem {
  card: TheoryCard;
  method: Method;
}

interface Result {
  cardId: string;
  topic: string;
  knew: boolean;
}

interface Props {
  billet: Billet;
  onClose: () => void;
}

const METHODS: Method[] = ["cloze", "match", "free"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BilletTestMode({ billet, onClose }: Props) {
  const allCards = useMemo(
    () => [...billet.theory_q1.cards, ...billet.theory_q2.cards],
    [billet],
  );

  const queue = useMemo<TestItem[]>(() => {
    return shuffle(allCards).map((card) => ({
      card,
      method: METHODS[Math.floor(Math.random() * METHODS.length)],
    }));
  }, [allCards]);

  const [stage, setStage] = useState<"intro" | "running" | "results">("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const start = () => {
    setStage("running");
    setIndex(0);
    setResults([]);
  };

  const handleResult = (knew: boolean) => {
    const item = queue[index];
    setResults((prev) => [
      ...prev,
      { cardId: item.card.id, topic: item.card.topic, knew },
    ]);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      setStage("results");
    }
  };

  const abort = () => {
    if (results.length > 0) {
      setStage("results");
    } else {
      onClose();
    }
  };

  if (stage === "intro") {
    return (
      <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              📝 Тест по билету
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

          <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed space-y-2">
            <p>
              <strong>Что будет:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{queue.length} карточек по этому билету</li>
              <li>
                Случайный активный метод на каждой:{" "}
                <strong>Пропуск</strong>, <strong>Сопоставить</strong>,{" "}
                <strong>Определение</strong>
              </li>
              <li>
                Прогресс-коробки <strong>не меняются</strong> — это чистая
                проверка
              </li>
              <li>
                Ошибки <strong>записываются в журнал</strong> для последующей
                работы
              </li>
              <li>В конце — список карточек, на которых ошибся, с переходом к ним</li>
            </ul>
          </div>

          <button
            onClick={start}
            className="w-full bg-blue-900 hover:bg-blue-800 rounded-lg py-4 text-lg font-medium"
          >
            Начать тест
          </button>
        </div>
      </div>
    );
  }

  if (stage === "running") {
    const item = queue[index];
    const total = queue.length;

    const headerBar = (
      <div className="fixed top-0 left-0 right-0 z-30 p-2 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={abort}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ✕ Завершить
          </button>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 tabular-nums">
            {index + 1}/{total}
          </div>
        </div>
      </div>
    );

    const commonProps = {
      billetId: billet.id,
      card: item.card,
      onClose: () => {},
      onResult: handleResult,
      skipLeitner: true,
      skipErrors: false,
    };

    return (
      <div className="pt-12">
        {headerBar}
        {item.method === "cloze" && <ClozeMethod {...commonProps} />}
        {item.method === "match" && (
          <MatchMethod {...commonProps} allCards={allCards} />
        )}
        {item.method === "free" && <FreeAnswerMethod {...commonProps} />}
      </div>
    );
  }

  const correct = results.filter((r) => r.knew).length;
  const wrong = results.filter((r) => !r.knew);
  const percent =
    results.length > 0 ? Math.round((correct / results.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            📝 Результаты теста
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 text-center space-y-2">
          <div className="text-5xl font-bold tabular-nums">{percent}%</div>
          <div className="text-sm text-slate-400">
            {correct} правильно из {results.length}
          </div>
        </div>

        {wrong.length === 0 ? (
          <div className="bg-green-900 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">🎉</div>
            <div className="text-sm">Все карточки верно — билет ты знаешь.</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-slate-400">
              Ошибся на этих карточках — открой и переучи:
            </div>
            <div className="space-y-2">
              {wrong.map((r) => (
                <button
                  key={r.cardId}
                  onClick={() =>
                    navigateTo({
                      kind: "billet",
                      billetId: billet.id,
                      focusCardId: r.cardId,
                    })
                  }
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-lg p-3 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 font-medium">
                      {r.topic}
                    </div>
                    <div className="text-xs text-slate-500">ID {r.cardId}</div>
                  </div>
                  <div className="text-blue-400 text-sm shrink-0">
                    → Открыть
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => {
              setResults([]);
              setIndex(0);
              setStage("intro");
            }}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Ещё раз
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg py-3 font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
