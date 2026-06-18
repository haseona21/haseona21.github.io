# haseona21.github.io

Personal site for Christine Mae Tse — served by GitHub Pages at https://maetse.com.

## How this site is built (read before editing)

The published files — `index.html`, `llms.txt`, and `writing/*.html` — are
**generated**. Do not edit them by hand. Every shared fact (name, job title,
location, links, project list, writing list) lives in one place:

```
data/site.json          ← the single source of truth (facts + projects + writing)
src/index.html          ← homepage template          → index.html
src/llms.txt            ← llms.txt template           → llms.txt
src/templates/post.html ← shared blog-post layout
src/writing/<slug>.html ← each post's article body    → writing/<slug>.html
build.js                ← renders the source into the published files
```

### To make a change

1. Edit `data/site.json` (a fact, a project, a writing entry) and/or the
   relevant template in `src/`.
2. Commit and push.

That's it. A GitHub Action rebuilds the site on every push to `main` and commits
the regenerated files (`index.html`, `llms.txt`, `robots.txt`, `sitemap.xml`,
`writing/*.html`) back automatically — so the published files can never fall out
of sync with the source.

To preview locally before pushing (optional):

```sh
npm run build    # regenerate now
npm run check    # verify output matches source
```

### Common edits

- **Change a fact everywhere** (title, location, a link): edit `data/site.json`.
  It propagates to the homepage `<title>`, meta tags, JSON-LD, the bio links,
  the footer, the weather widget, and `llms.txt` in one shot.
- **Add/remove a project**: edit the `projects` array in `data/site.json`. It
  updates both the homepage Projects section and `llms.txt`.
- **Add a blog post**: add an entry to the `writing` array in `data/site.json`,
  then create `src/writing/<slug>.html` containing just the `<article>…</article>`
  body. The build produces the full page, the homepage link, and the `llms.txt`
  entry.
- **Change page styling/markup**: edit `src/index.html` or
  `src/templates/post.html` (these hold all the CSS/JS verbatim).

## Automatic build (GitHub Actions)

`.github/workflows/build.yml` runs on every push to `main`: it regenerates the
site from `data/site.json` + `src/` and commits the result back (tagged
`[skip ci]` so it can't loop). This is what keeps the published files in sync —
you only ever edit and commit the source.

**One-time setup** (needed for the Action to commit back): in the repo,
Settings → Actions → General → Workflow permissions → **Read and write**.

`_config.yml` excludes the build sources (`src/`, `data/`, `build.js`, etc.) from
the published site, so only the generated output and static assets are served at
maetse.com.
