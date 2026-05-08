# Фаза 2.1 + правки прогресса + режим Тренировки

## Контекст

Пользователь начал тестировать продукт и попросил три вещи:
1. **Поправить прогресс**: сейчас новый билет показывает 20% потому что Leitner-коробка 1 = 1/5 = 20% по старой формуле. Должно быть 0%, если ничего не учил.
2. **Добавить метод "слово → определение"** — это FreeAnswerMethod из исходного плана.
3. **Добавить режим "тест в разброс" как в ПДД** — это режим Микс из плана.

Также по плану нужно добавить **Match-метод** (сопоставление). Делаем всё в одной фазе — это связанные изменения по обучающим методам.

После этой фазы пользователь сможет реально нарешивать билеты в любых режимах.

---

## Что строим

### Новые/изменённые файлы

```
src/
  lib/
    progressMath.ts             ← ОБНОВИТЬ: коробка 1 = 0%, коробка 5 = 100%
    leitner.ts                  ← ОБНОВИТЬ: расширить suggestMethod (читать → выбор → пропуск → пара → ответ)
    similarity.ts               ← НОВЫЙ: нормализация и сравнение текста для FreeAnswer
    practiceQueue.ts            ← НОВЫЙ: формирование очереди карточек для режима Тренировки
  components/
    methods/
      MatchMethod.tsx           ← НОВЫЙ: сопоставление 5 topic ↔ 5 content
      FreeAnswerMethod.tsx      ← НОВЫЙ: показал topic → ввёл текст → раскрыл эталон → оценил себя
    PracticeMode.tsx            ← НОВЫЙ: режим тренировки (как в ПДД), полноэкранный
    Header.tsx                  ← ОБНОВИТЬ: добавить кнопку "🎯 Тренировка"
    BilletPage.tsx              ← ОБНОВИТЬ: добавить запуск Match и FreeAnswer (5 кнопок методов вместо 3)
    CardListItem.tsx            ← ОБНОВИТЬ: 5 кнопок методов
  router/
    AppRouter.tsx               ← ОБНОВИТЬ: добавить маршрут #/practice
  lib/
    routing.ts                  ← ОБНОВИТЬ: добавить kind "practice" в Route
```

---

## Шаг 1. Fix прогресса (КРИТИЧНО)

### `src/lib/progressMath.ts`

В функции `calculateTheoryProgress` замени формулу. Было:

```typescript
total += card ? card.box : 1;
// потом: total / cardIds.length / 5 * 100
```

Должно стать (новая формула: `(box - 1) / 4 * 100`):

```typescript
export function calculateTheoryProgress(billet: Billet, progress: BilletProgress | undefined): number {
  const cardIds = getAllCardIds(billet);
  if (cardIds.length === 0) return 0;
  let total = 0;
  for (const id of cardIds) {
    const card = progress?.cards[id];
    const box = card ? card.box : 1;
    // коробка 1 = 0%, коробка 5 = 100%
    total += ((box - 1) / 4) * 100;
  }
  return Math.round(total / cardIds.length);
}
```

Остальные функции (`calculateBilletProgress`, `progressColor`, `calculateOverallProgress`, `isBilletLearned`) **не трогать** — они работают через `calculateTheoryProgress`.

После правки: новый билет покажет 0% (теория 0% × 0.6 + пересказ 0 × 0.25 + задача 0 × 0.15 = 0%). Билет с одной выученной карточкой из 10 в коробке 5 покажет: теория = (4/4 × 100) / 10 = 10%, общий = 10% × 0.6 = 6%.

---

## Шаг 2. Расширить выбор метода в Leitner

### `src/lib/leitner.ts`

Добавь два метода в `LearnMethod` и обнови `suggestMethod`:

```typescript
export type LearnMethod =
  | "read"
  | "multiple_choice"
  | "cloze"
  | "match"           // НОВЫЙ
  | "free_answer"     // НОВЫЙ
  | "extended";

export function suggestMethod(box: LeitnerBox): LearnMethod {
  switch (box) {
    case 1: return "read";              // прочитать
    case 2: return "multiple_choice";   // выбрать
    case 3: return "cloze";             // вставить пропуск
    case 4: return "match";             // сопоставить
    case 5: return "free_answer";       // дать определение
    default: return "read";
  }
}
```

---

## Шаг 3. Утилита сравнения для FreeAnswer

### `src/lib/similarity.ts` (новый файл)

