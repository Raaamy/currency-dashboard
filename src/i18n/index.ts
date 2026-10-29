import { useCallback } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { en } from './en';
import { nl, type MessageKey } from './nl';
import type { Language } from './locale';

export { detectLanguage, isLanguage, LANGUAGES, localeFor, type Language } from './locale';
export type { MessageKey } from './nl';

export type MessageParams = Record<string, string | number>;

export const dictionaries: Record<Language, Record<MessageKey, string>> = { nl, en };

/** Looks up `key` for `language` and replaces `{name}` placeholders from `params`. */
export function t(language: Language, key: MessageKey, params?: MessageParams): string {
  const template: string | undefined = dictionaries[language]?.[key];
  if (template === undefined) return key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Translator bound to the current settings language. */
export function useT(): (key: MessageKey, params?: MessageParams) => string {
  const { language } = useSettings();
  return useCallback(
    (key: MessageKey, params?: MessageParams) => t(language, key, params),
    [language],
  );
}
