# FIX: Спойлеры в Match и MultipleChoice

## Проблема

В обоих методах при показе содержимого карточки в нём **прямо написан topic**, что превращает упражнение в подстановку первых слов:

**MatchMethod:**
- Топик "Материальная точка" (слева)
- Описание "Материальная точка — тело, размерами..." (справа)
- Сопоставление тривиально по первому слову.

**MultipleChoiceMethod:**
- Показан content "Механическое движение — изменение положения тела..."
- Среди 4 вариантов "Механическое движение — определение" — это **первое же слово** в content.

Это спойлер, упражнение бесполезно для запоминания.

## Решение

В обоих методах при подготовке содержимого для показа — **заменять все вхождения topic карточки на `[…]`**, регистронезависимо.

## Шаг 1. Создай вспомогательный модуль

Создай новый файл `src/lib/maskTopic.ts`:

```typescript
// Скрывает упоминания topic в content, заменяя на [...]
// Регистронезависимо. Также убирает markdown ** (жирный).
export function maskTopic(content: string, topic: string): string {
  // Убираем markdown bold
  let result = content.replace(/\*\*/g, "");

  // Если topic пустой/короткий — ничего не делаем
  if (!topic || topic.trim().length < 3) return result;

  // Экранируем спецсимволы regex в topic
  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Регистронезависимая глобальная замена
  const regex = new RegExp(escaped, "gi");
  result = result.replace(regex, "[…]");

  return result;
}
```

## Шаг 2. Применить в `MatchMethod.tsx`

Найди в `src/components/methods/MatchMethod.tsx` строку, где формируется массив `contents` (примерно так):

```typescript
const contents = useMemo(
  () => shuffle(cards.map((c) => ({ id: c.id, text: c.content.replace(/\*\*/g, "") }))),
  [cards]
);
```

Замени на:

```typescript
import { maskTopic } from "../../lib/maskTopic";

// ...

const contents = useMemo(
  () =>
    shuffle(
      cards.map((c) => ({
        id: c.id,
        text: maskTopic(c.content, c.topic),
      }))
    ),
  [cards]
);
```

Главное: каждый content скрывает **свой собственный** topic. То есть для карточки "Материальная точка" замаскируется только "материальная точка", а другие термины останутся.

## Шаг 3. Применить в `MultipleChoiceMethod.tsx`

Найди в `src/components/methods/MultipleChoiceMethod.tsx` блок где показывается content. Сейчас примерно так:

```tsx
<div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
  {card.content.replace(/\*\*/g, "")}
</div>
```

Замени на:

```tsx
import { maskTopic } from "../../lib/maskTopic";

// ...

<div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
  {maskTopic(card.content, card.topic)}
</div>
```

## Шаг 4. Проверка

1. `npm run build` — должен пройти чисто.
2. Открой Match для билета 1, карточка "Материальная точка":
   - В правой колонке у неё описание должно начинаться с `[…] — тело, размерами которого...` (а не "Материальная точка — тело...").
3. Открой MultipleChoice для той же карточки:
   - В блоке content должно быть `[…] — тело, размерами которого...`
   - 4 варианта topic'а — без изменений.
4. **Важная проверка:** другие термины в content **не должны** маскироваться. Например, для карточки "Закон Ома для участка цепи" content "I = U / R\n\nСила тока прямо пропорциональна напряжению...". Слова "Сила тока", "напряжение" должны остаться (они key_terms, но не topic). Маскируется ТОЛЬКО "закон Ома для участка цепи".

## Шаг 5. Коммит и пуш

```bash
git add -A
git commit -m "Fix: скрытие topic в content для Match и MultipleChoice (anti-spoiler)"
git push origin main
```

После пуша напиши:
**"Fix спойлеров готов."**

(Отчёт делать не надо, это маленькая правка.)
