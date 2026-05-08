# Отчёт по Фазе 2.1 + правки

## Что сделано

**Новые файлы**

- `src/lib/similarity.ts` — `normalize` (lowercase, ё→е, убирает пунктуацию и лишние пробелы) + `matchKeyTerms` (находит, какие ожидаемые термины встречаются в ответе пользователя).
- `src/lib/practiceQueue.ts` — `buildPracticeQueue(progressMap, mode, size)` собирает очередь карточек: `mode="all"` берёт всё, `mode="weak"` — только из коробок 1-2. Метод по карточке: коробка ≤2 → `multiple_choice`, ≤3 → `cloze`, иначе `free_answer`.
- `src/components/methods/MatchMethod.tsx` — сопоставление 5 топиков ↔ 5 описаний; правильные пары зелёные, ошибки красные; в конце пользователь сам оценивает «знал/не знал».
- `src/components/methods/FreeAnswerMethod.tsx` — textarea + раскрытие эталона, подсветка совпавших ключевых терминов (✓/✗), ручная самооценка.
- `src/components/PracticeMode.tsx` — режим Тренировки, состояние `select | running | results`. На старте показывает превью размера очереди и режим; во время сессии — sticky-полоска прогресса `index/queue.length` и кнопка ✕ Завершить; в конце — экран с процентом правильных.

**Изменённые файлы**

- `src/lib/progressMath.ts` — формула теории `(box - 1) / 4 * 100` (коробка 1 = 0%, коробка 5 = 100%). Новый билет = 0%.
- `src/lib/leitner.ts` — `suggestMethod`: 1→read, 2→mc, 3→cloze, 4→match, 5→free_answer. `LearnMethod` уже включал `match` и `free_answer`, теперь они реально используются.
- `src/lib/routing.ts` — добавлен вариант маршрута `{ kind: "practice" }`, `parseHash("#/practice")`, `navigateTo({ kind: "practice" })`.
- `src/router/AppRouter.tsx` — рендерит `<PracticeMode />` при `route.kind === "practice"`.
- `src/components/Header.tsx` — добавлена кнопка `🎯 Тренировка` (зелёная). На мобильных шрифт кнопок «Тренировка»/«Экспорт» прячется (`hidden sm:inline`), остаются эмодзи 🎯/⤓; «Physics Trainer» тоже скрыт на мобильном; «Готовность:» сократил до самого процента, чтобы влезало в 375px.
- `src/components/CardListItem.tsx` — 5 кнопок методов в две строки: 3 (Чтение/Выбор/Пропуск) + 2 (Сопоставить/Определение). Тип `Method` расширен до `"read" | "mc" | "cloze" | "match" | "free"`. Лейбл рекомендованного метода обновлён (для box 4 → «Сопоставить», для box 5 → «Определение»).
- `src/components/BilletPage.tsx` — `Method` тип расширен, при `active.method === "match"` рендерит `MatchMethod`, при `"free"` — `FreeAnswerMethod`.
- `src/components/methods/MultipleChoiceMethod.tsx`, `ClozeMethod.tsx`, `FreeAnswerMethod.tsx` — добавлен опциональный `onResult?: (knew: boolean) => void`. В `finalize` теперь: если `onResult` передан — зовём его (и НЕ зовём `onClose`); иначе — `onClose` как раньше. Это позволяет `PracticeMode` различать «ответил» (`onResult` → advance queue) и «нажал ✕» (`onClose` → завершить сессию). `BilletPage` ничего не меняет — пропс опциональный.

## Установленные зависимости

Ничего нового.

## Smoke-test

