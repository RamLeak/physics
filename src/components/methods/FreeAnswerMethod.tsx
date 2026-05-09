import { useState, useMemo } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { useErrorsStore } from "../../store/errorsStore";
import { matchKeyTerms } from "../../lib/similarity";
import { renderMarkdownLite } from "../../lib/markdownLite";

interface Props {
  billetId: number;
  card: TheoryCard;
  onClose: () => void;
  onResult?: (knew: boolean) => void;
  skipLeitner?: boolean;
  skipErrors?: boolean;
}

export default function FreeAnswerMethod({
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
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  const match = useMemo(
    () => matchKeyTerms(answer, card.key_terms),
    [answer, card.key_terms],
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
            Дай определение
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Тема
          </div>
          <div className="text-lg font-semibold">{card.topic}</div>
        </div>

        <div>
          <label className="text-sm text-slate-400 block mb-2">
            Расскажи своими словами (или мысленно — главное проверить себя):
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed}
            rows={6}
            className="w-full p-3 bg-slate-800 rounded-lg text-sm text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-70"
            placeholder="Начни писать..."
          />

          {!revealed &&
            card.key_terms.length > 0 &&
            answer.trim().length > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                Упомянуто терминов: {match.found.length} из{" "}
                {card.key_terms.length}
              </div>
            )}
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Показать эталон
          </button>
        ) : (
          <>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">
                Эталон
              </div>
              <div
                className="text-sm text-slate-200 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownLite(card.content),
                }}
              />
            </div>

            {card.key_terms.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs">
                <div className="text-slate-400 mb-2">Ключевые термины:</div>
                <div className="space-y-1">
                  {card.key_terms.map((term) => {
                    const isFound = match.found.includes(term);
                    return (
                      <div
                        key={term}
                        className={isFound ? "text-green-400" : "text-red-400"}
                      >
                        {isFound ? "✓" : "✗"} {term}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-sm text-slate-400">Оцени себя честно:</div>
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
                Сказал правильно
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
