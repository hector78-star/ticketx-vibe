/**
 * Small fuzzy matcher for the seller's event search.
 *
 * Deliberately dependency-free and simple: the event catalog is small, and a seller typing
 * "reading fest" or "readingfestival" needs to land on "Reading Festival 2026" without knowing the
 * exact wording. Scoring, highest first:
 *
 *   4  exact match
 *   3  starts with the query
 *   2  contains the query
 *   1  every query character appears in order (subsequence) - catches typos and abbreviations
 *   0  no match
 *
 * Word-boundary matches are nudged above mid-word ones so "fest" ranks "Reading Festival" above a
 * hypothetical "Manifesto Night".
 */
const normalise = str =>
  (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isSubsequence = (needle, haystack) => {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
    if (haystack[j] === needle[i]) {
      i += 1;
    }
  }
  return i === needle.length;
};

export const fuzzyScore = (query, text) => {
  const q = normalise(query);
  const t = normalise(text);
  if (!q) {
    return 1;
  }
  if (!t) {
    return 0;
  }
  if (t === q) {
    return 4;
  }
  if (t.startsWith(q)) {
    return 3;
  }
  if (t.includes(q)) {
    // A match at a word boundary is a better match than one buried mid-word.
    return t.split(' ').some(word => word.startsWith(q)) ? 2.5 : 2;
  }
  // Compare without spaces so "readingfest" still matches "reading festival".
  if (isSubsequence(q.replace(/ /g, ''), t.replace(/ /g, ''))) {
    return 1;
  }
  return 0;
};

/**
 * Rank items by how well `query` matches the string returned by `getText`.
 * Ties keep the original order, so an empty query leaves the list untouched.
 */
export const fuzzySearch = (items, query, getText, limit = 25) => {
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, getText(item)) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(entry => entry.item);
};
