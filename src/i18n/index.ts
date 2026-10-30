import { en, type MessageKey } from './en';

export type { MessageKey } from './en';

export type MessageParams = Record<string, string | number>;

const messages: Record<MessageKey, string> = en;

/** Looks up the English copy for `key` and replaces `{name}` placeholders from `params`. */
export function t(key: MessageKey, params?: MessageParams): string {
  const template: string | undefined = messages[key];
  if (template === undefined) return key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Hook-shaped accessor for `t`, so components keep `const t = useT()`. */
export function useT(): (key: MessageKey, params?: MessageParams) => string {
  return t;
}
