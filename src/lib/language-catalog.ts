import catalog from '../../shared/language-catalog.json';

export type LanguageCapability = 'FULL' | 'PARTIAL' | 'EXPERIMENTAL' | 'COMING_SOON';
export type LanguageCapabilityKey = 'interface' | 'search' | 'translation' | 'speechToText' | 'textToSpeech' | 'codeSwitching';

export type EcoLanguage = {
  tag: string;
  name: string;
  nativeName: string;
  countries: string[];
  capabilities: Record<LanguageCapabilityKey, LanguageCapability>;
};

export const ecoLanguages = catalog.languages as EcoLanguage[];
export const ecoLanguageTags = new Set(ecoLanguages.map((language) => language.tag));
export const ecoLanguageCountries = new Set(catalog.supportedCountries);

export type EcoLanguagePreferences = {
  preferredLanguage: string;
  contentLanguages: string[];
  voiceInputLanguage: string;
  voiceOutputLanguage: string;
  regionCode: string;
  allowCodeSwitching: boolean;
};

export const defaultEcoLanguagePreferences: EcoLanguagePreferences = {
  preferredLanguage: 'en-GH',
  contentLanguages: ['en-GH'],
  voiceInputLanguage: 'en-GH',
  voiceOutputLanguage: 'en-GH',
  regionCode: 'GH',
  allowCodeSwitching: false,
};

export const languageCapabilityLabel = (status: LanguageCapability) => ({
  FULL: 'Available',
  PARTIAL: 'Limited',
  EXPERIMENTAL: 'Pilot',
  COMING_SOON: 'Coming soon',
})[status];
