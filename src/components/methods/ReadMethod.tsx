import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { renderMarkdownLite } from "../../lib/markdownLite";

interface Props {
  billetId: number;
  card: TheoryCard;
  onClose: () => void;
}

export default function ReadMethod({ billetId, card, onClose }: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);

  const handle = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            Чтение
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold">{card.topic}</h2>
        <div
          className="text-slate-200 leading-relaxed text-sm space-y-3"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownLite(card.content),
          }}
        />
        {card.key_terms.length > 0 && (
          <div className="text-xs text-slate-500 pt-2">
            Ключевые термины: {card.key_terms.join(", ")}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-4">
          <button
            onClick={() => handle(false)}
            className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium transition-colors"
          >
            Не знаю
          </button>
          <button
            onClick={() => handle(true)}
            className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium transition-colors"
          >
            Знаю
          </button>
        </div>
      </div>
    </div>
  );
}