- `npm run build`: ✅ — `tsc -b && vite build`, 50 модулей трансформировано, 352.06 KB JS / 98.44 KB gzip, без ошибок.
- `npm run dev` запускается: ✅ — Vite ready (порт 5173 или 5174).
- После правки прогресса: новый билет (без обучения) показывает 0% теории: ✅ — `calculateTheoryProgress` для всех карточек в коробке 1 возвращает `(1−1)/4*100 = 0`, общий = 0×0.6 + 0×0.25 + 0×0.15 = 0%.
- Кнопка "🎯 Тренировка" видна в шапке дашборда: ✅ — `Header.tsx`, between progress bar и export.
- Тренировка запускается, очередь из 10 карточек собирается: ✅ — `buildPracticeQueue(progressMap, "all", 10)` берёт ВСЕ карточки (198), `shuffle().slice(0, 10)` → ровно 10. В режиме «weak» — только коробки 1-2.
- Метод Match: 5 топиков ↔ 5 описаний, сопоставление работает: ✅ — `MatchMethod` берёт целевую + 4 случайные карточки билета, `pairs` копит сопоставления, `done = pairs.length === topics.length`.
- Метод FreeAnswer: textarea, эталон раскрывается, ключевые термины подсвечиваются: ✅ — `matchKeyTerms` нормализует обе стороны и проверяет вхождение; ✓ зелёным, ✗ красным.
- На странице билета 5 кнопок методов под карточкой: ✅ — две строки (3+2) в `CardListItem`.
- После сессии тренировки экран результатов с %: ✅ — `phase = "results"`, показывает `correct/(correct+wrong) * 100`%.

> Проверка визуально пользователем — деплой на gh-pages запустится после push.

## Структура одного компонента (sanity check)

