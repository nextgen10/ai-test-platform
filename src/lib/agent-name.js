/**
 * Hub frontmatter often stores `name` as the file id (`requirement-analyst`).
 * The console should still read as a person's role, not a slug.
 */
export function displayAgentName(id, name) {
    const trimmed = name?.trim();
    if (trimmed && trimmed !== id && !/[-_]/.test(trimmed)) return trimmed;
    const source = trimmed && trimmed !== id ? trimmed : id;
    return source
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
