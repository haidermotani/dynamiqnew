import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import {
  SITE_URL,
  WHATSAPP_DISPLAY,
  INSTAGRAM_URL,
  FACEBOOK_URL,
  TIKTOK_URL,
  LEGAL_NAME,
} from './src/config.js';
import { messages, phoneHref, waLink } from './src/lib/whatsapp.js';

const publicSiteUrl = SITE_URL.startsWith('{{REPLACE:')
  ? 'https://yourdomain.example'
  : SITE_URL.replace(/\/+$/, '');

const tokens = {
  __SITE_URL__: publicSiteUrl,
  __WA_HERO_URL__: waLink(messages.hero),
  __WA_FLOAT_URL__: waLink(messages.hero),
  __WA_DISPLAY__: WHATSAPP_DISPLAY,
  __TEL_URL__: phoneHref(),
  __INSTAGRAM_URL__: INSTAGRAM_URL,
  __FACEBOOK_URL__: FACEBOOK_URL,
  __TIKTOK_URL__: TIKTOK_URL,
  __LEGAL_NAME__: LEGAL_NAME,
};

function replaceSiteTokens() {
  return {
    name: 'dynamiq-site-tokens',
    transformIndexHtml(html) {
      let output = html;
      for (const [token, value] of Object.entries(tokens)) {
        output = output.split(token).join(value);
      }
      return output;
    },
  };
}

export default defineConfig({
  plugins: [replaceSiteTokens()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
