import { htmlLangOf, prerenderLocales, seoFor, SITE_URL } from '../app/config/seoMeta';

/**
 * Build-time SEO patcher for the prerendered language shells.
 *
 * With `ssr: false` the prerenderer emits the plain SPA shell for every route, so
 * page-level `useHead` never runs and each shell would carry the same generic
 * `<title>`/description from nuxt.config. Crawlers that don't execute JS (every
 * social-preview bot) would then see identical, locale-less markup — and before
 * prerendering they saw public/404.html, which has no meta at all.
 *
 * This rewrites the head of each shell in place: locale title/description/OG,
 * `<html lang>`, canonical and hreflang alternates.
 */

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const content = escapeAttr(value);
  const existing = new RegExp(`(<meta[^>]*\\s${attr}="${key}"[^>]*\\scontent=")[^"]*(")`);
  if (existing.test(html)) {
    return html.replace(existing, `$1${content}$2`);
  }
  return html.replace('</head>', `<meta ${attr}="${key}" content="${content}"></head>`);
}

function canonicalOf(route: string): string {
  return route === '/' ? SITE_URL : `${SITE_URL}${route}`;
}

function alternateLinks(): string {
  const links = prerenderLocales.map(
    locale => `<link rel="alternate" hreflang="${htmlLangOf(locale)}" href="${SITE_URL}/${locale}">`,
  );
  return `<link rel="alternate" hreflang="x-default" href="${SITE_URL}">${links.join('')}`;
}

/** `route` is the prerendered path, e.g. `/` or `/nl`. */
export function applyPrerenderSeo(html: string, route: string): string {
  // Nitro prerenders the root twice, as `/` and `/index.html`; the latter runs last
  // and would otherwise overwrite the patched file
  const path = route.replace(/\/index\.html$/, '') || '/';
  const locale = path === '/' ? 'en' : path.replace(/^\//, '');
  // Skip /200.html — it is a fallback shell answering for arbitrary URLs, so a
  // canonical or locale pinned to it would be wrong
  if (path !== '/' && !prerenderLocales.includes(locale)) {
    return html;
  }
  const { title, description } = seoFor(locale);
  const canonical = canonicalOf(path);
  const lang = htmlLangOf(locale);

  let out = html;

  out = out.replace(/<html([^>]*)>/, (_match, attrs: string) => {
    const rest = attrs.replace(/\slang="[^"]*"/, '');
    return `<html${rest} lang="${lang}">`;
  });

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);

  out = setMeta(out, 'name', 'title', title);
  out = setMeta(out, 'name', 'description', description);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', description);
  out = setMeta(out, 'property', 'og:url', canonical);
  out = setMeta(out, 'property', 'og:locale', lang.replace('-', '_'));
  out = setMeta(out, 'name', 'twitter:title', title);
  out = setMeta(out, 'name', 'twitter:description', description);

  out = out.replace(
    '</head>',
    `<link rel="canonical" href="${canonical}">${alternateLinks()}</head>`,
  );

  return out;
}
