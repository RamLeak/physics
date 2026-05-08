import { useState, useEffect } from "react";
import type { ErrorEntry } from "../store/errorsStore";
import { useErrorsStore } from "../store/errorsStore";
import { getBilletById } from "../lib/billetsLoader";
import { navigateTo } from "../lib/routing";

interface Props {
  entry: ErrorEntry;
  isArchived?: boolean;
}

export default function ErrorEntryCard({ entry, isArchived = false }: Props) {
  const updateMyFix = useErrorsStore((s) => s.updateMyFix);
  const removeError = useErrorsStore((s) => s.removeError);
  const removeFromArchive = useErrorsStore((s) => s.removeFromArchive);
  const [myFix, setMyFix] = useState(entry.myFix);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setMyFix(entry.myFix);
  }, [entry.id, entry.myFix]);

  const billet = getBilletById(entry.billetId);
  const billetTitle = billet?.title ?? `Билет ${entry.billetId}`;

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

  const handleOpen = () => {
    if (entry.cardId) {
      navigateTo({
        kind: "billet",
        billetId: entry.billetId,
        focusCardId: entry.cardId,
      });
    } else if (entry.problemId) {
      navigateTo({
        kind: "billet",
        billetId: entry.billetId,
        openProblem: true,
      });
    } else {
      navigateTo({ kind: "billet", billetId: entry.billetId });
    }
  };

  const openTitle = entry.cardId
    ? "Открыть карточку и прорешать"
    : entry.problemId
      ? "Открыть задачу"
      : "Открыть билет";

  const handleRemove = () => {
    if (isArchived) {
      if (
        window.confirm(
          "Удалить из архива? Эта запись больше не появится перед экзаменом.",
        )
      ) {
        removeFromArchive(entry.id);
      }
    } else {
      if (window.confirm("Удалить эту ошибку из журнала?")) {
        removeError(entry.id);
      }
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() =>
              navigateTo({ kind: "billet", billetId: entry.billetId })
            }
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors text-left"
          >
            Билет {String(entry.billetId).padStart(2, "0")} · {billetTitle}
          </button>
          <div className="text-sm font-medium text-slate-100 mt-0.5">
            {entry.problemId ? "📐 " : ""}
            {entry.what}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-[10px] text-slate-500 tabular-nums">{date}</div>
          {isArchived && entry.archivedAt && (
            <div className="text-[10px] text-green-500 tabular-nums">
              ✓ переучено
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpen}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              title={openTitle}
            >
              → Открыть
            </button>
            <button
              onClick={handleRemove}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              title={
                isArchived
                  ? "Удалить из архива навсегда"
                  : "Удалить — например, если уже переучил"
              }
            >
              ✕
            </button>
          </div>
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
