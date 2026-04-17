#!/usr/bin/env node
// Extract URL / Request parameter / Request content field tables from a cached
// Realtime Register documentation HTML file. Usage: node extract-fields.mjs <file>
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const file = process.argv[2];
if (!file) {
  console.error('usage: extract-fields.mjs <html-file>');
  process.exit(1);
}

const $ = cheerio.load(readFileSync(file, 'utf8'));

const sections = [
  'URL fields',
  'Request parameters',
  'Request content fields',
  'Request content',
];

// Walk the document in order and find the first table that appears after the
// specified h5 heading but before any subsequent h5.
function findTableAfter(heading) {
  const all = $('h5, table').toArray();
  let passed = false;
  for (const el of all) {
    const $el = $(el);
    if (el.tagName === 'h5') {
      if ($el.text().trim() === heading) { passed = true; continue; }
      if (passed) return null;
    } else if (passed && el.tagName === 'table') {
      return $el;
    }
  }
  return null;
}

for (const heading of sections) {
  const $tbl = findTableAfter(heading);
  if (!$tbl || !$tbl.length) continue;

  const headers = $tbl
    .find('thead th')
    .map((_, el) => $(el).text().trim())
    .get();
  const rows = $tbl
    .find('tbody tr')
    .toArray()
    .map((tr) =>
      $(tr)
        .find('td')
        .map((_, td) => $(td).text().trim().replace(/\s+/g, ' '))
        .get()
    );

  process.stdout.write(`=== ${heading} ===\n`);
  process.stdout.write(headers.join(' | ') + '\n');
  process.stdout.write('-'.repeat(80) + '\n');
  for (const r of rows) {
    process.stdout.write(r.map((c) => c.slice(0, 120)).join(' | ') + '\n');
  }
  process.stdout.write('\n');
}
