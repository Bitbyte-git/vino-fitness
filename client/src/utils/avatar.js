/**
 * Computes initials from first name and last name.
 * If multiple words: takes the first letter of the first name and the first letter of the last name.
 * If single word: takes the first two characters.
 *
 * Examples:
 *  "Thor A" -> "TA"
 *  "Sanjay Shetty" -> "SS"
 *  "Chetan Joshi" -> "CJ"
 *  "Senthilkumar S" -> "SS"
 *  "Siddharth Yadav" -> "SY"
 *  "Pooja" -> "PO"
 */
export function getInitials(name, fallback = 'M') {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
