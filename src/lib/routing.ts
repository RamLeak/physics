export type Route =
  | { kind: "dashboard" }
  | { kind: "billet"; billetId: number }
  | { kind: "practice" }
  | { kind: "errors" }
  | { kind: "exam" };

export function parseHash(hash: string): Route {
  if (hash === "#/practice") return { kind: "practice" };
  if (hash === "#/errors") return { kind: "errors" };
  if (hash === "#/exam") return { kind: "exam" };
  const m = hash.match(/^#\/billet\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (!Number.isNaN(id)) return { kind: "billet", billetId: id };
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
    window.location.hash = `#/billet/${route.billetId}`;
  }
}
