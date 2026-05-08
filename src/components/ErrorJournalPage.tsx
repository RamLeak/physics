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
