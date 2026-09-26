/**
 * The last sentence of a title that has more than one, so the markup can keep it on a line of
 * its own.
 *
 * At display size "Set a goal. Get gentle steps." no longer fits one line, and `text-wrap:
 * balance` picks the most even split rather than the sensible one: "Set a goal. Get" / "gentle
 * steps." Holding the second sentence together leaves the sentence break as the only good place
 * to wrap. A single-sentence title returns undefined and wraps as plain text would.
 */
export function trailingSentence(text: string): string | undefined {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.length > 1 ? sentences[sentences.length - 1] : undefined;
}
