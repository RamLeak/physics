# Фаза 4.1 — Агрессивный PWA-кэш всех ассетов

## Контекст

Сейчас vite-plugin-pwa сделан с базовым precache (обычно — JS/CSS/HTML billd-артефакты). В рантайме работает Service Worker, но он может **не закэшировать**:
- `src/data/billets.json` (157 KB) — если он импортируется в JS-бандл, то попадает в JS chunk и кэшируется. Но если вдруг сделан внешним fetch — может не попасть.
- 12 PNG в `public/images/` (`billet-1-problem.png` ... `billet-19-problem.png`) — эти **точно** не precache по умолчанию, потому что они грузятся только когда пользователь открывает задачу.

Цель: убедиться, что **с первой загрузки PWA в авиарежиме работает всё** — включая задачи всех билетов с картинками.

## Что делать

### Шаг 1. Открой `vite.config.ts`

Найди секцию `VitePWA({ ... })`. Добавь/обнови два поля:

#### `includeAssets`

В этом массиве должны быть все статические файлы из `public/`, которые нужно precache. Добавь маски на картинки задач:

```typescript
includeAssets: [
  "favicon.ico",
  "apple-touch-icon.png",
  "images/*.png",  // ← все картинки задач
],
```

#### `workbox.globPatterns`

Этот массив контролирует, что будет включено в precache при build'е. Расширь его:

```typescript
workbox: {
  globPatterns: [
    "**/*.{js,css,html,ico,png,svg,woff,woff2,json}"
  ],
  // максимальный размер файла, который попадает в precache
  // 157KB JSON и PNG-картинки задач должны влезть. Поднимаем лимит до 5MB на всякий случай.
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // runtime caching — на случай если что-то всё-таки запрашивается на лету
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.endsWith(".png"),
      handler: "CacheFirst",
      options: {
        cacheName: "images-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 дней
        },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.endsWith(".json"),
      handler: "CacheFirst",
      options: {
        cacheName: "json-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
},
```

### Шаг 2. Поправь `registerType`, если нужно

`registerType: "autoUpdate"` уже стоит — это правильно. SW автоматически обновляется при выходе новой версии.

Ничего больше не меняем.

### Шаг 3. Build и проверка

Запусти:

```bash
npm run build
```

После build'а в `dist/` должны быть:
- `dist/sw.js` (сам Service Worker)
- `dist/workbox-XXXXX.js`
- `dist/manifest.webmanifest`
- В `dist/assets/` или просто в `dist/` — все картинки задач

В выводе build'а ищи строку типа `precache N entries` — должно быть **больше 25** (потому что добавились картинки). Если 25-30 — норм.

### Шаг 4. Коммит и пуш

```bash
git add -A
git commit -m "Phase 4.1: aggressive PWA precache for offline (images + JSON)"
git push origin main
```

### Шаг 5. ⚠️ Что должен сделать пользователь руками

Это важно: **существующие PWA-инсталляции на телефоне НЕ обновят SW автоматически на новую версию мгновенно**. Нужно либо:

**Вариант А** (быстрее): на телефоне закрой PWA → открой её снова. SW проверит обновление и перекэширует. На это может уйти 10-30 секунд при первом открытии после деплоя.

**Вариант Б** (надёжнее): удали PWA с главного экрана → зайди на `https://ramleak.github.io/physics/` через браузер → переустанови как PWA. Тогда новый SW установится с нуля.

Чтобы проверить, что precache реально работает:
1. Открой PWA онлайн один раз (это даст SW время precache'ить ассеты)
2. Включи **авиарежим**
3. Закрой и снова открой PWA
4. Открой любой билет с задачей (например, билет 1 — там наклонная плоскость)
5. Нажми "Задача" — **картинка должна загрузиться**

Если картинка не загружается в авиарежиме — значит precache не сработал, нужно переустановить PWA (Вариант Б).

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

Создай `PHASE-4.1-REPORT.md`. Шаблон:

```markdown
# Отчёт по Фазе 4.1

## Что сделано

- `vite.config.ts` — обновил конфиг VitePWA: includeAssets + workbox.globPatterns + runtimeCaching.

## Установленные зависимости

[ничего нового]

## Smoke-test

- `npm run build`: ✅ / ❌
- В выводе build'а вижу `precache N entries`: N = ?
- В `dist/` появились файлы: sw.js, workbox-*.js, manifest.webmanifest
- Все 12 PNG из `public/images/` попали в `dist/`

## Структура vite.config.ts (sanity check)

Распечатай ПОЛНОСТЬЮ исходник `vite.config.ts`.

## Возникшие проблемы и как обошёл

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в Actions
- Закрыть и переоткрыть PWA на телефоне (или переустановить)
- Проверить в авиарежиме: открыть задачу любого билета — картинка должна загрузиться
```

После создания отчёта напиши:
**"Phase 4.1 завершена. Оффлайн полный."**

---

**Всё. Это последний промпт сегодня. Дальше — учёба.**
