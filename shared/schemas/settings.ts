import { z } from 'zod'

// Fork: dashboard-wide settings stored in the D1 `settings` table.

const hexColor = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Use a #rrggbb colour')

/** Base64 data URL of a PNG or SVG image, at most ~200 KB. */
export const MAX_LOGO_DATA_URL_LENGTH = 280_000
export const LogoDataUrlSchema = z.string()
  .max(MAX_LOGO_DATA_URL_LENGTH, 'The image must be smaller than 200 KB')
  .regex(/^data:image\/(?:png|svg\+xml);base64,[\w+/]+=*$/, 'Upload a PNG or SVG image')

export const QR_DOT_STYLES = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'] as const
export const QR_CORNER_STYLES = ['square', 'rounded', 'dot'] as const
export const QR_ERROR_LEVELS = ['auto', 'L', 'M', 'Q', 'H'] as const
/** Query parameter added to the encoded short link so scans show up as QR in the click log. */
export const QR_SCAN_MARKERS = ['none', 'utm_medium', 'qr'] as const

export const QrStyleSchema = z.object({
  foreground: hexColor.default('#000000'),
  background: hexColor.default('#ffffff'),
  finder: hexColor.default('#000000'),
  dotStyle: z.enum(QR_DOT_STYLES).default('dots'),
  cornerStyle: z.enum(QR_CORNER_STYLES).default('rounded'),
  errorCorrection: z.enum(QR_ERROR_LEVELS).default('auto').describe('auto = H with a centre image, otherwise Q.'),
  logo: LogoDataUrlSchema.nullable().default(null),
  linkIcon: z.boolean().default(true).describe('Without a logo, show the destination site\'s icon in the centre.'),
  scanMarker: z.enum(QR_SCAN_MARKERS).default('none'),
})

export type QrStyle = z.infer<typeof QrStyleSchema>

export const DEFAULT_QR_STYLE: QrStyle = QrStyleSchema.parse({})

export const BioButtonSchema = z.object({
  label: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(256).regex(/^[\w.\-/]+$/, 'Use an existing short link slug').transform(slug => slug.replace(/^\/+|\/+$/g, '')),
})

/** Links page ("link in bio"): a branded list of short links. */
export const BioPageSchema = z.object({
  enabled: z.boolean().default(false),
  path: z.string().trim().min(1).max(64).regex(/^[\w.-]+$/, 'One path segment, e.g. links').default('links'),
  title: z.string().trim().max(120).default(''),
  description: z.string().trim().max(300).default(''),
  logo: LogoDataUrlSchema.nullable().default(null),
  background: hexColor.default('#f5f5f4'),
  text: hexColor.default('#1c1917'),
  buttonBackground: hexColor.default('#ffffff'),
  buttonText: hexColor.default('#1c1917'),
  buttons: z.array(BioButtonSchema).max(60).default([]),
})

export type BioPage = z.infer<typeof BioPageSchema>
export type BioPageInput = z.input<typeof BioPageSchema>
