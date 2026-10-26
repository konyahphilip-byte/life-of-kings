// Canonical app prompt buttons are shared with server retrieval. A page or a
// common word alone must not turn everyday conversation into app instructions.
export function chalePagePrompts(page) {
  if (page === 'Money & Trust') return ['Explain the Money & Trust test records', 'How do I report a record problem?', 'What does Trust Passport support now?'];
  if (page === 'Waste') return ['How do I request a waste collection?', 'Help me solve a collection problem', 'Suggest a way to improve recycling'];
  if (page === 'Marketplace') return ['Help me find a product', 'How do I start selling?', 'Help improve my product idea'];
  if (page === 'Quick&Handi') return ['How do I request a local service?', 'Help me describe a job', 'How can I grow as a provider?'];
  if (page === 'Settings') return ['How do I change my language?', 'Help me report a problem', 'How do I pause learning?'];
  return [`Help me use ${page}`, 'Help me report a problem', 'Help me improve an idea'];
}
