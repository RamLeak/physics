export type Route =
  | { kind: "dashboard" }
  | {
      kind: "billet";
      billetId: number;
      focusCardId?: string;
      openProblem?: boolean;
    }
  | { kind: "practice" }
  | { kind: "errors" }
  | { kind: "exam" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
  if (hash === "#/errors") return { kind: "errors" };
  if (hash === "#/exam") return { kind: "exam" };

  const qIdx = hash.indexOf("?");
  const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  const queryStr = qIdx >= 0 ? hash.slice(qIdx + 1) : "";

  const m = path.match(/^#\/billet\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (!Number.isNaN(id)) {
      const params = new URLSearchParams(queryStr);
      return {
        kind: "billet",
        billetId: id,
        focusCardId: params.get("card") ?? undefined,
        openProblem: params.get("problem") === "1",
      };
    }
  }

  return { kind: "dashboard" };
}

export function navigateTo(route: Route): void {
  if (route.kind === "dashboard") {
    window.location.hash = "#/";
  } else if (route.kind === "practice") {
    window.location.hash = "#/practice";
  } else if (route.kind === "errors") {
    window.location.hash = "#/errors";
  } else if (route.kind === "exam") {
    window.location.hash = "#/exam";
  } else {
    let url = `#/billet/${route.billetId}`;
    const params: string[] = [];
    if (route.focusCardId)
      params.push(`card=${encodeURIComponent(route.focusCardId)}`);
    if (route.openProblem) params.push("problem=1");
    if (params.length > 0) url += "?" + params.join("&");
    window.location.hash = url;
  }
}
