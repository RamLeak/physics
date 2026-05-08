# Фаза 1.1 + 1.2 — Сторы Zustand + Dashboard

## Контекст

Каркас Vite + React + TS + Tailwind + PWA уже стоит (Фаза 0.1). Билеты распарсены в `src/data/billets.json` (20 билетов, 198 карточек, 32 дубликата). Картинки задач лежат в `public/images/`.

Сейчас задача — построить **первый рабочий экран**: дашборд со всеми 20 билетами, прогресс-барами и общей шкалой готовности. Плюс — все Zustand-сторы, типы данных, логика Leitner, кнопка экспорта прогресса.

После этой фазы пользователь сможет открыть приложение с телефона и **увидеть свои билеты**. Кликабельных билетов пока нет — это в следующей фазе.

---

## Что строим

### Файлы

```
src/
  types/
    billets.ts          ← типы Billet, TheoryCard, Problem, ConnectedRecall, Duplicate
    progress.ts         ← типы CardProgress, LeitnerBox, BilletProgress
  data/
    billets.json        ← УЖЕ ЕСТЬ
  lib/
    billetsLoader.ts    ← загружает billets.json, типизирует, валидирует
    leitner.ts          ← логика коробок Leitner (миграция, выбор метода)
    progressMath.ts     ← подсчёт % прогресса билета и общего
  store/
    progressStore.ts    ← Zustand + persist: состояние карточек
    errorsStore.ts      ← журнал ошибок (пустой пока, только структура)
    statsStore.ts       ← счётчики (пустой пока, только структура)
    settingsStore.ts    ← настройки (Groq-ключ — заготовка)
    index.ts            ← реэкспорт всех сторов
  components/
    Dashboard.tsx       ← главный экран с 20 билетами
    BilletTile.tsx      ← плитка одного билета на дашборде
    ProgressBar.tsx     ← переиспользуемый компонент шкалы
    Header.tsx          ← шапка с названием + кнопкой экспорта
  App.tsx               ← обновить, рендерить Dashboard
```

---

## Шаг 1. Типы (`src/types/billets.ts` и `src/types/progress.ts`)

### `billets.ts`

Точно по структуре `billets.json`:

```typescript
export interface TheoryCard {
  id: string;              // "1.1.1"
  topic: string;
  content: string;
  key_terms: string[];
}

export interface TheoryQuestion {
  title: string;
  cards: TheoryCard[];
}

export interface ConnectedRecall {
  checklist: string[];
}

export interface Problem {
  id: string;              // "P1"
  title: string;
  condition: string;
  given: string[];
  find: string;
  image: string | null;    // "/images/billet-1-problem.png" или null
  solution_steps: string[];
  answer: string;
}

export interface Duplicate {
  billet_id: number;
  question: "q1" | "q2";
  note: string;
}

export interface Billet {
  id: number;
  title: string;
  theory_q1: TheoryQuestion;
  theory_q2: TheoryQuestion;
  connected_recall: ConnectedRecall;
  problem: Problem;
  theory_duplicates: Duplicate[];
}

export interface BilletsData {
  billets: Billet[];
}
```

### `progress.ts`

```typescript
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
// 1 = новая, не знаю
// 2 = изучаю
// 3 = освоено базово
// 4 = крепко освоено
// 5 = выучено

export interface CardProgress {
  cardId: string;          // "1.1.1"
  box: LeitnerBox;
  lastReviewed: number | null;  // timestamp
  totalReviews: number;
  correctReviews: number;
}

export interface BilletProgress {
  billetId: number;
  cards: Record<string, CardProgress>;  // ключ — cardId
  oralRecallDone: boolean;              // прошёл ли устный пересказ
  problemSolved: boolean;               // решена ли задача
}
```

---

## Шаг 2. Загрузчик билетов (`src/lib/billetsLoader.ts`)

