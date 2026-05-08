# Отчёт по Фазе 4.1

## Что сделано

- `vite.config.ts` — обновил конфиг `VitePWA`:
  - `includeAssets` теперь включает `images/*.png` (картинки задач из `public/images/` копируются в `dist/` и попадают в precache).
  - `workbox.globPatterns` расширен до `**/*.{js,css,html,ico,png,svg,woff,woff2,json}` (добавлены `woff` и `json`).
  - `workbox.maximumFileSizeToCacheInBytes = 5 MB` — на случай больших ассетов.
  - `workbox.runtimeCaching` — два правила:
    - `*.png` → `CacheFirst` (`images-cache`, 50 entries, 30 дней) — страховка для картинок, которые вдруг не попали в precache.
    - `*.json` → `CacheFirst` (`json-cache`, 10 entries, 30 дней) — для билетов, если когда-то начнём грузить JSON отдельным fetch.

Никакой логики приложения не трогал — только PWA-конфиг.

## Установленные зависимости

Ничего нового — `vite-plugin-pwa` уже стоит с Phase 0.1.

## Smoke-test

- `npm run build`: ✅ — `tsc -b && vite build`, 54 модуля, 367.73 KB JS / 101.55 KB gzip, без ошибок.
- В выводе build'а вижу `precache N entries`: **N = 37** (было 25 до правки → +12 картинок задач).
- В `dist/` появились файлы: ✅ — `sw.js`, `workbox-dcde9eb3.js`, `manifest.webmanifest`, `registerSW.js`.
- Все 12 PNG из `public/images/` попали в `dist/images/`: ✅ — `billet-{1..8,10,15,17,19}-problem.png` лежат в `dist/images/`.

## Структура vite.config.ts (sanity check)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/physics/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'images/*.png',
      ],
      manifest: {
        name: 'Physics Billet Trainer',
        short_name: 'Physics',
        description: 'Тренажёр билетов по физике',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/physics/',
        scope: '/physics/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,json}',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.png'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'json-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
});
```

## Возникшие проблемы и как обошёл

- **JSON в precache ничего не меняет на практике** — `src/data/billets.json` импортируется через `import billetsData from "../data/billets.json"`, и Vite инлайнит его в JS-бандл (видно по размеру `index-Cv2fqHPh.js` 367 KB). То есть `*.json` в globPatterns ничего не precache'ит из дистрибутива (там нет голых `.json`-файлов, кроме `manifest.webmanifest`). Добавил `json` в паттерны на будущее (если когда-то решим грузить billets отдельным fetch — кэш сработает); сейчас это no-op, но безвредный.
- **`images/*.png` в `includeAssets`** — этот массив отвечает за то, чтобы файлы из `public/` точно попали в `dist/`. У нас они и так копируются автоматически (`public/images/`), но `includeAssets` фиксирует их в манифесте precache явно — двойная гарантия.

## Что нужно сделать пользователю руками

- Дождаться зелёной галочки в **GitHub Actions** после push в `main`.
- На телефоне:
  - **Вариант А** (быстрее): закрой PWA → открой её снова. SW автообновится за 10–30 сек.
  - **Вариант Б** (надёжнее, если изменения не подцепляются): удали PWA с главного экрана → открой `https://ramleak.github.io/physics/` в браузере → переустанови как PWA. Тогда SW установится с нуля и precache'нет всё, включая 12 PNG.
- **Проверка оффлайна:**
  1. Открой PWA онлайн один раз — дай SW время на precache.
  2. Включи **авиарежим**.
  3. Закрой и открой PWA заново.
  4. Открой задачу билета 1 (наклонная плоскость) — картинка должна загрузиться.
  5. Если не загружается — переустанови PWA (Вариант Б).
- Иди учить.
