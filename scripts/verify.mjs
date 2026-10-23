import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { SITE_URL, WHATSAPP_NUMBER } from '../src/config.js';
import { customKitMessage, messages, productMessage, waLink } from '../src/lib/whatsapp.js';

const root = path.resolve(import.meta.dirname, '..');
const sourcePages = ['index.html', 'privacy.html', 'terms.html', '404.html'];
const scanExtensions = new Set(['.html', '.js', '.json', '.css', '.xml', '.txt', '.webmanifest']);
const skipDirectories = new Set(['.git', 'dist', 'node_modules', 'IMAGES']);
const bannedCopy = [
  'elevate',
  'unleash',
  'seamless',
  'crafted',
  'journey',
  'passion',
  'redefine',
  'game-changer',
  'next level',
  'curated',
];
const productPlaceholder = 'Sample product';
const passes = [];
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passes.push(name);
  } else {
    failures.push(detail ? `${name}: ${detail}` : name);
  }
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) continue;
      files.push(...(await walk(path.join(directory, entry.name))));
    } else if (scanExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function staticChecks() {
  const srcFiles = await walk(path.join(root, 'src'));
  const htmlFiles = sourcePages.map((file) => path.join(root, file));
  const publicTextFiles = [
    path.join(root, 'public', 'sitemap.xml'),
    path.join(root, 'public', 'robots.txt'),
    path.join(root, 'public', 'site.webmanifest'),
  ];
  const sourceFiles = [...htmlFiles, ...srcFiles, ...publicTextFiles];
  const sourceText = (await Promise.all(sourceFiles.map((file) => fs.readFile(file, 'utf8')))).join('\n');
  const css = await fs.readFile(path.join(root, 'src', 'styles.css'), 'utf8');
  const config = await fs.readFile(path.join(root, 'src', 'config.js'), 'utf8');
  const products = await readJson(path.join(root, 'src', 'data', 'products.json'));
  const faqs = await readJson(path.join(root, 'src', 'data', 'faqs.json'));

  check('source files found', sourceFiles.length >= 10, `${sourceFiles.length} files`);
  check('no em or en dash', !/[\u2013\u2014]/.test(sourceText));
  check('no emoji', !/\p{Extended_Pictographic}/u.test(sourceText));
  check('no gradients', !/(?:linear|radial|conic)-gradient/i.test(sourceText));
  check('no custom cursor images', !/cursor\s*:\s*url\(/i.test(sourceText));
  check('no purple or violet colors', !/(?:purple|violet|magenta|indigo)/i.test(sourceText));

  for (const phrase of bannedCopy) {
    check(`banned copy absent: ${phrase}`, !sourceText.toLowerCase().includes(phrase));
  }

  const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)].map((match) => match[1].trim());
  const badRadii = radii.filter((value) => /%|\b(?:[5-9]|[1-9]\d+)px\b/.test(value));
  check('no pill or rounded card radii', badRadii.length === 0, badRadii.join(', '));

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    check(`${relative(file)} has one h1`, h1Count === 1, `${h1Count} found`);
    const imageTags = html.match(/<img\b[^>]*>/gi) || [];
    const invalidImages = imageTags.filter(
      (tag) => !/\balt=/.test(tag) || !/\bwidth=/.test(tag) || !/\bheight=/.test(tag),
    );
    check(`${relative(file)} images have alt, width, height`, invalidImages.length === 0, invalidImages.join(' '));
  }

  for (const file of sourceFiles) {
    if (file === path.join(root, 'src', 'config.js')) continue;
    const text = await fs.readFile(file, 'utf8');
    check(`${relative(file)} does not hardcode the WhatsApp number`, !text.includes(WHATSAPP_NUMBER));
  }

  check('WhatsApp number lives in config', config.includes(WHATSAPP_NUMBER));
  check('hero message is exact', messages.hero === "Hello DYNAMIQ, I'd like to know more about your collection.");
  check('product message is exact', productMessage({ name: 'Test kit' }, 'M', 2) === "Hello DYNAMIQ, I'd like to order: Test kit, Size M, Qty 2. Please confirm availability and price.");
  check('custom kit message includes notes', customKitMessage({ teamName: 'A', sport: 'Football', quantity: '3', customization: 'Names', city: 'B', notes: 'C' }).includes('Notes: C'));
  check('four product entries', products.length === 4, `${products.length} found`);
  check('products use WebP images', products.every((product) => [product.images.front, product.images.back].every((src) => src.endsWith('.webp'))));
  check('sample products are labelled', products.every((product) => product.name.startsWith(productPlaceholder)));
  check('sample prices are not invented', products.every((product) => product.price === null));
  check('four answered FAQs', faqs.filter((item) => typeof item.answer === 'string' && item.answer.trim()).length === 4);

  const distPages = ['index.html', 'privacy.html', 'terms.html', '404.html'];
  for (const page of distPages) {
    check(`dist/${page} exists`, existsSync(path.join(root, 'dist', page)));
  }
  const distAssets = await fs.readdir(path.join(root, 'dist', 'assets'));
  check('dist CSS exists', distAssets.some((name) => name.endsWith('.css')));
  check('dist JS exists', distAssets.some((name) => name.endsWith('.js')));

  if (existsSync(path.join(root, 'dist'))) {
    const buildTokens = [
      '__SITE_URL__',
      '__WA_HERO_URL__',
      '__WA_FLOAT_URL__',
      '__WA_DISPLAY__',
      '__TEL_URL__',
      '__INSTAGRAM_URL__',
      '__FACEBOOK_URL__',
      '__TIKTOK_URL__',
      '__LEGAL_NAME__',
    ];
    const distFiles = await walk(path.join(root, 'dist'));
    const distText = (await Promise.all(distFiles.filter((file) => scanExtensions.has(path.extname(file).toLowerCase())).map((file) => fs.readFile(file, 'utf8')))).join('\n');
    const leftoverTokens = buildTokens.filter((token) => distText.includes(token));
    check('dist has no unreplaced build tokens', leftoverTokens.length === 0, leftoverTokens.join(', '));
    check('dist has no development asset URLs', !distText.includes('/src/main.js'));
    check('dist uses generated WebP product images', distText.includes('/assets/products/sample-01-front.webp'));
  }

  check('SITE_URL is a documented placeholder', SITE_URL.startsWith('{{REPLACE:'));
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => (port ? resolve(port) : reject(new Error('Could not find a free port.'))));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

