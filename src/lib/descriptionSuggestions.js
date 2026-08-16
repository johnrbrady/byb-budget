/**
 * Predict descriptions from this household's own transaction history.
 * Prefix matches come first, then frequency and recency. Matching is
 * case-insensitive, while the most recently used spelling is preserved.
 */
export function descriptionSuggestions(transactions, query, { limit = 5, type } = {}) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return [];

  const byDescription = new Map();
  (transactions || []).forEach((transaction, index) => {
    if (type && transaction.type !== type) return;
    const label = String(transaction.description || "").trim();
    if (!label) return;
    const key = label.toLocaleLowerCase();
    const existing = byDescription.get(key);
    byDescription.set(key, {
      label,
      key,
      count: (existing?.count || 0) + 1,
      recency: Math.max(existing?.recency ?? -1, index),
    });
  });

  return [...byDescription.values()]
    .filter((entry) => entry.key !== needle && entry.key.includes(needle))
    .sort((a, b) =>
      Number(b.key.startsWith(needle)) - Number(a.key.startsWith(needle)) ||
      b.count - a.count ||
      b.recency - a.recency ||
      a.label.localeCompare(b.label)
    )
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.label);
}
