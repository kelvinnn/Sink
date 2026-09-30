export default defineAppConfig({
  title: 'Sink',
  documentation: 'https://docs.sink.cool',
  github: 'https://github.com/miantiao-me/sink',
  coffee: 'https://sink.cool/coffee',
  twitter: 'https://sink.cool/x',
  telegram: 'https://sink.cool/telegram',
  description: 'A Simple / Speedy / Secure Link Shortener with Analytics, 100% run on Cloudflare.',
  image: 'https://sink.cool/banner.png',
  previewTTL: 300, // 5 minutes
  // Fork: allow `.`, `_` and `/` between segments (e.g. `shop/sale`, `menu.pdf`).
  slugRegex: /^[a-z0-9]+(?:[-._/]+[a-z0-9]+)*$/i,
  // Matched against the first path segment of a slug.
  reserveSlug: [
    'dashboard',
    'api',
  ],
})