```typescript
import billetsData from "../data/billets.json";
import type { BilletsData, Billet } from "../types/billets";

const data = billetsData as BilletsData;

export function getAllBillets(): Billet[] {
  return data.billets;
}

export function getBilletById(id: number): Billet | undefined {
  return data.billets.find((b) => b.id === id);
}

export function getAllCardIds(billet: Billet): string[] {
  return [
    ...billet.theory_q1.cards.map((c) => c.id),
    ...billet.theory_q2.cards.map((c) => c.id),
  ];
}
```

В `tsconfig.app.json` нужно убедиться, что включён `"resolveJsonModule": true` и `"esModuleInterop": true`. Если нет — добавь.

---

## Шаг 3. Логика Leitner (`src/lib/leitner.ts`)

```typescript
import type { LeitnerBox, CardProgress } from "../types/progress";

export function createInitialProgress(cardId: string): CardProgress {
  return {
    cardId,
    box: 1,
    lastReviewed: null,
    totalReviews: 0,
    correctReviews: 0,
  };
}

// При "знаю" — поднять на коробку выше (макс 5)
// При "не знаю" — откатить в коробку 1
export function migrateBox(current: LeitnerBox, knew: boolean): LeitnerBox {
  if (knew) {
    return Math.min(current + 1, 5) as LeitnerBox;
  }
  return 1;
}

// Какой метод предложить для карточки в данной коробке.
// Используется в Phase 1.3+, пока заглушка.
export type LearnMethod = "read" | "multiple_choice" | "cloze" | "match" | "free_answer" | "extended";

export function suggestMethod(box: LeitnerBox): LearnMethod {
  switch (box) {
    case 1: return "read";
    case 2: return "multiple_choice";
    case 3: return "cloze";
    case 4: return "free_answer";
    case 5: return "extended";
    default: return "read";
  }
}
```

---

## Шаг 4. Подсчёт прогресса (`src/lib/progressMath.ts`)

```typescript
import type { Billet } from "../types/billets";
import type { BilletProgress, CardProgress } from "../types/progress";
import { getAllCardIds } from "./billetsLoader";
import { createInitialProgress } from "./leitner";

// % освоения билета: средняя коробка / 5 * 100
// Карточки без прогресса считаются за коробку 1
export function calculateBilletProgress(billet: Billet, progress: BilletProgress | undefined): number {
  const cardIds = getAllCardIds(billet);
  if (cardIds.length === 0) return 0;

  let totalBox = 0;
  for (const cardId of cardIds) {
    const cardProgress = progress?.cards[cardId];
    totalBox += cardProgress ? cardProgress.box : 1;
  }
  const avgBox = totalBox / cardIds.length;
  return Math.round((avgBox / 5) * 100);
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

// Билет считается "выучен", если 100% (все карточки в коробке 5)
// + oralRecallDone === true (устный пересказ пройден)
export function isBilletLearned(billet: Billet, progress: BilletProgress | undefined): boolean {
  if (!progress) return false;
  const percent = calculateBilletProgress(billet, progress);
  return percent === 100 && progress.oralRecallDone;
}
```

---

## Шаг 5. Сторы Zustand

### `progressStore.ts` (главный, с persist)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BilletProgress, CardProgress, LeitnerBox } from "../types/progress";
import { createInitialProgress, migrateBox } from "../lib/leitner";

interface ProgressState {
  // ключ — billetId
  billets: Record<number, BilletProgress>;

  // Записать результат повторения карточки
  reviewCard: (billetId: number, cardId: string, knew: boolean) => void;

  // Получить прогресс карточки (создаёт начальный, если нет)
  getCardProgress: (billetId: number, cardId: string) => CardProgress;

  // Получить прогресс билета
  getBilletProgress: (billetId: number) => BilletProgress | undefined;

  // Отметить устный пересказ билета
  markOralRecall: (billetId: number, done: boolean) => void;

