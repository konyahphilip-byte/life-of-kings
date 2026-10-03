import englishMessages from './locales/en-GH.json';

export type TranslationKey = keyof typeof englishMessages;

const dictionaries: Record<string, Partial<typeof englishMessages>> = {
  'en-GH': englishMessages,
};

export function t(key: TranslationKey, language = 'en-GH'): string {
  const dictionary = dictionaries[language] || dictionaries[language.split('-')[0]];
  return dictionary?.[key] || englishMessages[key] || key;
}
