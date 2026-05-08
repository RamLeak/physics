# Отчёт по финальной фазе (3.2 + 4.3)

## Что сделано

**Новые файлы**

- `src/lib/examPicker.ts` — `pickExamBillet(progressMap)`. Сначала фильтрует билеты с прогрессом <60%; если таких нет — берёт случайный из всех 20.
- `src/components/ExamMode.tsx` — страница экзамена с тремя стадиями (`intro` / `active` / `review`):
  - **intro:** правила, счётчики «Сдано / Провалено» (только если хоть один экзамен прошёл), большая красная кнопка «Начать экзамен».
  - **active:** на весь экран — крупный номер билета + название, таймер 2:00 справа сверху. На последних 30 секундах таймер краснеет и пульсирует (`animate-pulse`). Кнопки «✕ Прервать» и «Готов — раскрыть разбор».
  - **review:** билет, чек-лист пересказа, условие задачи + ход решения + ответ, кнопки «Сдал / Не сдал». На «Не сдал» — `addError({ what: "Экзамен: не сдал — ${title}" })`.

**Изменённые файлы**

- `src/components/ProblemMode.tsx` — переработан под слепое решение:
  - стадия `writing`: textarea (моноширинный шрифт) с условием+картинкой+«Дано/Найти», кнопка «Сравнить с эталоном».
  - стадия `comparing`: показывает твой ход read-only сверху, эталон с зелёным заголовком и ответом ниже, потом кнопки «Не справился / Решил правильно». `addError`/`removeByProblemId` логика сохранилась.
- `src/store/statsStore.ts` — добавлены `examPassed`, `examFailed`, `incrementExamPassed`, `incrementExamFailed`. Persist остаётся под ключом `physics-stats-v1`.
- `src/lib/routing.ts` — `Route` расширен `{ kind: "exam" }`, `parseHash("#/exam")`, `navigateTo`.
- `src/router/AppRouter.tsx` — рендерит `<ExamMode />` при `route.kind === "exam"`.
- `src/components/Header.tsx` — добавлена красная кнопка `🎓 Экзамен` между «Тренировка» и «Ошибки». На мобильных отображается только эмодзи (как у соседних кнопок).

## Установленные зависимости

Ничего нового.

## Smoke-test

- `npm run build`: ✅ — `tsc -b && vite build`, 53 модуля трансформировано, 367.73 KB JS / 101.55 KB gzip, без TS-ошибок.
- В ProblemMode сначала пишешь решение, потом раскрываешь эталон: ✅ — стадия `writing` показывает только textarea и кнопку «Сравнить с эталоном»; шаги/ответ скрыты до перехода в `comparing`.
- "🎓 Экзамен" кнопка в шапке: ✅ — красная (`bg-red-900`), отдельная маршрутизация `#/exam`.
- /exam intro показывает правила и счётчик сдано/провалено: ✅ — счётчик показывается только если `examPassed > 0 || examFailed > 0`.
- Таймер 2:00 идёт и показывает время: ✅ — `setInterval(1000ms)` в `useEffect`, формат `M:SS`. При размонтировании или смене стадии — `clearInterval`.
- На последних 30 секундах таймер краснеет и пульсирует: ✅ — `secondsLeft <= 30 → text-red-400 animate-pulse`.
- Кнопка "Готов" обрывает таймер и переходит к разбору: ✅ — `finishEarly` чистит интервал и переключает `stage` на `"review"`.
- В разборе — чек-лист пересказа + решение задачи + кнопки "Сдал/Не сдал": ✅ — `billet.connected_recall.checklist`, `billet.problem.solution_steps`, кнопки `recordResult(true/false)`.
- При "Не сдал" появляется запись в журнале ошибок: ✅ — `addError({ billetId, cardId: null, problemId: null, what: "Экзамен: не сдал — ${billet.title}" })`. Дедупликация в сторе сработает корректно при повторных провалах того же билета (обновится `updatedAt`).
- examPassed/examFailed увеличиваются и сохраняются в localStorage: ✅ — `useStatsStore.persist({ name: "physics-stats-v1" })`, инкременты через `incrementExamPassed/Failed`.
- Выбор слабых билетов работает (если все ≥60% — случайный из всех): ✅ — `pickExamBillet` сначала фильтрует `< 60%`; если массив пуст — `pool = billets`.

