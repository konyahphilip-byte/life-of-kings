const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "near", "show", "find", "need", "want",
  "what", "where", "please", "some", "your", "you", "our", "this", "that",
  "new", "good", "best", "more", "less", "help", "looking", "based", "open",
]);

export const BASE_RECOMMENDATION_INTERESTS = [
  "Art & design", "Books & learning", "Business", "Education", "Fashion",
  "Food", "Gaming", "Home", "Music", "Professional services", "Sports",
  "Technology", "Travel & local", "Wellness",
];

export function normalizeRecommendationTopic(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 64);
}

function titleTopics(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function recommendationTopicsForItem(item) {
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : String(item.tags || "");
  return [...new Set([
    normalizeRecommendationTopic(item.category),
    ...titleTopics(item.title),
    ...titleTopics(tags),
  ])].filter(Boolean).slice(0, 7);
}

export function recommendationInterestWeights(preferences = [], signals = [], now = Date.now()) {
  const weights = new Map();
  for (const topic of preferences) {
    const normalized = normalizeRecommendationTopic(topic);
    if (normalized) weights.set(normalized, (weights.get(normalized) || 0) + 5);
  }
  for (const signal of signals) {
    if (!Boolean(signal.active)) continue;
    const topic = normalizeRecommendationTopic(signal.topic);
    if (!topic) continue;
    const ageDays = Math.max(0, (now - Date.parse(signal.created_at)) / 86_400_000);
    const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / 45) : 1;
    weights.set(topic, (weights.get(topic) || 0) + Number(signal.weight || 0) * decay);
  }
  return weights;
}

export function summarizeRecommendationProfile(signals = [], now = Date.now()) {
  const profile = new Map();
  const actions = new Map();
  for (const signal of signals) {
    if (!Boolean(signal.active) || signal.action === "dismissed") continue;
    const topic = normalizeRecommendationTopic(signal.topic);
    if (!topic) continue;
    const ageDays = Math.max(0, (now - Date.parse(signal.created_at)) / 86_400_000);
    const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / 45) : 1;
    profile.set(topic, (profile.get(topic) || 0) + Number(signal.weight || 0) * decay);
    const byAction = actions.get(topic) || new Map();
    byAction.set(signal.action, (byAction.get(signal.action) || 0) + Number(signal.weight || 0) * decay);
    actions.set(topic, byAction);
  }
  return [...profile.entries()]
    .filter(([, weight]) => weight > 0.15)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([topic, weight]) => {
      const byAction = actions.get(topic);
      const purchased = byAction?.get("purchased") || 0;
      const saved = byAction?.get("saved") || 0;
      const opened = byAction?.get("opened") || 0;
      const learnedFrom = purchased >= Math.max(saved, opened) ? "purchases" : saved >= opened ? "saved items" : "items explored";
      return { topic, strength: Math.round(Math.min(25, weight) * 10) / 10, learnedFrom };
    });
}

export function summarizeAvoidedRecommendationTopics(signals = [], now = Date.now()) {
  const profile = new Map();
  for (const signal of signals) {
    if (!Boolean(signal.active) || signal.action !== "dismissed") continue;
    const topic = normalizeRecommendationTopic(signal.topic);
    if (!topic) continue;
    const ageDays = Math.max(0, (now - Date.parse(signal.created_at)) / 86_400_000);
    const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / 45) : 1;
    profile.set(topic, (profile.get(topic) || 0) + Number(signal.weight || 0) * decay);
  }
  return [...profile.entries()]
    .filter(([, weight]) => weight < -0.15)
    .sort((left, right) => left[1] - right[1])
    .slice(0, 6)
    .map(([topic, weight]) => ({ topic, strength: Math.round(Math.abs(Math.max(-25, weight)) * 10) / 10 }));
}