  // Отметить решение задачи билета
  markProblemSolved: (billetId: number, solved: boolean) => void;

  // Полный сброс прогресса (для дебага)
  resetAll: () => void;

  // Экспорт прогресса для скачивания
  exportProgress: () => string;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      billets: {},

      reviewCard: (billetId, cardId, knew) => {
        set((state) => {
          const billet = state.billets[billetId] ?? {
            billetId,
            cards: {},
            oralRecallDone: false,
            problemSolved: false,
          };
          const card = billet.cards[cardId] ?? createInitialProgress(cardId);
          const newBox = migrateBox(card.box, knew);
          const updated: CardProgress = {
            ...card,
            box: newBox,
            lastReviewed: Date.now(),
            totalReviews: card.totalReviews + 1,
            correctReviews: card.correctReviews + (knew ? 1 : 0),
          };
          return {
            billets: {
              ...state.billets,
              [billetId]: {
                ...billet,
                cards: { ...billet.cards, [cardId]: updated },
              },
            },
          };
        });
      },

      getCardProgress: (billetId, cardId) => {
        const billet = get().billets[billetId];
        return billet?.cards[cardId] ?? createInitialProgress(cardId);
      },

      getBilletProgress: (billetId) => get().billets[billetId],

      markOralRecall: (billetId, done) => {
        set((state) => {
          const billet = state.billets[billetId] ?? {
            billetId,
            cards: {},
            oralRecallDone: false,
            problemSolved: false,
          };
          return {
            billets: {
              ...state.billets,
              [billetId]: { ...billet, oralRecallDone: done },
            },
          };
        });
      },

      markProblemSolved: (billetId, solved) => {
        set((state) => {
          const billet = state.billets[billetId] ?? {
            billetId,
            cards: {},
            oralRecallDone: false,
            problemSolved: false,
          };
          return {
            billets: {
              ...state.billets,
              [billetId]: { ...billet, problemSolved: solved },
            },
          };
        });
      },

      resetAll: () => set({ billets: {} }),

      exportProgress: () => {
        const state = get();
        return JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            version: 1,
            billets: state.billets,
          },
          null,
          2
        );
      },
    }),
    {
      name: "physics-progress-v1",
      version: 1,
    }
  )
);
```

### `errorsStore.ts` (заготовка)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ErrorEntry {
  id: string;
  billetId: number;
  cardId: string | null;
  problemId: string | null;
  what: string;          // что было неверно
  myFix: string;         // поле "моя проработка" (заполняется пользователем)
  createdAt: number;
}

interface ErrorsState {
  entries: ErrorEntry[];
  addError: (e: Omit<ErrorEntry, "id" | "createdAt">) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set) => ({
      entries: [],
      addError: (e) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...e, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      updateMyFix: (id, myFix) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, myFix } : entry
          ),
        })),
      removeError: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
    }),
    { name: "physics-errors-v1" }
  )
);
```

### `statsStore.ts` (заготовка)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StatsState {
  totalCardsReviewed: number;
  totalSessionsStarted: number;
  incrementCardsReviewed: () => void;
  incrementSessions: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalCardsReviewed: 0,
      totalSessionsStarted: 0,
      incrementCardsReviewed: () =>
        set((s) => ({ totalCardsReviewed: s.totalCardsReviewed + 1 })),
      incrementSessions: () =>
        set((s) => ({ totalSessionsStarted: s.totalSessionsStarted + 1 })),
    }),
    { name: "physics-stats-v1" }
  )
);
```

### `settingsStore.ts` (заготовка)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  groqApiKey: string;          // для Phase 3.1
  preferredFontSize: "sm" | "base" | "lg";
  setGroqApiKey: (key: string) => void;
  setFontSize: (s: "sm" | "base" | "lg") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      groqApiKey: "",
      preferredFontSize: "base",
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setFontSize: (s) => set({ preferredFontSize: s }),
    }),
    { name: "physics-settings-v1" }
  )
);
```

