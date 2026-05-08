# Фаза 1.3 + 1.4 — Страница билета, методы обучения, связный пересказ

## Контекст

Сейчас работают:
- Дашборд с 20 плитками билетов
- Прогресс-бары на основе Leitner-коробок (но они только по теории)
- Сторы Zustand с persist
- Логика Leitner (миграция коробок при «знаю/не знаю»)

Чего нет:
- Кликабельности плиток
- Страницы билета
- Любого реального обучения

**После этой фазы пользователь сможет реально учить билеты.** Это критическая фаза дня.

---

## Что строим

### Новые/изменённые файлы

```
src/
  router/
    AppRouter.tsx           ← минимальный роутер на хеш-навигации (без react-router)
  components/
    BilletPage.tsx          ← страница билета: список карточек + методы + связный режим + задача
    CardListItem.tsx        ← одна карточка в списке: показывает topic, текущую коробку, кнопку "Учить"
    methods/
      ReadMethod.tsx        ← уровень 1: показал текст → "знаю/не знаю"
      MultipleChoiceMethod.tsx  ← уровень 2: правильный topic + 3 ложных → выбор → "знаю/не знаю"
      ClozeMethod.tsx       ← уровень 3: текст с пропусками ключевых терминов → ввод → проверка
    ConnectedRecallMode.tsx ← связный пересказ: спрятать всё → раскрыть → отметить пройдено
    ProblemMode.tsx         ← задача: показать условие+картинку → отметить решена/не решена
    BackButton.tsx          ← маленькая кнопка "← Назад"
  lib/
    progressMath.ts         ← ОБНОВИТЬ: учитывать устный пересказ (25%) и задачу (15%)
    routing.ts              ← хелперы для хеш-навигации (parseHash, navigateTo)
    cloze.ts                ← подготовка cloze-текста (замена ключевых терминов на пропуски)
  store/
    progressStore.ts        ← Уже есть markOralRecall и markProblemSolved. Не трогать.
  components/
    Dashboard.tsx           ← ОБНОВИТЬ: при клике плитки переходим на #/billet/N
    BilletTile.tsx          ← ОБНОВИТЬ: показывать обе темы билета (q1 | q2 в 2 строки), не только title
  App.tsx                   ← ОБНОВИТЬ: использовать AppRouter
```

---

## Шаг 1. Минимальный роутер на хешах

Не подключаем react-router (лишняя зависимость и оверкилл для 2 экранов).

### `src/lib/routing.ts`

```typescript
export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number };

export function parseHash(hash: string): Route {
  // hash вида "#/billet/5" или "" / "#/" / "#"
  const m = hash.match(/^#\/billet\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (!Number.isNaN(id)) return { kind: "billet", billetId: id };
  }
  return { kind: "dashboard" };
}

export function navigateTo(route: Route): void {
  if (route.kind === "dashboard") {
    window.location.hash = "#/";
  } else {
    window.location.hash = `#/billet/${route.billetId}`;
  }
}
```

### `src/router/AppRouter.tsx`

```typescript
import { useEffect, useState } from "react";
import { parseHash, type Route } from "../lib/routing";
import Dashboard from "../components/Dashboard";
import BilletPage from "../components/BilletPage";

export default function AppRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // При смене маршрута скроллим в начало
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  if (route.kind === "billet") {
    return <BilletPage billetId={route.billetId} />;
  }
  return <Dashboard />;
}
```

### `src/App.tsx` — обнови

```tsx
import AppRouter from "./router/AppRouter";

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <AppRouter />
    </div>
  );
}

export default App;
```

### `src/components/Dashboard.tsx` — обнови обработчик клика

В существующем `Dashboard.tsx` найди заглушку `handleTileClick` и замени на:

```typescript
import { navigateTo } from "../lib/routing";

const handleTileClick = (billetId: number) => {
  navigateTo({ kind: "billet", billetId });
};
```

---

## Шаг 2. Улучшение прогресса (КРИТИЧНО)

### `src/lib/progressMath.ts` — ПОЛНОСТЬЮ ПЕРЕПИШИ

```typescript
import type { Billet } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import { getAllCardIds } from "./billetsLoader";