async function startPreview(port, executablePath) {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error('Vite is not installed. Run npm install.');

  const child = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  let logs = '';
  child.stdout.on('data', (data) => {
    logs += data.toString();
  });
  child.stderr.on('data', (data) => {
    logs += data.toString();
  });

  const url = `http://127.0.0.1:${port}/`;
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (child.exitCode !== null) throw new Error(`Preview server exited early.\n${logs}`);
    try {
      const response = await fetch(url);
      if (response.ok) return child;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Preview server did not start.\n${logs}`);
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function attachErrorCapture(page, bucket) {
  page.on('console', (message) => {
    if (message.type() === 'error') bucket.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => bucket.push(`page: ${error.message}`));
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function browserChecks(baseUrl, executablePath) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    const homeErrors = [];
    attachErrorCapture(page, homeErrors);

    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    const introVisible = await page.evaluate(() => {
      const intro = document.getElementById('intro');
      const skip = document.getElementById('intro-skip');
      return Boolean(intro && !intro.hidden && getComputedStyle(intro).display !== 'none' && skip && skip.offsetParent !== null);
    });
    check('intro is visible on a new session', introVisible);

    const h1 = (await page.$eval('h1', (element) => element.textContent || '')).replace(/\s+/g, ' ').trim();
    check('hero heading copy is present', h1.includes('Football and cricket kits') && h1.includes('made to order.'));

    const whatsappLinks = await page.$$eval('a[href*="wa.me/"]', (links) => links.map((link) => link.href));
    check('WhatsApp links use the configured number', whatsappLinks.length >= 2 && whatsappLinks.every((href) => href.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)));
    const heroLink = await page.$eval('.hero__actions a[href*="wa.me/"]', (link) => link.href);
    check('hero WhatsApp message is exact', decodeURIComponent(new URL(heroLink).searchParams.get('text')) === messages.hero);
    check('hero primary CTA points to the collection', (await page.$eval('.hero__actions .button--cyan', (link) => link.getAttribute('href'))) === '#collection');

    await page.click('#intro-skip');
    await page.waitForFunction(() => document.getElementById('intro')?.hidden === true);
    check('skip button closes the intro', true);
    check('intro writes its session flag', await page.evaluate(() => sessionStorage.getItem('dynamiq-intro-seen') === '1'));

    await page.reload({ waitUntil: 'networkidle0' });
    const introAfterReload = await page.evaluate(() => {
      const intro = document.getElementById('intro');
      return Boolean(intro && !intro.hidden && getComputedStyle(intro).display !== 'none');
    });
    check('intro does not replay in the same session', !introAfterReload);

    const cards = await page.$$('#product-grid .product-card');
    check('four product cards render', cards.length === 4, `${cards.length} found`);
    await page.click('[data-filter="Cricket"]');
    await page.waitForFunction(() => document.getElementById('collection-count')?.textContent?.includes('Showing 1'));
    const visibleCricket = await page.$$eval('#product-grid .product-card', (items) => items.filter((item) => !item.hidden).length);
    check('category filter updates visible cards', visibleCricket === 1, `${visibleCricket} visible`);
    await page.click('[data-filter="All"]');

    const firstProductButton = await page.$('[data-quick-view="sample-01"]');
    check('product button has a specific accessible name', (await firstProductButton.evaluate((element) => element.getAttribute('aria-label'))) === 'View product: Sample product 01');
    await firstProductButton.click();
    await page.waitForFunction(() => document.querySelector('.quick-view')?.open === true);
    check('quick view opens as a dialog', await page.evaluate(() => document.querySelector('.quick-view')?.tagName === 'DIALOG'));
    await page.select('#quick-size', 'XL');
    await page.$eval('#quick-quantity', (input) => {
      input.value = '3';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const quickOrderHref = await page.$eval('#quick-order', (link) => link.href);
    check('quick view order message includes product, size, and quantity', decodeURIComponent(new URL(quickOrderHref).searchParams.get('text')) === productMessage(productsFixture[0], 'XL', 3));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.quick-view')?.open === false);
    const restoredFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-quick-view'));
    check('quick view restores focus to its trigger', restoredFocus === 'sample-01');

    await scrollThrough(page);
    const imageState = await page.$$eval('img', (images) => images.map((image) => ({ src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 })));
    check('all images load', imageState.every((image) => image.loaded), imageState.filter((image) => !image.loaded).map((image) => image.src).join(', '));

    const anchorIssues = await page.evaluate(() => {
      const issues = [];
      for (const link of document.querySelectorAll('a[href^="#"]')) {
        const target = link.getAttribute('href');
        if (target && target !== '#' && !document.querySelector(target)) issues.push(target);
      }
      return issues;
    });
    check('home internal anchors resolve', anchorIssues.length === 0, anchorIssues.join(', '));

    const placeholders = await page.$$eval('a', (links) => links.filter((link) => link.getAttribute('href')?.includes('{{REPLACE:')).length);
    check('placeholder links are handled at runtime', placeholders === 0);
    const disabledSocialLinks = await page.$$eval('.footer-social a', (links) => links.filter((link) => link.getAttribute('aria-disabled') === 'true' && link.getAttribute('href') === '#contact').length);
    check('placeholder social links fall back to contact', disabledSocialLinks === 3, `${disabledSocialLinks} links`);

    await page.$eval('#custom-kit-form', (form) => form.scrollIntoView({ block: 'center' }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    check('floating WhatsApp button hides near the form', await page.$eval('#whatsapp-float', (element) => element.classList.contains('is-concealed') && element.getAttribute('aria-hidden') === 'true'));

    await page.type('#team-name', 'Verify FC');
    await page.select('#sport', 'Football');
    await page.$eval('#quantity', (input) => {
      input.value = '12';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.select('#customization', 'Names and numbers');
    await page.type('#city', 'Lahore');
    await page.type('#notes', 'Cyan trim');
    await page.evaluate(() => {
      window.__dynamiqTestOrderUrl = null;
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function testClick() {
        if (this.target === '_blank' && this.href.startsWith('https://wa.me/')) {
          window.__dynamiqTestOrderUrl = this.href;
          return;
        }
        originalClick.call(this);
      };
    });
    await page.click('#custom-kit-form button[type="submit"]');
    await page.waitForFunction(() => Boolean(window.__dynamiqTestOrderUrl));
    const formOrderHref = await page.evaluate(() => window.__dynamiqTestOrderUrl);
    const formValues = {
      teamName: 'Verify FC',
      sport: 'Football',
      quantity: '12',
      customization: 'Names and numbers',
      city: 'Lahore',
      notes: 'Cyan trim',
    };
    check('custom kit form opens the exact WhatsApp message', decodeURIComponent(new URL(formOrderHref).searchParams.get('text')) === customKitMessage(formValues));
    check('custom kit form exposes a WhatsApp fallback link', (await page.$eval('#form-status', (element) => element.textContent)).includes('Opening WhatsApp'));

    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((resolve) => setTimeout(resolve, 300));
    check('floating WhatsApp button returns away from the form', await page.$eval('#whatsapp-float', (element) => !element.classList.contains('is-concealed')));
    check('home has no console errors', homeErrors.length === 0, homeErrors.join(' | '));

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle0' });
    const mobileLayout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      floatRight: document.getElementById('whatsapp-float')?.getBoundingClientRect().right,
      viewport: window.innerWidth,
    }));
    check('mobile layout has no horizontal overflow', mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, JSON.stringify(mobileLayout));
    check('floating button stays inside the mobile viewport', mobileLayout.floatRight <= mobileLayout.viewport + 1);
    await page.click('.nav-toggle');
    await page.waitForFunction(() => document.querySelector('.nav-toggle')?.getAttribute('aria-expanded') === 'true');
    await new Promise((resolve) => setTimeout(resolve, 250));
    check('mobile menu opens', await page.$eval('#site-nav', (nav) => nav.classList.contains('is-open') && getComputedStyle(nav).visibility === 'visible'));
    await page.click('#site-nav a[href="#brand"]');
    check('mobile menu closes after a link click', (await page.$eval('.nav-toggle', (button) => button.getAttribute('aria-expanded'))) === 'false');

    for (const [pageName, expectedHeading] of [
      ['/privacy.html', 'Privacy Policy'],
      ['/terms.html', 'Terms and Conditions'],
      ['/404.html', 'That page is not here.'],
    ]) {
      const legalPage = await context.newPage();
      const errors = [];
      attachErrorCapture(legalPage, errors);
      await legalPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await legalPage.goto(`${baseUrl.replace(/\/$/, '')}${pageName}`, { waitUntil: 'networkidle0' });
      const heading = (await legalPage.$eval('h1', (element) => element.textContent || '')).replace(/\s+/g, ' ').trim();
      check(`${pageName} loads with the expected heading`, heading === expectedHeading, heading);
      check(`${pageName} has no console errors`, errors.length === 0, errors.join(' | '));
      const pageLayout = await legalPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      check(`${pageName} has no horizontal overflow`, pageLayout.scrollWidth <= pageLayout.clientWidth + 1, JSON.stringify(pageLayout));
      const images = await legalPage.$$eval('img', (items) => items.map((item) => item.complete && item.naturalWidth > 0));
      check(`${pageName} images load`, images.every(Boolean));
      await legalPage.close();
    }

    await context.close();

    const reducedContext = await browser.createBrowserContext();
    const reducedPage = await reducedContext.newPage();
    const reducedErrors = [];
    attachErrorCapture(reducedPage, reducedErrors);
    await reducedPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await reducedPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reducedStart = Date.now();
    await reducedPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const reducedState = await reducedPage.evaluate(() => {
      const intro = document.getElementById('intro');
      const skip = document.getElementById('intro-skip');
      return {
        visible: Boolean(intro && !intro.hidden && getComputedStyle(intro).display !== 'none'),
        skipVisible: Boolean(skip && skip.offsetParent !== null),
        boltHidden: getComputedStyle(document.querySelector('.intro__bolt')).display === 'none',
      };
    });
    check('reduced motion still shows a short intro', reducedState.visible);
    check('reduced motion keeps the skip control available', reducedState.skipVisible);
    check('reduced motion removes the flashy intro elements', reducedState.boltHidden);
    await reducedPage.waitForFunction(() => document.getElementById('intro')?.hidden === true, { timeout: 3000 });
    check('reduced motion intro ends quickly', Date.now() - reducedStart < 2500, `${Date.now() - reducedStart}ms`);
    check('reduced motion page has no console errors', reducedErrors.length === 0, reducedErrors.join(' | '));
    await reducedContext.close();
  } finally {
    await browser.close();
  }
}

let productsFixture;

async function main() {
  if (!existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error('Build output is missing. Run npm run build first.');
  }

  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run browser checks.');
  }

  productsFixture = await readJson(path.join(root, 'src', 'data', 'products.json'));

  await staticChecks();

  const port = await findFreePort();
  const server = await startPreview(port, executablePath);
  try {
    await browserChecks(`http://127.0.0.1:${port}/`, executablePath);
  } finally {
    await stopPreview(server);
  }

  console.log(`\nPASS ${passes.length}`);
  for (const item of passes) console.log(`  ok ${item}`);

  if (failures.length > 0) {
    console.error(`\nFAIL ${failures.length}`);
    for (const item of failures) console.error(`  x ${item}`);
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
