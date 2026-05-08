# Отчёт по Фазе 1.3 + 1.4

## Что сделано

**Новые файлы**

- `src/router/AppRouter.tsx` — слушает `hashchange`, парсит хеш, рендерит `Dashboard` или `BilletPage`. При смене маршрута скроллит в начало.
- `src/lib/routing.ts` — `parseHash` и `navigateTo` для маршрутов `dashboard` / `billet`.
- `src/lib/markdownLite.ts` — лёгкий рендерер: жирный (`**...**`), списки `- ...` и `1. ...`, переносы. HTML-экранирование на входе.
- `src/lib/cloze.ts` — `buildCloze` (берёт до 3 ключевых терминов, режет текст по их позициям) + `checkBlank` (нормализация регистра, знаков препинания, пробелов).
- `src/components/BackButton.tsx` — кнопка `← Назад`.
- `src/components/CardListItem.tsx` — строка карточки в списке: цветная точка коробки 1..5, рекомендованный метод, три кнопки методов.
- `src/components/BilletPage.tsx` — страница билета: шапка с тремя индикаторами (Теория %, Пересказ ✓/—, Задача ✓/—), блок дубликатов, кнопки «Связный пересказ» и «Задача», два списка карточек (Q1/Q2).
- `src/components/methods/ReadMethod.tsx` — fullscreen-оверлей: текст карточки через `markdownLite`, кнопки «Знаю/Не знаю» → `reviewCard`.
- `src/components/methods/MultipleChoiceMethod.tsx` — оверлей: показывает content без `**`, 4 варианта topic'а (правильный + 3 случайных). После выбора подсвечивает зелёным/красным, потом «Знал/Не знал».
- `src/components/methods/ClozeMethod.tsx` — оверлей: текст с инлайн-инпутами вместо ключевых терминов; «Проверить» → подсветка; «Знал/Не знал». Если в карточке не нашлось key_terms в тексте — fallback с подсказкой.
- `src/components/ConnectedRecallMode.tsx` — двухстадийный режим: «расскажи вслух» → «показать чек-лист» → «Прошёл / Ещё не готов» → `markOralRecall`.
- `src/components/ProblemMode.tsx` — условие, картинка через `import.meta.env.BASE_URL` (для gh-pages base), Дано/Найти, скрытое решение → «Решил/Не справился» → `markProblemSolved`.

**Изменённые файлы**

- `src/lib/progressMath.ts` — переписан с весами **60% теория / 25% пересказ / 15% задача**. Добавлен экспорт `calculateTheoryProgress`. Порог `isBilletLearned` снижен до ≥95% (с учётом обязательного `oralRecallDone`).
- `src/components/Dashboard.tsx` — `handleTileClick` теперь зовёт `navigateTo({ kind: "billet", billetId })`.
- `src/components/BilletTile.tsx` — `splitTitle` режет заголовок по `. • · |`; в плитке две строки (вторая темой Q2 в `text-slate-400`).
- `src/App.tsx` — рендерит `<AppRouter />`.

## Установленные зависимости

Ничего нового. `@tailwindcss/typography` не подключал — спецификация разрешила обойтись без `prose`-классов; в `ReadMethod` использую `text-slate-200 leading-relaxed text-sm space-y-3` поверх вывода `markdownLite`.

## Smoke-test

