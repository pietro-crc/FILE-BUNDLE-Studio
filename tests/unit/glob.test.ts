import { globToRegExp, matchesAnyGlob, parseGlobInput } from '../../src/core/preflight/glob'

describe('bounded exclusion globs', () => {
  it('supports path-aware *, ** and ? matching', () => {
    expect(globToRegExp('node_modules/**').test('node_modules/pkg/index.js')).toBe(true)
    expect(globToRegExp('**/*.test.?s').test('src/core/file.test.ts')).toBe(true)
    expect(globToRegExp('*.log').test('nested/app.log')).toBe(false)
  })

  it('normalizes separators and reports overlong patterns instead of evaluating them', () => {
    expect(matchesAnyGlob('dist/app.js', ['dist\\**'])).toBe(true)
    const parsed = parseGlobInput(`${'x'.repeat(257)}, build/**`)
    expect(parsed.patterns).toEqual(['build/**'])
    expect(parsed.errors).toHaveLength(1)
  })
})
