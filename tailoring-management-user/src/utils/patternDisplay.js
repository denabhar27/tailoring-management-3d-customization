/**
 * Human-readable pattern label for saved 3D design data.
 * @param {{ pattern?: string, patternOtherText?: string } | null | undefined} design
 * @returns {string | null}
 */
export function formatPatternChoice(design) {
  if (!design?.pattern || design.pattern === 'none') return null;
  if (design.pattern === 'other') {
    const t = (design.patternOtherText || '').trim();
    return t ? `Other — ${t}` : 'Other';
  }
  return design.pattern.charAt(0).toUpperCase() + design.pattern.slice(1);
}
