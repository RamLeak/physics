import { useEffect, useState } from "react";
import { getBilletById } from "../lib/billetsLoader";
import { useProgressStore } from "../store/progressStore";
import { navigateTo } from "../lib/routing";
import {
  calculateBilletProgress,
  calculateTheoryProgress,
} from "../lib/progressMath";
import BackButton from "./BackButton";
import ProgressBar from "./ProgressBar";
import CardListItem from "./CardListItem";
import ReadMethod from "./methods/ReadMethod";
import MultipleChoiceMethod from "./methods/MultipleChoiceMethod";
import ClozeMethod from "./methods/ClozeMethod";
import ConnectedRecallMode from "./ConnectedRecallMode";
import ProblemMode from "./ProblemMode";
import type { TheoryCard } from "../types/billets";

interface Props {
  billetId: number;
}

type Method = "read" | "mc" | "cloze";

type ActiveMode =
  | { kind: "none" }
  | { kind: "method"; cardId: string; method: Method }
  | { kind: "recall" }
  | { kind: "problem" };

export default function BilletPage({ billetId }: Props) {
  const billet = getBilletById(billetId);
  const progress = useProgressStore((s) => s.billets[billetId]);
  const [active, setActive] = useState<ActiveMode>({ kind: "none" });

  useEffect(() => {
    if (!billet) navigateTo({ kind: "dashboard" });
  }, [billet]);

  if (!billet) return null;

  const overallPercent = calculateBilletProgress(billet, progress);
  const theoryPercent = calculateTheoryProgress(billet, progress);
  const recallDone = progress?.oralRecallDone ?? false;
  const problemSolved = progress?.problemSolved ?? false;

  const allCards: TheoryCard[] = [
    ...billet.theory_q1.cards,
    ...billet.theory_q2.cards,
  ];

  const close = () => setActive({ kind: "none" });

  if (active.kind === "method") {
    const found = allCards.find((c) => c.id === active.cardId);
    if (!found) return null;
    if (active.method === "read") {
      return <ReadMethod billetId={billetId} card={found} onClose={close} />;
    }
    if (active.method === "mc") {
      return (
        <MultipleChoiceMethod
          billetId={billetId}
          card={found}
          allCards={allCards}
          onClose={close}
        />
      );
    }
    return <ClozeMethod billetId={billetId} card={found} onClose={close} />;
  }

  if (active.kind === "recall") {
    return <ConnectedRecallMode billet={billet} onClose={close} />;
  }

  if (active.kind === "problem") {
    return <ProblemMode billet={billet} onClose={close} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigateTo({ kind: "dashboard" })} />
        <div className="text-sm text-slate-400 tabular-nums">
          {overallPercent}%
        </div>
      </div>

      <header className="space-y-2">
        <div className="text-xs text-slate-500 tabular-nums">
          Билет {String(billet.id).padStart(2, "0")}
        </div>
        <h1 className="text-xl font-semibold leading-tight">{billet.title}</h1>
        <ProgressBar percent={overallPercent} height="md" showLabel={false} />

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
          <div>
            Теория:{" "}
            <span className="text-slate-200">{theoryPercent}%</span>
          </div>
          <div>
            Пересказ:{" "}
            <span
              className={
                recallDone ? "text-green-400" : "text-slate-200"
              }
            >
              {recallDone ? "✓" : "—"}
            </span>
          </div>
          <div>
            Задача:{" "}
            <span
              className={
                problemSolved ? "text-green-400" : "text-slate-200"
              }
            >
              {problemSolved ? "✓" : "—"}
            </span>
          </div>
        </div>
      </header>

      {billet.theory_duplicates.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <div className="text-slate-400 mb-1">
            🔗 Связано с другими билетами:
          </div>
          <ul className="space-y-1">
            {billet.theory_duplicates.map((d, i) => (
              <li key={i}>
                Билет {d.billet_id} (
                {d.question === "q1" ? "Вопрос 1" : "Вопрос 2"}) — {d.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActive({ kind: "recall" })}
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 text-left transition-colors"
        >
          <div className="text-sm font-medium">🎤 Связный пересказ</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {recallDone ? "Пройден" : "Не пройден"}
          </div>
        </button>
        <button
          onClick={() => setActive({ kind: "problem" })}
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 text-left transition-colors"
        >
          <div className="text-sm font-medium">📐 Задача</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {problemSolved ? "Решена" : "Не решена"}
          </div>
        </button>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-2 mt-4">
          Теория · Вопрос 1
        </h2>
        <div className="text-xs text-slate-500 mb-2">
          {billet.theory_q1.title}
        </div>
        <div className="space-y-2">
          {billet.theory_q1.cards.map((card) => (
            <CardListItem
              key={card.id}
              billetId={billetId}
              card={card}
              onChooseMethod={(method) =>
                setActive({ kind: "method", cardId: card.id, method })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-2 mt-4">
          Теория · Вопрос 2
        </h2>
        <div className="text-xs text-slate-500 mb-2">
          {billet.theory_q2.title}
        </div>
        <div className="space-y-2">
          {billet.theory_q2.cards.map((card) => (
            <CardListItem
              key={card.id}
              billetId={billetId}
              card={card}
              onChooseMethod={(method) =>
                setActive({ kind: "method", cardId: card.id, method })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