// ВЕСА компонентов прогресса билета
const WEIGHT_THEORY = 0.6;       // 60% — карточки в Leitner
const WEIGHT_RECALL = 0.25;      // 25% — устный пересказ пройден
const WEIGHT_PROBLEM = 0.15;     // 15% — задача решена

// Прогресс по теории: средняя коробка карточек / 5 * 100
export function calculateTheoryProgress(billet: Billet, progress: BilletProgress | undefined): number {
  const cardIds = getAllCardIds(billet);
  if (cardIds.length === 0) return 0;
  let total = 0;
  for (const id of cardIds) {
    const card = progress?.cards[id];
    total += card ? card.box : 1;
  }
  return Math.round((total / cardIds.length / 5) * 100);
}

// Общий прогресс билета: взвешенная сумма трёх компонентов
export function calculateBilletProgress(billet: Billet, progress: BilletProgress | undefined): number {
  const theory = calculateTheoryProgress(billet, progress) / 100;
  const recall = progress?.oralRecallDone ? 1 : 0;
  const problem = progress?.problemSolved ? 1 : 0;

  const composite = theory * WEIGHT_THEORY + recall * WEIGHT_RECALL + problem * WEIGHT_PROBLEM;
  return Math.round(composite * 100);
}

// Цвет шкалы: красный <30, оранжевый 30-60, жёлтый 60-85, зелёный >85
export function progressColor(percent: number): string {
  if (percent < 30) return "bg-red-500";
  if (percent < 60) return "bg-orange-500";
  if (percent < 85) return "bg-yellow-500";
  return "bg-green-500";
}

// Общий прогресс по всем 20 билетам — средний процент
export function calculateOverallProgress(
  billets: Billet[],
  progressMap: Record<number, BilletProgress>
): number {
  if (billets.length === 0) return 0;
  const sum = billets.reduce(
    (acc, b) => acc + calculateBilletProgress(b, progressMap[b.id]),
    0
  );
  return Math.round(sum / billets.length);
}

// Билет считается «выучен», если прогресс >= 95% И oralRecallDone
export function isBilletLearned(billet: Billet, progress: BilletProgress | undefined): boolean {
  if (!progress) return false;
  if (!progress.oralRecallDone) return false;
  return calculateBilletProgress(billet, progress) >= 95;
}
```

При пустом прогрессе билет получит 12% (60% × 20% от Leitner = 12). Это нормально и видно как «начинаешь почти с нуля».

---

## Шаг 3. Обновить плитку билета

### `src/components/BilletTile.tsx` — обнови блок с заголовком

Сейчас показывается только `billet.title`. Нужно показывать **обе темы билета** в две строки. Если `title` похож на формат "Тема1. Тема2" или "Тема1 • Тема2" — раздели по `.` или `•`. Если разделить не удалось — показывай как есть.

Замени блок с заголовком на:

```tsx
const splitTitle = (title: string): [string, string] => {
  const sep = /[.•·|]/;
  const parts = title.split(sep).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return [parts[0], parts.slice(1).join(" · ")];
  }
  return [title, ""];
};

const [topic1, topic2] = splitTitle(billet.title);

// в JSX:
<div className="text-xs text-slate-300 leading-snug pr-6 space-y-0.5">
  <div className="line-clamp-1">{topic1}</div>
  {topic2 && <div className="line-clamp-1 text-slate-400">{topic2}</div>}
</div>
```

Это сделает плитки информативнее — будет видно обе темы, а не "Кинематика равномерного и равноускоренного…" с обрезкой.

---

## Шаг 4. Страница билета `BilletPage.tsx`

```tsx
import { useState, useEffect } from "react";
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

type ActiveMode =
  | { kind: "none" }
  | { kind: "method"; cardId: string; method: "read" | "mc" | "cloze" }
  | { kind: "recall" }
  | { kind: "problem" };

