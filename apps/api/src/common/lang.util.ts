// Language layer — Pulse answers in the user's own language (vision: "every age,
// every country, every income level"). The phone sends `x-language`; live Gemini
// responses are instructed to reply in that language. Adding a language = one
// entry here + one dictionary on the mobile side. India-first, but open-ended.

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  mr: 'Marathi',
  kn: 'Kannada',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ml: 'Malayalam',
  ur: 'Urdu',
};

export function resolveLanguage(header?: string): string {
  const code = header?.trim().toLowerCase().split('-')[0];
  return code && LANGUAGE_NAMES[code] ? code : 'en';
}

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? 'English';
}

/** A system-prompt clause telling the model which language to reply in. */
export function languageDirective(code: string): string {
  return code === 'en'
    ? ''
    : `Respond entirely in ${languageName(code)}, in a natural, everyday register.`;
}
