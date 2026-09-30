import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { escape } from 'es-toolkit/string'
import { parseURL } from 'ufo'

// Fork addition: serve a short HTML page that loads a Google Tag
// Manager container before redirecting, so retargeting tags (Meta Pixel, Google Ads
// remarketing, GA4) fire for links whose destinations we cannot tag ourselves.

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|curl\/|wget|python-requests|go-http-client|headless|lighthouse|pingdom|uptime/i

function parseList(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

/** Returns true when this request should get the tracking page instead of a plain redirect. */
export function shouldServeTrackingPage(event: H3Event, link: Link): boolean {
  const { gtmId, gtmSkipTags } = useRuntimeConfig(event)
  if (!gtmId || event.method !== 'GET')
    return false

  const userAgent = getHeader(event, 'user-agent') || ''
  if (!userAgent || BOT_UA.test(userAgent))
    return false

  const skipTags = parseList(gtmSkipTags)
  return !(link.tags || []).some(tag => skipTags.includes(tag.toLowerCase()))
}

// JSON.stringify output is safe inside <script> once `<` is escaped (prevents `</script>` breakouts).
function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function generateTrackingHtml(event: H3Event, link: Link, targetUrl: string): string {
  const { gtmId, gtmMaxDelayMs } = useRuntimeConfig(event)
  const maxDelay = Math.min(Math.max(Number(gtmMaxDelayMs) || 2000, 300), 5000)
  const { host } = parseURL(targetUrl)

  // Pushed before the container loads so GTM triggers and audiences can use them.
  const dataLayerSeed = {
    event: 'shortlink_view',
    shortlink_slug: link.slug,
    shortlink_tags: (link.tags || []).join(','),
    shortlink_destination_host: host || '',
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="data:,">
<title>${escape(link.title || 'Redirecting…')}</title>
<script>
window.dataLayer=window.dataLayer||[];window.dataLayer.push(${toScriptLiteral(dataLayerSeed)});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${toScriptLiteral(gtmId)});
</script>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#71717a;font-size:14px}a{color:inherit}</style>
</head>
<body>
<p>Redirecting… <a id="go" href="${escape(targetUrl)}">continue</a></p>
<script>
(function(){
  var target=${toScriptLiteral(targetUrl)},done=false;
  function go(){
    if(done)return;done=true;
    // A synthetic mousedown lets the GA4 / Ads cross-domain linker decorate the URL
    // with _gl for configured domains; it is a no-op for other destinations.
    var a=document.getElementById('go');
    try{a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));}catch(e){}
    location.replace(a.href||target);
  }
  window.addEventListener('load',function(){setTimeout(go,300);});
  setTimeout(go,${maxDelay});
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${escape(targetUrl)}"></noscript>
</body>
</html>`
}
