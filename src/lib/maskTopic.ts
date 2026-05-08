export function maskTopic(content: string, topic: string): string {
  let result = content.replace(/\*\*/g, "");

  if (!topic || topic.trim().length < 3) return result;

  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  result = result.replace(regex, "[…]");

  return result;
}
