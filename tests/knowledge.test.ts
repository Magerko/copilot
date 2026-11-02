import { describe, expect, it } from 'vitest'
import { Bm25Index, selectKnowledge, type Chunk } from '../src/main/context/retrieval'

const cv = (id: string, section: string, text: string): Chunk => ({ id, documentId: 'cv', docName: 'CV.docx', kind: 'cv', section, text })
const jd = (id: string, text: string): Chunk => ({ id, documentId: 'jd', docName: 'Job.pdf', kind: 'jd', section: '', text })
const chunks = [
  cv('h', '', 'Denys Shcheniatskyi\nSenior QA Engineer\nKyiv, Ukraine'),
  cv('s', 'SUMMARY', 'Senior QA Engineer with 7+ years in fintech, e-health and Web3.'),
  cv('k', 'SKILLS', 'Automation: Playwright, Selenium, RestAssured, Pytest'),
  cv('w1', 'WORK EXPERIENCE', 'Aleph One | Led QA for an AI-powered product'),
  cv('w2', 'WORK EXPERIENCE', 'NuxGame | Lead of QA, test strategy'),
  jd('j1', 'Senior QA Automation Engineer at Example, Playwright + TypeScript'),
  jd('j2', 'Requirements: 5+ years, API testing, CI'),
  jd('j3', 'Benefits: remote, insurance')
]
const ids = (q: string) => selectKnowledge(new Bm25Index(chunks), chunks, q).map((c) => c.id)

describe('knowledge selection', () => {
  it('an English CV still reaches a Ukrainian question with no shared words', () => {
    const got = ids('Як би ви організували регресійне тестування?')
    expect(got).toEqual(expect.arrayContaining(['h', 's', 'k', 'j1', 'j2']))
    expect(got).not.toContain('j3')
  })

  it('a question about the user brings the whole CV', () => {
    expect(ids('Що ти знаєш про моє резюме?')).toEqual(expect.arrayContaining(['w1', 'w2']))
  })

  it('matches come first, before the profile core', () => {
    expect(ids('Playwright TypeScript')[0]).toMatch(/^(k|j1)$/)
  })

  it('no documents, no context', () => {
    expect(selectKnowledge(null, [], 'anything')).toEqual([])
  })
})
