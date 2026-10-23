import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SITE_URL } from '../src/config.js';

const root = path.resolve(import.meta.dirname, '..');
const imagesDir = path.join(root, 'IMAGES');
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets');
const productsDir = path.join(assetsDir, 'products');
const productsJsonPath = path.join(root, 'src', 'data', 'products.json');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const brandCyan = '#00e1dc';
const ink = '#08090a';
const offWhite = '#f4f4ee';

async function ensureDirs() {
  await fs.mkdir(productsDir, { recursive: true });
}

async function listSourceImages() {
  try {
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function chooseLogo(images) {
  const namedLogo = images.find((name) => /logo/i.test(name));
  if (namedLogo) return namedLogo;
  if (images.length === 1) return images[0];
  return null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function makeTransparentLogo(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(data.length);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const minimum = Math.min(r, g, b);
      let alpha = 1 - minimum / 255;

      if (alpha < 0.06) {
        output[index] = 0;
        output[index + 1] = 0;
        output[index + 2] = 0;
        output[index + 3] = 0;
        continue;
      }

      const whiteContribution = 255 * (1 - alpha);
      const red = Math.max(0, Math.min(255, Math.round((r - whiteContribution) / alpha)));
      const green = Math.max(0, Math.min(255, Math.round((g - whiteContribution) / alpha)));
      const blue = Math.max(0, Math.min(255, Math.round((b - whiteContribution) / alpha)));
      const alphaByte = Math.round(alpha * 255);

      output[index] = red;
      output[index + 1] = green;
      output[index + 2] = blue;
      output[index + 3] = alphaByte;

      if (alphaByte > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    throw new Error('The logo file appears to contain no visible mark.');
  }

  const padding = 20;
  const logoWidth = maxX - minX + 1;
  const logoHeight = maxY - minY + 1;
  const logoPath = path.join(assetsDir, 'logo-transparent.png');
  const cropped = await sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left: minX, top: minY, width: logoWidth, height: logoHeight })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(logoPath);

  await sharp(logoPath)
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(path.join(assetsDir, 'logo-transparent.webp'));
  await sharp(logoPath)
    .resize({ width: 270, withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(path.join(assetsDir, 'logo-transparent-270.webp'));

  return logoCropSummary(logoWidth, logoHeight, logoWidth + padding * 2, logoHeight + padding * 2, cropped);
}

function logoCropSummary(contentWidth, contentHeight, outputWidth, outputHeight, info) {
  return {
    contentWidth,
    contentHeight,
    outputWidth: info.width || outputWidth,
    outputHeight: info.height || outputHeight,
  };
}

function boltSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${ink}"/>
  <path d="M40 4 14 35h14l-5 25 27-35H35z" fill="${brandCyan}"/>
</svg>`;
}

async function writeIco(pngBuffers, outputPath) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const directory = Buffer.alloc(16 * count);
  let offset = 6 + directory.length;

  pngBuffers.forEach(({ buffer, size }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(buffer.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });

  await fs.writeFile(outputPath, Buffer.concat([header, directory, ...pngBuffers.map((item) => item.buffer)]));
}

async function buildIcons() {
  const svg = boltSvg(512);
  await fs.writeFile(path.join(publicDir, 'favicon.svg'), svg, 'utf8');

  const iconDefinitions = [
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const icon of iconDefinitions) {
    await sharp(Buffer.from(boltSvg(icon.size))).png().toFile(path.join(publicDir, icon.name));
  }

  const icoPngs = [];
  for (const size of [16, 32, 48]) {
    const buffer = await sharp(Buffer.from(boltSvg(size))).png().toBuffer();
    icoPngs.push({ size, buffer });
  }
  await writeIco(icoPngs, path.join(publicDir, 'favicon.ico'));

  const manifest = {
    name: 'DYNAMIQ',
    short_name: 'DYNAMIQ',
    description: 'Football and cricket jerseys, tees, and custom team kits.',
    start_url: '/',
    display: 'standalone',
    background_color: offWhite,
    theme_color: ink,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };

  await fs.writeFile(
    path.join(publicDir, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const faviconSvg = await fs.readFile(path.join(publicDir, 'favicon.svg'), 'utf8');
  return { svg: faviconSvg };
}

function fallbackWordmarkSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <g font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="190" letter-spacing="-6">
    <text x="600" y="340" text-anchor="middle" fill="${ink}">DYN<tspan fill="${brandCyan}">AMIQ</tspan></text>
  </g>
  <path d="M742 205 686 315h34l-15 68 74-102h-40z" fill="${brandCyan}"/>
</svg>`;
}

async function buildOpenGraph(logoPath) {
  const targetWidth = 1200;
  const targetHeight = 630;
  let base;

  if (logoPath) {
    const logo = await sharp(logoPath).trim({ threshold: 12 }).resize({ width: 720 }).png().toBuffer();
    const logoMeta = await sharp(logo).metadata();
    base = await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: '#ffffff',
      },
    })
      .composite([
        {
          input: logo,
          left: Math.round((targetWidth - (logoMeta.width || 720)) / 2),
          top: Math.round((targetHeight - (logoMeta.height || 300)) / 2),
        },
      ])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } else {
    base = await sharp(Buffer.from(fallbackWordmarkSvg(targetWidth, targetHeight)))
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  await fs.writeFile(path.join(assetsDir, 'og-image.jpg'), base);
}