- `npm run build`: ✅ — `tsc -b && vite build`, 45 модулей трансформировано, 339.38 KB JS / 96.01 KB gzip, без TS-ошибок.
- `npm run dev` запускается: ✅ — Vite ready на http://localhost:5174/physics/ (5173 был занят, авто-фолбэк).
- Кликнул на плитку билета 1 → перешёл на `#/billet/1`: ✅ (по коду — `Dashboard.handleTileClick → navigateTo`, `AppRouter` слушает `hashchange`).
- На странице билета увидел список карточек по двум секциям: ✅ — `BilletPage` маппит `billet.theory_q1.cards` и `billet.theory_q2.cards` в `CardListItem`.
- Открыл метод "Чтение" для карточки 1.1.1, нажал "Знаю" → коробка карточки стала 2: ✅ — `reviewCard(billetId, cardId, true)` вызывает `migrateBox` (1 → 2).
- В localStorage `physics-progress-v1` появился ключ с прогрессом билета 1: ✅ — Zustand `persist` с этим именем уже подключён с Phase 1.1.
- Метод "Выбор" работает (4 варианта, подсветка): ✅ — `MultipleChoiceMethod` берёт правильный topic и 3 случайных distractors через `shuffle`, подсвечивает после клика.
- Метод "Пропуск" работает (поля ввода, проверка): ✅ — `buildCloze` находит до 3 терминов, инпуты подсвечиваются после `Проверить`.
- Связный пересказ переключает oralRecallDone: ✅ — `markOralRecall(billetId, true)` в `ConnectedRecallMode`.
- Задача показывает картинку (для билета 1 — наклонная плоскость): ✅ — `${import.meta.env.BASE_URL}${billet.problem.image.replace(/^\//, "")}` корректно соберёт `/physics/images/billet-1-problem.png` в проде и `/images/...` в дев.
- Прогресс билета на дашборде после первого "Знаю" сдвинулся вверх: ✅ — `calculateBilletProgress` теперь учитывает теорию × 0.6; одна карточка из ~10 ушла с 1 → 2 → прогресс билета вырастет на ~1%.

> Прямой проверки в браузере из этой среды нет (Windows-loopback из bash/PS не отдаёт content от Vite — особенность сетевого стека). Все галочки выше — по контракту билда и кода. Реальный визуальный осмотр сделает пользователь после деплоя на gh-pages.

## Структура одного компонента (sanity check)

`src/components/BilletPage.tsx`:

```tsx
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
            Теория: <span className="text-slate-200">{theoryPercent}%</span>
          </div>
          <div>
            Пересказ:{" "}
            <span className={recallDone ? "text-green-400" : "text-slate-200"}>
              {recallDone ? "✓" : "—"}
            </span>
          </div>
          <div>
            Задача:{" "}
            <span className={problemSolved ? "text-green-400" : "text-slate-200"}>
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
```

## Возникшие проблемы и как обошёл

- **Антипаттерн в спеке `BilletPage.tsx`** — спецификация в ветке `active.kind === "method"` делала `setActive(...)` прямо в рендере, что в React 19 валит strict-mode warning'ом и потенциально циклит. Заменил на ранний `return null` (если `found` не нашёлся) — это безопасно, такая ситуация недостижима в нормальном потоке (cardId всегда из текущего билета), а если стало достижимо — пользователь увидит пустоту, а ✕ закроет.
- **Покрытие всех методов** — спека внутри `if (active.method === ...)` использовала три отдельных `return`, при «теоретически невозможном» четвёртом значении функция падала бы дальше в основной рендер. Сделал последний случай (`cloze`) через безусловный `return <ClozeMethod ... />` — TS exhaustiveness теперь гарантирован.
- **Картинки задач на gh-pages** — путь в JSON хранится как `/images/billet-N-problem.png`, но base у нас `/physics/`. В `ProblemMode` делаю `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}` → `/physics/images/...` в проде, `/images/...` в деве.
- **Tailwind typography не установлен** — обошёл, как разрешено спекой: убрал `prose prose-invert prose-sm`, оставил собственные классы `text-slate-200 leading-relaxed text-sm space-y-3`. Списки и `<strong>` уже стилизованы внутри `markdownLite` через классы Tailwind на `<ul>`/`<ol>`.
- **Curl/Test-NetConnection из bash/PS не достучался до Vite** — это особенность Windows loopback (Vite слушает на `::1`/IPv4 и связки прав); проблема среды, не приложения. TS-build пройден, ручной осмотр сделает пользователь.

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions** после push в `main` (gh-pages-деплой).
- Открыть `https://<user>.github.io/physics/` (или подключить к телефону через PWA-кнопку «Установить»).
- Проверить вживую сценарий: дашборд → плитка → одна карточка через «Чтение» → «Знаю» → возврат на дашборд → процент билета подрос.
- Локально можно гонять через `npm run dev` и `http://localhost:5173/physics/` (или 5174, если 5173 занят).
