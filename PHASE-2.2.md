# Фаза 2.2 — Журнал ошибок

## Контекст

В сторе `errorsStore.ts` уже есть заготовка (тип `ErrorEntry` + методы `addError`, `updateMyFix`, `removeError`). Сейчас её нужно **реально подключить**: автозапись ошибок из методов, страница просмотра, режим повтора из журнала.

## Что строим

### Файлы

```
src/
  components/
    ErrorJournalPage.tsx      ← НОВЫЙ: страница списка ошибок
    ErrorEntryCard.tsx        ← НОВЫЙ: одна запись с полем "моя проработка"
    Header.tsx                ← ОБНОВИТЬ: добавить кнопку "📓 Ошибки" с бейджем
  router/
    AppRouter.tsx             ← ОБНОВИТЬ: маршрут #/errors
  lib/
    routing.ts                ← ОБНОВИТЬ: kind "errors" в Route
  store/
    errorsStore.ts            ← ОБНОВИТЬ: добавить хелперы getByBillet, replayQueue
  components/methods/
    ReadMethod.tsx            ← ОБНОВИТЬ: при "Не знаю" → addError
    MultipleChoiceMethod.tsx  ← ОБНОВИТЬ: при "Не знал" → addError
    ClozeMethod.tsx           ← ОБНОВИТЬ: при "Не знал" → addError
    MatchMethod.tsx           ← ОБНОВИТЬ: при "Не знал" → addError
    FreeAnswerMethod.tsx      ← ОБНОВИТЬ: при "Не справился" → addError
  components/
    ProblemMode.tsx           ← ОБНОВИТЬ: при "Не справился" → addError (с problemId)
```

---

## Шаг 1. Расширить errorsStore

### `src/store/errorsStore.ts`

Текущий стор уже есть с методами `addError`, `updateMyFix`, `removeError`. Добавь:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ErrorEntry {
  id: string;
  billetId: number;
  cardId: string | null;       // null если ошибка по задаче
  problemId: string | null;    // null если ошибка по карточке
  what: string;                // топик карточки или название задачи
  myFix: string;               // заполняется пользователем
  createdAt: number;
  updatedAt: number;
}

interface ErrorsState {
  entries: ErrorEntry[];
  addError: (e: Omit<ErrorEntry, "id" | "createdAt" | "updatedAt" | "myFix">) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;
  removeByCardId: (billetId: number, cardId: string) => void;     // для дедупликации
  removeByProblemId: (billetId: number, problemId: string) => void;
  countByBillet: (billetId: number) => number;
  countTotal: () => number;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set, get) => ({
      entries: [],

      addError: (e) => {
        // Дедупликация: если эта же карточка/задача уже в журнале — обновляем updatedAt
        set((state) => {
          const dupIndex = state.entries.findIndex((entry) => {
            if (entry.billetId !== e.billetId) return false;
            if (e.cardId && entry.cardId === e.cardId) return true;
            if (e.problemId && entry.problemId === e.problemId) return true;
            return false;
          });
          if (dupIndex >= 0) {
            const updated = [...state.entries];
            updated[dupIndex] = { ...updated[dupIndex], updatedAt: Date.now() };
            return { entries: updated };
          }
          const newEntry: ErrorEntry = {
            ...e,
            id: crypto.randomUUID(),
            myFix: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return { entries: [newEntry, ...state.entries] };
        });
      },

      updateMyFix: (id, myFix) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, myFix, updatedAt: Date.now() } : e
          ),
        }));
      },

      removeError: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
      },

      removeByCardId: (billetId, cardId) => {
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.billetId === billetId && e.cardId === cardId)
          ),
        }));
      },

      removeByProblemId: (billetId, problemId) => {
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.billetId === billetId && e.problemId === problemId)
          ),
        }));
      },

      countByBillet: (billetId) => {
        return get().entries.filter((e) => e.billetId === billetId).length;
      },

      countTotal: () => get().entries.length,
    }),
    { name: "physics-errors-v1", version: 1 }
  )
);
```

---

## Шаг 2. Подключить автозапись в методах

В каждом методе при "Не знал/Не справился" — звать `addError`. **При "Знал" — звать `removeByCardId`** (чтобы старые ошибки очищались, когда ты переучил карточку).

### Пример для `ReadMethod.tsx`

Найди `handle`:

```typescript
const handle = (knew: boolean) => {
  reviewCard(billetId, card.id, knew);
  // ...
};
```

Замени на:

```typescript
import { useErrorsStore } from "../../store/errorsStore";

