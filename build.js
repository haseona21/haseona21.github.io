#!/usr/bin/env node
/*
 * build.js — renders the published site from a single source of truth.
 *
 *   data/site.json        canonical facts (name, title, location, links, projects, writing)
 *   src/index.html        homepage template      -> index.html
 *   src/llms.txt          llms.txt template      -> llms.txt
 *   src/templates/post.html + src/writing/<slug>.html (article body) -> writing/<slug>.html
 *
 * Every cross-file fact lives in data/site.json. Edit the source, never the
 * generated files. Run `npm run build`. `npm run check` verifies the committed
 * output matches what the sources would produce (used by the pre-commit hook).
 *
 * No dependencies — plain Node (fs + string replace).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const r = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(r(p), 'utf8');

const site = JSON.parse(read('data/site.json'));

// ── derived fields ──────────────────────────────────────────────────────────
const person = {
  ...site.person,
  resumePath: './' + site.person.resumeFile,
  resumeUrl: site.person.url + '/' + site.person.resumeFile,
};

// JSON-LD array literals, indented to match the surrounding block exactly.
const jsonArray = (items) =>
  '[\n' + items.map((s) => '      ' + JSON.stringify(s)).join(',\n') + '\n    ]';

const sameAs = [site.links.linkedin, site.links.github, site.links.x, site.links.instagram];

// Homepage project rows.
const indexProjects = site.projects
  .map((p) => {
    const name = p.url
      ? `<a href="${p.url}" target="_blank" rel="noopener">${p.name}</a>`
      : p.name;
    return [
      '    <div class="project-item">',
      '      <div class="project-info">',
      `        <span class="project-name">${name}</span>`,
      `        <span class="project-desc">${p.desc}</span>`,
      '      </div>',
      `      <span class="project-lang">${p.lang}</span>`,
      '    </div>',
    ].join('\n');
  })
  .join('\n');

// Homepage writing rows.
const indexWriting = site.writing
  .map((w) =>
    [
      `    <a class="post-item" href="./writing/${w.slug}.html">`,
      `      <span class="post-title">${w.title}</span>`,
      `      <span class="post-date">${w.listDate}</span>`,
      '    </a>',
    ].join('\n')
  )
  .join('\n');

// llms.txt list sections.
const llmsProjects = site.projects
  .map((p) => `- **${p.name}** (${p.lang}): ${p.desc}.`)
  .join('\n');
const llmsWriting = site.writing
  .map(
    (w) =>
      `- [${w.title}](${person.url}/writing/${w.slug}.html): ${w.llmsDescription} (${w.dateDisplay})`
  )
  .join('\n');

const ctx = {
  person,
  location: site.location,
  links: site.links,
  accounts: site.accounts,
  seo: site.seo,
  content: site.content,
  json: { knowsAbout: jsonArray(site.knowsAbout), sameAs: jsonArray(sameAs) },
  html: { indexProjects, indexWriting },
  md: { llmsProjects, llmsWriting },
};

// ── tiny {{path}} template engine — throws on any unknown token ──────────────
function render(label, tpl, context) {
  const missing = new Set();
  const out = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, keyPath) => {
    const value = keyPath.split('.').reduce((o, k) => (o == null ? o : o[k]), context);
    if (value === undefined || value === null) {
      missing.add(keyPath);
      return '';
    }
    return String(value);
  });
  if (missing.size) {
    throw new Error(`${label}: unknown token(s): ${[...missing].join(', ')}`);
  }
  return out;
}

// ── render every output ──────────────────────────────────────────────────────
const outputs = {};
outputs['index.html'] = render('index.html', read('src/index.html'), ctx);
outputs['llms.txt'] = render('llms.txt', read('src/llms.txt'), ctx);

const postTpl = read('src/templates/post.html');
for (const w of site.writing) {
  const bodyHtml = read(`src/writing/${w.slug}.html`).replace(/\n$/, '');
  const post = {
    ...w,
    ogTitle: w.title,
    ogUrl: `${site.seo.ogBase}/writing/${w.slug}.html`,
    bodyHtml,
  };
  outputs[`writing/${w.slug}.html`] = render(`writing/${w.slug}.html`, postTpl, { ...ctx, post });
}

// ── robots.txt ───────────────────────────────────────────────────────────────
outputs['robots.txt'] = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${person.url}/sitemap.xml`,
  '',
].join('\n');

// ── sitemap.xml ──────────────────────────────────────────────────────────────
// lastmod is deterministic (no clock): home uses the most recent post date.
const latest = site.writing
  .map((w) => w.published)
  .sort()
  .reverse()[0];
const urlEntry = (loc, lastmod) =>
  ['  <url>', `    <loc>${loc}</loc>`, `    <lastmod>${lastmod}</lastmod>`, '  </url>'].join('\n');
outputs['sitemap.xml'] =
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntry(`${person.url}/`, latest),
    ...site.writing.map((w) => urlEntry(`${person.url}/writing/${w.slug}.html`, w.published)),
    '</urlset>',
  ].join('\n') + '\n';

// ── write or check ───────────────────────────────────────────────────────────
const checkMode = process.argv.includes('--check');
let drift = 0;
for (const [rel, content] of Object.entries(outputs)) {
  const abs = r(rel);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (checkMode) {
    if (current !== content) {
      drift++;
      console.error(`DRIFT: ${rel} is out of sync with its source. Run \`npm run build\`.`);
    }
  } else if (current !== content) {
    fs.writeFileSync(abs, content);
    console.log(`wrote ${rel}`);
  } else {
    console.log(`ok    ${rel} (unchanged)`);
  }
}

if (checkMode) {
  if (drift) {
    console.error(`\n${drift} file(s) drifted. Edit data/site.json + src/, then \`npm run build\`.`);
    process.exit(1);
  }
  console.log('check passed — all generated files match their sources.');
}
