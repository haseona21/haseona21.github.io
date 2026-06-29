#!/usr/bin/env node
/*
 * build.js — renders the published site from a single source of truth.
 *
 *   data/site.json        canonical facts (name, title, location, links, projects, writing)
 *   src/index.html        homepage template      -> index.html
 *   src/llms.txt          llms.txt template      -> llms.txt
 *   src/llms-full.txt     deep LLM profile       -> llms-full.txt
 *   src/profile.html      canonical profile      -> profile.html
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
const compactJson = (value) => JSON.stringify(value);

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

const profileProjects = site.projects
  .map((p) => {
    const name = p.url ? `<a href="${p.url}">${p.name}</a>` : p.name;
    return `      <li><strong>${name}</strong> (${p.lang}) — ${p.desc}.</li>`;
  })
  .join('\n');

const profileWriting = site.writing
  .map(
    (w) =>
      `      <li><a href="./writing/${w.slug}.html">${w.title}</a> — ${w.llmsDescription} (${w.dateDisplay})</li>`
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
  education: site.education,
  location: site.location,
  links: site.links,
  accounts: site.accounts,
  seo: site.seo,
  content: site.content,
  json: { knowsAbout: jsonArray(site.knowsAbout), sameAs: jsonArray(sameAs) },
  html: { indexProjects, indexWriting, profileProjects, profileWriting },
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
outputs['llms-full.txt'] = render('llms-full.txt', read('src/llms-full.txt'), ctx);
outputs['profile.html'] = render('profile.html', read('src/profile.html'), ctx);

const postTpl = read('src/templates/post.html');
for (const w of site.writing) {
  const bodyHtml = read(`src/writing/${w.slug}.html`).replace(/\n$/, '');
  const post = {
    ...w,
    ogTitle: w.title,
    ogUrl: `${site.seo.ogBase}/writing/${w.slug}.html`,
    canonicalUrl: `${person.url}/writing/${w.slug}.html`,
    articleJsonLd: compactJson({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: w.title,
      description: w.metaDescription,
      datePublished: w.published,
      dateModified: w.updated || w.published,
      mainEntityOfPage: `${person.url}/writing/${w.slug}.html`,
      url: `${person.url}/writing/${w.slug}.html`,
      author: {
        '@type': 'Person',
        '@id': `${person.url}/#person`,
        name: person.name,
        url: person.url,
        sameAs,
      },
      publisher: {
        '@type': 'Person',
        '@id': `${person.url}/#person`,
        name: person.name,
        url: person.url,
      },
    }),
    bodyHtml,
  };
  outputs[`writing/${w.slug}.html`] = render(`writing/${w.slug}.html`, postTpl, { ...ctx, post });
}

// ── robots.txt ───────────────────────────────────────────────────────────────
outputs['robots.txt'] = [
  '# OpenAI search/indexing crawler for ChatGPT search results.',
  'User-agent: OAI-SearchBot',
  'Allow: /',
  'Allow: /llms.txt',
  'Allow: /llms-full.txt',
  '',
  '# OpenAI crawler for improving generative AI foundation models.',
  'User-agent: GPTBot',
  'Allow: /',
  'Allow: /llms.txt',
  'Allow: /llms-full.txt',
  '',
  '# User-initiated ChatGPT browsing guidance.',
  'User-agent: ChatGPT-User',
  'Allow: /',
  'Allow: /llms.txt',
  'Allow: /llms-full.txt',
  '',
  '# Default policy for other search engines and answer-engine crawlers.',
  'User-agent: *',
  'Allow: /',
  'Allow: /llms.txt',
  'Allow: /llms-full.txt',
  '',
  `# AI crawlers should use ${person.url}/llms.txt for a concise summary and ${person.url}/llms-full.txt for detailed context.`,
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
    urlEntry(`${person.url}/profile.html`, latest),
    urlEntry(`${person.url}/llms.txt`, latest),
    urlEntry(`${person.url}/llms-full.txt`, latest),
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
