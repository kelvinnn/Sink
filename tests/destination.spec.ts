import { describe, expect, it } from 'vitest'
import { destinationHosts, disallowedHosts, isHostAllowed, parseAllowedHosts } from '../shared/utils/destination-hosts'

// Fork tests: destination allow-list host matching.

describe('destination allow-list', () => {
  const allowed = parseAllowedHosts(' Example.com, *.shop.test ,maps.app.goo.gl,')

  it('parses the list', () => {
    expect(allowed).toEqual(['example.com', 'shop.test', 'maps.app.goo.gl'])
    expect(parseAllowedHosts('')).toEqual([])
  })

  it('allows listed hosts and their subdomains only', () => {
    expect(isHostAllowed('example.com', allowed)).toBe(true)
    expect(isHostAllowed('www.example.com', allowed)).toBe(true)
    expect(isHostAllowed('a.b.shop.test', allowed)).toBe(true)
    expect(isHostAllowed('badexample.com', allowed)).toBe(false)
    expect(isHostAllowed('example.com.evil.test', allowed)).toBe(false)
    expect(isHostAllowed('goo.gl', allowed)).toBe(false)
    expect(isHostAllowed('anything.test', [])).toBe(true)
  })

  it('checks every destination and ignores hosts the previous version already had', () => {
    const link = { url: 'https://www.example.com/a', apple: 'https://apps.apple.com/x', geo: { SG: 'https://evil.test/sg' } }
    expect(destinationHosts(link)).toEqual(['www.example.com', 'apps.apple.com', 'evil.test'])
    expect(disallowedHosts(link, allowed)).toEqual(['apps.apple.com', 'evil.test'])
    expect(disallowedHosts(link, allowed, { url: 'https://evil.test/old' })).toEqual(['apps.apple.com'])
    expect(disallowedHosts(link, [])).toEqual([])
  })
})
