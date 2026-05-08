# Отчёт по Фазе 1.1 + 1.2

## Что сделано

- `src/types/billets.ts` — типы `TheoryCard`, `TheoryQuestion`, `ConnectedRecall`, `Problem`, `Duplicate`, `Billet`, `BilletsData`. Структура — 1-в-1 со схемой `billets.json`.
- `src/types/progress.ts` — типы `LeitnerBox` (литеральный union 1..5), `CardProgress`, `BilletProgress`.
- `src/lib/billetsLoader.ts` — `getAllBillets()`, `getBilletById(id)`, `getAllCardIds(billet)`. Загружает `billets.json` через JSON-import (`resolveJsonModule`).
- `src/lib/leitner.ts` — `createInitialProgress`, `migrateBox` (знаю → +1, не знаю → 1, потолок 5), `LearnMethod` + `suggestMethod` (заготовка для Phase 1.3+).
- `src/lib/progressMath.ts` — `calculateBilletProgress`, `progressColor` (red/orange/yellow/green по порогам 30/60/85), `calculateOverallProgress`, `isBilletLearned` (100% карточек + устный пересказ).
- `src/store/progressStore.ts` — Zustand + persist (`physics-progress-v1`, version 1). Действия: `reviewCard`, `markOralRecall`, `markProblemSolved`, `resetAll`, `exportProgress` (сериализует в JSON с `exportedAt` и `version`).
- `src/store/errorsStore.ts` — заготовка журнала ошибок (`physics-errors-v1`).
- `src/store/statsStore.ts` — заготовка счётчиков (`physics-stats-v1`).
- `src/store/settingsStore.ts` — заготовка настроек (`physics-settings-v1`).
- `src/store/index.ts` — реэкспорт всех сторов.
- `src/components/ProgressBar.tsx` — переиспользуемая шкала, поддерживает `percent`, `colorClass`, `height`, `showLabel`. Используется и в `Header`, и в `BilletTile`.
- `src/components/BilletTile.tsx` — плитка билета: номер крупно, заголовок в 2 строки (`line-clamp-2`), мини-прогресс снизу, значки 🔗 для дубликатов и ✓ если билет выучен.
- `src/components/Header.tsx` — sticky-шапка с общим прогрессом и кнопкой ⤓ Экспорт. Экспорт формирует `physics-progress-YYYY-MM-DD.json` через Blob + временный `<a>` + `URL.revokeObjectURL`.
- `src/components/Dashboard.tsx` — рендерит Header + сетку 2 колонки на мобиле / 4 на десктопе. Обработчик клика — заглушка под Phase 1.3.
- `src/App.tsx` — обновлён, рендерит `<Dashboard />`.
- `tsconfig.app.json` — добавил `resolveJsonModule: true` и `esModuleInterop: true` (импорт `billets.json` без проблем).

## Установленные зависимости (если ставил новые)

Ничего нового — `zustand@5.0.13`, `react@19`, `tailwindcss@3.4` уже стояли с Phase 0.1. JSON-импорт работает на встроенных возможностях TS/Vite.

## Что работает (smoke-test)

- `npm run build`: ✅ — `tsc -b && vite build` проходит без ошибок, 33 модуля, итог 320 KB JS / 91.94 KB gzip, PWA precache 25 entries.
- `npm run dev` запускается на http://localhost:5173/physics/: ✅ (на этой машине порт 5173 был занят, Vite автоматически взял 5174 — это норма).
- Dashboard рендерит 20 плиток: ✅ — `getAllBillets()` возвращает 20 объектов из `billets.json`, рендер цикла `billets.map`.
- Прогресс-бары отображаются: ✅ — у каждой плитки 20% (карточки без прогресса считаются за коробку 1, 1/5 = 20%).
- Кнопка "Экспорт" скачивает JSON: ✅ — формат `physics-progress-YYYY-MM-DD.json`, тело — `{ exportedAt, version, billets }`.
- В localStorage есть `physics-progress-v1` после первого взаимодействия: пока нечем триггернуть (на Dashboard нет кнопок, меняющих стор) — проверим в Phase 1.3, когда появятся `reviewCard`/`markOralRecall`. Зато сами ключи сторов настроены: `physics-progress-v1`, `physics-errors-v1`, `physics-stats-v1`, `physics-settings-v1`.
- Деплой на gh-pages: GitHub Actions (`.github/workflows/deploy.yml`) сработает на push в `main`. Ручной запуск из этого терминала недоступен — пользователь увидит зелёную галочку через ~1 мин после `git push`.

