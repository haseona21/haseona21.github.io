# CLAUDE.md — instructions for this repo

This site is **generated from a single source of truth**. The published files
are build artifacts — never edit them directly.

## Generated (do NOT edit by hand)
- `index.html`
- `llms.txt`
- `robots.txt`
- `sitemap.xml`
- `writing/*.html`

## Source (edit these)
- `data/site.json` — all shared facts: name, job title, location, links,
  `projects[]`, `writing[]`. Change a fact here and it propagates everywhere.
- `src/index.html` — homepage template (`{{token}}` placeholders + verbatim CSS/JS).
- `src/llms.txt` — llms.txt template.
- `src/templates/post.html` — shared blog-post layout.
- `src/writing/<slug>.html` — a single post's `<article>…</article>` body.

## Workflow for ANY content change
1. Edit `data/site.json` and/or the relevant `src/` file.
2. Commit and push the source.

A GitHub Action (`.github/workflows/build.yml`) runs `node build.js` on every
push to `main` and commits the regenerated output back automatically, so the
published files stay in sync without a manual build step.

To preview locally before pushing (optional): `npm run build` then
`npm run check` (and inspect `git diff`).

## Adding a blog post
1. Add an entry to `writing[]` in `data/site.json` (slug, title, dates,
   readTime, metaDescription, ogDescription, llmsDescription).
2. Create `src/writing/<slug>.html` with only the article body.
3. `npm run build` — it generates the full page, the homepage link, and the
   llms.txt entry.

## Deploy
GitHub Pages serves the committed files from the repo root (`main` branch).
The `build.yml` Action regenerates and commits the output on each push, so the
served files stay current. `_config.yml` keeps build sources out of the
published site. Follow the global push/deploy guardrails in the user-level
CLAUDE.md before any `git push` (a push to `main` deploys the live site).
