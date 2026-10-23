# DYNAMIQ website

A static, multi-page website for DYNAMIQ football and cricket kits. Orders are arranged on WhatsApp. There is no checkout, database, analytics, or cookie consent because the site does not use them.

## Requirements

- Node.js 20.19 or newer, or Node.js 22.12 or newer
- npm
- Chrome or Edge for the automated browser checks and Lighthouse

## Setup

```powershell
npm install
npm run dev
```

Vite serves the development site at the URL printed in the terminal. The development command rebuilds generated assets before starting.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build generated assets and start Vite in development mode |
| `npm run build` | Build generated assets and create the production site in `dist/` |
| `npm run preview` | Serve `dist/` at `http://localhost:4173/` |
| `npm run check` | Build, check placeholder documentation, and run static plus browser checks |
| `npm run check:placeholders` | List unresolved placeholders and confirm they are documented in `TODO.md` |
| `npm run verify` | Run the static checks and automated browser checks against a temporary preview server |

The verify script uses `CHROME_PATH` or a standard Chrome or Edge installation. Set `CHROME_PATH` if the browser is installed somewhere else.

## Launch checklist

Read `TODO.md` before publishing. Every `{{REPLACE: ...}}` value is intentional. Replace the values, update the domain, and run `npm run check` again.

The minimum launch edits are:

1. Set the real domain in `src/config.js`.
2. Add the real social links and legal business name in `src/config.js`.
3. Replace the owner story, contact email, business address, and legal policy placeholders.
4. Replace the four sample products and their photos.
5. Confirm the WhatsApp number and test the order flow on a phone.

## WhatsApp configuration

The WhatsApp number is stored only in `src/config.js`:

```js
export const WHATSAPP_NUMBER = '923390012879';
export const WHATSAPP_DISPLAY = '0339 0012879';
```

`src/lib/whatsapp.js` builds every WhatsApp and telephone URL:

- Hero inquiry message
- Product order message with product, size, and quantity
- Custom kit message built from the contact form

Do not hardcode the number in HTML or JavaScript. The verify script fails if it finds the number outside `src/config.js` in the source files.

## Site data

- `src/data/products.json` contains product names, categories, image paths, sizes, and optional prices. A `null` price displays as "Price on WhatsApp".
- `src/data/faqs.json` contains questions. A `null` or empty answer hides that question.
- `src/data/size-guide.json` is an array of rows. An empty array hides the size guide.
- `src/config.js` contains the domain, contact details, social URLs, and legal name.

Products are rendered from JSON. Keep the `id` stable because it is also used for photo matching and the quick view dialog.

## Product photos

Add source photos to the read-only `IMAGES/` folder. Do not edit or delete the original DYNAMIQ logo file.

Name photos with the product ID or product slug plus `front` or `back`:

```text
IMAGES/
  sample-01-front.jpg
  sample-01-back.jpg
  sample-02-front.jpg
  sample-02-back.jpg
```

The build script resizes photos into 1000x1250 WebP files in `public/assets/products/`. Photos that cannot be matched are listed under "Unmatched product photos" in `TODO.md` after a build.

The generated grey product tiles are only placeholders. Replace them with real product photography before launch. The logo is processed into transparent PNG and WebP versions, including a smaller WebP for the header and footer.

## Images and generated assets

`npm run build:assets` generates:

- Transparent logo files at 539x308, plus a 270px WebP version
- Favicons, Apple touch icon, and PWA icons
- Web app manifest
- 1200x630 Open Graph image
- Four product placeholders with front and back views
- `sitemap.xml`, `robots.txt`, and `CNAME`

The production build copies these files from `public/` into `dist/`.

## Intro and accessibility

The opening sequence plays once per browser session, lasts about 6.5 seconds, and includes a Skip button. Escape also skips it. It is bypassed when JavaScript is unavailable, when the visitor prefers reduced motion, and when the page is revisited in the same session. Append `?intro=1` to the home page URL to replay it for preview.

The site includes:

- Semantic page landmarks and heading order
- A skip link
- Visible keyboard focus
- Accessible product dialogs with focus trapping and focus restoration
- Reduced-motion handling
- Text alternatives for content images
- Non-pill, low-radius controls as required by the brand direction

Run `npm run check` after changes. The verify script checks headings, alt text, image dimensions, placeholder handling, WhatsApp messages, navigation, filters, the product dialog, the custom kit form, mobile overflow, the intro, reduced motion, and the legal pages.

## Deployment

The production output is a static folder in `dist/`. Deploy it to any static host, including GitHub Pages, Netlify, Cloudflare Pages, or a standard web server.

1. Set `SITE_URL` in `src/config.js` to the final HTTPS domain. Do not include a trailing slash.
2. Run `npm run build`.
3. Upload the contents of `dist/` to the host.
4. Confirm `CNAME` contains the real domain when using GitHub Pages.
5. Configure the host to serve `404.html` for unknown paths.
6. Test the WhatsApp links, phone links, product dialog, and custom kit form on a real phone.

When `SITE_URL` still contains a placeholder, the build uses `https://yourdomain.example` for canonical links, the sitemap, and social metadata so the site remains buildable. The site is not ready to launch until the real domain is set.

## Lighthouse

Start the production preview, then run Lighthouse against it:

```powershell
npm run preview
npx lighthouse http://localhost:4173/ --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" --view
```

Run the same command for `/privacy.html`, `/terms.html`, and `/404.html` when changing shared layout or navigation.

## Legal pages

`privacy.html` and `terms.html` are practical templates, not legal advice. The privacy text describes the current implementation: no accounts, no cookies, no analytics, no server database, session storage only for the intro, and WhatsApp as a third-party service. Review both pages with the business owner and replace every placeholder before launch.

## Project structure

```text
.
  IMAGES/                 Original supplied images, read-only
  public/                 Generated and static assets copied by Vite
  scripts/
    build-assets.mjs      Logo, product images, icons, social image, sitemap, CNAME
    check-placeholders.mjs
    verify.mjs
  src/
    config.js             Site URL, WhatsApp, social links, legal name
    data/                 Products, FAQs, size guide
    lib/whatsapp.js       WhatsApp and telephone URL builders
    main.js               Intro, navigation, products, dialog, form, FAQ
    styles.css            Full responsive visual system
  index.html
  privacy.html
  terms.html
  404.html
  TODO.md                 Launch tasks and unresolved placeholders
```
