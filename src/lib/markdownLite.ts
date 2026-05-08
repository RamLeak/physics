export function renderMarkdownLite(text: string): string {
  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const paragraphs = out.split(/\n\n+/).map((p) => {
    if (/^- /.test(p.trim())) {
      const items = p
        .split("\n")
        .filter((l) => l.trim().startsWith("- "))
        .map((l) => `<li>${l.replace(/^- /, "")}</li>`)
        .join("");
      return `<ul class="list-disc pl-5 space-y-1">${items}</ul>`;
    }
    if (/^\d+\. /.test(p.trim())) {
      const items = p
        .split("\n")
        .filter((l) => /^\d+\. /.test(l.trim()))
        .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
        .join("");
      return `<ol class="list-decimal pl-5 space-y-1">${items}</ol>`;
    }
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  });

  return paragraphs.join("");
}
