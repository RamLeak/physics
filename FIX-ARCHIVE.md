# FIX: Архив переученных ошибок + повтор перед экзаменом

## Что меняется

Сейчас при "Знаю/Сказал правильно" по ошибке — она просто удаляется из журнала. Это потеря ценнейших данных: эти карточки — то, в чём ты раз ошибся → значит, потенциальное слабое место.

Решение:
- **Активный журнал** — текущие непроработанные ошибки (как сейчас)
- **Архив** — карточки, которые ты переучил. Не удаляются, ждут повторения
- **Триггер 13 мая 2026** — за день до экзамена на дашборде появляется баннер "Повтори X архивных ошибок"
- **Возврат из архива:** если карточка из архива снова попала в "не знаю" → она вернётся в активный журнал

## Шаг 1. Расширить `errorsStore.ts`

### Полная замена `src/store/errorsStore.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ErrorEntry {
  id: string;
  billetId: number;
  cardId: string | null;
  problemId: string | null;
  what: string;
  myFix: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;  // когда переехала в архив
}

interface ErrorsState {
  entries: ErrorEntry[];           // активные ошибки
  archived: ErrorEntry[];          // переученные, ждут повтора

  addError: (e: Omit<ErrorEntry, "id" | "createdAt" | "updatedAt" | "myFix" | "archivedAt">) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;        // полное удаление из активного (✕)
  removeFromArchive: (id: string) => void;  // полное удаление из архива

  // При "Знаю" в карточке → переносим в архив
  archiveByCardId: (billetId: number, cardId: string) => void;
  archiveByProblemId: (billetId: number, problemId: string) => void;

  // Старые имена оставляем как aliases для обратной совместимости вызовов
  removeByCardId: (billetId: number, cardId: string) => void;
  removeByProblemId: (billetId: number, problemId: string) => void;

  countByBillet: (billetId: number) => number;
  countTotal: () => number;
  countArchived: () => number;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set, get) => ({
      entries: [],
      archived: [],

      addError: (e) => {
        set((state) => {
          // Если карточка/задача уже в архиве — достаём её обратно (значит, опять ошибся)
          const archivedIdx = state.archived.findIndex((entry) => {
            if (entry.billetId !== e.billetId) return false;
            if (e.cardId && entry.cardId === e.cardId) return true;
            if (e.problemId && entry.problemId === e.problemId) return true;
            return false;
          });

          if (archivedIdx >= 0) {
            const restored = state.archived[archivedIdx];
            const newArchived = [...state.archived];
            newArchived.splice(archivedIdx, 1);
            const reActivated: ErrorEntry = {
              ...restored,
              archivedAt: undefined,
              updatedAt: Date.now(),
            };
            return {
              archived: newArchived,
              entries: [reActivated, ...state.entries],
            };
          }

          // Стандартная дедупликация в активных
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
          archived: state.archived.map((e) =>
            e.id === id ? { ...e, myFix, updatedAt: Date.now() } : e
          ),
        }));
      },

      removeError: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
      },

      removeFromArchive: (id) => {
        set((state) => ({ archived: state.archived.filter((e) => e.id !== id) }));
      },

      archiveByCardId: (billetId, cardId) => {
        set((state) => {
          const toArchive = state.entries.filter(
            (e) => e.billetId === billetId && e.cardId === cardId
          );
          if (toArchive.length === 0) return state;
          const archivedNow = toArchive.map((e) => ({ ...e, archivedAt: Date.now() }));
          return {
            entries: state.entries.filter(
              (e) => !(e.billetId === billetId && e.cardId === cardId)
            ),
            archived: [...archivedNow, ...state.archived],
          };
        });
      },

      archiveByProblemId: (billetId, problemId) => {
        set((state) => {
          const toArchive = state.entries.filter(
            (e) => e.billetId === billetId && e.problemId === problemId
          );
          if (toArchive.length === 0) return state;
          const archivedNow = toArchive.map((e) => ({ ...e, archivedAt: Date.now() }));
          return {
            entries: state.entries.filter(
              (e) => !(e.billetId === billetId && e.problemId === problemId)
            ),
            archived: [...archivedNow, ...state.archived],
          };
        });
      },

      // ВАЖНО: эти алиасы теперь делают archive, а не remove (по требованию задачи)
      removeByCardId: (billetId, cardId) => get().archiveByCardId(billetId, cardId),
      removeByProblemId: (billetId, problemId) => get().archiveByProblemId(billetId, problemId),

      countByBillet: (billetId) =>
        get().entries.filter((e) => e.billetId === billetId).length,
      countTotal: () => get().entries.length,
      countArchived: () => get().archived.length,
    }),
    { name: "physics-errors-v1", version: 2 }
  )
);
```

**Ключевая логика** (повторяю чтобы не потерялось):
- `addError` теперь смотрит сначала в архив. Если там есть совпадение — **достаёт обратно в активный**, а не плодит дубль.
- `removeByCardId` и `removeByProblemId` (которые вызываются при "Знаю/Решил") теперь **архивируют, а не удаляют**.
- `removeError` (через ✕ в журнале) — реальное удаление навсегда.
- `removeFromArchive` — отдельная кнопка из архива (если понял, что эта карточка больше не нужна).

## Шаг 2. Дата экзамена и хелпер

### Создай `src/lib/examDate.ts`

```typescript
// Дата экзамена: 14 мая 2026, утро.
// Триггер для архивного повтора: 13 мая 2026 (за день до).
export const EXAM_DATE = new Date("2026-05-14T09:00:00");