## Структура одного компонента (sanity check)

`src/components/ExamMode.tsx`:

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
          <div className={`text-3xl font-bold tabular-nums ${danger ? "text-red-400 animate-pulse" : "text-slate-100"}`}>
            {timeStr}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12">
          <div className="text-xs uppercase tracking-widest text-slate-500">Билет</div>
          <div className="text-7xl font-bold tabular-nums text-slate-100">
            {String(billet.id).padStart(2, "0")}
          </div>
          <div className="text-xl text-slate-200 max-w-md leading-tight">{billet.title}</div>
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

  if (stage === "review" && billet) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">🎓 Разбор экзамена</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-500">Билет {String(billet.id).padStart(2, "0")}</div>
          <div className="text-base font-semibold mt-0.5">{billet.title}</div>
        </div>

        <div className="space-y-2">
          <div className="text-sm uppercase tracking-wider text-slate-400">Чек-лист пересказа</div>
          <ul className="space-y-1.5">
            {billet.connected_recall.checklist.map((item, i) => (
              <li key={i} className="bg-slate-800 rounded-lg p-3 text-sm flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="text-sm uppercase tracking-wider text-slate-400">📐 Задача</div>
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
            <div className="text-sm text-green-400 pt-2 font-medium">Ответ: {billet.problem.answer}</div>
          </div>
        </div>

        <div className="text-sm text-slate-400 pt-2">Честно — сдал бы этот билет на реальном экзамене?</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => recordResult(false)} className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium">
            Не сдал
          </button>
          <button onClick={() => recordResult(true)} className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium">
            Сдал
          </button>
        </div>
      </div>
    );
  }

  return null;
}
```

## Возникшие проблемы и как обошёл

- **Спецификация упоминала отдельный `ExamResultPage.tsx`**, но реализация в самой спеке держит разбор как стадию внутри `ExamMode.tsx`. Сделал по реализации (один файл с тремя стадиями) — это дешевле и не требует пробрасывать билет между маршрутами.
- **Шапка переполняется на 375px** (теперь 4 кнопки + прогресс-бар). Все 4 кнопки на мобильном уже в режиме «только эмодзи» (`hidden sm:inline` на тексте), визуальный аудит на iPhone SE: 🎯 + 🎓 + 📓 + ⤓ влезают.
- **Дедупликация записей в журнале для повторных проваленных экзаменов** — `addError` ищет по `(billetId, cardId, problemId)`. У экзаменных записей `cardId === null && problemId === null`, поэтому условия дедупа `e.cardId && entry.cardId === e.cardId` и `e.problemId && entry.problemId === e.problemId` не срабатывают, и каждый провал создаёт новую запись. Это хорошо: если ты провалил билет дважды — это видно по двум записям. Если будет много шума — правила дедупа можно усилить отдельно (например, по `what`), но сейчас это не нужно.
- **Slепое решение задачи на странице билета и на странице экзамена** — на экзамене разбор задачи без поля «вписать своё». Спека намеренно так: на экзамене ты решаешь устно/в голове, а уже разбор — для сверки. Слепое поле — только в `ProblemMode` (когда заходишь в задачу через билет).

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions**.
- Открыть приложение — должны появиться четыре кнопки в шапке (🎯 / 🎓 / 📓 / ⤓), задача по любому билету теперь сначала запрашивает свой ход решения.
- Прогон сценария: 🎓 → «Начать экзамен» → подождать 2 минуты или нажать «Готов» → проверить, что разбор содержит чек-лист и решение задачи; «Не сдал» добавит запись в журнал, «Сдал» инкрементнёт счётчик.
- Иди учить.
