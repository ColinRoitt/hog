/**
 * Signed timeline values: AD years are positive (e.g. 1865), BC years are negative (e.g. -551).
 */

export function formatHistoricalYear(signedYear) {
  if (!Number.isFinite(signedYear)) {
    return String(signedYear);
  }

  if (signedYear < 0) {
    return `${Math.abs(signedYear).toLocaleString("en-GB")} BC`;
  }

  return `${signedYear.toLocaleString("en-GB")} AD`;
}

/**
 * @param {string} yearDigits - digits only (magnitude)
 * @param {boolean} isBC
 * @returns {number | null} signed year, or null if invalid
 */
export function signedYearFromParts(yearDigits, isBC) {
  const trimmed = String(yearDigits ?? "").trim().replace(/,/g, "");
  if (!trimmed) {
    return null;
  }

  const magnitude = Number(trimmed);
  if (!Number.isFinite(magnitude) || magnitude < 0) {
    return null;
  }

  if (isBC) {
    if (magnitude === 0) {
      return null;
    }
    return -magnitude;
  }

  return magnitude;
}
