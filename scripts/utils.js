export function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    let i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    let j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

export function findBestMatch(target, candidates, threshold = 3) {
    if (!target) return null;

    let bestMatch = null;
    let minDistance = Infinity;

    const lowerTarget = target.toLowerCase();

    // First try exact match (case-insensitive) for speed
    // This assumes candidates are plain strings. If candidates are objects, caller must map them.
    for (const candidate of candidates) {
        const lowerCandidate = candidate.toLowerCase();

        if (lowerCandidate === lowerTarget) {
            return { match: candidate, distance: 0 };
        }

        const distance = levenshteinDistance(lowerTarget, lowerCandidate);

        // Adaptive threshold: allow more errors for longer strings
        // e.g. "Corn" (4 chars) -> max 1 error
        // "Baked Corn" (10 chars) -> max 4 errors
        const maxAllowed = Math.floor(candidate.length * 0.4);
        const effectiveThreshold = Math.min(threshold, maxAllowed);

        if (distance <= effectiveThreshold && distance < minDistance) {
            minDistance = distance;
            bestMatch = candidate;
        }
    }

    return bestMatch ? { match: bestMatch, distance: minDistance } : null;
}
