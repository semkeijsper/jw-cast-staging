import type { Language } from '~/types';

export function languageLabel(item: Language): string {
  return item.name === item.vernacular ? item.name : `${item.name} (${item.vernacular})`;
}
