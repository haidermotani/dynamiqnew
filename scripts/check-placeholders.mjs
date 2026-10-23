import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const todoPath = path.join(root, 'TODO.md');
const distDir = path.join(root, 'dist');
const scanExtensions = new Set(['.html', '.js', '.json', '.css', '.webmanifest', '.xml', '.txt']);
const skipDirectories = new Set(['.git', 'dist', 'node_modules', 'IMAGES']);
const placeholderPattern = /\{\{REPLACE:\s*([^}]+?)\s*\}\}/g;
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

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

async function collectPlaceholders() {
  const files = await walk(root);
  const placeholders = new Map();

  for (const file of files) {
    if (file === todoPath) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const match of text.matchAll(placeholderPattern)) {
      const value = `{{REPLACE: ${match[1].trim()}}}`;
      if (!placeholders.has(value)) placeholders.set(value, new Set());
      placeholders.get(value).add(relative(file));
    }
  }

  return placeholders;
}

async function checkBuildTokens() {
  let files;
  try {
    files = await walk(distDir);
  } catch {
    return null;
  }

  const leftovers = [];
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    for (const token of buildTokens) {
      if (text.includes(token)) leftovers.push(`${relative(file)}: ${token}`);
    }
  }

  return leftovers;
}

async function main() {
  const placeholders = await collectPlaceholders();
  let todo = '';
  try {
    todo = await fs.readFile(todoPath, 'utf8');
  } catch {
    todo = '';
  }

  const missingFromTodo = [];
  for (const placeholder of placeholders.keys()) {
    if (!todo.includes(placeholder)) missingFromTodo.push(placeholder);
  }

  const buildTokens = await checkBuildTokens();

  console.log(`Found ${placeholders.size} placeholder values.`);

  if (placeholders.size === 0) {
    console.log('No {{REPLACE: ...}} values found.');
  } else {
    for (const [placeholder, locations] of placeholders) {
      const state = todo.includes(placeholder) ? 'documented' : 'MISSING FROM TODO.md';
      console.log(`- ${placeholder} [${state}] (${[...locations].join(', ')})`);
    }
  }

  if (buildTokens === null) {
    console.log('Build output not found. Run npm run build to check build tokens.');
  } else if (buildTokens.length > 0) {
    console.log('Unreplaced build tokens:');
    for (const item of buildTokens) console.log(`- ${item}`);
  } else {
    console.log('Build output: no unreplaced internal tokens.');
  }

  let failed = false;
  if (missingFromTodo.length > 0) {
    failed = true;
    console.error(`\n${missingFromTodo.length} placeholder value(s) are not listed in TODO.md.`);
  }
  if (buildTokens && buildTokens.length > 0) {
    failed = true;
    console.error(`\n${buildTokens.length} unreplaced build token(s) found in dist.`);
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