FreeAnswer не использует автопроверку (LLM не подключаем) — пользователь сам себя оценивает. Но мы можем **показать ему совпадающие ключевые термины**, чтобы помочь оценить себя честно.

```typescript
// Нормализация: lowercase, убираем знаки препинания, лишние пробелы
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?()«»"'`\-]/g, " ")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

// Какие из ожидаемых ключевых терминов встречаются в ответе пользователя
export function matchKeyTerms(userAnswer: string, keyTerms: string[]): {
  found: string[];
  missing: string[];
} {
  const norm = normalize(userAnswer);
  const found: string[] = [];
  const missing: string[] = [];
  for (const term of keyTerms) {
    if (norm.includes(normalize(term))) {
      found.push(term);
    } else {
      missing.push(term);
    }
  }
  return { found, missing };
}
```

---

## Шаг 4. Метод 4 — `MatchMethod.tsx`

Сопоставление: показываем 5 topic'ов слева и 5 content'ов справа в случайном порядке. Пользователь жмёт topic, потом content — соединяет. Правильные пары становятся зелёными, неправильные — красными (с подсветкой правильной).

```tsx
import { useMemo, useState } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";

interface Props {
  billetId: number;
  card: TheoryCard;          // карточка, которую пытаемся учить
  allCards: TheoryCard[];    // все карточки билета — для пары
  onClose: () => void;
}

interface Pair {
  topicId: string;
  contentId: string;
  correct: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchMethod({ billetId, card, allCards, onClose }: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);

  // Берём до 5 карточек: целевую + 4 случайных других
  const cards = useMemo(() => {
    const others = allCards.filter((c) => c.id !== card.id);
    const picked = shuffle(others).slice(0, Math.min(4, others.length));
    return shuffle([card, ...picked]);
  }, [card, allCards]);

  const topics = useMemo(() => cards.map((c) => ({ id: c.id, text: c.topic })), [cards]);
  const contents = useMemo(
    () => shuffle(cards.map((c) => ({ id: c.id, text: c.content.replace(/\*\*/g, "") }))),
    [cards]
  );

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [done, setDone] = useState(false);

  const isPaired = (id: string) => pairs.some((p) => p.topicId === id || p.contentId === id);
  const pairOf = (id: string) => pairs.find((p) => p.topicId === id || p.contentId === id);

  const handleTopicClick = (topicId: string) => {
    if (isPaired(topicId)) return;
    setSelectedTopic(selectedTopic === topicId ? null : topicId);
  };

  const handleContentClick = (contentId: string) => {
    if (isPaired(contentId)) return;
    if (!selectedTopic) return;
    const correct = selectedTopic === contentId;
    const next = [...pairs, { topicId: selectedTopic, contentId, correct }];
    setPairs(next);
    setSelectedTopic(null);
    if (next.length === topics.length) {
      setDone(true);
    }
  };

  const targetPair = pairs.find((p) => p.topicId === card.id);
  const wasCorrectForTarget = targetPair?.correct ?? false;

