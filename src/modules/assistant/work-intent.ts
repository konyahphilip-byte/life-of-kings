// Routing only, never authorization. The existing work-status API derives the
// account from its session; no name, record ID or model output selects an actor.
export function privateWorkIntent(value: string): 'mine' | 'unsupported' | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 1200) return null;
  const text = value.normalize('NFKC').replace(/[‘’ʼ]/g, "'").toLowerCase();
  if (/\b(?:wallet|balances?|payments?|payouts?|refunds?|transfers?|banks?|invoices?|receipts?|interviews?|support|verification|applications?|courses?|learning|orders?)\b/.test(text)) return null;
  if (/\b(?:[a-z]+n't|cannot|not|no|without|avoid|refrain|never|stop|cancel|hide|hidden|explain|translate|translation|grammar|sentence|example|fiction)\b/.test(text)) return null;
  if (!/\b(?:jobs?|bookings?|collections?|pickups?|requests?|work|quick\s*&?\s*handi)\b/.test(text)) return null;
  if (/\bhow\s+(?:do|can|should|would|to)\b/.test(text)) return null;
  const requested = /\b(?:status|progress|how many)\b/.test(text)
    || /\b(?:show|check|list|view)\b/.test(text)
    || /\bwhere\s+(?:is|are)\b/.test(text);
  if (!requested) return null;
  const contractions = new Set(['what', 'where', 'how', 'who', 'when', 'why', 'that', 'there', 'here', 'it', 'let']);
  const namedOwner = [...text.matchAll(/(?:^|[^\p{L}\p{N}_])([\p{L}][\p{L}\p{M}-]{0,63})'s\b/gu)]
    .some(match => !contractions.has(match[1]));
  const selector = text.includes('@') || namedOwner
    || /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i.test(text)
    || /\b(?:user|owner|account|customer|provider|organization|job)[_-]?id\s*[:=]/.test(text)
    || /\b(?:his|her|their|someone|another|other users?)\b/.test(text)
    || /\ball\s+(?:users?\s+|private\s+|customers?\s+)?(?:jobs?|bookings?|collections?|requests?)\b/.test(text);
  if (selector) return 'unsupported';
  // Only bounded affirmative shapes initiate a read. Capability, method and
  // hypothetical questions can mention the same words without asking us to act.
  const item = '(?:(?:waste|quick\\s*&?\\s*handi)\\s+)?(?:collection requests?|pickup requests?|collections?|pickups?|bookings?|jobs?|requests?|work)';
  const owned = `(?:my\\s+${item}(?:\\s+(?:status|progress))?|(?:the\\s+)?${item}\\s+assigned to me)`;
  const subject = `(?:(?:the\\s+)?(?:status|progress)\\s+of\\s+)?${owned}`;
  const phrase = text.trim().replace(/[?!.]+$/, '').trim().replace(/\s+/g, ' ');
  const affirmative = new RegExp(`^(?:(?:can|could|would) you\\s+)?(?:please\\s+)?(?:show|check|list|view)(?:\\s+me)?\\s+${subject}(?:\\s+please)?$`);
  const question = new RegExp(`^(?:what(?: is| are|'s)|where (?:is|are))\\s+${subject}$`);
  const count = new RegExp(`^how many ${item} do i have$`);
  return affirmative.test(phrase) || question.test(phrase) || count.test(phrase) ? 'mine' : null;
}
