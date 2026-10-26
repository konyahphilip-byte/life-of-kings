// Match only an entire greeting, never a greeting followed by a real request.
export function chaleGreeting(value) {
  if (typeof value !== 'string' || value.length > 1200) return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (/^(?:(?:hi|hello|hey)(?: there)?|good (?:morning|afternoon|evening))(?:[,\s]+chale(?: ai)?)?[!.?]*$/i.test(text)) {
    return 'Hi! What would you like help with today?';
  }
  if (/^(?:(?:hi|hello|hey)[!,]?\s+)?how are you(?: doing)?(?:[,\s]+chale(?: ai)?)?[!.?]*$/i.test(text)) {
    return "I'm here and ready to help. What would you like to talk about?";
  }
  return null;
}
