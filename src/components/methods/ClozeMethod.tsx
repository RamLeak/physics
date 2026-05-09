import { useMemo, useState } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { useErrorsStore } from "../../store/errorsStore";
import { buildCloze, checkBlank } from "../../lib/cloze";

interface Props {
  billetId: number;
  card: TheoryCard;
  onClose: () => void;
  onResult?: (knew: boolean) => void;
  skipLeitner?: boolean;
  skipErrors?: boolean;
}

export default function ClozeMethod({
  billetId,
  card,
  onClose,
  onResult,
  skipLeitner,
  skipErrors,
}: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const addError = useErrorsStore((s) => s.addError);
  const removeByCardId = useErrorsStore((s) => s.removeByCardId);
  const cloze = useMemo(() => buildCloze(card), [card]);
  const [answers, setAnswers] = useState<string[]>(() =>
    cloze.blanks.map(() => ""),
  );
  const [checked, setChecked] = useState(false);

  if (cloze.blanks.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Пропуск (нет ключевых терминов)
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-sm"
            >
              ✕
            </button>
          </div>
          <h2 className="text-lg font-semibold">{card.topic}</h2>
          <div className="text-sm text-slate-300 whitespace-pre-wrap">
            {card.content.replace(/\*\*/g, "")}
          </div>
          <div className="text-xs text-slate-500">
            Для этой карточки cloze-режим недоступен — попробуй другой метод.
          </div>
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 w-full"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  const allCorrect = cloze.blanks.every((b, i) =>
    checkBlank(answers[i], b.expected),
  );

  const finalize = (knew: boolean) => {
    if (!skipLeitner) {
      reviewCard(billetId, card.id, knew);
      if (knew) {
        removeByCardId(billetId, card.id);
      }
    }

    if (!knew && !skipErrors) {
      addError({
        billetId,
        cardId: card.id,
        problemId: null,
        what: card.topic,
      });
    }

    if (onResult) onResult(knew);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            Заполни пропуски
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold">{card.topic}</h2>
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {cloze.parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < cloze.blanks.length && (
                <input
                  type="text"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  disabled={checked}
                  className={`inline-block mx-1 px-2 py-0.5 rounded bg-slate-800 border-b-2 min-w-[120px] ${
                    checked
                      ? checkBlank(answers[i], cloze.blanks[i].expected)
                        ? "border-green-500 text-green-300"
                        : "border-red-500 text-red-300"
                      : "border-slate-600"
                  } focus:outline-none focus:border-slate-400`}
                />
              )}
            </span>
          ))}
        </div>

        {checked && !allCorrect && (
          <div className="text-xs text-slate-400 bg-slate-800 rounded p-2">
            Правильные ответы:{" "}
            {cloze.blanks.map((b) => b.expected).join(", ")}
          </div>
        )}

        {!checked ? (
          <button
            onClick={() => setChecked(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Проверить
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => finalize(false)}
              className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium"
            >
              Не знал
            </button>
            <button
              onClick={() => finalize(true)}
              className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
            >
              Знал
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
