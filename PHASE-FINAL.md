# Фаза 3.2 + 4.3 — Слепое решение задач + Экзамен-режим (ФИНАЛЬНАЯ)

## Контекст

Это **последняя фаза проекта**. После неё пользователь садится учиться, никаких новых фич не будет.

Что добавляем:
1. **Слепое решение задач** — улучшение `ProblemMode`: возможность вписать свой ход решения и сравнить с эталоном.
2. **🎓 Экзамен-режим** — отдельная страница: случайный слабый билет, таймер 2 минуты, минимум информации, в конце — чек-лист и решение задачи.

Не реализуем: PWA-кэш (уже работает), Groq (разрешено выкинуть), активный дубликат-детектор (статический уже есть).

---

## Что строим

### Файлы

```
src/
  components/
    ProblemMode.tsx           ← ОБНОВИТЬ: добавить переключатель "Слепо/Просмотр"
    ExamMode.tsx              ← НОВЫЙ: страница экзамена с таймером
    ExamResultPage.tsx        ← НОВЫЙ: разбор после экзамена (чек-лист + решение)
    Header.tsx                ← ОБНОВИТЬ: кнопка "🎓 Экзамен"
  router/
    AppRouter.tsx             ← ОБНОВИТЬ: маршрут #/exam
  lib/
    routing.ts                ← ОБНОВИТЬ: kind "exam"
    examPicker.ts             ← НОВЫЙ: выбор билета для экзамена (слабые → случайный)
  store/
    statsStore.ts             ← ОБНОВИТЬ: examPassed, examFailed
```

---

## ЧАСТЬ 1. Слепое решение задач

### Обнови `src/components/ProblemMode.tsx`

Добавь состояние режима — "blind" (слепое) или "preview" (просмотр). По умолчанию — blind. Пользователь сначала вписывает свой ход решения, потом раскрывает эталон.