// внутри компонента
const addError = useErrorsStore((s) => s.addError);
const removeByCardId = useErrorsStore((s) => s.removeByCardId);

const handle = (knew: boolean) => {
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
  if (onResult) onResult(knew);
  else onClose();
};
```

**То же самое сделай в:**
- `MultipleChoiceMethod.tsx` (в функции `handle(knew)`)
- `ClozeMethod.tsx` (в функции `finalize(knew)`)
- `MatchMethod.tsx` (в функции `finalize(knew)`)
- `FreeAnswerMethod.tsx` (в функции `finalize(knew)`)

### Для `ProblemMode.tsx`

Аналогично, но через `problemId` вместо `cardId`:

```typescript
const addError = useErrorsStore((s) => s.addError);
const removeByProblemId = useErrorsStore((s) => s.removeByProblemId);

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
```

---

## Шаг 3. Маршрут /errors

### `src/lib/routing.ts`

```typescript
export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number }
  | { kind: "practice" }
  | { kind: "errors" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
  if (hash === "#/errors") return { kind: "errors" };
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
  else window.location.hash = `#/billet/${route.billetId}`;
}
```

### `src/router/AppRouter.tsx`

Добавь в условия:

```typescript
import ErrorJournalPage from "../components/ErrorJournalPage";

// ...
if (route.kind === "errors") return <ErrorJournalPage />;
if (route.kind === "practice") return <PracticeMode />;
if (route.kind === "billet") return <BilletPage billetId={route.billetId} />;
return <Dashboard />;
```

---

## Шаг 4. Кнопка "📓 Ошибки" в шапке

### `src/components/Header.tsx`

Добавь между кнопкой Тренировка и кнопкой Экспорт:

```tsx
import { useErrorsStore } from "../store/errorsStore";

// внутри компонента
const errorsCount = useErrorsStore((s) => s.entries.length);

// в JSX:
<button
  onClick={() => navigateTo({ kind: "errors" })}
  className="relative text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
  title="Журнал ошибок"
>
  <span className="hidden sm:inline">📓 Ошибки</span>
  <span className="sm:hidden">📓</span>
  {errorsCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {errorsCount > 99 ? "99+" : errorsCount}
    </span>
  )}
</button>
```

Бейдж с числом только если ошибок > 0.

---

## Шаг 5. Карточка ошибки `ErrorEntryCard.tsx`

```tsx
import { useState, useEffect } from "react";
import type { ErrorEntry } from "../store/errorsStore";
import { useErrorsStore } from "../store/errorsStore";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";

interface Props {
  entry: ErrorEntry;
}

