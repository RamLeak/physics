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

interface Pair {
  topicId: string;
  contentId: string;
  correct: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchMethod({
  billetId,
  card,
  allCards,
  onClose,
  onResult,
}: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const addError = useErrorsStore((s) => s.addError);
  const removeByCardId = useErrorsStore((s) => s.removeByCardId);

  const cards = useMemo(() => {
    const others = allCards.filter((c) => c.id !== card.id);
    const picked = shuffle(others).slice(0, Math.min(4, others.length));
    return shuffle([card, ...picked]);
  }, [card, allCards]);

  const topics = useMemo(
    () => cards.map((c) => ({ id: c.id, text: c.topic })),
    [cards],
  );
  const contents = useMemo(
    () =>
      shuffle(
        cards.map((c) => ({ id: c.id, text: c.content.replace(/\*\*/g, "") })),
      ),
    [cards],
  );

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [done, setDone] = useState(false);

  const isPaired = (id: string) =>
    pairs.some((p) => p.topicId === id || p.contentId === id);

  const handleTopicClick = (topicId: string) => {
    if (isPaired(topicId)) return;
    setSelectedTopic(selectedTopic === topicId ? null : topicId);
  };

  const handleContentClick = (contentId: string) => {
    if (isPaired(contentId)) return;
    if (!selectedTopic) return;
    const correct = selectedTopic === contentId;
    const next = [...pairs, { topicId: selectedTopic, contentId, correct }];
    setPairs(next);
    setSelectedTopic(null);
    if (next.length === topics.length) {
      setDone(true);
    }
  };

  const targetPair = pairs.find((p) => p.topicId === card.id);
  const wasCorrectForTarget = targetPair?.correct ?? false;

  const finalize = (knew: boolean) => {
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

  const colorForTopic = (topicId: string): string => {
    const pair = pairs.find((p) => p.topicId === topicId);
    if (pair) return pair.correct ? "bg-green-900" : "bg-red-900";
    if (topicId === selectedTopic) return "bg-blue-900";
    return "bg-slate-800";
  };

  const colorForContent = (contentId: string): string => {
    const pair = pairs.find((p) => p.contentId === contentId);
    if (pair) return pair.correct ? "bg-green-900" : "bg-red-900";
    return "bg-slate-800";
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            Сопоставь топик с описанием
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="text-sm text-slate-400">
          Жми сначала топик слева, потом подходящий текст справа.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Топики
            </div>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTopicClick(t.id)}
                disabled={isPaired(t.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors disabled:opacity-60 ${colorForTopic(t.id)} ${
                  isPaired(t.id) ? "" : "hover:bg-slate-700"
                }`}
              >
                {t.text}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Описания
            </div>
            {contents.map((c) => (
              <button
                key={c.id}
                onClick={() => handleContentClick(c.id)}
                disabled={isPaired(c.id) || !selectedTopic}
                className={`w-full text-left p-3 rounded-lg text-xs whitespace-pre-wrap transition-colors disabled:opacity-60 ${colorForContent(c.id)} ${
                  isPaired(c.id) || !selectedTopic ? "" : "hover:bg-slate-700"
                }`}
              >
                {c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text}
              </button>
            ))}
          </div>
        </div>

        {done && (
          <div className="space-y-3 pt-2">
            <div className="text-sm text-slate-300">
              {wasCorrectForTarget
                ? "Целевая карточка сопоставлена правильно ✅"
                : "Целевую карточку не угадал ❌"}
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
