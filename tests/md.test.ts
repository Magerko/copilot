import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownInline } from '../src/renderer/lib/md'

const html = (text: string) => renderToStaticMarkup(createElement(MarkdownInline, { text }))

describe('inline markdown in answers', () => {
  it('renders bold and code instead of raw asterisks', () => {
    expect(html('Є **функціональне** і `API` тестування')).toBe('Є <strong>функціональне</strong> і <code>API</code> тестування')
  })

  it('hides a dangling ** while the answer is still streaming', () => {
    expect(html('Є **функціональне, нефунк')).toBe('Є функціональне, нефунк')
  })

  it('never turns text into HTML', () => {
    expect(html('<img src=x onerror=alert(1)> **b**')).toBe('&lt;img src=x onerror=alert(1)&gt; <strong>b</strong>')
  })
})
