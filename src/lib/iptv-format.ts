// Turns the portal's raw fields into display-ready values.

/**
 * Portal names carry a language/region prefix: "EN - Movie (2026)", "PK| GEO TV", "UK: BBC".
 * Split it into a short tag and the clean title.
 */
export function splitTag(name: string | undefined): { tag: string | null; title: string } {
  const raw = (name || "").trim();
  const match = raw.match(/^([A-Z0-9]{2,5}(?:[ -][A-Z]{2,3})?)\s*[|:\-–]\s*(.+)$/);
  if (!match) return { tag: null, title: raw };
  return { tag: match[1], title: match[2].trim() };
}

/** "2026-09-26" or "2026" → "2026"; anything else → null */
export function formatYear(year: string | number | undefined): string | null {
  const match = String(year ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

/** "8" / "7.4" → "8.0" / "7.4"; "N/A", "0", "" → null */
export function formatRating(rating: string | number | undefined): string | null {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : null;
}

export function isHd(hd: string | number | undefined): boolean {
  return String(hd) === "1";
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
