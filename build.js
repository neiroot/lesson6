import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const files = ['index.html', 'styles.css', 'app.js', 'calculator.js'];
const sources = new Map();
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('api/explain.js', import.meta.url))], { stdio: 'inherit' });

// Fail before publishing an incomplete application or invalid JavaScript.
for (const file of files) {
  const source = new URL(file, import.meta.url);
  sources.set(file, await readFile(source));
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', fileURLToPath(source)], { stdio: 'inherit' });
}
const html = sources.get('index.html').toString();
for (const [, reference] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(?:https?:|data:)/.test(reference)) continue;
  if (!sources.has(reference)) throw new Error(`Missing application asset: ${reference}`);
}

const output = new URL('dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [file, contents] of sources) await writeFile(new URL(file, output), contents);
console.log(`Built ${files.length} static files in dist/`);
