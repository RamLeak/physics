# FIX: Журнал — переход к карточке/задаче из ошибки

## Проблема

В журнале записаны ошибки ("Материальная точка", "Шайба на наклонной плоскости" и т.д.), но **нельзя одним тапом попасть к этой карточке/задаче** и прорешать заново. Пользователь должен закрыть журнал → найти билет на дашборде → найти нужную карточку среди десятков других.

## Решение

На каждой записи в журнале добавить кнопку **"→ Открыть"** или **"→ Прорешать"**, которая:
- Для **карточки** — переходит на страницу билета и автоматически скроллит к этой карточке + подсвечивает её на 2 секунды
- Для **задачи** — переходит на страницу билета и сразу открывает режим решения задачи
- Для **экзамена** (cardId=null, problemId=null) — переходит на страницу билета (на shop)

## Шаг 1. Расширить роутинг

### `src/lib/routing.ts`

Добавить поддержку query-параметров для маршрута билета. Например `#/billet/1?card=1.1.3` или `#/billet/1?problem=1`.

```typescript
export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number; focusCardId?: string; openProblem?: boolean }
  | { kind: "practice" }
  | { kind: "errors" }
  | { kind: "exam" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
  if (hash === "#/errors") return { kind: "errors" };
  if (hash === "#/exam") return { kind: "exam" };

  // Разделяем path и query: "#/billet/5?card=5.1.2" → path="#/billet/5", query="card=5.1.2"
  const qIdx = hash.indexOf("?");
  const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  const queryStr = qIdx >= 0 ? hash.slice(qIdx + 1) : "";

  const m = path.match(/^#\/billet\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (!Number.isNaN(id)) {
      const params = new URLSearchParams(queryStr);
      return {
        kind: "billet",
        billetId: id,
        focusCardId: params.get("card") ?? undefined,
        openProblem: params.get("problem") === "1",
      };
    }
  }

  return { kind: "dashboard" };
}

export function navigateTo(route: Route): void {
  if (route.kind === "dashboard") window.location.hash = "#/";
  else if (route.kind === "practice") window.location.hash = "#/practice";
  else if (route.kind === "errors") window.location.hash = "#/errors";
  else if (route.kind === "exam") window.location.hash = "#/exam";
  else {
    // billet route
    let url = `#/billet/${route.billetId}`;
    const params: string[] = [];
    if (route.focusCardId) params.push(`card=${encodeURIComponent(route.focusCardId)}`);
    if (route.openProblem) params.push("problem=1");
    if (params.length > 0) url += "?" + params.join("&");
    window.location.hash = url;
  }
}
```

## Шаг 2. На странице билета — обработка `focusCardId` и `openProblem`

### `src/components/BilletPage.tsx`

Принять новые пропы:

```typescript
interface Props {
  billetId: number;
  focusCardId?: string;
  openProblem?: boolean;
}

export default function BilletPage({ billetId, focusCardId, openProblem }: Props) {
  // ...существующий код
}
```

После рендера билета — два эффекта:

```typescript
// Автооткрытие задачи, если запрошено
useEffect(() => {
  if (openProblem && billet) {
    setActive({ kind: "problem" });
  }
}, [openProblem, billet]);

// Скролл и подсветка карточки, если запрошена
useEffect(() => {
  if (!focusCardId || !billet) return;
  // Дать React время отрендерить список карточек
  const timer = setTimeout(() => {
    const el = document.getElementById(`card-${focusCardId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-yellow-400", "animate-pulse");
      setTimeout(() => {
        el.classList.remove("animate-pulse");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-yellow-400");
        }, 800);
      }, 1500);
    }
  }, 100);
  return () => clearTimeout(timer);
}, [focusCardId, billet]);
```

### `src/components/CardListItem.tsx`

Дать каждой карточке `id`:

```tsx
return (
  <div id={`card-${card.id}`} className="bg-slate-800 rounded-lg p-3 transition-all">
    {/* ...существующий код */}
  </div>
);
```

### `src/router/AppRouter.tsx`

Передать новые пропы:

```tsx
if (route.kind === "billet") {
  return (
    <BilletPage
      billetId={route.billetId}
      focusCardId={route.focusCardId}
      openProblem={route.openProblem}
    />
  );
}
```

## Шаг 3. Кнопки в журнале

### `src/components/ErrorEntryCard.tsx`

В блоке с правым верхним углом (где сейчас ✕ и дата) — добавить кнопку **"→ Открыть"**. Полная замена этого блока:

```tsx
import { navigateTo } from "../lib/routing";

// внутри компонента:
const handleOpen = () => {
  if (entry.cardId) {
    // Карточка → переход на билет с фокусом на карточке
    navigateTo({
      kind: "billet",
      billetId: entry.billetId,
      focusCardId: entry.cardId,
    });
  } else if (entry.problemId) {
    // Задача → переход на билет и автооткрытие задачи
    navigateTo({
      kind: "billet",
      billetId: entry.billetId,
      openProblem: true,
    });
  } else {
    // Экзамен (cardId=null, problemId=null) → просто на билет
    navigateTo({
      kind: "billet",
      billetId: entry.billetId,
    });
  }
};

// В правом верхнем блоке:
<div className="flex flex-col items-end gap-1 shrink-0">
  <div className="text-[10px] text-slate-500 tabular-nums">{date}</div>
  <div className="flex items-center gap-2">
    <button
      onClick={handleOpen}
      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
      title={
        entry.cardId
          ? "Открыть карточку и прорешать"
          : entry.problemId
          ? "Открыть задачу"
          : "Открыть билет"
      }
    >
      → Открыть
    </button>
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
```

## Шаг 4. Проверка

1. `npm run build` чистый.
2. Открой билет 1 → пройди карточку 1.1.3 ("Материальная точка") через "Чтение" → "Не знаю".
3. Зайди в **📓 Ошибки** → увидишь запись с топиком "Материальная точка" и кнопкой **→ Открыть**.
4. Тапни **→ Открыть**:
   - Должен произойти переход на `#/billet/1?card=1.1.3`
   - Страница билета прокрутится до карточки "Материальная точка"
   - Карточка подсветится жёлтой рамкой на 2 секунды (с пульсацией)
5. Прорешай её через любой метод и нажми "Знаю" → ошибка автоматически уйдёт из журнала (это уже работает с Phase 2.2).
6. Проверь задачу: на любом билете → "Задача" → "Не справился" → в журнале запись с 📐 → **→ Открыть** → должна сразу открыться задача в режиме решения.

## Шаг 5. Коммит и пуш

```bash
git add -A
git commit -m "Fix: журнал — кнопки перехода к карточке/задаче с подсветкой"
git push origin main
```

После пуша напиши:
**"Fix журнала готов."**

(Отчёт делать не надо.)