export default function ErrorEntryCard({ entry }: Props) {
  const updateMyFix = useErrorsStore((s) => s.updateMyFix);
  const removeError = useErrorsStore((s) => s.removeError);
  const [myFix, setMyFix] = useState(entry.myFix);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setMyFix(entry.myFix);
  }, [entry.id, entry.myFix]);

  const billet = getBilletById(entry.billetId);
  const billetTitle = billet?.title ?? `Билет ${entry.billetId}`;

  // Дебаунс сохранения myFix: 600мс после последнего ввода
  useEffect(() => {
    if (myFix === entry.myFix) return;
    const t = setTimeout(() => {
      updateMyFix(entry.id, myFix);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }, 600);
    return () => clearTimeout(t);
  }, [myFix, entry.myFix, entry.id, updateMyFix]);

  const date = new Date(entry.updatedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigateTo({ kind: "billet", billetId: entry.billetId })}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Билет {String(entry.billetId).padStart(2, "0")} · {billetTitle}
          </button>
          <div className="text-sm font-medium text-slate-100 mt-0.5">
            {entry.problemId ? "📐 " : ""}{entry.what}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-[10px] text-slate-500 tabular-nums">{date}</div>
          <button
            onClick={() => {
              if (confirm("Удалить эту ошибку из журнала?")) removeError(entry.id);
            }}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            title="Удалить — например, если уже переучил"
          >
            ✕
          </button>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-500 uppercase tracking-wider">
          Моя проработка
        </label>
        <textarea
          value={myFix}
          onChange={(e) => setMyFix(e.target.value)}
          rows={2}
          placeholder="Как не повторить? Формула, мнемоника, якорь..."
          className="mt-1 w-full p-2 bg-slate-900 rounded text-sm text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-slate-600 placeholder-slate-600"
        />
        <div className="text-[10px] text-slate-600 mt-1 h-3">
          {savedFlash && "✓ сохранено"}
        </div>
      </div>
    </div>
  );
}
```

---

## Шаг 6. Страница журнала `ErrorJournalPage.tsx`

```tsx
import { useMemo, useState } from "react";
import { useErrorsStore } from "../store/errorsStore";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";
import ErrorEntryCard from "./ErrorEntryCard";
import BackButton from "./BackButton";

