import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:8080',
  integrations: [
    sitemap(),
    expressiveCode({
      themes: ['everforest-light', 'everforest-dark'],
      styleOverrides: {
        codeFontFamily: 'var(--mono)',
        codeBackground: 'var(--soft)',
        codeForeground: 'var(--fg)',
        borderColor: 'var(--line)',
        borderWidth: '1px',
        borderRadius: '3px',
        frames: {
          frameBoxShadowCssValue: 'none',
          editorBackground: 'var(--soft)',
          editorTabBarBackground: 'var(--bg)',
          editorActiveTabBackground: 'var(--soft)',
          editorActiveTabForeground: 'var(--fg)',
          editorTabBarBorderColor: 'var(--line)',
          editorActiveTabIndicatorTopColor: 'var(--accent)',
          terminalBackground: 'var(--soft)',
          terminalTitlebarBackground: 'var(--bg)',
          terminalTitlebarForeground: 'var(--muted)',
          terminalTitlebarBorderBottomColor: 'var(--line)',
          inlineButtonForeground: 'var(--muted)',
        },
      },
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) =>
        `[data-tone="${theme.name.endsWith('dark') ? 'dark' : 'light'}"]`,
    }),
  ],
  image: { responsiveStyles: true },
});
