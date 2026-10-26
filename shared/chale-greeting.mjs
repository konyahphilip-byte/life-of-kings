// Match only an entire greeting, never a greeting followed by a real request.
export function chaleGreeting(value) {
  if (typeof value !== 'string' || value.length > 1200) return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return /^(?:(?:hi|hello|hey)(?: there)?|good (?:morning|afternoon|evening))(?:[,\s]+chale(?: ai)?)?[!.?]*$/i.test(text)
    ? 'Hi! What would you like help with today?'
    : null;
}
