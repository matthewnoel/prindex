import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public');
const config = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;

async function github(url, accept = 'application/vnd.github+json') {
  const headers = {
    Accept: accept,
    'User-Agent': 'prindex-build',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  return accept.includes('raw') ? res.text() : res.json();
}

async function fetchAllRepos(owner) {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await github(`${API}/users/${owner}/repos?per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function titleize(name) {
  return name
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Rewrite relative src/href in rendered README HTML so images and file links
// resolve against the repo on GitHub instead of 404ing on our domain.
function absolutizeUrls(html, repo) {
  const raw = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}`;
  const blob = `https://github.com/${repo.full_name}/blob/${repo.default_branch}`;
  return html.replace(/(src|href)="([^"]+)"/g, (match, attr, url) => {
    if (/^(https?:|mailto:|#|data:)/i.test(url)) return match;
    const clean = url.replace(/^\.?\//, '');
    const base = attr === 'src' ? raw : blob;
    return `${attr}="${base}/${clean}"`;
  });
}

function formatDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function layout({ title, description, canonicalPath, ogImage, jsonLd, body, depth = 0 }) {
  const assetBase = '../'.repeat(depth);
  const cssPath = `${assetBase}styles.css`;
  const canonical = `${config.siteUrl}${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${ogImage}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="stylesheet" href="${cssPath}">
<link rel="stylesheet" href="${assetBase}themes.css">
<script>try{var t=localStorage.getItem('prindex-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header class="site-header">
<a class="site-name" href="${'../'.repeat(depth) || './'}">${escapeHtml(config.title.split('—')[0].trim())}</a>
</header>
<main>
${body}
</main>
<footer class="site-footer">
<p>Free and open source. Browse the code and files on <a href="https://github.com/${config.owner}" rel="me">GitHub</a>.</p>
</footer>
<script src="${assetBase}debug.js" defer></script>
</body>
</html>
`;
}

function repoPage(repo, readmeHtml) {
  const displayName = titleize(repo.name);
  const description = repo.description || `${displayName}, a free 3D-printable design by ${config.owner}.`;
  const ogImage = `https://opengraph.githubassets.com/1/${repo.full_name}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': '3DModel',
    name: displayName,
    description,
    url: `${config.siteUrl}/repos/${repo.name}/`,
    image: ogImage,
    dateModified: repo.pushed_at,
    keywords: repo.topics.join(', '),
    isAccessibleForFree: true,
    ...(repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
      ? { license: `https://spdx.org/licenses/${repo.license.spdx_id}` }
      : {}),
    author: { '@type': 'Person', name: config.owner, url: `https://github.com/${config.owner}` },
    isBasedOn: repo.html_url,
  };
  const body = `<article class="repo">
<h1>${escapeHtml(displayName)}</h1>
<p class="repo-description">${escapeHtml(description)}</p>
<p class="repo-meta">
<a class="button" href="${repo.html_url}">Get the files on GitHub</a>
<span>Updated ${formatDate(repo.pushed_at)}</span>
${repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? `<span>License: ${escapeHtml(repo.license.spdx_id)}</span>` : ''}
</p>
${repo.topics.length ? `<ul class="topics">${repo.topics.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
${readmeHtml ? `<section class="readme">${readmeHtml}</section>` : ''}
</article>`;
  return layout({
    title: `${displayName} — Free 3D Print Files | ${config.title.split('—')[0].trim()}`,
    description,
    canonicalPath: `/repos/${repo.name}/`,
    ogImage,
    jsonLd,
    body,
    depth: 2,
  });
}

function indexPage(repos) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.title,
    description: config.description,
    url: `${config.siteUrl}/`,
    numberOfItems: repos.length,
    itemListElement: repos.map((repo, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: titleize(repo.name),
      url: `${config.siteUrl}/repos/${repo.name}/`,
    })),
  };
  const cards = repos
    .map(
      (repo) => `<li class="card">
<article>
<h2><a href="repos/${repo.name}/">${escapeHtml(titleize(repo.name))}</a></h2>
${repo.description ? `<p>${escapeHtml(repo.description)}</p>` : ''}
${repo.topics.length ? `<ul class="topics">${repo.topics.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
<p class="card-meta">Updated ${formatDate(repo.pushed_at)} · <a href="${repo.html_url}">Source</a></p>
</article>
</li>`
    )
    .join('\n');
  const body = `<h1>${escapeHtml(config.title)}</h1>
<p class="intro">${escapeHtml(config.description)}</p>
${repos.length ? `<ul class="card-grid">\n${cards}\n</ul>` : '<p>No models published yet — check back soon.</p>'}`;
  return layout({
    title: config.title,
    description: config.description,
    canonicalPath: '/',
    ogImage: null,
    jsonLd,
    body,
    depth: 0,
  });
}

function notFoundPage() {
  return layout({
    title: `Page not found | ${config.title.split('—')[0].trim()}`,
    description: 'This page does not exist.',
    canonicalPath: '/404.html',
    ogImage: null,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
    body: '<h1>Page not found</h1><p>This page does not exist. <a href="/">Browse all models</a>.</p>',
    depth: 0,
  });
}

function sitemap(repos) {
  const urls = [
    { loc: `${config.siteUrl}/`, lastmod: formatDate(new Date().toISOString()) },
    ...repos.map((r) => ({ loc: `${config.siteUrl}/repos/${r.name}/`, lastmod: formatDate(r.pushed_at) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

// --- Build ---

console.log(`Fetching public repos for ${config.owner}…`);
const allRepos = await fetchAllRepos(config.owner);
const repos = allRepos
  .filter((r) => !r.fork && !r.archived && r.topics.includes(config.topic))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
console.log(`${allRepos.length} public repos, ${repos.length} tagged with "${config.topic}".`);

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

for (const repo of repos) {
  console.log(`Building page for ${repo.name}…`);
  const readme = await github(`${API}/repos/${repo.full_name}/readme`, 'application/vnd.github.raw+json');
  const readmeHtml = readme ? absolutizeUrls(await marked.parse(readme), repo) : null;
  const dir = path.join(outDir, 'repos', repo.name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), repoPage(repo, readmeHtml));
}

await fs.writeFile(path.join(outDir, 'index.html'), indexPage(repos));
await fs.writeFile(path.join(outDir, '404.html'), notFoundPage());
await fs.writeFile(path.join(outDir, 'sitemap.xml'), sitemap(repos));
await fs.writeFile(path.join(outDir, '.nojekyll'), '');
await fs.copyFile(path.join(root, 'static', 'styles.css'), path.join(outDir, 'styles.css'));
// Design Lab (temporary): theme explorations + the ?debug=1 widget.
await fs.copyFile(path.join(root, 'static', 'themes.css'), path.join(outDir, 'themes.css'));
await fs.copyFile(path.join(root, 'static', 'debug.js'), path.join(outDir, 'debug.js'));

console.log(`Done. Wrote ${repos.length + 2} pages to ${path.relative(root, outDir)}/.`);
