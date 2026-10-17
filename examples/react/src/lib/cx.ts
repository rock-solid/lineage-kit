/** Joins class names, skipping empty ones. */
export const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