export function rankRecommendations(items, preferences = [], signals = [], limit = 6, now = Date.now()) {
  const preferredTopics = new Set(preferences.map(normalizeRecommendationTopic).filter(Boolean));
  const profile = new Map();
  const profileActions = new Map();
  const dismissed = new Set();

  for (const signal of signals) {
    if (!Boolean(signal.active)) continue;
    const topic = normalizeRecommendationTopic(signal.topic);
    if (!topic) continue;
    const ageDays = Math.max(0, (now - Date.parse(signal.created_at)) / 86_400_000);
    const decay = Number.isFinite(ageDays) ? Math.pow(0.5, ageDays / 45) : 1;
    profile.set(topic, (profile.get(topic) || 0) + Number(signal.weight || 0) * decay);
    if (Number(signal.weight) > 0) {
      const actions = profileActions.get(topic) || new Map();
      actions.set(signal.action, (actions.get(signal.action) || 0) + Number(signal.weight) * decay);
      profileActions.set(topic, actions);
    }
    if (signal.action === "dismissed") dismissed.add(`${signal.item_type}:${signal.item_id}`);
  }

  const ranked = items
    .filter((item) => !dismissed.has(`${item.itemType}:${item.id}`))
    .map((item) => {
      const topics = recommendationTopicsForItem(item);
      const explicitMatches = topics.filter((topic) => preferredTopics.has(topic));
      const learnedMatches = topics
        .map((topic) => ({ topic, weight: profile.get(topic) || 0 }))
        .filter((match) => match.weight > 0)
        .sort((left, right) => right.weight - left.weight);
      const ageDays = Math.max(0, (now - Date.parse(item.created_at)) / 86_400_000);
      const freshness = Number.isFinite(ageDays) ? Math.max(0, 2 - ageDays / 30) : 0;
      const learnedScore = learnedMatches.reduce((sum, match) => sum + Math.min(6, match.weight), 0);
      const avoidedScore = topics.reduce((sum, topic) => sum + Math.min(0, Math.max(-6, profile.get(topic) || 0)) * 0.75, 0);
      const score = Number(item.search_score || 0) + explicitMatches.length * 5 + learnedScore + avoidedScore + freshness;
      const primaryMatch = explicitMatches[0] || learnedMatches[0]?.topic;
      let reason = `A recent ${item.category || item.itemType} listing`;
      if (explicitMatches.length) {
        reason = `Matches your chosen “${explicitMatches[0]}” interest`;
      } else if (primaryMatch) {
        const actions = profileActions.get(primaryMatch);
        const purchased = actions?.get("purchased") || 0;
        const saved = actions?.get("saved") || 0;
        const opened = actions?.get("opened") || 0;
        const followed = actions?.get("followed") || 0;
        const watched = actions?.get("watched") || 0;
        const liked = actions?.get("liked") || 0;
        const completed = actions?.get("completed") || 0;
        const attended = actions?.get("attended") || 0;
        const applied = actions?.get("applied") || 0;
        if (followed >= Math.max(purchased, saved, opened, watched, liked, completed, attended, applied)) {
          reason = `Because you follow creators in ${primaryMatch}`;
        } else if (watched >= Math.max(purchased, saved, opened, liked, completed, attended, applied)) {
          reason = `Because you watched ${primaryMatch} Reels`;
        } else if (completed >= Math.max(purchased, saved, opened, liked, attended, applied)) {
          reason = `Because you completed related ${primaryMatch} work`;
        } else if (attended >= Math.max(purchased, saved, opened, liked, applied)) {
          reason = `Because you attended ${primaryMatch} events`;
        } else if (applied >= Math.max(purchased, saved, opened, liked)) {
          reason = `Because you applied to ${primaryMatch} opportunities`;
        } else if (liked >= Math.max(purchased, saved, opened)) {
          reason = `Because you like ${primaryMatch} content`;
        } else {
          const learnedFrom = purchased >= Math.max(saved, opened) ? "purchased" : saved >= opened ? "saved" : "explored";
          reason = `Because you ${learnedFrom} similar ${primaryMatch} listings`;
        }
      }
      return { ...item, score, reason, saved: false, _topics: topics };
    })
    .sort((left, right) => right.score - left.score || String(right.created_at).localeCompare(String(left.created_at)));

  const selected = [];
  const categoryCounts = new Map();
  for (const item of ranked) {
    const category = normalizeRecommendationTopic(item.category) || item.itemType;
    if ((categoryCounts.get(category) || 0) >= 2) continue;
    selected.push(item);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected.map(({ _topics, ...item }) => item);
}
