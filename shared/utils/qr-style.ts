import type { QrStyle } from '../schemas/settings'

// Fork: turns the stored QR style into qr-code-styling options (shared so it can be unit tested).

const CORNERS: Record<QrStyle['cornerStyle'], { square: 'square' | 'extra-rounded' | 'dot', dot: 'square' | 'dot' }> = {
  square: { square: 'square', dot: 'square' },
  rounded: { square: 'extra-rounded', dot: 'dot' },
  dot: { square: 'dot', dot: 'dot' },
}

/** Print size of downloaded PNGs: 2048 px is about 17 cm at 300 dpi. */
export const QR_PRINT_SIZE = 2048

/** Short link with the scan marker, so scans are logged as QR (trigger=qr). */
export function qrData(shortLink: string, marker: QrStyle['scanMarker']): string {
  if (marker === 'none')
    return shortLink
  const param = marker === 'utm_medium' ? 'utm_medium=qr_code' : 'qr=1'
  return `${shortLink}${shortLink.includes('?') ? '&' : '?'}${param}`
}

export function qrErrorLevel(style: QrStyle, hasImage: boolean): 'L' | 'M' | 'Q' | 'H' {
  if (style.errorCorrection !== 'auto')
    return style.errorCorrection
  return hasImage ? 'H' : 'Q'
}

/** Centre image: the uploaded logo, else (optionally) the link's icon. */
export function qrImage(style: QrStyle, linkIcon?: string): string {
  return style.logo || (style.linkIcon ? linkIcon || '' : '')
}

export function qrStylingOptions(style: QrStyle, input: { data: string, image?: string, size: number, type?: 'svg' | 'canvas' }) {
  const image = qrImage(style, input.image)
  const corners = CORNERS[style.cornerStyle]
  return {
    width: input.size,
    height: input.size,
    data: input.data,
    type: input.type ?? 'svg' as const,
    margin: Math.round(input.size / 25),
    qrOptions: { typeNumber: 0 as const, mode: 'Byte' as const, errorCorrectionLevel: qrErrorLevel(style, !!image) },
    image: image || undefined,
    imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: Math.round(input.size / 128) },
    dotsOptions: { type: style.dotStyle, color: style.foreground },
    backgroundOptions: { color: style.background },
    cornersSquareOptions: { type: corners.square, color: style.finder },
    cornersDotOptions: { type: corners.dot, color: style.finder },
  }
}
