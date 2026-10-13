import { createLocaleStore } from './helper';
import type { Lang } from './state';

import { dict as headerDict } from './header';
import { dict as loginDict } from './login';
import { dict as dashboardDict } from './dashboard';
import { dict as scannerDict } from './scanner';
import { dict as maintenanceDict } from './maintenance';
import { dict as historyDict } from './history';
import { dict as specsDict } from './specs';
import { dict as settingsDict } from './settings';
import { dict as usersDict } from './users';
import { dict as changePasswordDict } from './changePassword';
import { dict as splashDict } from './splash';
import { dict as syncDict } from './sync';
import { dict as unauthorizedDict } from './unauthorized';
import { dict as manualDict } from './manual';
import { dict as commonDict } from './common';

// 전체 통합 사전 (하위 호환 및 전역 번역 참조용)
export const fullDictionary = {
  ...headerDict,
  ...loginDict,
  ...dashboardDict,
  ...scannerDict,
  ...maintenanceDict,
  ...historyDict,
  ...specsDict,
  ...settingsDict,
  ...usersDict,
  ...changePasswordDict,
  ...splashDict,
  ...syncDict,
  ...unauthorizedDict,
  ...manualDict,
  ...commonDict,
} satisfies Record<string, Record<Lang, any>>;

export type FullTranslationKey = keyof typeof fullDictionary;

export const t = createLocaleStore(fullDictionary);

export * as headerLocale from './header';
export * as loginLocale from './login';
export * as dashboardLocale from './dashboard';
export * as scannerLocale from './scanner';
export * as maintenanceLocale from './maintenance';
export * as historyLocale from './history';
export * as specsLocale from './specs';
export * as settingsLocale from './settings';
export * as usersLocale from './users';
export * as changePasswordLocale from './changePassword';
export * as splashLocale from './splash';
export * as syncLocale from './sync';
export * as unauthorizedLocale from './unauthorized';
export * as manualLocale from './manual';
export * as commonLocale from './common';

