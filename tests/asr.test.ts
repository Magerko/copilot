import { describe, expect, it } from 'vitest'
import { applyVocabulary, diagnoseWhisperFailure, isHallucination, stripTags } from '../src/main/asr/whisper'

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

describe('whisper-server crash diagnosis', () => {
  it('spots a missing VC++ runtime (by exit code and by stderr)', () => {
    // 0xC0000135 (DLL not found) comes back as a signed int32 on Windows.
    expect(diagnoseWhisperFailure(-1073741515, [])).toMatch(/Visual C\+\+/)
    expect(diagnoseWhisperFailure(1, ['msvcp140.dll was not found'])).toMatch(/Visual C\+\+/)
  })

  it('spots an unsupported CPU (no AVX)', () => {
    expect(diagnoseWhisperFailure(-1073741795, [])).toMatch(/AVX/) // 0xC000001D illegal instruction
    expect(diagnoseWhisperFailure(1, ['Illegal instruction'])).toMatch(/AVX/)
  })

  it('spots CUDA, corrupt model, busy port and access violation', () => {
    expect(diagnoseWhisperFailure(1, ['CUDA error: out of memory'])).toMatch(/CUDA/)
    expect(diagnoseWhisperFailure(1, ['failed to load model from file'])).toMatch(/модел/)
    expect(diagnoseWhisperFailure(1, ['error: bind: address already in use'])).toMatch(/порт занят/)
    expect(diagnoseWhisperFailure(-1073741819, [])).toMatch(/access violation/) // 0xC0000005
  })

  it('returns null for a clean/unknown exit', () => {
    expect(diagnoseWhisperFailure(0, ['server listening on 127.0.0.1'])).toBeNull()
    expect(diagnoseWhisperFailure(null, [])).toBeNull()
  })
})
