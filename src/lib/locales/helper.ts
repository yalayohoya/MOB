import { lang, type Lang } from './state';
import { derived, type Readable } from 'svelte/store';

export type { Lang };

/**
 * 도메인/화면별 단어장을 Svelte 반응형 스토어 $t 및 레거시 t[$lang] 겸용 객체로 래핑
 */
export function createLocaleStore<T extends Record<string, Record<Lang, any>>>(
  dict: T
): Readable<{ [K in keyof T]: T[K]['ko'] }> & {
  ko: { [K in keyof T]: T[K]['ko'] };
  es: { [K in keyof T]: T[K]['es'] };
} {
  const koDict = {} as any;
  const esDict = {} as any;
  for (const [k, v] of Object.entries(dict)) {
    koDict[k] = (v as any)['ko'];
    esDict[k] = (v as any)['es'];
  }

  const store = derived(lang, ($lang) => ($lang === 'es' ? esDict : koDict));
  return Object.assign(store, {
    ko: koDict,
    es: esDict,
  });
}