### `index.ts`

```typescript
export { useProgressStore } from "./progressStore";
export { useErrorsStore } from "./errorsStore";
export { useStatsStore } from "./statsStore";
export { useSettingsStore } from "./settingsStore";
```

---

## Шаг 6. Компоненты UI

### `ProgressBar.tsx`

Переиспользуемая горизонтальная шкала. Принимает:
- `percent: number` (0-100)
- `colorClass?: string` (если не передан — используй `progressColor(percent)`)
- `height?: "sm" | "md" | "lg"` (по умолчанию "md")
- `showLabel?: boolean` (показывать ли "73%" внутри/рядом)

Делай через Tailwind: `<div class="w-full bg-slate-700 rounded-full"><div class="h-2 rounded-full {colorClass}" style="width: {percent}%"></div></div>`. Анимация ширины — `transition-all duration-300`.

### `BilletTile.tsx`

Плитка одного билета на дашборде. Показывает:
- Номер билета крупно (например "01" большим шрифтом)
- Заголовок билета (`billet.title`) — мелким, в 1-2 строки, обрезается через `line-clamp-2`
- Прогресс-бар снизу
- Процент справа от прогресс-бара
- Если есть дубликаты — маленький значок "🔗 N" в углу (где N — количество дубликатов)
- Если `isBilletLearned` — зелёная галочка ✓ в углу
- При клике — `onClick(billetId)` (просто колбек, навигация в Phase 1.3+)
- Стили: тёмная карточка `bg-slate-800`, hover `hover:bg-slate-700`, border при фокусе, скруглённые углы, тень

Размеры: на мобильном — 2 колонки (по 50% ширины), на десктопе — 4 колонки. Используй grid: `grid grid-cols-2 md:grid-cols-4 gap-3`.

### `Header.tsx`

Шапка приложения. В ней:
- Слева: название "Physics Trainer" мелко
- По центру: общий прогресс ("Готовность: 47%" + тонкая шкала)
- Справа: кнопка ⤓ "Экспорт"

Кнопка экспорта по клику:
1. Берёт `useProgressStore.getState().exportProgress()`
2. Создаёт `Blob([str], { type: "application/json" })`
3. Делает временную ссылку через `URL.createObjectURL`, кликает её, удаляет
4. Имя файла: `physics-progress-YYYY-MM-DD.json` (через `new Date().toISOString().slice(0,10)`)

Sticky сверху: `sticky top-0 z-10 bg-slate-900 border-b border-slate-700`.

### `Dashboard.tsx`

Главный экран:
- Header сверху (sticky)
- Сетка из 20 `BilletTile` (2 кол на мобиле, 4 на десктопе)
- Подвал с маленькой подсказкой "Тапни билет, чтобы начать" (пока ничего не делает)

Загружает билеты через `getAllBillets()` и для каждого — прогресс через `useProgressStore`.

Отступы: `p-4` снаружи, `gap-3` между плитками. Максимальная ширина контента — `max-w-4xl mx-auto`.

### `App.tsx`

Замени содержимое со страницы "Physics Billet Trainer работает" на:

```tsx
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Dashboard />
    </div>
  );
}

export default App;
```

---

## Дизайн (важно!)

- **Тёмная тема, без вариантов**. Цвета: фон `bg-slate-900`, плитки `bg-slate-800`, текст `text-slate-100`, акцент — никакого, только цветные шкалы прогресса.
- **Mobile-first**. Всё проверяй мысленно с шириной 375px (iPhone SE).
- **Никаких градиентов, теней, glow-эффектов**. Лаконично.
- **Шрифт системный** (по умолчанию Tailwind). Никаких подключений внешних шрифтов.
- **Плитки тапабельные** — минимум 60px по высоте, чтобы пальцем попасть.
- **Без иконок-картинок**. Только Unicode-символы (✓ ⤓ 🔗) — они не требуют установки иконочных библиотек.