  const finalize = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    onClose();
  };

  // Цветовое решение для строк
  const colorFor = (id: string): string => {
    const p = pairOf(id);
    if (!p) return id === selectedTopic ? "bg-slate-600" : "bg-slate-800";
    return p.correct ? "bg-green-900" : "bg-red-900";
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Сопоставь топик с описанием</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>

        <div className="text-sm text-slate-400">
          Жми сначала топик слева, потом подходящий текст справа.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Колонка топиков */}
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Топики</div>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTopicClick(t.id)}
                disabled={isPaired(t.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${colorFor(t.id)} ${isPaired(t.id) ? "" : "hover:bg-slate-700"}`}
              >
                {t.text}
              </button>
            ))}
          </div>

          {/* Колонка контентов */}
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Описания</div>
            {contents.map((c) => (
              <button
                key={c.id}
                onClick={() => handleContentClick(c.id)}
                disabled={isPaired(c.id) || !selectedTopic}
                className={`w-full text-left p-3 rounded-lg text-xs whitespace-pre-wrap transition-colors ${colorFor(c.id)} ${isPaired(c.id) || !selectedTopic ? "" : "hover:bg-slate-700"}`}
              >
                {c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text}
              </button>
            ))}
          </div>
        </div>

        {done && (
          <div className="space-y-3 pt-2">
            <div className="text-sm text-slate-300">
              {wasCorrectForTarget
                ? "Целевая карточка сопоставлена правильно ✅"
                : "Целевую карточку не угадал ❌"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => finalize(false)} className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium">
                Не знал
              </button>
              <button onClick={() => finalize(true)} className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium">
                Знал
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

## Шаг 5. Метод 5 — `FreeAnswerMethod.tsx`

"Слово → определение". Показываем topic, пользователь пишет в textarea, потом раскрывает эталон, видит совпавшие ключевые термины, сам оценивает себя.

```tsx
import { useState, useMemo } from "react";
import type { TheoryCard } from "../../types/billets";
import { useProgressStore } from "../../store/progressStore";
import { matchKeyTerms } from "../../lib/similarity";
import { renderMarkdownLite } from "../../lib/markdownLite";

interface Props {
  billetId: number;
  card: TheoryCard;
  onClose: () => void;
}

export default function FreeAnswerMethod({ billetId, card, onClose }: Props) {
  const reviewCard = useProgressStore((s) => s.reviewCard);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  const match = useMemo(
    () => matchKeyTerms(answer, card.key_terms),
    [answer, card.key_terms]
  );

  const finalize = (knew: boolean) => {
    reviewCard(billetId, card.id, knew);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-20 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Дай определение</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Тема</div>
          <div className="text-lg font-semibold">{card.topic}</div>
        </div>

        <div>
          <label className="text-sm text-slate-400 block mb-2">
            Расскажи своими словами (или мысленно — главное проверить себя):
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed}
            rows={6}
            className="w-full p-3 bg-slate-800 rounded-lg text-sm text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-70"
            placeholder="Начни писать..."
          />

          {!revealed && card.key_terms.length > 0 && answer.trim().length > 0 && (
            <div className="text-xs text-slate-500 mt-2">
              Упомянуто терминов: {match.found.length} из {card.key_terms.length}
            </div>
          )}
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Показать эталон
          </button>
        ) : (
          <>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Эталон</div>
              <div
                className="text-sm text-slate-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdownLite(card.content) }}
              />
            </div>

            {card.key_terms.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs">
                <div className="text-slate-400 mb-2">Ключевые термины:</div>
                <div className="space-y-1">
                  {card.key_terms.map((term) => {
                    const isFound = match.found.includes(term);
                    return (
                      <div key={term} className={isFound ? "text-green-400" : "text-red-400"}>
                        {isFound ? "✓" : "✗"} {term}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-sm text-slate-400">Оцени себя честно:</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => finalize(false)} className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-medium">
                Не справился
              </button>
              <button onClick={() => finalize(true)} className="bg-green-900 hover:bg-green-800 rounded-lg py-3 font-medium">
                Сказал правильно
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

## Шаг 6. Очередь для режима Тренировки

### `src/lib/practiceQueue.ts` (новый файл)

```typescript
import type { Billet, TheoryCard } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import { getAllBillets } from "./billetsLoader";
import type { LearnMethod } from "./leitner";

export interface PracticeItem {
  billetId: number;
  card: TheoryCard;
  method: LearnMethod;
}

export type PracticeMode = "all" | "weak";  // все карточки vs только из коробок 1-2

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Какой метод предлагать в тренировке: для коробки 1-2 — multiple_choice (быстрее, как в ПДД),
// для 3-4 — cloze, для 5 — free_answer. Это даёт разнообразие.
function methodForBox(box: number): LearnMethod {
  if (box <= 2) return "multiple_choice";
  if (box <= 3) return "cloze";
  if (box <= 4) return "free_answer";
  return "free_answer";
}

export function buildPracticeQueue(
  progressMap: Record<number, BilletProgress>,
  mode: PracticeMode,
  size: number = 10
): PracticeItem[] {
  const billets = getAllBillets();
  const allItems: PracticeItem[] = [];

  for (const billet of billets) {
    const progress = progressMap[billet.id];
    const allCards = [...billet.theory_q1.cards, ...billet.theory_q2.cards];
    for (const card of allCards) {
      const box = progress?.cards[card.id]?.box ?? 1;
      if (mode === "weak" && box > 2) continue;
      allItems.push({
        billetId: billet.id,
        card,
        method: methodForBox(box),
      });
    }
  }

  return shuffle(allItems).slice(0, size);
}
```

---

## Шаг 7. Режим Тренировки — `PracticeMode.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { useProgressStore } from "../store/progressStore";
import { buildPracticeQueue, type PracticeMode as PMode } from "../lib/practiceQueue";
import MultipleChoiceMethod from "./methods/MultipleChoiceMethod";
import ClozeMethod from "./methods/ClozeMethod";
import FreeAnswerMethod from "./methods/FreeAnswerMethod";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";

const SESSION_SIZE = 10;

export default function PracticeMode() {
  const progressMap = useProgressStore((s) => s.billets);
  const [mode, setMode] = useState<PMode>("all");
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState(() => buildPracticeQueue(progressMap, "all", SESSION_SIZE));
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });

  // Когда меняется режим — пересобираем очередь
  useEffect(() => {
    if (!started) {
      setQueue(buildPracticeQueue(progressMap, mode, SESSION_SIZE));
    }
  }, [mode, progressMap, started]);

  const start = () => {
    const fresh = buildPracticeQueue(progressMap, mode, SESSION_SIZE);
    setQueue(fresh);
    setIndex(0);
    setAnswered({ correct: 0, wrong: 0 });
    setStarted(true);
  };

  const finish = () => {
    setStarted(false);
    navigateTo({ kind: "dashboard" });
  };

  // Хук в reviewCard — чтобы понять, был ли ответ правильным,
  // мы перехватываем через коллбек onClose в каждом методе
  // но для счёта правильных нам нужен кастом — оборачиваем reviewCard
  // Простейший способ: сравниваем коробку до и после
  const reviewCardOriginal = useProgressStore((s) => s.reviewCard);
  const handleReview = (billetId: number, cardId: string, knew: boolean) => {
    reviewCardOriginal(billetId, cardId, knew);
    setAnswered((a) => ({
      correct: a.correct + (knew ? 1 : 0),
      wrong: a.wrong + (knew ? 0 : 1),
    }));
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      // Конец сессии
      setStarted(false);
    }
  };

  // Стартовый экран выбора режима
  if (!started && answered.correct === 0 && answered.wrong === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateTo({ kind: "dashboard" })}
            className="text-sm text-slate-300 hover:text-slate-100"
          >
            ← Назад
          </button>
        </div>
        <h1 className="text-xl font-semibold">🎯 Тренировка</h1>
        <p className="text-sm text-slate-400">
          {SESSION_SIZE} случайных карточек из всех билетов. Метод подбирается автоматически по уровню освоения карточки.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setMode("all")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${mode === "all" ? "bg-slate-700" : "bg-slate-800 hover:bg-slate-700"}`}
          >
            <div className="font-medium">Все карточки</div>
            <div className="text-xs text-slate-400 mt-1">
              Из всех билетов, любой коробки. {queue.length === 0 ? "(нет карточек)" : `Будет ${Math.min(queue.length, SESSION_SIZE)}.`}
            </div>
          </button>
          <button
            onClick={() => setMode("weak")}
            className={`w-full p-4 rounded-lg text-left transition-colors ${mode === "weak" ? "bg-slate-700" : "bg-slate-800 hover:bg-slate-700"}`}
          >
            <div className="font-medium">Только слабые</div>
            <div className="text-xs text-slate-400 mt-1">
              Только из коробок 1-2 (то, что ещё не выучил). {queue.length === 0 ? "(всё выучено или ничего не учил — переключись на «Все карточки»)" : `Будет ${Math.min(queue.length, SESSION_SIZE)}.`}
            </div>
          </button>
        </div>

        <button
          onClick={start}
          disabled={queue.length === 0}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-4 text-lg font-medium"
        >
          Начать
        </button>
      </div>
    );
  }

  // Экран результатов
  if (!started && (answered.correct > 0 || answered.wrong > 0)) {
    const total = answered.correct + answered.wrong;
    const percent = total > 0 ? Math.round((answered.correct / total) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Сессия завершена</h1>
        <div className="bg-slate-800 rounded-lg p-6 text-center space-y-2">
          <div className="text-5xl font-bold tabular-nums">{percent}%</div>
          <div className="text-sm text-slate-400">
            {answered.correct} правильно из {total}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setAnswered({ correct: 0, wrong: 0 });
              setStarted(false);
            }}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-medium"
          >
            Ещё раз
          </button>
          <button onClick={finish} className="bg-slate-800 hover:bg-slate-700 rounded-lg py-3 font-medium">
            На дашборд
          </button>
        </div>
      </div>
    );
  }

  // Активная сессия — рендерим текущий элемент
  const item = queue[index];
  if (!item) return null;
  const billet = getBilletById(item.billetId);
  if (!billet) return null;

  const allCardsOfBillet = [...billet.theory_q1.cards, ...billet.theory_q2.cards];

  // Наверху ставим прогресс сессии
  const progressBar = (
    <div className="fixed top-0 left-0 right-0 z-30 p-2 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => setStarted(false)}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ✕ Завершить
        </button>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${((index) / queue.length) * 100}%` }}
          />
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          {index + 1}/{queue.length}
        </div>
      </div>
    </div>
  );

  // Оборачиваем метод-компонент: подменяем reviewCard через клик-перехват не получится без рефакторинга,
  // поэтому делаем на уровне useProgressStore.setState через подписку — но проще всего:
  // рендерим метод как обычно и параллельно слушаем изменения. Но это усложнит.
  // Простая версия: в каждом методе onClose вызывается ПОСЛЕ reviewCard. Вместо этого
  // используем CustomMethodWrapper, который заменяет onClose на handleAdvance.

  // Чтобы не плодить логику — переопределим handle через локальный useState флаг:
  // когда метод вызывает onClose, мы перехватываем и делаем handleReview (не зная knew).
  // НО: методы уже зовут reviewCard внутри. Нужна логика: до открытия метода запомнить box,
  // после onClose — сравнить.

  // Вместо этого: после onClose читаем последнее обновление из стора (lastReviewed).
  // Но проще — пробросить колбек onResult через newProp.

  // ✱ ВАЖНО: чтобы счётчик правильных работал, методы должны звать дополнительный колбек.
  // НЕ хотим менять методы. Поэтому: считаем правильным/неправильным по разнице коробок.

  // СТРАТЕГИЯ: до отображения сохраняем текущий box в локальном useRef.
  // После onClose читаем box из стора, сравниваем.

  // Поскольку методы уже работают и зовут onClose в конце — сделаем wrapper,
  // который оборачивает только onClose:

  const wrappedOnClose = () => {
    // Считываем актуальный box карточки
    const after = useProgressStore.getState().billets[item.billetId]?.cards[item.card.id]?.box ?? 1;
    const before = boxBeforeRef;
    const knew = after > before;
    setAnswered((a) => ({
      correct: a.correct + (knew ? 1 : 0),
      wrong: a.wrong + (knew ? 0 : 1),
    }));
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      setStarted(false);
    }
  };

  // Запоминаем box до показа
  const boxBeforeRef = progressMap[item.billetId]?.cards[item.card.id]?.box ?? 1;

  return (
    <div className="pt-12">
      {progressBar}
      {item.method === "multiple_choice" && (
        <MultipleChoiceMethod
          billetId={item.billetId}
          card={item.card}
          allCards={allCardsOfBillet}
          onClose={wrappedOnClose}
        />
      )}
      {item.method === "cloze" && (
        <ClozeMethod billetId={item.billetId} card={item.card} onClose={wrappedOnClose} />
      )}
      {item.method === "free_answer" && (
        <FreeAnswerMethod billetId={item.billetId} card={item.card} onClose={wrappedOnClose} />
      )}
      {/* Не используем read/match в тренировке — слишком пассивно/тяжело */}
    </div>
  );
}
```

> **ВАЖНО про реализацию `wrappedOnClose`**: подход с чтением `useProgressStore.getState()` ПОСЛЕ `onClose` — рабочий, но требует осторожности. Если вдруг работает нестабильно — упрости: добавь к `MultipleChoiceMethod`, `ClozeMethod`, `FreeAnswerMethod` опциональный пропс `onResult?: (knew: boolean) => void`, который вызывается прямо в их `finalize/handle`. И в `PracticeMode` пробрасывай его. Это чище, но требует правки 3 файлов методов. Если успеваешь — делай через `onResult` (правильнее), если нет — через `getState()` (работает).

---

## Шаг 8. Маршрутизация

### `src/lib/routing.ts` — расширь Route

```typescript
export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number }
  | { kind: "practice" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
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
  else window.location.hash = `#/billet/${route.billetId}`;
}
```

### `src/router/AppRouter.tsx` — добавь практику

```typescript
import PracticeMode from "../components/PracticeMode";
// ...
if (route.kind === "practice") return <PracticeMode />;
if (route.kind === "billet") return <BilletPage billetId={route.billetId} />;
return <Dashboard />;
```

---

## Шаг 9. Кнопка "🎯 Тренировка" в Header

### `src/components/Header.tsx`

Добавь между общим прогрессом и кнопкой Экспорт новую кнопку:

```tsx
<button
  onClick={() => navigateTo({ kind: "practice" })}
  className="text-sm bg-green-900 hover:bg-green-800 px-3 py-1.5 rounded-lg font-medium transition-colors"
  title="Тренировка как в ПДД — случайные карточки из всех билетов"
