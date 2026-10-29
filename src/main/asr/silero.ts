import { existsSync } from 'node:fs'
import type { InferenceSession, Tensor } from 'onnxruntime-node'

const RATE = 16000
const CHUNK = 512
// Silero v5 wants 64 samples of previous context prepended to each 512-sample frame; without them it quietly misfires.
const CONTEXT = 64

type Ort = typeof import('onnxruntime-node')

/**
 * Silero VAD speech gate. I run it before whisper so music/silence/noise never reaches the model —
 * that is where "[музыка]" and the phantom prompt words came from. It loads lazily and, if the model
 * or the native runtime is missing, degrades to a pass-through (speechSeconds → -1) so ASR never breaks.
 */
export class SileroGate {
  private ort: Ort | null = null
  private session: InferenceSession | null = null
  private failed = false
  private loading: Promise<void> | null = null

  constructor(
    private modelPath: string,
    private log?: (kind: string, data: unknown) => void
  ) {}

  private async load(): Promise<void> {
    if (this.session || this.failed) return
    if (!this.loading)
      this.loading = (async () => {
        try {
          if (!existsSync(this.modelPath)) throw new Error(`модель Silero не найдена: ${this.modelPath}`)
          this.ort = await import('onnxruntime-node')
          this.session = await this.ort.InferenceSession.create(this.modelPath, { interOpNumThreads: 1, intraOpNumThreads: 1 })
        } catch (e) {
          this.failed = true
          this.log?.('silero_unavailable', { message: e instanceof Error ? e.message : String(e) })
        }
      })()
    await this.loading
  }

  /** Seconds of detected speech in the clip, or -1 when the gate is unavailable (the caller then lets the clip through). */
  async speechSeconds(pcm: Int16Array, threshold = 0.5): Promise<number> {
    await this.load()
    const ort = this.ort
    const session = this.session
    if (!ort || !session) return -1
    const [inName, stateName, srName] = session.inputNames
    const [outName, outStateName] = session.outputNames
    let state: Tensor = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128])
    const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(RATE)]), [])
    const context = new Float32Array(CONTEXT)
    let hits = 0
    try {
      for (let i = 0; i + CHUNK <= pcm.length; i += CHUNK) {
        const frame = new Float32Array(CONTEXT + CHUNK)
        frame.set(context, 0)
        for (let j = 0; j < CHUNK; j++) frame[CONTEXT + j] = pcm[i + j] / 32768
        const input = new ort.Tensor('float32', frame, [1, CONTEXT + CHUNK])
        const out = await session.run({ [inName]: input, [stateName]: state, [srName]: sr })
        if ((out[outName].data as Float32Array)[0] >= threshold) hits++
        state = out[outStateName]
        context.set(frame.subarray(CHUNK)) // carry the last 64 samples into the next frame
      }
    } catch (e) {
      this.failed = true
      this.session = null
      this.log?.('silero_run_error', { message: e instanceof Error ? e.message : String(e) })
      return -1
    }
    return (hits * CHUNK) / RATE
  }
}