---

## Чего НЕ делать

- ❌ Не подключай React Router. Пока всё на одной странице (Dashboard). Навигация на BilletPage будет в Phase 1.3.
- ❌ Не пиши тесты — времени нет.
- ❌ Не подключай UI-библиотеки (shadcn, Material UI, Radix). Только Tailwind + ручные компоненты.
- ❌ Не добавляй `react-icons` или `lucide-react`. Юникод символов хватит.
- ❌ Не реализуй уровни обучения, методы, страницу билета — это Phase 1.3+.
- ❌ Не трогай `billets.json` и картинки в `public/images/`.

---

## Финальная проверка перед отчётом

1. `npm run build` проходит без ошибок TypeScript.
2. `npm run dev` запускает локальный сервер.
3. Открой `http://localhost:5173/physics/` — видишь Dashboard с 20 билетами.
4. Все прогресс-бары на 20% (потому что новых карточек нет, средняя коробка = 1, 1/5 = 20%).
5. Общий прогресс в шапке тоже 20%.
6. Кнопка "Экспорт" скачивает `physics-progress-YYYY-MM-DD.json` (даже если прогресса нет — пустой объект ок).
7. **В DevTools → Application → Local Storage** проверь, что после клика по любой кнопке появляется ключ `physics-progress-v1` (это будет когда добавим действия в Phase 1.3, сейчас просто проверь что Zustand persist подключен).
8. Закоммить и запушь изменения в main — GitHub Actions задеплоит на gh-pages.

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

После завершения создай файл `PHASE-1-REPORT.md` в корне проекта. Шаблон:

```markdown
# Отчёт по Фазе 1.1 + 1.2

## Что сделано

- [список созданных и изменённых файлов]
- Например: `src/types/billets.ts` — создан, типы для Billet/Card/Problem
- Например: `src/store/progressStore.ts` — создан, Zustand с persist
- Например: `src/components/Dashboard.tsx` — создан, рендерит 20 плиток

## Установленные зависимости (если ставил новые)

- [например: ничего нового, всё было в Phase 0.1]
- Если ставил что-то — перечисли с версиями.

## Что работает (smoke-test)

- `npm run build`: ✅ / ❌ (если ❌ — какие ошибки)
- `npm run dev` запускается на http://localhost:5173/physics/: ✅ / ❌
- Dashboard рендерит 20 плиток: ✅ / ❌
- Прогресс-бары отображаются: ✅ / ❌
- Кнопка "Экспорт" скачивает JSON: ✅ / ❌
- В localStorage есть `physics-progress-v1` после первого взаимодействия: ✅ / ❌ (если действий пока нет — пиши "пока нечем триггернуть, проверим в Phase 1.3")
- Деплой на gh-pages прошёл (зелёная галочка в GitHub Actions): ✅ / ❌

## Скриншот текстом (что увидел в DevTools)

После загрузки страницы:
- Сколько плиток отрендерено: 20
- Какой общий процент в шапке: X%
- Любые console.error / console.warn в консоли: [перечисли]

## Структура одного компонента (sanity check)

Распечатай ПОЛНОСТЬЮ исходник `src/components/BilletTile.tsx` в этом отчёте — для проверки качества кода.

```tsx
// ... код BilletTile.tsx целиком
```

## Возникшие проблемы и как обошёл

- [например: "TypeScript ругался на импорт JSON, добавил resolveJsonModule"]
- Если проблем не было — пиши "Проблем не возникло".

## Что нужно сделать пользователю руками

- [например: "Дождаться зелёной галочки в Actions, обновить страницу в браузере"]
- Если ничего — пиши "Ничего, всё готово."
```

После создания этого файла напиши в чат:
**"Фаза 1.1 + 1.2 завершена. Отчёт в PHASE-1-REPORT.md. Можно открывать дашборд."**

---

**Всё. Начинай.**
