import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:8080',
  integrations: [
    sitemap(),
    expressiveCode({
      themes: ['github-light', 'github-dark'],
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) =>
        `[data-tone="${theme.name.endsWith('dark') ? 'dark' : 'light'}"]`,
    }),
  ],
  image: { responsiveStyles: true },
});
