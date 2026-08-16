import { addPeriod, dayOfMonth } from "./utils.js";

/** Return every due date through today and the first future due date. */
export function recurringCatchUp(rule, today, maxOccurrences = 600) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule?.nextDueDate || "")) throw new TypeError("Recurring rule has an invalid next due date");
  const dueDay = rule.dueDay || dayOfMonth(rule.nextDueDate);
  const dates = [];
  let nextDueDate = rule.nextDueDate;
  while (nextDueDate <= today) {
    if (dates.length >= maxOccurrences) throw new RangeError("Recurring rule has too many missed occurrences");
    dates.push(nextDueDate);
    const advanced = addPeriod(nextDueDate, rule.frequency, dueDay);
    if (!advanced || advanced <= nextDueDate) throw new TypeError("Recurring rule has an invalid frequency");
    nextDueDate = advanced;
  }
  return { dates, nextDueDate, dueDay };
}
