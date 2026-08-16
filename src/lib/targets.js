const monthDistance = (from, to) => {
  const [fromYear, fromMonth] = from.slice(0, 7).split("-").map(Number);
  const [toYear, toMonth] = to.slice(0, 7).split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
};

/**
 * Turn an accumulating envelope's amount/date into an actionable monthly plan.
 * The current partial month is excluded: on 1 September, a March deadline has
 * six future monthly fills (Oct–Mar), matching how the app's Fill action works.
 */
export function envelopeTarget(category, today) {
  const targetAmount = category?.targetAmount || 0;
  const targetDate = category?.targetDate || "";
  const balance = category?.envelopeBalance || 0;
  if (!Number.isSafeInteger(targetAmount) || targetAmount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
  const remaining = Math.max(0, targetAmount - balance);
  const monthGap = monthDistance(today, targetDate);
  const overdue = targetDate < today;
  const monthsRemaining = Math.max(1, monthGap);
  const requiredMonthly = remaining === 0 ? 0 : Math.ceil(remaining / monthsRemaining);
  const monthlyFill = category.baseAmount || 0;
  const status = remaining === 0 ? "complete" : overdue ? "overdue" : monthlyFill >= requiredMonthly ? "on-track" : "behind";
  return { targetAmount, targetDate, balance, remaining, monthsRemaining, requiredMonthly, monthlyFill, status };
}
