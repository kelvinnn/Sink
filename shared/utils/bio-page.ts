import type { BioPage } from '../schemas/settings'

// Fork: renders the links page ("link in bio") as a small standalone HTML document.
// Each button is a relative link to a short link, so clicks go through the normal redirect
// (click log, tracking page).

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

export function renderBioPage(page: BioPage, options: { linkBase?: string } = {}): string {
  const base = options.linkBase ?? ''
  const buttons = page.buttons.map(button => `<a class="button" href="${escapeAttr(`${base}/${button.slug.split('/').map(encodeURIComponent).join('/')}`)}">${escapeHtml(button.label)}</a>`).join('\n')
  const title = escapeHtml(page.title || 'Links')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${page.description ? `<meta name="description" content="${escapeAttr(page.description)}">` : ''}
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:${page.background};color:${page.text};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:580px;margin:0 auto;padding:48px 16px 64px;display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{width:96px;height:96px;border-radius:50%;object-fit:contain;background:${page.buttonBackground};margin-bottom:16px}
h1{font-size:1.25rem;margin:0 0 6px}
p{margin:0 0 24px;opacity:.75;font-size:.95rem}
nav{width:100%;display:flex;flex-direction:column;gap:12px}
.button{display:block;padding:16px 20px;border-radius:14px;background:${page.buttonBackground};color:${page.buttonText};text-decoration:none;font-weight:600;line-height:1.3;box-shadow:0 1px 2px rgba(0,0,0,.08);transition:transform .1s}
.button:hover{transform:scale(1.015)}
.button:focus-visible{outline:3px solid ${page.text};outline-offset:2px}
</style>
</head>
<body>
<main>
${page.logo ? `<img class="logo" src="${escapeAttr(page.logo)}" alt="">` : ''}
${page.title ? `<h1>${title}</h1>` : ''}
${page.description ? `<p>${escapeHtml(page.description)}</p>` : ''}
<nav>
${buttons}
</nav>
</main>
</body>
</html>
`
}
