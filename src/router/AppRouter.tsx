import { useEffect, useState } from "react";
import { parseHash, type Route } from "../lib/routing";
import Dashboard from "../components/Dashboard";
import BilletPage from "../components/BilletPage";
import PracticeMode from "../components/PracticeMode";
import ErrorJournalPage from "../components/ErrorJournalPage";
import ExamMode from "../components/ExamMode";

export default function AppRouter() {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  if (route.kind === "exam") {
    return <ExamMode />;
  }
  if (route.kind === "errors") {
    return <ErrorJournalPage />;
  }
  if (route.kind === "practice") {
    return <PracticeMode />;
  }
  if (route.kind === "billet") {
    return <BilletPage billetId={route.billetId} />;
  }
  return <Dashboard />;
}
