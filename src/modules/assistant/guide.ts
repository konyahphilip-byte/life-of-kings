import guideDocument from '../../../shared/chale-app-guide.json';
import { chalePagePrompts } from '../../../shared/chale-prompts.mjs';
import type { AssistantDestination } from './assistant';

export type GuideEntry = {
  id: string;
  title: string;
  destination: AssistantDestination;
  availability: 'implemented' | 'preview' | 'provider_required';
  summary: string;
  steps: string[];
  keywords: string[];
};

const destinations = new Set<AssistantDestination>([
  'Home', 'Explore', 'Create', 'Messages', 'Calls & Live', 'Reels', 'Profile',
  'Marketplace', 'Opportunities', 'Gaming', 'Communities', 'Quick&Handi', 'Waste',
  'EcoVibes ID', 'Rewards', 'Wallet', 'Money & Trust', 'Settings',
]);

export function isAssistantDestination(value: unknown): value is AssistantDestination {
  return typeof value === 'string' && destinations.has(value as AssistantDestination);
}

function isGuideEntry(value: unknown): value is GuideEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.title === 'string'
    && isAssistantDestination(entry.destination)
    && ['implemented', 'preview', 'provider_required'].includes(String(entry.availability))
    && typeof entry.summary === 'string'
    && Array.isArray(entry.steps) && entry.steps.every((step) => typeof step === 'string')
    && Array.isArray(entry.keywords) && entry.keywords.every((keyword) => typeof keyword === 'string');
}

export const appGuideVersion = guideDocument.version;
export const appGuides: GuideEntry[] = guideDocument.entries.filter(isGuideEntry) as GuideEntry[];
const guidesById = new Map(appGuides.map((entry) => [entry.id, entry]));

// The server may select a guide; the app renders its checked-in, verified copy.
export function verifiedGuides(value: unknown): GuideEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    const canonical = typeof candidate.id === 'string' ? guidesById.get(candidate.id) : undefined;
    if (!canonical || candidate.destination !== canonical.destination || seen.has(canonical.id)) return [];
    seen.add(canonical.id);
    return [canonical];
  }).slice(0, 4);
}

const stopWords = new Set(['the', 'and', 'for', 'with', 'how', 'can', 'you', 'help', 'does', 'this', 'that', 'what', 'want', 'need', 'please', 'open', 'use', 'app', 'page', 'me', 'my', 'to', 'in', 'of', 'is']);
const words = (value: string) => value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter((word) => !stopWords.has(word)) || [];

export function localAppGuides(query: string, currentPage: AssistantDestination): GuideEntry[] {
  const queryWords = [...new Set(words(query))];
  const ranked = appGuides.map((entry) => {
    const terms = new Set(words(`${entry.title} ${entry.destination} ${entry.summary} ${entry.keywords.join(' ')}`));
    const keywords = new Set(words(entry.keywords.join(' ')));
    const matches = queryWords.reduce((total, word) => total + (terms.has(word) ? 1 : 0) + (keywords.has(word) ? 2 : 0), 0);
    const score = matches + (matches > 0 && entry.destination === currentPage ? 2 : 0);
    return { entry, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  if (ranked.length) return ranked.slice(0, 3).map(({ entry }) => entry);
  return appGuides.filter((entry) => entry.destination === currentPage).slice(0, 2);
}

export function pagePrompts(page: AssistantDestination): string[] {
  return chalePagePrompts(page);
}
