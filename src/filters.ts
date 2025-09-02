// Basic profanity / slur filtering (server-side authoritative)
// NOTE: This is a heuristic and NOT exhaustive. Patterns intentionally broad to catch obfuscations.
// Approach: replace matched segments with ***; trim & collapse whitespace; fallback to 'anon' if empty.

const BAD_PATTERNS: RegExp[] = [
  // Racial slur (common obfuscations: numbers, repeated chars, separators). We intentionally do not expose the raw word plainly.
  /n[\W_]*[i1l|![\W_]*g+[\W_]*g*[\W_]*[ae4@]?/i,
  // Generic profanity roots (expand cautiously)
  /f[\W_]*u[\W_]*c[\W_]*k+/i,
  /s[\W_]*h[\W_]*i[\W_]*t+/i,
  /b[\W_]*i[\W_]*t[\W_]*c[\W_]*h+/i,
  /c[\W_]*u[\W_]*n[\W_]*t+/i,
  /a[\W_]*s[\W_]*s+h*[\W_]*/i,
];

export function sanitizeName(input: string): string {
  let name = input.normalize('NFKC');
  for (const pattern of BAD_PATTERNS) {
    name = name.replace(pattern, '***');
  }
  // Collapse multiple asterisks / spaces
  name = name.replace(/\*{2,}/g, '***').replace(/\s{2,}/g, ' ').trim();
  if (!name || name === '***') name = 'anon';
  // Enforce visible length and remove leading punctuation spam
  name = name.replace(/^[^A-Za-z0-9]+/, '');
  if (!name) name = 'anon';
  return name.slice(0, 24);
}