export default function BilletPage({ billetId }: Props) {
  const billet = getBilletById(billetId);
  const progress = useProgressStore((s) => s.billets[billetId]);
  const [active, setActive] = useState<ActiveMode>({ kind: "none" });

  // Если билета нет — назад на дашборд
  useEffect(() => {
    if (!billet) navigateTo({ kind: "dashboard" });
  }, [billet]);

  if (!billet) return null;

  const overallPercent = calculateBilletProgress(billet, progress);
  const theoryPercent = calculateTheoryProgress(billet, progress);
  const recallDone = progress?.oralRecallDone ?? false;
  const problemSolved = progress?.problemSolved ?? false;

  const allCards: { card: TheoryCard; section: "q1" | "q2" }[] = [
    ...billet.theory_q1.cards.map((c) => ({ card: c, section: "q1" as const })),
    ...billet.theory_q2.cards.map((c) => ({ card: c, section: "q2" as const })),
  ];

  // Активный режим — оверлей поверх всего
  if (active.kind === "method") {
    const found = allCards.find((x) => x.card.id === active.cardId);
    if (!found) {
      setActive({ kind: "none" });
      return null;
    }
    const close = () => setActive({ kind: "none" });
    if (active.method === "read")
      return <ReadMethod billetId={billetId} card={found.card} onClose={close} />;
    if (active.method === "mc")
      return (
        <MultipleChoiceMethod
          billetId={billetId}
          card={found.card}
          allCards={allCards.map((x) => x.card)}
          onClose={close}
        />
      );
    if (active.method === "cloze")
      return <ClozeMethod billetId={billetId} card={found.card} onClose={close} />;
  }

  if (active.kind === "recall") {
    return (
      <ConnectedRecallMode
        billet={billet}
        onClose={() => setActive({ kind: "none" })}
      />
    );
  }

  if (active.kind === "problem") {
    return (
      <ProblemMode
        billet={billet}
        onClose={() => setActive({ kind: "none" })}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigateTo({ kind: "dashboard" })} />
        <div className="text-sm text-slate-400 tabular-nums">{overallPercent}%</div>
      </div>

      <header className="space-y-2">
        <div className="text-xs text-slate-500 tabular-nums">Билет {String(billet.id).padStart(2, "0")}</div>
        <h1 className="text-xl font-semibold leading-tight">{billet.title}</h1>
        <ProgressBar percent={overallPercent} height="md" showLabel={false} />

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
          <div>Теория: <span className="text-slate-200">{theoryPercent}%</span></div>
          <div>Пересказ: <span className={recallDone ? "text-green-400" : "text-slate-200"}>{recallDone ? "✓" : "—"}</span></div>
          <div>Задача: <span className={problemSolved ? "text-green-400" : "text-slate-200"}>{problemSolved ? "✓" : "—"}</span></div>
        </div>
      </header>

      {/* Дубликаты-подсказка */}
      {billet.theory_duplicates.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <div className="text-slate-400 mb-1">🔗 Связано с другими билетами:</div>
          <ul className="space-y-1">
            {billet.theory_duplicates.map((d, i) => (
              <li key={i}>
                Билет {d.billet_id} ({d.question === "q1" ? "Вопрос 1" : "Вопрос 2"}) — {d.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Главные действия */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActive({ kind: "recall" })}
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 text-left transition-colors"
        >
          <div className="text-sm font-medium">🎤 Связный пересказ</div>
          <div className="text-xs text-slate-400 mt-0.5">{recallDone ? "Пройден" : "Не пройден"}</div>
        </button>
        <button
          onClick={() => setActive({ kind: "problem" })}
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 text-left transition-colors"
        >
          <div className="text-sm font-medium">📐 Задача</div>
          <div className="text-xs text-slate-400 mt-0.5">{problemSolved ? "Решена" : "Не решена"}</div>
        </button>
      </div>

      {/* Секция теории q1 */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-2 mt-4">Теория · Вопрос 1</h2>
        <div className="text-xs text-slate-500 mb-2">{billet.theory_q1.title}</div>
        <div className="space-y-2">
          {billet.theory_q1.cards.map((card) => (
            <CardListItem
              key={card.id}
              billetId={billetId}
              card={card}
              onChooseMethod={(method) => setActive({ kind: "method", cardId: card.id, method })}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-2 mt-4">Теория · Вопрос 2</h2>
        <div className="text-xs text-slate-500 mb-2">{billet.theory_q2.title}</div>
        <div className="space-y-2">
          {billet.theory_q2.cards.map((card) => (
            <CardListItem
              key={card.id}
              billetId={billetId}
              card={card}
              onChooseMethod={(method) => setActive({ kind: "method", cardId: card.id, method })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## Шаг 5. `BackButton.tsx`

```tsx
interface Props {
  onClick: () => void;
}

export default function BackButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-slate-300 hover:text-slate-100 transition-colors"
    >
      ← Назад
    </button>
  );
}
```

---

## Шаг 6. `CardListItem.tsx` — карточка в списке теории

```tsx
import type { TheoryCard } from "../types/billets";
import { useProgressStore } from "../store/progressStore";
import { suggestMethod } from "../lib/leitner";

interface Props {
  billetId: number;
  card: TheoryCard;
  onChooseMethod: (method: "read" | "mc" | "cloze") => void;
}

export default function CardListItem({ billetId, card, onChooseMethod }: Props) {
  const cardProgress = useProgressStore((s) => s.billets[billetId]?.cards[card.id]);
  const box = cardProgress?.box ?? 1;

  // Цвет точки коробки
  const dotColor =
    box === 1 ? "bg-red-500" :
    box === 2 ? "bg-orange-500" :
    box === 3 ? "bg-yellow-500" :
    box === 4 ? "bg-lime-500" : "bg-green-500";

  const suggested = suggestMethod(box);
  const suggestedLabel =
    suggested === "read" ? "Чтение" :
    suggested === "multiple_choice" ? "Выбор" :
    suggested === "cloze" ? "Пропуск" :
    suggested === "free_answer" ? "Свободный" :
    "Развёрнутый";

  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} title={`Коробка ${box}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-100">{card.topic}</div>
          <div className="text-xs text-slate-500 mt-0.5">Коробка {box}/5 · рекомендуется: {suggestedLabel}</div>
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
    </div>
  );
}
```

---

## Шаг 7. Метод 1 — `ReadMethod.tsx` (чтение)

```tsx
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
          <div className="text-xs text-slate-500 uppercase tracking-wider">Чтение</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>
        <h2 className="text-lg font-semibold">{card.topic}</h2>
        <div
          className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdownLite(card.content) }}
        />
        {card.key_terms.length > 0 && (
          <div className="text-xs text-slate-500 pt-2">
            Ключевые термины: {card.key_terms.join(", ")}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-4 sticky bottom-4">
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
```

### Хелпер `src/lib/markdownLite.ts`

Не подключаем react-markdown — слишком тяжёлый для нашей мелочи. Простой минимальный рендерер для **жирного**, переносов строк и `\n-` списков:

```typescript
export function renderMarkdownLite(text: string): string {
  // Экранируем HTML
  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // **жирный**
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // переносы строк → <br>
  // двойные переносы → новый параграф
  const paragraphs = out.split(/\n\n+/).map((p) => {
    // списки: строки начинающиеся с "- "
    if (/^- /.test(p.trim())) {
      const items = p
        .split("\n")
        .filter((l) => l.trim().startsWith("- "))
        .map((l) => `<li>${l.replace(/^- /, "")}</li>`)
        .join("");
      return `<ul class="list-disc pl-5 space-y-1">${items}</ul>`;
    }
    // нумерованные списки: "1. ..."
    if (/^\d+\. /.test(p.trim())) {
      const items = p
        .split("\n")
        .filter((l) => /^\d+\. /.test(l.trim()))
        .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
        .join("");
      return `<ol class="list-decimal pl-5 space-y-1">${items}</ol>`;
    }
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  });

  return paragraphs.join("");
}
```

Стили `prose-invert` от Tailwind. Если они не подключены — добавь `@tailwindcss/typography` в plugin'ы Tailwind. **Если плагин не установлен — просто убери класс `prose prose-invert prose-sm` и оставь обычный текст**, это допустимо.

---

## Шаг 8. Метод 2 — `MultipleChoiceMethod.tsx`

```tsx
import { useMemo, useState } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";

interface Props {
  billetId: number;
  card: TheoryCard;
  allCards: TheoryCard[];     // все карточки билета — для выбора отвлекающих
  onClose: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MultipleChoiceMethod({ billetId, card, allCards, onClose }: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const [picked, setPicked] = useState<string | null>(null);

  // Вопрос: показываем content (без topic), 4 варианта topic'а — один правильный + 3 случайных
  const options = useMemo(() => {
    const others = allCards.filter((c) => c.id !== card.id).map((c) => c.topic);
    const distractors = shuffle(others).slice(0, 3);
    return shuffle([card.topic, ...distractors]);
  }, [card, allCards]);

  const handle = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Выбор правильного варианта</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>
        <div className="text-sm text-slate-400">К чему относится этот фрагмент?</div>
        <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
          {card.content.replace(/\*\*/g, "")}
        </div>

        <div className="space-y-2 pt-2">
          {options.map((opt) => {
            const isCorrect = opt === card.topic;
            const isPicked = picked === opt;
            const showResult = picked !== null;
            const cls = !showResult
              ? "bg-slate-800 hover:bg-slate-700"
              : isCorrect
              ? "bg-green-900"
              : isPicked
              ? "bg-red-900"
              : "bg-slate-800 opacity-60";
            return (
              <button
                key={opt}
                onClick={() => !picked && setPicked(opt)}
                disabled={picked !== null}
                className={`w-full text-left rounded-lg p-3 text-sm transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="grid grid-cols-2 gap-2 pt-4">
            <button
              onClick={() => handle(false)}
              className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium"
            >
              Не знал
            </button>
            <button
              onClick={() => handle(true)}
              className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
            >
              Знал
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

Логика: пользователь выбирает вариант, видит правильный/неправильный (визуально), затем сам решает — записать как «знал/не знал». Это даёт обучающий эффект (увидел правильный ответ) и контроль (сам оценивает).

---

## Шаг 9. Метод 3 — `ClozeMethod.tsx`

### `src/lib/cloze.ts` — подготовка пропусков

```typescript
import type { TheoryCard } from "../types/billets";

export interface ClozeBlank {
  index: number;       // позиция пропуска
  expected: string;    // правильное слово/фраза
}

export interface ClozeText {
  parts: string[];     // куски между пропусками
  blanks: ClozeBlank[];
}

// Заменяем КАЖДЫЙ key_term на пропуск (если найден в тексте, регистронезависимо).
// Берём ДО 3 терминов — больше — мутит.
export function buildCloze(card: TheoryCard): ClozeText {
  const text = card.content.replace(/\*\*/g, "");
  const terms = card.key_terms.slice(0, 3);

  if (terms.length === 0) {
    return { parts: [text], blanks: [] };
  }

  // Простая стратегия: ищем первое вхождение каждого термина в тексте, по порядку
  const found: { term: string; index: number }[] = [];
  for (const term of terms) {
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i >= 0) found.push({ term, index: i });
  }
  // Сортируем по позиции
  found.sort((a, b) => a.index - b.index);

  if (found.length === 0) return { parts: [text], blanks: [] };

  const parts: string[] = [];
  const blanks: ClozeBlank[] = [];
  let cursor = 0;
  for (let i = 0; i < found.length; i++) {
    const { term, index } = found[i];
    parts.push(text.slice(cursor, index));
    blanks.push({ index: i, expected: term });
    cursor = index + term.length;
  }
  parts.push(text.slice(cursor));

  return { parts, blanks };
}

// Сравнение ответа: регистронезависимо, без знаков препинания и лишних пробелов
export function checkBlank(actual: string, expected: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[.,;:!?()«»"'`-]/g, "").replace(/\s+/g, " ").trim();
  return norm(actual) === norm(expected);
}
```

### `src/components/methods/ClozeMethod.tsx`

```tsx
import { useMemo, useState } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { buildCloze, checkBlank } from "../../lib/cloze";

interface Props {
  billetId: number;
  card: TheoryCard;
  onClose: () => void;
}

export default function ClozeMethod({ billetId, card, onClose }: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const cloze = useMemo(() => buildCloze(card), [card]);
  const [answers, setAnswers] = useState<string[]>(() => cloze.blanks.map(() => ""));
  const [checked, setChecked] = useState(false);

  if (cloze.blanks.length === 0) {
    // Если в карточке нет ключевых терминов в тексте — fallback на чтение
    return (
      <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Пропуск (нет ключевых терминов)</div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>
          <h2 className="text-lg font-semibold">{card.topic}</h2>
          <div className="text-sm text-slate-300 whitespace-pre-wrap">{card.content.replace(/\*\*/g, "")}</div>
          <div className="text-xs text-slate-500">Для этой карточки cloze-режим недоступен — попробуй другой метод.</div>
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 w-full">Закрыть</button>
        </div>
      </div>
    );
  }

  const allCorrect = cloze.blanks.every((b, i) => checkBlank(answers[i], b.expected));

  const finalize = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Заполни пропуски</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>
        <h2 className="text-lg font-semibold">{card.topic}</h2>
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {cloze.parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < cloze.blanks.length && (
                <input
                  type="text"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  disabled={checked}
                  className={`inline-block mx-1 px-2 py-0.5 rounded bg-slate-800 border-b-2 min-w-[120px] ${
                    checked
                      ? checkBlank(answers[i], cloze.blanks[i].expected)
                        ? "border-green-500 text-green-300"
                        : "border-red-500 text-red-300"
                      : "border-slate-600"
                  } focus:outline-none focus:border-slate-400`}
                />
              )}
            </span>
          ))}
        </div>

        {checked && !allCorrect && (
          <div className="text-xs text-slate-400 bg-slate-800 rounded p-2">
            Правильные ответы: {cloze.blanks.map((b) => b.expected).join(", ")}
          </div>
        )}

        {!checked ? (
          <button
            onClick={() => setChecked(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Проверить
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => finalize(false)} className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium">
              Не знал
            </button>
            <button onClick={() => finalize(true)} className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium">
              Знал
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Шаг 10. Связный пересказ — `ConnectedRecallMode.tsx`

```tsx
import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

export default function ConnectedRecallMode({ billet, onClose }: Props) {
  const markOralRecall = useProgressStore((s) => s.markOralRecall);
  const currentlyDone = useProgressStore((s) => s.billets[billet.id]?.oralRecallDone ?? false);

  const [stage, setStage] = useState<"hidden" | "revealed">("hidden");

  const finalize = (passed: boolean) => {
    markOralRecall(billet.id, passed);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">🎤 Связный пересказ</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>
        <h2 className="text-lg font-semibold">Билет {billet.id}: {billet.title}</h2>

        {stage === "hidden" && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed">
              <p className="mb-2"><strong>Шаг 1.</strong> Расскажи билет вслух — голосом, как на экзамене. Не подглядывай.</p>
              <p className="mb-2"><strong>Шаг 2.</strong> Когда закончишь — нажми кнопку ниже, чтобы открыть чек-лист.</p>
              <p><strong>Шаг 3.</strong> Сверь свой рассказ с чек-листом — что упустил, что сказал хорошо.</p>
            </div>
            <button
              onClick={() => setStage("revealed")}
              className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
            >
              Я закончил рассказывать — показать чек-лист
            </button>
          </div>
        )}

        {stage === "revealed" && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">Чек-лист — что должно было прозвучать:</div>
            <ul className="space-y-2">
              {billet.connected_recall.checklist.map((item, i) => (
                <li key={i} className="bg-slate-800 rounded-lg p-3 text-sm flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="text-sm text-slate-400 pt-2">
              Как прошло? Без подсказок — это значит ты не подглядывал во время рассказа.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => finalize(false)}
                className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
              >
                Ещё не готов
              </button>
              <button
                onClick={() => finalize(true)}
                className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium"
              >
                {currentlyDone ? "Снова прошёл" : "Прошёл без подсказок"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Шаг 11. Задача — `ProblemMode.tsx`

```tsx
import { useState } from "react";
import type { Billet } from "../types/billets";
import { useProgressStore } from "../store/progressStore";

interface Props {
  billet: Billet;
  onClose: () => void;
}

export default function ProblemMode({ billet, onClose }: Props) {
  const markProblemSolved = useProgressStore((s) => s.markProblemSolved);
  const currentlySolved = useProgressStore((s) => s.billets[billet.id]?.problemSolved ?? false);

  const [showSolution, setShowSolution] = useState(false);

  const finalize = (solved: boolean) => {
    markProblemSolved(billet.id, solved);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">📐 Задача</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
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

        {!showSolution ? (
          <button
            onClick={() => setShowSolution(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Я решил — показать ход решения
          </button>
        ) : (
          <>
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="text-xs text-slate-400">Ход решения:</div>
              <ol className="text-sm text-slate-200 space-y-1.5 list-decimal pl-5">
                {billet.problem.solution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="text-sm text-green-400 pt-2 font-medium">Ответ: {billet.problem.answer}</div>
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

## Финальная проверка

1. `npm run build` без ошибок.
2. Дашборд открывается, плитки кликабельны, переход на `#/billet/N`.
3. На странице билета:
   - Шапка с тремя индикаторами (Теория %, Пересказ ✓/—, Задача ✓/—)
   - Список карточек по двум секциям (Q1 и Q2) с цветными точками коробок
   - У каждой карточки — 3 кнопки методов
   - Дубликаты подсказаны вверху, если есть
   - Кнопки «Связный пересказ» и «Задача» — с состоянием
4. Метод "Чтение" открывается, при «знаю» коробка карточки растёт.
5. Метод "Выбор" — 4 варианта, после выбора показывается правильный, потом «знал/не знал».
6. Метод "Пропуск" — поля ввода в тексте, проверка, подсветка зелёным/красным.
7. Связный пересказ — двухстадийный, переключает `oralRecallDone`.
8. Задача — показывает условие+картинку+дано, потом ход решения, переключает `problemSolved`.
9. Прогресс в шапке билета и на дашборде растёт по новой формуле (теория 60%, пересказ 25%, задача 15%).
10. Кнопка «Назад» возвращает на дашборд (через хеш).
11. Прогресс сохраняется в localStorage (проверь в DevTools → Application).

---

## Чего НЕ делать

- ❌ Не добавляй react-router, react-markdown, lucide-react, framer-motion. Всё на нативе.
- ❌ Не реализуй Match и FreeAnswer (это Phase 2.1).
- ❌ Не трогай журнал ошибок (это Phase 2.2).
- ❌ Не реализуй Groq (это Phase 3.1).

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

Создай файл `PHASE-1.3-REPORT.md` в корне проекта по шаблону:

```markdown
# Отчёт по Фазе 1.3 + 1.4

## Что сделано

[список созданных и изменённых файлов]

## Установленные зависимости

[если ставил что-то новое — перечисли. Если нет — пиши "ничего нового"]

## Smoke-test

- `npm run build`: ✅ / ❌
- `npm run dev` запускается: ✅ / ❌
- Кликнул на плитку билета 1 → перешёл на `#/billet/1`: ✅ / ❌
- На странице билета увидел список карточек по двум секциям: ✅ / ❌
- Открыл метод "Чтение" для карточки 1.1.1, нажал "Знаю" → коробка карточки стала 2: ✅ / ❌
- В localStorage `physics-progress-v1` появился ключ с прогрессом билета 1: ✅ / ❌
- Метод "Выбор" работает (4 варианта, подсветка): ✅ / ❌
- Метод "Пропуск" работает (поля ввода, проверка): ✅ / ❌
- Связный пересказ переключает oralRecallDone: ✅ / ❌
- Задача показывает картинку (для билета 1 — наклонная плоскость): ✅ / ❌
- Прогресс билета на дашборде после первого "Знаю" сдвинулся вверх: ✅ / ❌

## Структура одного компонента (sanity check)

Распечатай ПОЛНОСТЬЮ исходник `src/components/BilletPage.tsx`.

## Возникшие проблемы и как обошёл

[список или "Проблем не возникло"]

## Что нужно сделать пользователю руками

[если что-то — перечисли. Если нет — "Ничего"]
```

После создания отчёта напиши:
**"Фаза 1.3 + 1.4 завершена. Можно учить."**

---

**Всё. Начинай.**
