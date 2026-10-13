import { createLocaleStore } from './helper';
import type { Lang } from './helper';

export const dict = {
  manualTitle: { ko: "이용자 매뉴얼", es: "Manual de usuario" },
} satisfies Record<string, Record<Lang, any>>;

export type ManualKey = keyof typeof dict;

/**
 * [MANUAL 전용 반응형 언어 스토어]
 * 사용법:
 *   import { t } from '$lib/locales/manual';
 *   {$t.manualTitle}
 */
export const t = createLocaleStore(dict);
