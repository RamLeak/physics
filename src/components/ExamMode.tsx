import { useEffect, useRef, useState } from "react";
import { useProgressStore } from "../store/progressStore";
import { useStatsStore } from "../store/statsStore";
import { useErrorsStore } from "../store/errorsStore";
import { pickExamBillet } from "../lib/examPicker";
import { navigateTo } from "../lib/routing";
import type { Billet } from "../types/billets";
import BackButton from "./BackButton";

const EXAM_SECONDS = 120;

type Stage = "intro" | "active" | "review";

export default function ExamMode() {
  const progressMap = useProgressStore((s) => s.billets);
  const incrementExamPassed = useStatsStore((s) => s.incrementExamPassed);
  const incrementExamFailed = useStatsStore((s) => s.incrementExamFailed);
  const examPassed = useStatsStore((s) => s.examPassed);
  const examFailed = useStatsStore((s) => s.examFailed);
  const addError = useErrorsStore((s) => s.addError);

  const [stage, setStage] = useState<Stage>("intro");
  const [billet, setBillet] = useState<Billet | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const intervalRef = useRef<number | null>(null);

  const pickAndStart = () => {
    const picked = pickExamBillet(progressMap);
    if (!picked) return;
    setBillet(picked);
    setSecondsLeft(EXAM_SECONDS);
    setStage("active");
  };

  useEffect(() => {
    if (stage !== "active") return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setStage("review");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [stage]);

  const finishEarly = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setStage("review");
  };

  const recordResult = (passed: boolean) => {
    if (passed) {
      incrementExamPassed();
    } else {
      incrementExamFailed();
      if (billet) {
        addError({
          billetId: billet.id,
          cardId: null,
          problemId: null,
          what: `Экзамен: не сдал — ${billet.title}`,
        });
      }
    }
    setStage("intro");
    setBillet(null);
  };

  if (stage === "intro") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <BackButton onClick={() => navigateTo({ kind: "dashboard" })} />
        </div>

        <h1 className="text-xl font-semibold">🎓 Экзамен</h1>

        <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed space-y-2">
          <p>
            <strong>Правила:</strong>
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Случайный билет (приоритет — слабые, где &lt;60%).</li>
            <li>
              Таймер <strong>2 минуты</strong>. За это время ты должен{" "}
              <strong>устно</strong> рассказать ОБА теоретических вопроса.
            </li>
            <li>
              На экране — только номер билета и его название. Никаких подсказок.
            </li>
            <li>
              После таймера (или когда нажмёшь «Готов») — раскрывается чек-лист
              и решение задачи. Сверишь себя сам.
            </li>
            <li>Если провалил — экзамен запишется в журнал ошибок.</li>
          </ol>
        </div>

        {(examPassed > 0 || examFailed > 0) && (
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 flex justify-between">
            <div>
              Сдано:{" "}
              <span className="text-green-400 tabular-nums">{examPassed}</span>
            </div>
            <div>
              Провалено:{" "}
              <span className="text-red-400 tabular-nums">{examFailed}</span>
            </div>
          </div>
        )}

        <button
          onClick={pickAndStart}
          className="w-full bg-red-900 hover:bg-red-800 rounded-lg py-4 text-lg font-medium"
        >
          Начать экзамен
        </button>
      </div>
    );
  }

  if (stage === "active" && billet) {
    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${String(minutes).padStart(1, "0")}:${String(secs).padStart(2, "0")}`;
    const danger = secondsLeft <= 30;

    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6 min-h-screen flex flex-col">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (intervalRef.current) window.clearInterval(intervalRef.current);
              setStage("intro");
              setBillet(null);
            }}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ✕ Прервать
          </button>
          <div
            className={`text-3xl font-bold tabular-nums ${
              danger ? "text-red-400 animate-pulse" : "text-slate-100"
            }`}
          >
            {timeStr}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Билет
          </div>
          <div className="text-7xl font-bold tabular-nums text-slate-100">
            {String(billet.id).padStart(2, "0")}
          </div>
          <div className="text-xl text-slate-200 max-w-md leading-tight">
            {billet.title}
          </div>
          <div className="text-sm text-slate-500 pt-4 max-w-md">
            Рассказывай <strong>вслух</strong>. Не подглядывай. Когда
            закончишь — нажми «Готов».
          </div>
        </div>

        <button
          onClick={finishEarly}
          className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
        >
          Готов — раскрыть разбор
        </button>
      </div>
    );
  }

  if (stage === "review" && billet) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            🎓 Разбор экзамена
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-500">
            Билет {String(billet.id).padStart(2, "0")}
          </div>
          <div className="text-base font-semibold mt-0.5">{billet.title}</div>
        </div>

        <div className="space-y-2">
          <div className="text-sm uppercase tracking-wider text-slate-400">
            Чек-лист пересказа
          </div>
          <ul className="space-y-1.5">
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
        </div>

        <div className="space-y-2">
          <div className="text-sm uppercase tracking-wider text-slate-400">
            📐 Задача
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {billet.problem.condition}
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Ход решения:</div>
            <ol className="text-sm text-slate-200 space-y-1.5 list-decimal pl-5">
              {billet.problem.solution_steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="text-sm text-green-400 pt-2 font-medium">
              Ответ: {billet.problem.answer}
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-400 pt-2">
          Честно — сдал бы этот билет на реальном экзамене?
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => recordResult(false)}
            className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium"
          >
            Не сдал
          </button>
          <button
            onClick={() => recordResult(true)}
            className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
          >
            Сдал
          </button>
        </div>
      </div>
    );
  }

  return null;
}
