import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { setApiLanguage } from '../api/client';
import {
  LANGUAGES,
  TranslationKey,
  dictionaries,
  en,
} from './translations';

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: string;
  setLang: (code: string) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
  languages: typeof LANGUAGES;
  ready: boolean;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => en[k] ?? (k as string),
  languages: LANGUAGES,
  ready: false,
});

const STORAGE_KEY = 'pulse.lang';

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : '',
  );
}

function deviceLang(): string {
  try {
    const code = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    return dictionaries[code] ? code : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const initial = saved && dictionaries[saved] ? saved : deviceLang();
      setLangState(initial);
      setApiLanguage(initial); // so the backend answers in this language
      setReady(true);
    })();
  }, []);

  const setLang = (code: string) => {
    setLangState(code);
    setApiLanguage(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  };

  const t = (key: TranslationKey, vars?: Vars): string => {
    const dict = dictionaries[lang] ?? {};
    return interpolate(dict[key] ?? en[key] ?? (key as string), vars);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, languages: LANGUAGES, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
