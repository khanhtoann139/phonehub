import { describe, expect, it } from 'vitest'
import { parseFilters, toSearchParams, toggleIn } from './filters'
import { compactPrice, discountPercent, formatPrice, storageLabel } from './format'

describe('product filters ⇄ URL', () => {
  it('round-trips through search params', () => {
    const sp = new URLSearchParams('q=iphone&brand=apple,samsung&storage=256&minPrice=5000000&sort=price_asc&page=3&onSale=true')
    const f = parseFilters(sp)
    expect(f).toMatchObject({ q: 'iphone', brand: ['apple', 'samsung'], storage: ['256'], minPrice: 5_000_000, sort: 'price_asc', page: 3, onSale: true })
    expect(parseFilters(toSearchParams(f))).toEqual(f)
  })

  it('sanitizes invalid values', () => {
    const f = parseFilters(new URLSearchParams('sort=hack&page=-2&minPrice=abc'))
    expect(f.sort).toBe('popular')
    expect(f.page).toBe(1)
    expect(f.minPrice).toBeUndefined()
  })

  it('omits defaults to keep URLs short', () => {
    expect(toSearchParams({ sort: 'popular', page: 1 }).toString()).toBe('')
  })

  it('toggles values', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('format helpers', () => {
  it('formats VND', () => {
    expect(formatPrice(12990000).replace(/\s/g, '')).toBe('12.990.000₫')
    expect(storageLabel(1024)).toBe('1TB')
    expect(discountPercent(9_000_000, 10_000_000)).toBe(10)
    expect(discountPercent(10, null)).toBe(0)
    expect(compactPrice(25_500_000)).toContain('tr')
  })
})
