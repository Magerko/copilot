import { describe, expect, it } from 'vitest'
import { AsrManager, type AsrConfig, type AsrJob } from '../src/main/asr/manager'
import type { AsrAssets } from '../src/main/asr/assets'
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

describe('AsrManager.settled', () => {
  const job = (id: string, final: boolean): AsrJob => ({ sessionId: 's', utteranceId: id, source: 'remote', pcm: new Int16Array(16), startMs: 0, endMs: 1, final })

  function manager() {
    const emitted: string[] = []
    const assets = { serverPath: () => null, hasModel: () => false, modelPath: () => '' } as unknown as AsrAssets
    const m = new AsrManager(assets, fetch, { backend: 'metal', model: 'm', language: 'auto', vocabulary: [], threads: 2 } as unknown as AsrConfig, {
      segment: (seg) => emitted.push(seg.segmentId),
      status: () => {},
      log: () => {}
    })
    let open = () => {}
    const gate = new Promise<void>((r) => (open = r))
    m.ensure = async () => {
      await gate
      return false
    }
    return { m, emitted, open }
  }

  it('waits for a final and resolves right after it is emitted', async () => {
    const { m, emitted, open } = manager()
    m.push(job('a', true))
    let done = false
    void m.settled().then(() => (done = true))
    await new Promise((r) => setTimeout(r, 5))
    expect(done).toBe(false)
    open()
    await m.settled()
    await new Promise((r) => setTimeout(r, 0))
    expect(done).toBe(true)
    expect(emitted).toEqual(['a'])
  })

  it('does not wait for partials', async () => {
    const { m } = manager()
    m.push(job('a', false))
    await m.settled()
  })
})