```tsx
import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";
import { useErrorsStore } from "../store/errorsStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

type Stage = "writing" | "comparing";

export default function ProblemMode({ billet, onClose }: Props) {
  const markProblemSolved = useProgressStore((s) => s.markProblemSolved);
  const addError = useErrorsStore((s) => s.addError);
  const removeByProblemId = useErrorsStore((s) => s.removeByProblemId);
  const currentlySolved = useProgressStore(
    (s) => s.billets[billet.id]?.problemSolved ?? false,
  );

  const [stage, setStage] = useState<Stage>("writing");
  const [mySolution, setMySolution] = useState("");

  const finalize = (solved: boolean) => {
    markProblemSolved(billet.id, solved);
    if (solved) {
      removeByProblemId(billet.id, billet.problem.id);
    } else {
      addError({
        billetId: billet.id,
        cardId: null,
        problemId: billet.problem.id,
        what: billet.problem.title,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">
            📐 Задача
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ✕
          </button>
        </div>

        <h2 className="text-lg font-semibold">{billet.problem.title}</h2>

        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {billet.problem.condition}
        </div>

        {billet.problem.image && (
          <img
            src={`${import.meta.env.BASE_URL}${billet.problem.image.replace(/^\//, "")}`}
            alt="Схема задачи"
            className="rounded-lg border border-slate-700 max-w-full"
          />
        )}

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-2">Дано:</div>
          <ul className="text-sm text-slate-200 space-y-0.5">
            {billet.problem.given.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <div className="text-xs text-slate-400 mt-3 mb-1">Найти:</div>
          <div className="text-sm text-slate-200">{billet.problem.find}</div>
        </div>

        {/* СТАДИЯ 1 — пишем своё решение */}
        {stage === "writing" && (
          <>
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                Твой ход решения (формулы, шаги):
              </label>
              <textarea
                value={mySolution}
                onChange={(e) => setMySolution(e.target.value)}
                rows={8}
                className="w-full p-3 bg-slate-800 rounded-lg text-sm text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 font-mono"
                placeholder="Распиши решение по шагам — как делал бы на бумаге..."
              />
            </div>
            <button
              onClick={() => setStage("comparing")}
              className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
            >
              Сравнить с эталоном
            </button>
          </>
        )}

        {/* СТАДИЯ 2 — сверка с эталоном */}
        {stage === "comparing" && (
          <>
            {/* Твоё решение (read-only) */}
            {mySolution.trim() && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">Твой ход:</div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                  {mySolution}
                </div>
              </div>
            )}

            {/* Эталон */}
            <div className="bg-slate-800 rounded-lg p-3 space-y-2 border border-slate-700">
              <div className="text-xs text-green-400 uppercase tracking-wider">
                Эталон
              </div>
              <ol className="text-sm text-slate-200 space-y-1.5 list-decimal pl-5">
                {billet.problem.solution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="text-sm text-green-400 pt-2 font-medium">
                Ответ: {billet.problem.answer}
              </div>
            </div>

            <div className="text-sm text-slate-400">
              Сравни честно — твой ход совпал по логике с эталоном?
            </div>
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
                {currentlySolved ? "Снова решил" : "Решил правильно"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## ЧАСТЬ 2. Экзамен-режим

### `src/lib/examPicker.ts`

```typescript
import { getAllBillets } from "./billetsLoader";
import { calculateBilletProgress } from "./progressMath";
import type { BilletProgress } from "../types/progress";
import type { Billet } from "../types/billets";

// Выбирает билет для экзамена. Приоритет — слабые (прогресс < 60%).
// Если все билеты освоены ≥60% — берёт случайный из всех.
export function pickExamBillet(
  progressMap: Record<number, BilletProgress>,
): Billet | null {
  const billets = getAllBillets();
  if (billets.length === 0) return null;

  const weak = billets.filter((b) => calculateBilletProgress(b, progressMap[b.id]) < 60);
  const pool = weak.length > 0 ? weak : billets;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### `src/store/statsStore.ts` — расширить

Добавь два счётчика:

```typescript
interface StatsState {
  totalCardsReviewed: number;
  totalSessionsStarted: number;
  examPassed: number;
  examFailed: number;
  incrementCardsReviewed: () => void;
  incrementSessions: () => void;
  incrementExamPassed: () => void;
  incrementExamFailed: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalCardsReviewed: 0,
      totalSessionsStarted: 0,
      examPassed: 0,
      examFailed: 0,
      incrementCardsReviewed: () =>
        set((s) => ({ totalCardsReviewed: s.totalCardsReviewed + 1 })),
      incrementSessions: () =>
        set((s) => ({ totalSessionsStarted: s.totalSessionsStarted + 1 })),
      incrementExamPassed: () => set((s) => ({ examPassed: s.examPassed + 1 })),
      incrementExamFailed: () => set((s) => ({ examFailed: s.examFailed + 1 })),
    }),
    { name: "physics-stats-v1" }
  )
);
```

### `src/components/ExamMode.tsx`

Это страница экзамена. Три стадии:
1. **`intro`** — описание, кнопка "Начать"
2. **`active`** — таймер 2 минуты, ТОЛЬКО номер и название билета (рассказываешь устно)
3. **`review`** — раскрытый разбор: чек-лист пересказа + решение задачи. Самооценка "Сдал/Не сдал".

```tsx
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

  // Подбираем билет в начале
  const pickAndStart = () => {
    const picked = pickExamBillet(progressMap);
    if (!picked) return;
    setBillet(picked);
    setSecondsLeft(EXAM_SECONDS);
    setStage("active");
  };

  // Таймер
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
      // Если провалил — записать в журнал ошибок (по карточкам Q1+Q2 первой)
      // Чтобы не плодить — добавим только одну запись на билет
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

  // ===== СТАДИЯ INTRO =====
  if (stage === "intro") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <BackButton onClick={() => navigateTo({ kind: "dashboard" })} />
        </div>

        <h1 className="text-xl font-semibold">🎓 Экзамен</h1>

        <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed space-y-2">
          <p><strong>Правила:</strong></p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Случайный билет (приоритет — слабые, где &lt;60%).</li>
            <li>Таймер <strong>2 минуты</strong>. За это время ты должен <strong>устно</strong> рассказать ОБА теоретических вопроса.</li>
            <li>На экране — только номер билета и его название. Никаких подсказок.</li>
            <li>После таймера (или когда нажмёшь «Готов») — раскрывается чек-лист и решение задачи. Сверишь себя сам.</li>
            <li>Если провалил — экзамен запишется в журнал ошибок.</li>
          </ol>
        </div>

        {(examPassed > 0 || examFailed > 0) && (
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 flex justify-between">
            <div>Сдано: <span className="text-green-400 tabular-nums">{examPassed}</span></div>
            <div>Провалено: <span className="text-red-400 tabular-nums">{examFailed}</span></div>
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

  // ===== СТАДИЯ ACTIVE =====
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
            className={`text-3xl font-bold tabular-nums ${danger ? "text-red-400 animate-pulse" : "text-slate-100"}`}
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
            Рассказывай <strong>вслух</strong>. Не подглядывай. Когда закончишь — нажми «Готов».
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

  // ===== СТАДИЯ REVIEW =====
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
```

---

## ЧАСТЬ 3. Маршрутизация и кнопка

### `src/lib/routing.ts` — добавь exam

```typescript
export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number }
  | { kind: "practice" }
  | { kind: "errors" }
  | { kind: "exam" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
  if (hash === "#/errors") return { kind: "errors" };
  if (hash === "#/exam") return { kind: "exam" };
  const m = hash.match(/^#\/billet\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (!Number.isNaN(id)) return { kind: "billet", billetId: id };
  }
  return { kind: "dashboard" };
}

export function navigateTo(route: Route): void {
  if (route.kind === "dashboard") window.location.hash = "#/";
  else if (route.kind === "practice") window.location.hash = "#/practice";
  else if (route.kind === "errors") window.location.hash = "#/errors";
  else if (route.kind === "exam") window.location.hash = "#/exam";
  else window.location.hash = `#/billet/${route.billetId}`;
}
```

### `src/router/AppRouter.tsx`

```typescript
import ExamMode from "../components/ExamMode";

// в условиях:
if (route.kind === "exam") return <ExamMode />;
if (route.kind === "errors") return <ErrorJournalPage />;
if (route.kind === "practice") return <PracticeMode />;
if (route.kind === "billet") return <BilletPage billetId={route.billetId} />;
return <Dashboard />;
```

### `src/components/Header.tsx` — кнопка экзамена

Добавь между Тренировкой и Ошибками:

```tsx
<button
  onClick={() => navigateTo({ kind: "exam" })}
  className="text-sm bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded-lg font-medium transition-colors"
  title="Экзамен — таймер 2 минуты, без подсказок"
>
  <span className="hidden sm:inline">🎓 Экзамен</span>
  <span className="sm:hidden">🎓</span>
</button>
```

На узких экранах останется только эмодзи. Если шапка переполняется — Тренировку и Экзамен можешь сжать тоже до эмодзи на мобиле.

---

## Финальная проверка

1. `npm run build` чистый.
2. Открой задачу любого билета (например 1) → должно быть поле "Твой ход решения" сверху, эталон скрыт.
3. Введи что-нибудь в поле → "Сравнить с эталоном" → видишь свой ход и эталон рядом.
4. Кнопка "🎓 Экзамен" в шапке.
5. Нажми → intro с правилами → "Начать экзамен" → выбран случайный слабый билет, таймер 2:00.
6. Подожди или нажми "Готов" → раскрыт чек-лист пересказа + решение задачи.
7. Нажми "Не сдал" → в журнале ошибок появится запись "Экзамен: не сдал — ...".
8. Открой intro экзамена снова — счётчик "Сдано: 0 · Провалено: 1".

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

Создай `PHASE-FINAL-REPORT.md`. Шаблон:

```markdown
# Отчёт по финальной фазе (3.2 + 4.3)

## Что сделано

[список новых и изменённых файлов]

## Установленные зависимости

[ничего нового, скорее всего]

## Smoke-test

- `npm run build`: ✅ / ❌
- В ProblemMode сначала пишешь решение, потом раскрываешь эталон: ✅ / ❌
- "🎓 Экзамен" кнопка в шапке: ✅ / ❌
- /exam intro показывает правила и счётчик сдано/провалено: ✅ / ❌
- Таймер 2:00 идёт и показывает время: ✅ / ❌
- На последних 30 секундах таймер краснеет и пульсирует: ✅ / ❌
- Кнопка "Готов" обрывает таймер и переходит к разбору: ✅ / ❌
- В разборе — чек-лист пересказа + решение задачи + кнопки "Сдал/Не сдал": ✅ / ❌
- При "Не сдал" появляется запись в журнале ошибок: ✅ / ❌
- examPassed/examFailed увеличиваются и сохраняются в localStorage: ✅ / ❌
- Выбор слабых билетов работает (если все ≥60% — случайный из всех): ✅ / ❌

## Структура одного компонента (sanity check)

Распечатай `src/components/ExamMode.tsx` ПОЛНОСТЬЮ.

## Возникшие проблемы и как обошёл

## Что нужно сделать пользователю руками
```

После создания отчёта напиши:
**"Финальная фаза завершена. Проект готов. Иди учить."**

---

**Всё. Это последний промпт. Дальше — учёба.**
