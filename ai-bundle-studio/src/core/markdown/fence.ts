export interface MarkdownFence {
  readonly marker: string
  readonly character: '`' | '~'
}

function longestRun(value: string, character: '`' | '~'): number {
  let longest = 0
  let current = 0
  for (const item of value) {
    if (item === character) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }
  return longest
}

export function createSafeFence(content: string): MarkdownFence {
  const backticks = Math.max(3, longestRun(content, '`') + 1)
  const tildes = Math.max(3, longestRun(content, '~') + 1)
  const character = backticks <= tildes ? '`' : '~'
  return { character, marker: character.repeat(character === '`' ? backticks : tildes) }
}

export function renderFencedContent(content: string, language = ''): string {
  const fence = createSafeFence(content)
  const safeLanguage = language.replaceAll(/[^a-zA-Z0-9_+.-]/gu, '').slice(0, 40)
  return `${fence.marker}${safeLanguage}\n${content}\n${fence.marker}`
}
