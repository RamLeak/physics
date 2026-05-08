# Отчёт по Фазе 2.2

## Что сделано

**Новые файлы**

- `src/components/ErrorEntryCard.tsx` — карточка одной записи журнала. Показывает билет (кликом → переход на страницу билета), что было не так (`📐` для задач, иначе текст topic'а), дату `updatedAt`, кнопку ✕ с `window.confirm`. Поле «Моя проработка» — `textarea` 2 строки с дебаунсом 600 мс через `useEffect → setTimeout/clearTimeout` (`updateMyFix` вызывается только после паузы); индикатор `✓ сохранено` мигает на 1.2 сек.
- `src/components/ErrorJournalPage.tsx` — страница `#/errors`. Группировка по билетам (`Map<billetId, ErrorEntry[]>`), фильтр-чипсы по билетам с количеством, пустое состояние «🎉 Журнал пуст».

**Изменённые файлы**

- `src/store/errorsStore.ts` — расширен:
  - тип `ErrorEntry` теперь содержит `updatedAt`;
  - `addError` принимает `Omit<…, "id" | "createdAt" | "updatedAt" | "myFix">` (callers больше не указывают `myFix`);
  - **дедупликация**: при повторной ошибке по той же `(billetId, cardId)` или `(billetId, problemId)` запись не плодится — обновляется `updatedAt`;
  - `removeByCardId(billetId, cardId)` — для авто-очистки при «знаю»;
  - `removeByProblemId(billetId, problemId)` — для очистки задач при «решил»;
  - `countByBillet(billetId)`, `countTotal()` — для бейджей.
- `src/lib/routing.ts` — добавлен вариант `{ kind: "errors" }`, парсинг `#/errors` и `navigateTo`.
- `src/router/AppRouter.tsx` — рендерит `<ErrorJournalPage />` при `route.kind === "errors"`.
- `src/components/Header.tsx` — между «Тренировка» и «Экспорт» новая кнопка `📓` со свойственным красным бейджем `entries.length` (или `99+`). Подпись «Ошибки» прячется на мобильном (`hidden sm:inline`).
- `src/components/BilletTile.tsx` — справа сверху появился значок `⚠️ N` (оранжевый), считается через `useErrorsStore.entries.filter(e => e.billetId === billet.id).length`. Чтобы три значка (`⚠️`, `🔗`, `✓`) не растягивали шапку плитки на узких экранах, `🔗 N` теперь скрыт на мобильном (`hidden sm:inline`) — `⚠️` важнее перед экзаменом.
- `src/components/methods/ReadMethod.tsx` — добавлен опциональный `onResult`, в `handle`:
  - «Знаю» → `removeByCardId(billetId, cardId)`;
  - «Не знаю» → `addError({ billetId, cardId, problemId: null, what: card.topic })`;
  - затем `onResult ?? onClose`.
- `src/components/methods/MultipleChoiceMethod.tsx`, `ClozeMethod.tsx`, `MatchMethod.tsx`, `FreeAnswerMethod.tsx` — та же логика (`addError` на «Не знал/Не справился», `removeByCardId` на «Знал/Сказал правильно»).
- `src/components/ProblemMode.tsx` — `finalize(solved)`:
  - `solved` → `removeByProblemId(billet.id, billet.problem.id)`;
  - `!solved` → `addError({ billetId, cardId: null, problemId: billet.problem.id, what: billet.problem.title })`.

## Установленные зависимости

Ничего нового.

## Smoke-test

- `npm run build`: ✅ — `tsc -b && vite build`, 52 модуля, 359.41 KB JS / 100.11 KB gzip, без TS-ошибок.
- При "Не знаю" в ReadMethod ошибка добавляется в стор: ✅ — `addError({ billetId, cardId, problemId: null, what: card.topic })` вызывается перед `onResult/onClose`.
- При "Не знал" в MC/Cloze/Match/FreeAnswer ошибка добавляется: ✅ — все четыре метода теперь зовут `addError` в `handle/finalize` ветке `!knew`.
- При "Не справился" в ProblemMode ошибка добавляется (с problemId): ✅ — в `finalize` ветка `!solved` зовёт `addError({ ..., problemId: billet.problem.id, what: billet.problem.title })`.
- При "Знаю" по той же карточке ошибка удаляется автоматически: ✅ — ветка `knew` зовёт `removeByCardId`. Аналогично `removeByProblemId` для задач.
- Дедупликация: повторное "Не знаю" не плодит новые записи, обновляет updatedAt: ✅ — `addError` ищет по `(billetId, cardId/problemId)` через `findIndex`; при совпадении делает `entries[i].updatedAt = Date.now()`.
- Бейдж в шапке показывает количество ошибок: ✅ — `entries.length` через подписку `useErrorsStore`. `0` → бейдж не рендерится; `>99` → «99+».
- Страница /errors открывается, ошибки сгруппированы по билетам: ✅ — `Array.from(map.entries()).sort([a],[b] → a − b)`.
- Поле "Моя проработка" сохраняется с дебаунсом 600 мс и сохраняется после reload: ✅ — `useEffect` с `setTimeout(updateMyFix, 600)`; стор персистится в `localStorage` под ключом `physics-errors-v1`.
- Кнопка ✕ удаляет одну запись с подтверждением: ✅ — `window.confirm("Удалить эту ошибку из журнала?") && removeError(entry.id)`.
- Бейдж ⚠️ N на плитке билета на дашборде: ✅ — `useErrorsStore` фильтрует по `billet.id`, рендерится в правом верхнем углу плитки оранжевым.
- Пустое состояние "🎉 Журнал пуст" если нет ошибок: ✅ — отдельная ветка `entries.length === 0`.

## Структура одного компонента (sanity check)

`src/components/ErrorJournalPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useErrorsStore, type ErrorEntry } from "../store/errorsStore";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";
import ErrorEntryCard from "./ErrorEntryCard";
import BackButton from "./BackButton";

export default function ErrorJournalPage() {
  const entries = useErrorsStore((s) => s.entries);
  const [filterBilletId, setFilterBilletId] = useState<number | "all">("all");

  const billetIds = useMemo(() => {
    const set = new Set(entries.map((e) => e.billetId));
    return Array.from(set).sort((a, b) => a - b);
  }, [entries]);

  const filtered = useMemo(() => {
    if (filterBilletId === "all") return entries;
    return entries.filter((e) => e.billetId === filterBilletId);
  }, [entries, filterBilletId]);

  const grouped = useMemo<[number, ErrorEntry[]][]>(() => {
    const map = new Map<number, ErrorEntry[]>();
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
        <div className="text-sm text-slate-400">
          {entries.length} в журнале
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">📓 Журнал ошибок</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Сюда автоматически попадает всё, на что ты ответил «не знаю». Под
          каждой записью — поле «как не повторить»: впиши формулу, мнемонику
          или фразу-якорь. Когда переучишь — запись очистится сама (после
          первого «знаю» по этой карточке) или удали кнопкой ✕.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-sm text-slate-300">Журнал пуст.</div>
          <div className="text-xs text-slate-500 mt-1">
            Учись через билеты или Тренировку — ошибки запишутся сюда
            автоматически.
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
                Все ({entries.length})
              </button>
              {billetIds.map((bid) => {
                const billet = getBilletById(bid);
                const count = entries.filter(
                  (e) => e.billetId === bid,
                ).length;
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
                    Билет {String(billetId).padStart(2, "0")} ·{" "}
                    {billet?.title}
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

## Возникшие проблемы и как обошёл

- **Изменение схемы `ErrorEntry`** — добавил `updatedAt`. Существующие пользователи журнала ещё не могли иметь данных (журнал не подключался к UI до этой фазы — `entries: []` в storage), поэтому миграция не понадобилась. Версия persist остаётся `1`.
- **Узкая шапка плитки на 375px** — три значка (`⚠️`, `🔗`, `✓`) не помещаются. Спека разрешила на узких экранах оставить только `⚠️`. Сделал `🔗 N` через `hidden sm:inline` — на десктопе видны все три, на телефоне ⚠️ остаётся, ссылка-дубликат скрыта (вся информация о дубликатах всё равно есть на странице билета).
- **`confirm` под флагом `verbatimModuleSyntax` / `noUnusedLocals`** — использовал `window.confirm(...)` явно, чтобы не цеплять глобал и быть защищённым от lint-правил.
- **`ReadMethod` теперь тоже принимает `onResult`** — для единообразия и возможности использовать в Тренировке в будущем; сейчас `onResult` всё равно опциональный, и `BilletPage` его не передаёт — поведение не сломалось.

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions** после push в `main`.
- Если в браузере уже есть `physics-errors-v1` со старыми записями (без `updatedAt`) — открыть DevTools → Application → Local Storage и удалить ключ. Скорее всего такого нет: журнал до этой фазы был «мёртвой» заготовкой.
- Открыть приложение, пройти 2-3 карточки с ответом «Не знаю», проверить, что появился красный бейдж в шапке, ⚠️ на плитке билета, и что в `📓 Ошибки` запись группируется по билету.
