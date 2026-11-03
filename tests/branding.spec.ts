import { describe, expect, it } from 'vitest'
import { DEFAULT_QR_STYLE } from '../shared/schemas/settings'
import { qrData, qrErrorLevel, qrStylingOptions } from '../shared/utils/qr-style'

// Fork tests: QR style → qr-code-styling options.

describe('qr style', () => {
  it('adds the scan marker to the encoded link', () => {
    expect(qrData('https://s.example/menu', 'none')).toBe('https://s.example/menu')
    expect(qrData('https://s.example/menu', 'utm_medium')).toBe('https://s.example/menu?utm_medium=qr_code')
    expect(qrData('https://s.example/menu?a=1', 'qr')).toBe('https://s.example/menu?a=1&qr=1')
  })

  it('uses H error correction with a centre image unless a level is chosen', () => {
    expect(qrErrorLevel(DEFAULT_QR_STYLE, false)).toBe('Q')
    expect(qrErrorLevel(DEFAULT_QR_STYLE, true)).toBe('H')
    expect(qrErrorLevel({ ...DEFAULT_QR_STYLE, errorCorrection: 'M' }, true)).toBe('M')
  })

  it('maps colours, styles and the centre image', () => {
    const logo = 'data:image/png;base64,AAAA'
    const options = qrStylingOptions({ ...DEFAULT_QR_STYLE, foreground: '#111111', finder: '#222222', background: '#fafafa', cornerStyle: 'square', dotStyle: 'classy', logo }, { data: 'x', image: 'https://icon', size: 2048 })
    expect(options).toMatchObject({
      width: 2048,
      image: logo,
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'classy', color: '#111111' },
      backgroundOptions: { color: '#fafafa' },
      cornersSquareOptions: { type: 'square', color: '#222222' },
      cornersDotOptions: { type: 'square', color: '#222222' },
    })
    expect(qrStylingOptions({ ...DEFAULT_QR_STYLE, linkIcon: false }, { data: 'x', image: 'https://icon', size: 256 }).image).toBeUndefined()
    expect(qrStylingOptions(DEFAULT_QR_STYLE, { data: 'x', image: 'https://icon', size: 256 }).image).toBe('https://icon')
  })
})
