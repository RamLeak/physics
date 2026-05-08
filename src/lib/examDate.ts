export const EXAM_DATE = new Date("2026-05-14T09:00:00");

export function daysUntilExam(now: Date = new Date()): number {
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const examStart = new Date(
    EXAM_DATE.getFullYear(),
    EXAM_DATE.getMonth(),
    EXAM_DATE.getDate(),
  );
  const diff = examStart.getTime() - todayStart.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function shouldShowArchiveReminder(
  archivedCount: number,
  now: Date = new Date(),
): boolean {
  if (archivedCount === 0) return false;
  const days = daysUntilExam(now);
  return days === 1 || days === 0;
}