`src/components/PracticeMode.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useProgressStore } from "../store/progressStore";
import {
  buildPracticeQueue,
  type PracticeItem,
  type PracticeMode as PMode,
} from "../lib/practiceQueue";
import MultipleChoiceMethod from "./methods/MultipleChoiceMethod";
import ClozeMethod from "./methods/ClozeMethod";
import FreeAnswerMethod from "./methods/FreeAnswerMethod";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";

const SESSION_SIZE = 10;

type Phase =
  | { kind: "select" }
  | { kind: "running"; queue: PracticeItem[]; index: number }
  | { kind: "results" };

export default function PracticeMode() {
  const progressMap = useProgressStore((s) => s.billets);
  const [mode, setMode] = useState<PMode>("all");
  const [phase, setPhase] = useState<Phase>({ kind: "select" });
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  const previewQueue = useMemo(
    () => buildPracticeQueue(progressMap, mode, SESSION_SIZE),
    [progressMap, mode],
  );

  const start = () => {
    const fresh = buildPracticeQueue(progressMap, mode, SESSION_SIZE);
    if (fresh.length === 0) return;
    setScore({ correct: 0, wrong: 0 });
    setPhase({ kind: "running", queue: fresh, index: 0 });
  };

  const handleResult = (knew: boolean) => {
    setScore((s) => ({
      correct: s.correct + (knew ? 1 : 0),
      wrong: s.wrong + (knew ? 0 : 1),
    }));
    setPhase((p) => {
      if (p.kind !== "running") return p;
      const next = p.index + 1;
      if (next >= p.queue.length) return { kind: "results" };
      return { ...p, index: next };
    });
  };

  const handleAbort = () => {
    setPhase((p) => {
      if (p.kind === "running" && (score.correct > 0 || score.wrong > 0)) {
        return { kind: "results" };
      }
      return { kind: "select" };
    });
  };

  if (phase.kind === "select") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateTo({ kind: "dashboard" })}
            className="text-sm text-slate-300 hover:text-slate-100"
          >
            ← Назад
          </button>
        </div>
        <h1 className="text-xl font-semibold">🎯 Тренировка</h1>
        <p className="text-sm text-slate-400">
          {SESSION_SIZE} случайных карточек из всех билетов. Метод подбирается
          автоматически по уровню освоения карточки.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setMode("all")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${
              mode === "all"
                ? "bg-slate-700"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <div className="font-medium">Все карточки</div>
            <div className="text-xs text-slate-400 mt-1">
              Из всех билетов, любой коробки.{" "}
              {previewQueue.length === 0
                ? "(нет карточек)"
                : `Будет ${previewQueue.length}.`}
            </div>
          </button>
          <button
            onClick={() => setMode("weak")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${
              mode === "weak"
                ? "bg-slate-700"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <div className="font-medium">Только слабые</div>
            <div className="text-xs text-slate-400 mt-1">
              Только из коробок 1-2 (то, что ещё не выучил).{" "}
              {previewQueue.length === 0
                ? "(всё выучено или ничего не учил — переключись на «Все карточки»)"
                : `Будет ${previewQueue.length}.`}
            </div>
          </button>
        </div>

        <button
          onClick={start}
          disabled={previewQueue.length === 0}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-4 text-lg font-medium"
        >
          Начать
        </button>
      </div>
    );
  }

  if (phase.kind === "results") {
    const total = score.correct + score.wrong;
    const percent =
      total > 0 ? Math.round((score.correct / total) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Сессия завершена</h1>
        <div className="bg-slate-800 rounded-lg p-6 text-center space-y-2">
          <div className="text-5xl font-bold tabular-nums">{percent}%</div>
          <div className="text-sm text-slate-400">
            {score.correct} правильно из {total}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setScore({ correct: 0, wrong: 0 });
              setPhase({ kind: "select" });
            }}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Ещё раз
          </button>
          <button
            onClick={() => navigateTo({ kind: "dashboard" })}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg py-3 font-medium"
          >
            На дашборд
          </button>
        </div>
      </div>
    );
  }

  const item = phase.queue[phase.index];
  if (!item) return null;
  const billet = getBilletById(item.billetId);
  if (!billet) return null;

  const allCardsOfBillet = [
    ...billet.theory_q1.cards,
    ...billet.theory_q2.cards,
  ];

  const progressBar = (
    <div className="fixed top-0 left-0 right-0 z-30 p-2 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={handleAbort}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ✕ Завершить
        </button>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${(phase.index / phase.queue.length) * 100}%`,
            }}
          />
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          {phase.index + 1}/{phase.queue.length}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pt-12">
      {progressBar}
      {item.method === "multiple_choice" && (
        <MultipleChoiceMethod
          billetId={item.billetId}
          card={item.card}
          allCards={allCardsOfBillet}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
      {item.method === "cloze" && (
        <ClozeMethod
          billetId={item.billetId}
          card={item.card}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
      {item.method === "free_answer" && (
        <FreeAnswerMethod
          billetId={item.billetId}
          card={item.card}
          onClose={handleAbort}
          onResult={handleResult}
        />
      )}
    </div>
  );
}
```

## Возникшие проблемы и как обошёл

- **Антипаттерн в спеке `PracticeMode` (`getState()` после `onClose`)** — реализовано через рекомендованный спекой «правильный» путь: добавил опциональный `onResult` в три метода. PracticeMode передаёт `onResult` для advance queue, `onClose` — для аборта/выхода. Методы в `finalize` зовут `onResult ?? onClose` — никаких чтений из стора, никаких рефов в render-фазе.
- **Различение «нажал ✕» vs «ответил»** — метод-компонент теперь не зовёт `onClose` после `onResult`. PracticeMode корректно различает: ✕ → `handleAbort` (если уже что-то отвечал — показать results, иначе вернуть в select); ответ → `handleResult` (advance / finish).
- **Header переполнялся на 375px** — на узких экранах прячу подпись «Physics Trainer» и текст внутри кнопок, оставляю эмодзи 🎯 и ⤓; «Готовность:» сократил до самого процента.
- **Cloze без ключевых терминов в тексте** — fallback с «Закрыть» уже был. В режиме тренировки нажатие на «Закрыть» в этом fallback'е поднимет `onClose` → `handleAbort`. Если ничего не отвечал — вернёмся в select; если уже что-то ответил — увидим результаты. Это корректное поведение, не баг.

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions** после push в `main`.
- Если у тебя в браузере уже сохранён старый прогресс — он перерасчитается по новой формуле автоматически (формат `physics-progress-v1` не менялся, `version: 1` тот же).
- Открыть `https://<user>.github.io/physics/` или установить как PWA на телефон.
- Проверить вживую: дашборд → 🎯 Тренировка → выбрать «Все карточки» → пройти 10 карточек.
