import { mkdirSync, writeFileSync } from 'node:fs'
import { appIcon, makeIco } from '../src/main/util/png.ts'

mkdirSync('resources', { recursive: true })
writeFileSync('resources/icon.ico', makeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: appIcon(size) }))))
writeFileSync('resources/icon.png', appIcon(512))