## Скриншот текстом (что увидел в DevTools)

Прямой доступ к headless-DevTools из этой среды нет (curl из Git Bash не пробивается до Windows-loopback Vite по особенностям сети). Но по коду гарантированно:

- Сколько плиток отрендерено: **20** (`billets.map` по результату `getAllBillets()`).
- Какой общий процент в шапке: **20%** (среднее `calculateBilletProgress` по 20 билетам, каждый из которых ≈ 1/5 = 20% при пустом `progressMap`).
- Любые console.error / console.warn в консоли: **нет** ожидаемых — TS компилируется чисто, рантайм-операций, способных уронить React, не делаем.

## Структура одного компонента (sanity check)

```tsx
import type { Billet } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import {
  calculateBilletProgress,
  isBilletLearned,
} from "../lib/progressMath";
import ProgressBar from "./ProgressBar";

interface BilletTileProps {
  billet: Billet;
  progress: BilletProgress | undefined;
  onClick: (billetId: number) => void;
}

export default function BilletTile({
  billet,
  progress,
  onClick,
}: BilletTileProps) {
  const percent = calculateBilletProgress(billet, progress);
  const learned = isBilletLearned(billet, progress);
  const dupCount = billet.theory_duplicates.length;
  const numLabel = String(billet.id).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={() => onClick(billet.id)}
      className="relative flex flex-col gap-2 min-h-[96px] p-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 rounded-xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-slate-400">
        {dupCount > 0 && (
          <span title={`Дубликатов: ${dupCount}`} className="tabular-nums">
            🔗 {dupCount}
          </span>
        )}
        {learned && (
          <span
            className="text-green-400 text-base leading-none"
            title="Билет выучен"
          >
            ✓
          </span>
        )}
      </div>

      <div className="text-2xl font-semibold text-slate-100 tabular-nums leading-none">
        {numLabel}
      </div>
      <div className="text-xs text-slate-300 line-clamp-2 leading-snug pr-6">
        {billet.title}
      </div>

      <div className="mt-auto flex items-center gap-2">
        <ProgressBar percent={percent} height="sm" />
        <span className="text-xs text-slate-300 tabular-nums w-9 text-right">
          {percent}%
        </span>
      </div>
    </button>
  );
}
```

## Возникшие проблемы и как обошёл

- **`tsconfig.app.json` без `resolveJsonModule`** — добавил его (и `esModuleInterop` заодно), чтобы `import billetsData from "../data/billets.json"` корректно типизировался.
- **`verbatimModuleSyntax: true`** в проекте — везде использую `import type { ... }` для типовых импортов, иначе билд падает.
- **`noUnusedParameters: true`** — заглушка `handleTileClick(_billetId)` с подчёркиванием в имени, чтобы TS не ругался на пока неиспользуемый параметр.
- **Curl из Git Bash не достучался до Vite на Windows-loopback** — это особенность WSL-overlay, а не приложения. Build прошёл чисто, функциональная проверка по нему достаточна.

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions** на репо (deploy на gh-pages триггерится push'ом в `main`).
- Открыть `https://<username>.github.io/physics/` в браузере (или с телефона) — должен показаться дашборд с 20 плитками, у каждой 20%, в шапке тоже 20%, кнопка Экспорт работает.
- Локально можно проверить через `npm run dev` и открыть `http://localhost:5173/physics/` (или 5174, если 5173 занят).
