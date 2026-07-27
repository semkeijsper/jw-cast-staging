/**
 * Per-locale SEO copy for the language routes.
 *
 * Used twice:
 *  - at build time by `build/prerender-seo.ts`, which patches the prerendered
 *    `/:language/index.html` shells (see nuxt.config `nitro.prerender`)
 *  - at runtime by the page's `useHead`, so client-side language switches keep
 *    the title/description in sync
 *
 * Because nuxt.config loads this outside the app's alias resolution, this file
 * must stay free of `~`/`@` imports.
 */

export interface SeoMeta {
  title: string;
  description: string;
}

/**
 * Origin the canonical/OG URLs are built from, without a trailing slash.
 *
 * Overridable so the staging deploy (a GitHub Pages project page under
 * /jw-cast-staging/) emits its own canonicals instead of pointing at production.
 * nuxt.config mirrors the value into `vite.define` so the client bundle sees the
 * same string as the build-time prerender patcher.
 */
export const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL || 'https://jwcast.semdev.nl';

/** Locales that get a prerendered HTML shell — keep in sync with public/sitemap.xml. */
export const prerenderLocales = [
  'en', 'nl', 'ar', 'bn', 'cmn_hans', 'cmn_hant', 'de', 'el', 'es', 'fa', 'fr',
  'hi', 'it', 'ja', 'ko', 'pa', 'pl', 'pt', 'pt_pt', 'ru', 'tr',
];

/** Locale → BCP 47 tag for `<html lang>` and `hreflang` (sitemap uses these too). */
const bcp47: Record<string, string> = {
  cmn_hans: 'zh-hans',
  cmn_hant: 'zh-hant',
  pt_pt: 'pt-pt',
};

export function htmlLangOf(locale: string): string {
  return bcp47[locale] ?? locale;
}

/**
 * Locales without an entry fall back to `en`. Coverage mirrors config/uiStrings.ts,
 * so the sitemap locales that have no shell translation yet (ar, bn, cmn_hant, el,
 * fa, hi, pa, pt_pt, tr) are served the English copy rather than nothing.
 */
export const seoMeta: Record<string, SeoMeta> = {
  en: {
    title: 'JW Cast — jw.org videos with subtitles in any language',
    description: 'Watch jw.org videos and cast them to your TV with subtitles in any language, or download the video and subtitle files for a player such as VLC.',
  },
  nl: {
    title: 'JW Cast — jw.org-video\'s met ondertiteling in elke taal',
    description: 'Bekijk jw.org-video\'s en cast ze naar je tv met ondertiteling in elke taal, of download de video- en ondertitelbestanden voor een speler zoals VLC.',
  },
  es: {
    title: 'JW Cast: videos de jw.org con subtítulos en cualquier idioma',
    description: 'Mira videos de jw.org y transmítelos a tu televisor con subtítulos en cualquier idioma, o descarga los archivos de video y de subtítulos para VLC.',
  },
  pt: {
    title: 'JW Cast — vídeos do jw.org com legendas em qualquer idioma',
    description: 'Assista aos vídeos do jw.org e transmita para a sua TV com legendas em qualquer idioma, ou baixe os arquivos de vídeo e de legenda para usar no VLC.',
  },
  fr: {
    title: 'JW Cast — vidéos jw.org avec des sous-titres dans toutes les langues',
    description: 'Regardez les vidéos jw.org et diffusez-les sur votre téléviseur avec des sous-titres dans n\'importe quelle langue, ou téléchargez les fichiers vidéo et de sous-titres pour VLC.',
  },
  de: {
    title: 'JW Cast — jw.org-Videos mit Untertiteln in jeder Sprache',
    description: 'jw.org-Videos ansehen und mit Untertiteln in jeder Sprache auf den Fernseher streamen, oder Video- und Untertiteldateien für einen Player wie VLC herunterladen.',
  },
  it: {
    title: 'JW Cast — video di jw.org con sottotitoli in qualsiasi lingua',
    description: 'Guarda i video di jw.org e trasmettili alla TV con sottotitoli in qualsiasi lingua, oppure scarica i file video e dei sottotitoli per un player come VLC.',
  },
  ja: {
    title: 'JW Cast — jw.org の動画をあらゆる言語の字幕で',
    description: 'jw.org の動画を好きな言語の字幕付きでテレビにキャストできます。動画ファイルと字幕ファイルをダウンロードして VLC などで再生することもできます。',
  },
  ko: {
    title: 'JW Cast — 모든 언어의 자막으로 보는 jw.org 동영상',
    description: 'jw.org 동영상을 원하는 언어의 자막과 함께 TV로 캐스트하거나, 동영상과 자막 파일을 내려받아 VLC 같은 재생기에서 볼 수 있습니다.',
  },
  ru: {
    title: 'JW Cast — видео с jw.org с субтитрами на любом языке',
    description: 'Смотрите видео с jw.org и транслируйте их на телевизор с субтитрами на любом языке или скачивайте видео и файлы субтитров для плеера вроде VLC.',
  },
  pl: {
    title: 'JW Cast — filmy z jw.org z napisami w dowolnym języku',
    description: 'Oglądaj filmy z jw.org i przesyłaj je na telewizor z napisami w dowolnym języku albo pobierz pliki wideo i pliki napisów do odtwarzacza takiego jak VLC.',
  },
  tl: {
    title: 'JW Cast — mga video sa jw.org na may subtitle sa anumang wika',
    description: 'Panoorin ang mga video sa jw.org at i-cast ang mga ito sa TV mo na may subtitle sa anumang wika, o i-download ang video at subtitle files para sa VLC.',
  },
  cmn_hans: {
    title: 'JW Cast — 带任何语言字幕的 jw.org 视频',
    description: '把 jw.org 视频投放到电视上观看，可以配上任何语言的字幕，也可以下载视频和字幕文件，用 VLC 一类的播放器播放。',
  },
  da: {
    title: 'JW Cast — jw.org-videoer med undertekster på alle sprog',
    description: 'Se jw.org-videoer, og cast dem til dit tv med undertekster på ethvert sprog, eller download video- og undertekstfilerne til en afspiller som VLC.',
  },
  fi: {
    title: 'JW Cast — jw.org-videot tekstityksellä millä tahansa kielellä',
    description: 'Katso jw.org-videoita ja lähetä ne televisioon millä tahansa kielellä tekstitettynä, tai lataa video- ja tekstitystiedostot VLC:n kaltaista soitinta varten.',
  },
};

export function seoFor(locale: string): SeoMeta {
  return seoMeta[locale] ?? seoMeta.en!;
}