>
  🎯 Тренировка
</button>
```

(Импортируй `navigateTo` из `../lib/routing`.)

На мобильных экранах кнопка может не помещаться — сделай шапку гибкой: на узких экранах кнопка экспорта станет иконкой ⤓ без текста, а "🎯 Тренировка" остаётся как primary CTA.

---

## Шаг 10. Обновить кнопки методов на странице билета

### `src/components/CardListItem.tsx`

Сейчас 3 кнопки. Сделай **5 кнопок методов** в две строки:

```
[ Чтение  ] [ Выбор ] [ Пропуск ]
[ Сопоставить ] [ Определение ]
```

```tsx
<div className="grid grid-cols-3 gap-1.5 mt-2.5">
  <button onClick={() => onChooseMethod("read")} className="...">Чтение</button>
  <button onClick={() => onChooseMethod("mc")} className="...">Выбор</button>
  <button onClick={() => onChooseMethod("cloze")} className="...">Пропуск</button>
</div>
<div className="grid grid-cols-2 gap-1.5 mt-1.5">
  <button onClick={() => onChooseMethod("match")} className="...">Сопоставить</button>
  <button onClick={() => onChooseMethod("free")} className="...">Определение</button>
</div>
```

Тип `Method`: добавь `"match" | "free"`.

### `src/components/BilletPage.tsx` — поддержать новые методы

В `Method` тип:

```typescript
type Method = "read" | "mc" | "cloze" | "match" | "free";
```

В switch при рендере метода:

```tsx
if (active.method === "read")  return <ReadMethod ... />;
if (active.method === "mc")    return <MultipleChoiceMethod ... />;
if (active.method === "cloze") return <ClozeMethod ... />;
if (active.method === "match") return <MatchMethod billetId={billetId} card={found} allCards={allCards} onClose={close} />;
return <FreeAnswerMethod billetId={billetId} card={found} onClose={close} />;
```

---

## Финальная проверка

1. `npm run build` без ошибок.
2. Открыть дашборд — все плитки должны показывать **0%** (если ничего не учил с этого устройства). Если уже учил — реальный процент.
3. Кнопка "🎯 Тренировка" в шапке.
4. Тапнуть Тренировку → выбрать "Все карточки" → "Начать" → пройти 10 карточек разными методами.
5. После 10-й — экран результатов с процентом.
6. Прогресс отдельных билетов вырос соответственно.
7. На странице билета: 5 кнопок методов под каждой карточкой.
8. Match работает: 5 топиков ↔ 5 описаний, можно сопоставить.
9. FreeAnswer работает: пишешь определение, видишь сколько ключевых терминов упомянул.

---

## Чего НЕ делать

- ❌ Не подключай LLM/Groq.
- ❌ Не реализуй Экзамен-режим с таймером (это Phase 4.3).
- ❌ Не реализуй журнал ошибок (Phase 2.2).
- ❌ Не трогай билеты JSON, картинки.

---

## ⚠️ ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ ОТЧЁТ

Создай `PHASE-2.1-REPORT.md`. Шаблон:

```markdown
# Отчёт по Фазе 2.1 + правки

## Что сделано

[список новых и изменённых файлов]

## Установленные зависимости

[если ставил — перечисли. Если нет — "ничего нового"]

## Smoke-test

- `npm run build`: ✅ / ❌
- `npm run dev` запускается: ✅ / ❌
- После правки прогресса: новый билет (без обучения) показывает 0% теории: ✅ / ❌
- Кнопка "🎯 Тренировка" видна в шапке дашборда: ✅ / ❌
- Тренировка запускается, очередь из 10 карточек собирается: ✅ / ❌
- Метод Match: 5 топиков ↔ 5 описаний, сопоставление работает: ✅ / ❌
- Метод FreeAnswer: textarea, эталон раскрывается, ключевые термины подсвечиваются: ✅ / ❌
- На странице билета 5 кнопок методов под карточкой: ✅ / ❌
- После сессии тренировки экран результатов с %: ✅ / ❌

## Структура одного компонента (sanity check)

Распечатай ПОЛНОСТЬЮ исходник `src/components/PracticeMode.tsx`.

## Возникшие проблемы и как обошёл

## Что нужно сделать пользователю руками
```

После создания отчёта напиши:
**"Фаза 2.1 завершена. Тренировка готова."**

---

**Всё. Начинай.**
