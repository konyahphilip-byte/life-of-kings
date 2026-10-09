import appGuide from '../shared/chale-app-guide.json' with { type: 'json' };
import languageCatalog from '../shared/language-catalog.json' with { type: 'json' };

export const CHALE_GUIDE = appGuide;
export const APP_GUIDE_VERSION = appGuide.version;
export const CHALE_DESTINATIONS = [...new Set(appGuide.entries.map((entry) => entry.destination))];
const destinations = new Set(CHALE_DESTINATIONS);
const languages = new Set(languageCatalog.languages.map((language) => language.tag));
const dataModes = new Set(['standard', 'saver', 'extreme']);
const stopWords = new Set(['a', 'an', 'and', 'are', 'can', 'chale', 'do', 'for', 'help', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'please', 'the', 'this', 'to', 'use', 'what', 'with', 'you']);

// Only harmless UI context comes from the browser. Identity and consent flags
// come exclusively from the caller's authenticated server context.
export function normalizeChaleContext(client = {}, trusted = {}) {
  const source = client && typeof client === 'object' && !Array.isArray(client) ? client : {};
  const server = trusted && typeof trusted === 'object' && !Array.isArray(trusted) ? trusted : {};
  return {
    currentPage: destinations.has(source.currentPage) ? source.currentPage : 'Home',
    dataMode: dataModes.has(source.dataMode) ? source.dataMode : 'saver',
    signedIn: server.signedIn === true,
    learningEnabled: server.signedIn === true && server.learningEnabled === true,
    preferredLanguage: languages.has(server.preferredLanguage) ? server.preferredLanguage : 'en-GH',
  };
}

function tokensOf(value) {
  return String(value || '').slice(0, 4000).normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function searchAppGuide(query, currentPage = 'Home') {
  const tokens = [...new Set(tokensOf(query))].slice(0, 12);
  if (!tokens.length) {
    return appGuide.entries.filter((entry) => entry.destination === currentPage).slice(0, 2);
  }
  return appGuide.entries.map((entry) => {
    const title = new Set(tokensOf(`${entry.title} ${entry.destination}`));
    const keywords = new Set(tokensOf(entry.keywords.join(' ')));
    const body = new Set(tokensOf(`${entry.summary} ${entry.steps.join(' ')}`));
    const relevance = tokens.reduce((score, token) => score + (title.has(token) ? 5 : 0) + (keywords.has(token) ? 4 : 0) + (body.has(token) ? 1 : 0), 0);
    return { entry, score: relevance ? relevance + (entry.destination === currentPage ? 1 : 0) : 0 };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
    .slice(0, 3).map(({ entry }) => entry);
}