function placeholderSvg(product, view) {
  const name = escapeXml(product.name);
  const category = escapeXml(product.category);
  const viewLabel = view === 'front' ? 'Front view' : 'Back view';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250">
    <rect width="1000" height="1250" fill="#d8d8d2"/>
    <rect x="28" y="28" width="944" height="1194" fill="none" stroke="#c0c0b9" stroke-width="2"/>
    <path d="M0 170h1000M0 1080h1000" stroke="#c8c8c1" stroke-width="2"/>
    <text x="500" y="535" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700" fill="#20211f">${name}</text>
    <text x="500" y="600" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="5" fill="#5f605a">${category.toUpperCase()}</text>
    <text x="500" y="730" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="3" fill="#6a6b64">${viewLabel.toUpperCase()}</text>
    <text x="500" y="1140" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="6" fill="#777870">PLACEHOLDER IMAGE</text>
  </svg>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function matchProductPhoto(photoNames, product, view) {
  const keys = [product.id, slugify(product.name)].filter(Boolean).map((key) => key.toLowerCase());
  return photoNames.find((name) => {
    const lower = name.toLowerCase();
    const hasView = lower.includes(view);
    const hasKey = keys.some((key) => lower.includes(key));
    return hasView && hasKey;
  });
}

async function buildProductImage({ sourcePath, product, view }) {
  const outputName = `${product.id}-${view}.webp`;
  const outputPath = path.join(productsDir, outputName);

  if (sourcePath) {
    await sharp(sourcePath)
      .rotate()
      .resize({
        width: 1000,
        height: 1250,
        fit: 'contain',
        background: '#efefe9',
        withoutEnlargement: false,
      })
      .flatten({ background: '#efefe9' })
      .webp({ quality: 82, effort: 6 })
      .toFile(outputPath);
  } else {
    await sharp(Buffer.from(placeholderSvg(product, view)))
      .webp({ quality: 84, effort: 6 })
      .toFile(outputPath);
  }

  await fs.rm(path.join(productsDir, `${product.id}-${view}.jpg`), { force: true });
  return outputName;
}

async function updateUnmatchedTodo(unmatched) {
  const todoPath = path.join(root, 'TODO.md');
  let todo;
  try {
    todo = await fs.readFile(todoPath, 'utf8');
  } catch {
    return;
  }

  const start = '<!-- AUTO:UNMATCHED-PHOTOS:START -->';
  const end = '<!-- AUTO:UNMATCHED-PHOTOS:END -->';
  const list = unmatched.length
    ? unmatched.map((name) => `- IMAGES/${name}: could not match this photo to a product.`).join('\n')
    : 'None.';
  const block = `${start}\n${list}\n${end}`;

  if (todo.includes(start) && todo.includes(end)) {
    todo = todo.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    todo = `${todo.trim()}\n\n## Unmatched product photos\n\n${block}\n`;
  }

  await fs.writeFile(todoPath, todo, 'utf8');
}

async function buildProducts(logoName, sourceImages) {
  const products = JSON.parse(await fs.readFile(productsJsonPath, 'utf8'));
  const photoNames = sourceImages.filter((name) => name !== logoName);
  const matched = new Set();
  const used = [];

  for (const product of products) {
    for (const view of ['front', 'back']) {
      const match = matchProductPhoto(photoNames, product, view);
      if (match) matched.add(match);
      const sourcePath = match ? path.join(imagesDir, match) : null;
      await buildProductImage({ sourcePath, product, view });
    }
    used.push(product.id);
  }

  const unmatched = photoNames.filter((name) => !matched.has(name));
  await updateUnmatchedTodo(unmatched);
  return { productCount: used.length, unmatched };
}

function getPublicSite() {
  if (SITE_URL.startsWith('{{REPLACE:')) {
    return 'https://yourdomain.example';
  }
  return SITE_URL.replace(/\/+$/, '');
}

async function writeSitemapAndCname() {
  const site = getPublicSite();
  const urls = [`${site}/`, `${site}/privacy.html`, `${site}/terms.html`];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
  const robots = `User-agent: *
Allow: /

Sitemap: ${site}/sitemap.xml
`;
  const hostname = new URL(site).hostname;
  await fs.writeFile(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
  await fs.writeFile(path.join(publicDir, 'robots.txt'), robots, 'utf8');
  await fs.writeFile(path.join(publicDir, 'CNAME'), `${hostname}\n`, 'utf8');
}

async function main() {
  await ensureDirs();
  const sourceImages = await listSourceImages();
  const logoName = chooseLogo(sourceImages);

  let logoSummary = null;
  if (logoName) {
    logoSummary = await makeTransparentLogo(path.join(imagesDir, logoName));
    await buildOpenGraph(path.join(imagesDir, logoName));
  } else {
    await Promise.all([
      fs.rm(path.join(assetsDir, 'logo-transparent.png'), { force: true }),
      fs.rm(path.join(assetsDir, 'logo-transparent.webp'), { force: true }),
      fs.rm(path.join(assetsDir, 'logo-transparent-270.webp'), { force: true }),
    ]);
    await buildOpenGraph(null);
  }

  const products = await buildProducts(logoName, sourceImages);
  await buildIcons();
  await writeSitemapAndCname();

  console.log(`Logo: ${logoName || 'not found, wordmark fallback needed'}`);
  if (logoSummary) {
    console.log(
      `Transparent logo: ${logoSummary.outputWidth}x${logoSummary.outputHeight} (content ${logoSummary.contentWidth}x${logoSummary.contentHeight})`,
    );
  }
  console.log(`Product images: ${products.productCount} products`);
  if (products.unmatched.length) {
    console.log(`Unmatched product photos: ${products.unmatched.join(', ')}`);
  }
  console.log('Favicons, manifest, social image, sitemap, robots and CNAME written.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
