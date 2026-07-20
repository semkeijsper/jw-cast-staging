import type { Category, Language, MediaFile, Translations, Video } from '~/types';
import type { SearchResponse } from '~/types/search';

export const MEDIATOR_URL = 'https://b.jw-cdn.org/apis/mediator/v1';
export const SEARCH_URL = 'https://b.jw-cdn.org/apis/search/results';
export const TOKEN_URL = 'https://b.jw-cdn.org/tokens/jworg.jwt';

export async function fetchLanguages(code: string): Promise<Language[]> {
  const { languages } = await $fetch<{ languages: Language[] }>(
    `${MEDIATOR_URL}/languages/${code}/all?clientType=www`,
  );
  return languages;
}

export async function fetchTranslations(code: string): Promise<Translations | undefined> {
  const response = await $fetch<{ translations: { [key: string]: Translations } }>(
    `${MEDIATOR_URL}/translations/${code}`,
  );
  return response.translations[code];
}

export async function fetchCategory(code: string, name: string, limit?: number): Promise<Category> {
  const base = `${MEDIATOR_URL}/categories/${code}/${name}?detailed=1&clientType=www`;
  const url = limit ? `${base}&limit=${limit}` : base;
  return (await $fetch<{ category: Category }>(url)).category;
}

export async function fetchMediaItem(langCode: string, lank: string): Promise<Video | undefined> {
  const { media } = await $fetch<{ media: Video[] }>(
    `${MEDIATOR_URL}/media-items/${langCode}/${lank}?clientType=www`,
  );
  return media[0];
}

export function fetchSearch(
  code: string,
  query: string,
  options: { sort: string; offset: number; limit: number },
  jwt: string,
): Promise<SearchResponse> {
  const url = `${SEARCH_URL}/${code}/videos?sort=${options.sort}&offset=${options.offset}&limit=${options.limit}&q=${encodeURIComponent(query)}`;
  return $fetch<SearchResponse>(url, { headers: { Authorization: `Bearer ${jwt}` } });
}

export function fetchToken(): Promise<string> {
  return $fetch<string>(TOKEN_URL, { responseType: 'text' });
}

// 144p exists only as a low-bandwidth fallback; hide it from download/cast pickers
export function downloadableFiles(video: Video | null): MediaFile[] {
  return video?.files.filter(f => f.label !== '144p') ?? [];
}
