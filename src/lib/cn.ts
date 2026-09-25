/** Joins class names, skipping falsy values. Deliberately tiny: the design
 * system avoids conflicting utility classes by construction, so there's no
 * need for a class-merging library. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