export default function ErrorJournalPage() {
  const entries = useErrorsStore((s) => s.entries);
  const [filterBilletId, setFilterBilletId] = useState<number | "all">("all");

  // Уникальные билеты, по которым есть ошибки
  const billetIds = useMemo(() => {
    const set = new Set(entries.map((e) => e.billetId));
    return Array.from(set).sort((a, b) => a - b);
  }, [entries]);

  const filtered = useMemo(() => {
    if (filterBilletId === "all") return entries;
    return entries.filter((e) => e.billetId === filterBilletId);
  }, [entries, filterBilletId]);

  // Группировка по билетам для отображения
  const grouped = useMemo(() => {
    const map = new Map<number, typeof entries>();
    for (const e of filtered) {
      const arr = map.get(e.billetId) ?? [];
      arr.push(e);
      map.set(e.billetId, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filtered]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigateTo({ kind: "dashboard" })} />
        <div className="text-sm text-slate-400">{entries.length} в журнале</div>
      </div>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">📓 Журнал ошибок</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Сюда автоматически попадает всё, на что ты ответил «не знаю». Под
          каждой запись — поле «как не повторить»: впиши формулу, мнемонику или
          фразу-якорь. Когда переучишь — запись очистится сама (после первого
          «знаю» по этой карточке) или удали кнопкой ✕.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-sm text-slate-300">Журнал пуст.</div>
          <div className="text-xs text-slate-500 mt-1">
            Учись через билеты или Тренировку — ошибки запишутся сюда автоматически.
          </div>
        </div>
      ) : (
        <>
          {/* Фильтр по билетам */}
          {billetIds.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterBilletId("all")}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filterBilletId === "all"
                    ? "bg-slate-200 text-slate-900"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                Все ({entries.length})
              </button>
              {billetIds.map((bid) => {
                const billet = getBilletById(bid);
                const count = entries.filter((e) => e.billetId === bid).length;
                return (
                  <button
                    key={bid}
                    onClick={() => setFilterBilletId(bid)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      filterBilletId === bid
                        ? "bg-slate-200 text-slate-900"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                    title={billet?.title}
                  >
                    Б{String(bid).padStart(2, "0")} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Сгруппированные ошибки */}
          <div className="space-y-4">
            {grouped.map(([billetId, items]) => {
              const billet = getBilletById(billetId);
              return (
                <section key={billetId} className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-slate-500 px-1">
                    Билет {String(billetId).padStart(2, "0")} · {billet?.title}
                  </div>
                  <div className="space-y-2">
                    {items.map((e) => (
                      <ErrorEntryCard key={e.id} entry={e} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Шаг 7. Бейдж количества ошибок на плитке билета

Маленькая правка в `BilletTile.tsx` — показать рядом со значком 🔗 ещё значок ⚠️ N для ошибок (если их > 0).

В `BilletTile.tsx` добавь:

```tsx
import { useErrorsStore } from "../store/errorsStore";

// внутри компонента
const errorsCount = useErrorsStore((s) => s.countByBillet(billet.id));

// в блоке с правым верхним углом (рядом с dupCount):
{errorsCount > 0 && (
  <span title={`Ошибок: ${errorsCount}`} className="tabular-nums text-orange-400">
    ⚠️ {errorsCount}
  </span>
)}
```

Чтобы оба индикатора (🔗 N и ⚠️ N) умещались — раздели их через `space-x-1`. Если на узких экранах не помещаются — оставь только ⚠️ (более важный для финальной подготовки).

---

## Финальная проверка

1. `npm run build` чистый.
2. Дашборд → открой билет 1 → пройди 3 карточки и сделай "Не знаю" / "Не знал" в каждой.
3. В шапке должна появиться красная цифра "3" над 📓.
4. На плитке билета 1 на дашборде — `⚠️ 3`.
5. Тапни 📓 Ошибки — увидишь страницу с тремя записями, сгруппированными под билетом 1.
6. Введи в одну из них "формула X = Y/R" в поле проработки — через ~600мс появится "✓ сохранено".
7. Перезагрузи страницу — заметка осталась (persist работает).
8. Открой ту же карточку через метод и нажми "Знаю" — ошибка из журнала исчезнет автоматически.
9. На задаче — нажми "Не справился" → в журнале появится запись с 📐.
10. Бейдж в шапке обновляется на лету.

---

## Чего НЕ делать

- ❌ Не реализуй "режим повтора из журнала" с отдельной очередью — для этого уже есть Тренировка с режимом "Только слабые" (карточки в коробках 1-2 = это и есть твои недавние ошибки).
- ❌ Не добавляй экспорт журнала отдельно — он уже включён в общий экспорт прогресса (если стор привязан к localStorage). Если нужно отдельно — это заботит позже.
- ❌ Не трогай billets.json, картинки, базовую логику Leitner.

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

Создай `PHASE-2.2-REPORT.md`. Шаблон:

```markdown
# Отчёт по Фазе 2.2

## Что сделано

[список новых и изменённых файлов]

## Установленные зависимости

[если ставил — перечисли. Если нет — "ничего нового"]

## Smoke-test

- `npm run build`: ✅ / ❌
- При "Не знаю" в ReadMethod ошибка добавляется в стор: ✅ / ❌
- При "Не знал" в MultipleChoice/Cloze/Match/FreeAnswer ошибка добавляется: ✅ / ❌
- При "Не справился" в ProblemMode ошибка добавляется (с problemId): ✅ / ❌
- При "Знаю" по той же карточке ошибка удаляется автоматически: ✅ / ❌
- Дедупликация: повторное "Не знаю" по той же карточке не плодит новые записи, а обновляет updatedAt: ✅ / ❌
- Бейдж в шапке показывает количество ошибок: ✅ / ❌
- Страница /errors открывается, ошибки сгруппированы по билетам: ✅ / ❌
- Поле "Моя проработка" сохраняется с дебаунсом 600мс и сохраняется после reload: ✅ / ❌
- Кнопка ✕ удаляет одну запись с подтверждением: ✅ / ❌
- Бейдж ⚠️ N на плитке билета на дашборде: ✅ / ❌
- Пустое состояние "🎉 Журнал пуст" если нет ошибок: ✅ / ❌

## Структура одного компонента (sanity check)

Распечатай ПОЛНОСТЬЮ исходник `src/components/ErrorJournalPage.tsx`.

## Возникшие проблемы и как обошёл

## Что нужно сделать пользователю руками
```

После создания отчёта напиши:
**"Фаза 2.2 завершена. Журнал ошибок готов."**

---

**Всё. Начинай.**
