import { useMemo, useState } from "react";
import { useErrorsStore, type ErrorEntry } from "../store/errorsStore";
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
      </div>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">📓 Журнал ошибок</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          В <strong>активных</strong> — текущие ошибки. Когда переучишь
          карточку (нажмёшь «Знаю» в любом методе), она переедет в{" "}
          <strong>архив</strong> — и вернётся напомнить о себе за день до
          экзамена. Если та же карточка снова попадёт в «не знаю» — вернётся
          обратно в активные.
        </p>
      </header>

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
                    Билет {String(billetId).padStart(2, "0")} ·{" "}
                    {billet?.title}
                  </div>
                  <div className="space-y-2">
                    {items.map((e) => (
                      <ErrorEntryCard
                        key={e.id}
                        entry={e}
                        isArchived={tab === "archive"}
                      />
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
