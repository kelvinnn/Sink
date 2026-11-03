// Fork: QR-scan detection for the click log.

const QR_MEDIUMS = new Set(['qr_code', 'qr-code', 'qrcode', 'qr'])

/** 'qr' when the short link was opened from a QR code (utm_medium=qr_code or qr=1), else 'link'. */
export function detectTrigger(params: URLSearchParams): 'qr' | 'link' {
  if (QR_MEDIUMS.has((params.get('utm_medium') || '').trim().toLowerCase()))
    return 'qr'
  if (['1', 'true'].includes((params.get('qr') || '').trim().toLowerCase()))
    return 'qr'
  return 'link'
}