// Сколько дней до экзамена. Отрицательное число — экзамен прошёл.
export function daysUntilExam(now: Date = new Date()): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examStart = new Date(EXAM_DATE.getFullYear(), EXAM_DATE.getMonth(), EXAM_DATE.getDate());
  const diff = examStart.getTime() - todayStart.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// Показывать ли баннер архивного повтора
export function shouldShowArchiveReminder(archivedCount: number, now: Date = new Date()): boolean {
  if (archivedCount === 0) return false;
  const days = daysUntilExam(now);
  // Триггер: ровно 1 день до экзамена (13 мая) или сам день экзамена
  return days === 1 || days === 0;
}
```

## Шаг 3. Страница журнала — вкладки "Активные / Архив"

### `src/components/ErrorJournalPage.tsx`

Замени основное содержимое на двухвкладочную структуру:

```tsx
import { useMemo, useState } from "react";
import { useErrorsStore } from "../store/errorsStore";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";
import ErrorEntryCard from "./ErrorEntryCard";
import BackButton from "./BackButton";

type Tab = "active" | "archive";

export default function ErrorJournalPage() {
  const entries = useErrorsStore((s) => s.entries);
  const archived = useErrorsStore((s) => s.archived);
  const [tab, setTab] = useState<Tab>("active");
  const [filterBilletId, setFilterBilletId] = useState<number | "all">("all");

  const data = tab === "active" ? entries : archived;

  const billetIds = useMemo(() => {
    const set = new Set(data.map((e) => e.billetId));
    return Array.from(set).sort((a, b) => a - b);
  }, [data]);

  const filtered = useMemo(() => {
    if (filterBilletId === "all") return data;
    return data.filter((e) => e.billetId === filterBilletId);
  }, [data, filterBilletId]);

  const grouped = useMemo(() => {
    const map = new Map<number, typeof data>();
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
      </div>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">📓 Журнал ошибок</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          В <strong>активных</strong> — текущие ошибки. Когда переучишь карточку (нажмёшь «Знаю» в любом методе), она переедет в <strong>архив</strong> — и вернётся напомнить о себе за день до экзамена. Если та же карточка снова попадёт в «не знаю» — вернётся обратно в активные.
        </p>
      </header>

      {/* Вкладки */}
      <div className="grid grid-cols-2 gap-1 bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => {
            setTab("active");
            setFilterBilletId("all");
          }}
          className={`text-sm py-2 rounded transition-colors ${
            tab === "active"
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Активные ({entries.length})
        </button>
        <button
          onClick={() => {
            setTab("archive");
            setFilterBilletId("all");
          }}
          className={`text-sm py-2 rounded transition-colors ${
            tab === "archive"
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Архив ({archived.length})
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">{tab === "active" ? "🎉" : "📦"}</div>
          <div className="text-sm text-slate-300">
            {tab === "active" ? "Активных ошибок нет." : "Архив пуст."}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {tab === "active"
              ? "Учись через билеты или Тренировку — ошибки запишутся сюда автоматически."
              : "Когда переучишь карточку, она переедет сюда. За день до экзамена — напомню."}
          </div>
        </div>
      ) : (
        <>
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
                Все ({data.length})
              </button>
              {billetIds.map((bid) => {
                const billet = getBilletById(bid);
                const count = data.filter((e) => e.billetId === bid).length;
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
                      <ErrorEntryCard key={e.id} entry={e} isArchived={tab === "archive"} />
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

## Шаг 4. Карточка ошибки — поддержка архивного режима

### `src/components/ErrorEntryCard.tsx`

Добавь проп `isArchived?: boolean`. Если true — кнопка ✕ зовёт `removeFromArchive`, не `removeError`. Также в архивном режиме показываем дату архивирования.

```tsx
interface Props {
  entry: ErrorEntry;
  isArchived?: boolean;
}

export default function ErrorEntryCard({ entry, isArchived = false }: Props) {
  const updateMyFix = useErrorsStore((s) => s.updateMyFix);
  const removeError = useErrorsStore((s) => s.removeError);
  const removeFromArchive = useErrorsStore((s) => s.removeFromArchive);
  // ... остальное как раньше

  const handleRemove = () => {
    if (isArchived) {
      if (confirm("Удалить из архива? Эта запись больше не появится перед экзаменом.")) {
        removeFromArchive(entry.id);
      }
    } else {
      if (confirm("Удалить эту ошибку?")) {
        removeError(entry.id);
      }
    }
  };

  // в JSX, рядом с датой:
  {isArchived && entry.archivedAt && (
    <div className="text-[10px] text-green-500 tabular-nums">
      ✓ переучено
    </div>
  )}
```

И при клике на ✕ — зовём `handleRemove`, а не напрямую `removeError`.

## Шаг 5. Баннер на дашборде

### `src/components/Dashboard.tsx`

В начало render-блока (сразу после Header) добавить условный баннер:

```tsx
import { useErrorsStore } from "../store/errorsStore";
import { shouldShowArchiveReminder, daysUntilExam } from "../lib/examDate";
import { navigateTo } from "../lib/routing";

// внутри Dashboard:
const archivedCount = useErrorsStore((s) => s.archived.length);
const showReminder = shouldShowArchiveReminder(archivedCount);
const days = daysUntilExam();

// перед сеткой плиток:
{showReminder && (
  <div className="bg-orange-900 border border-orange-700 rounded-lg p-4 mb-4 mx-4">
    <div className="flex items-start gap-3">
      <div className="text-2xl">🔔</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-orange-100">
          {days === 0 ? "Сегодня экзамен!" : "Завтра экзамен"}
        </div>
        <div className="text-xs text-orange-200 mt-1">
          У тебя {archivedCount} переученных карточек в архиве. Самое время освежить — это ровно те темы, на которых ты раньше ошибался.
        </div>
        <button
          onClick={() => navigateTo({ kind: "errors" })}
          className="mt-2 text-xs bg-orange-700 hover:bg-orange-600 px-3 py-1.5 rounded font-medium transition-colors"
        >
          Открыть архив →
        </button>
      </div>
    </div>
  </div>
)}
```

## Шаг 6. Миграция версии стора

Так как формат стора errors теперь имеет поле `archived`, я выставил `version: 2` в persist. Zustand при чтении старого ключа `physics-errors-v1` версии 1 не сольёт ничего опасного — просто инициализирует стейт по умолчанию. Старые ошибки потеряются, но это **не критично** — у пользователя их пока немного.

Если хочешь сохранить старые ошибки — добавь migrate-функцию:

```typescript
{
  name: "physics-errors-v1",
  version: 2,
  migrate: (persistedState: any, version: number) => {
    if (version === 1 && persistedState?.entries) {
      return { ...persistedState, archived: [] };
    }
    return persistedState;
  },
}
```

Это безопаснее — пользовательские заметки не потеряются.

## Шаг 7. Проверка

1. `npm run build` чистый.
2. Открой Билет 1 → пройди карточку 1.1.1 через "Чтение" → "Не знаю" → запись в **Активных**.
3. Открой ту же карточку через "Чтение" → "Знаю" → запись **переехала в Архив**.
4. На странице журнала — вкладка "Архив" → видишь карточку с пометкой "✓ переучено".
5. Снова пройди ту же карточку через "Чтение" → "Не знаю" → запись **вернулась в Активные** (не дубль!).
6. На дашборде сегодня (8 мая) баннера НЕТ — до экзамена 6 дней.
7. **Чтобы проверить баннер вручную** — в DevTools → Console:
   ```js
   // Имитация даты 13 мая
   ```
   Или просто временно поменяй в `examDate.ts` `EXAM_DATE` на завтрашнюю дату → перезагрузи → увидишь баннер на дашборде → верни обратно.

## Шаг 8. Коммит

```bash
git add -A
git commit -m "Архив переученных ошибок + триггер за день до экзамена"
git push origin main
```

После пуша напиши:
**"Fix архива готов."**
