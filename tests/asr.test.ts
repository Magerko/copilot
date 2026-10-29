import { describe, expect, it } from 'vitest'
import { applyVocabulary, isHallucination, stripTags } from '../src/main/asr/whisper'

const VOCAB = ['PostgreSQL', 'FastAPI', 'Kubernetes', 'Docker', 'React', 'TypeScript']

describe('non-speech tag handling', () => {
  it('treats bracketed/music-only output as not speech', () => {
    expect(isHallucination('[ТРЕВОЖНАЯ МУЗЫКА]')).toBe(true)
    expect(isHallucination('[музыка]')).toBe(true)
    expect(isHallucination('(applause)')).toBe(true)
    expect(isHallucination('[BLANK_AUDIO]')).toBe(true)
    expect(isHallucination('♪♪♪')).toBe(true)
    expect(isHallucination('  ...  ')).toBe(true)
  })

  it('keeps real speech that merely contains a tag', () => {
    expect(isHallucination('[музыка] привет, как дела')).toBe(false)
    expect(stripTags('[музыка] привет, как дела')).toBe('привет, как дела')
    expect(stripTags('расскажи про REST (и gRPC)')).toBe('расскажи про REST')
    expect(stripTags('обычная фраза без тегов')).toBe('обычная фраза без тегов')
  })

  it('still catches the known subtitle hallucinations', () => {
    expect(isHallucination('Спасибо за просмотр')).toBe(true)
    expect(isHallucination('Thanks for watching')).toBe(true)
  })
})

describe('vocabulary normalization (never invents a term)', () => {
  it('fixes casing of a term the model already produced', () => {
    expect(applyVocabulary('мы используем kubernetes и docker', VOCAB)).toBe('мы используем Kubernetes и Docker')
    expect(applyVocabulary('пишем на typescript', VOCAB)).toBe('пишем на TypeScript')
  })

  it('fixes a small typo in a long term', () => {
    expect(applyVocabulary('подняли kubernets', VOCAB)).toBe('подняли Kubernetes')
  })

  it('never inserts a term that was not spoken', () => {
    const plain = 'расскажи о себе и своём опыте'
    expect(applyVocabulary(plain, VOCAB)).toBe(plain)
  })

  it('does not mangle an ordinary word near a short term', () => {
    // "React" is short → casing-only match, so the real word "reacts" is left alone.
    expect(applyVocabulary('он reacts на изменения', VOCAB)).toBe('он reacts на изменения')
  })
})
