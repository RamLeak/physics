import { useMemo, useState } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { useErrorsStore } from "../../store/errorsStore";

interface Props {
  billetId: number;
  card: TheoryCard;
  allCards: TheoryCard[];
  onClose: () => void;
  onResult?: (knew: boolean) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MultipleChoiceMethod({
  billetId,
  card,
  allCards,
  onClose,
  onResult,
}: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const addError = useErrorsStore((s) => s.addError);
  const removeByCardId = useErrorsStore((s) => s.removeByCardId);
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const others = allCards
      .filter((c) => c.id !== card.id)
      .map((c) => c.topic);
    const distractors = shuffle(others).slice(0, 3);
    return shuffle([card.topic, ...distractors]);
  }, [card, allCards]);

  const handle = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    if (knew) {
      removeByCardId(billetId, card.id);
    } else {
      addError({
        billetId,
        cardId: card.id,
        problemId: null,
        what: card.topic,
      });
    }
    if (onResult) {
      onResult(knew);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            Выбор правильного варианта
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="text-sm text-slate-400">
          К чему относится этот фрагмент?
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
          {card.content.replace(/\*\*/g, "")}
        </div>

        <div className="space-y-2 pt-2">
          {options.map((opt) => {
            const isCorrect = opt === card.topic;
            const isPicked = picked === opt;
            const showResult = picked !== null;
            const cls = !showResult
              ? "bg-slate-800 hover:bg-slate-700"
              : isCorrect
                ? "bg-green-900"
                : isPicked
                  ? "bg-red-900"
                  : "bg-slate-800 opacity-60";
            return (
              <button
                key={opt}
                onClick={() => !picked && setPicked(opt)}
                disabled={picked !== null}
                className={`w-full text-left rounded-lg p-3 text-sm transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="grid grid-cols-2 gap-2 pt-4">
            <button
              onClick={() => handle(false)}
              className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium"
            >
              Не знал
            </button>
            <button
              onClick={() => handle(true)}
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
