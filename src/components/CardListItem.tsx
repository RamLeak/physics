import type { TheoryCard } from "../types/billets";
import { useProgressStore } from "../store/progressStore";
import { suggestMethod } from "../lib/leitner";

type Method = "read" | "mc" | "cloze" | "match" | "free";

interface Props {
  billetId: number;
  card: TheoryCard;
  onChooseMethod: (method: Method) => void;
}

export default function CardListItem({
  billetId,
  card,
  onChooseMethod,
}: Props) {
  const cardProgress = useProgressStore(
    (s) => s.billets[billetId]?.cards[card.id],
  );
  const box = cardProgress?.box ?? 1;

  const dotColor =
    box === 1
      ? "bg-red-500"
      : box === 2
        ? "bg-orange-500"
        : box === 3
          ? "bg-yellow-500"
          : box === 4
            ? "bg-lime-500"
            : "bg-green-500";

  const suggested = suggestMethod(box);
  const suggestedLabel =
    suggested === "read"
      ? "Чтение"
      : suggested === "multiple_choice"
        ? "Выбор"
        : suggested === "cloze"
          ? "Пропуск"
          : suggested === "match"
            ? "Сопоставить"
            : suggested === "free_answer"
              ? "Определение"
              : "Развёрнутый";

  return (
    <div
      id={`card-${card.id}`}
      className="bg-slate-800 rounded-lg p-3 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`}
          title={`Коробка ${box}`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-100">{card.topic}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Коробка {box}/5 · рекомендуется: {suggestedLabel}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        <button
          onClick={() => onChooseMethod("read")}
          className="bg-slate-700 hover:bg-slate-600 rounded text-xs py-1.5 transition-colors"
        >
          Чтение
        </button>
        <button
          onClick={() => onChooseMethod("mc")}
          className="bg-slate-700 hover:bg-slate-600 rounded text-xs py-1.5 transition-colors"
        >
          Выбор
        </button>
        <button
          onClick={() => onChooseMethod("cloze")}
          className="bg-slate-700 hover:bg-slate-600 rounded text-xs py-1.5 transition-colors"
        >
          Пропуск
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <button
          onClick={() => onChooseMethod("match")}
          className="bg-slate-700 hover:bg-slate-600 rounded text-xs py-1.5 transition-colors"
        >
          Сопоставить
        </button>
        <button
          onClick={() => onChooseMethod("free")}
          className="bg-slate-700 hover:bg-slate-600 rounded text-xs py-1.5 transition-colors"
        >
          Определение
        </button>
      </div>
    </div>
  );
}
