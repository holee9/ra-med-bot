import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../..')
const PREFLIGHT = resolve(ROOT, 'scripts/preflight.sh')
const PKG = resolve(ROOT, 'package.json')

describe('preflight.sh shape', () => {
  it('file exists', () => {
    expect(existsSync(PREFLIGHT)).toBe(true)
  })

  it('file is executable (Unix only)', { skip: process.platform === 'win32' }, () => {
    const { statSync } = require('fs')
    const mode = statSync(PREFLIGHT).mode
    // owner execute bit (0o100)
    expect(mode & 0o100).toBeTruthy()
  })

  it('contains at least 17 named steps', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    const steps = content.match(/^##? ?step \d+/gim) ?? content.match(/run_step\s+"[^"]+"/gi) ?? []
    expect(steps.length).toBeGreaterThanOrEqual(17)
  })

  it('calls pnpm lint', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('pnpm lint')
  })

  it('calls pnpm typecheck', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('pnpm typecheck')
  })

  it('calls pnpm test', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('pnpm test')
  })

  it('calls pnpm build', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('pnpm build')
  })

  it('calls pnpm audit', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('pnpm audit')
  })

  it('calls eval:ci or promptfoo', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content.includes('eval:ci') || content.includes('promptfoo')).toBe(true)
  })

  it('has --skip-eval flag support', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('skip-eval')
  })

  it('has --skip-e2e flag support', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content).toContain('skip-e2e')
  })

  it('exits with non-zero on step failure', () => {
    const content = readFileSync(PREFLIGHT, 'utf-8')
    expect(content.includes('set -e') || content.includes('exit 1')).toBe(true)
  })
})

describe('package.json alias scripts', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf-8'))
  const scripts = pkg.scripts as Record<string, string>

  const REQUIRED_ALIASES = [
    'tokens:check',
    'modules:check',
    'contrast:check',
    'i18n:check',
    'a11y',
    'rbac:check',
    'audit:check',
  ]

  for (const alias of REQUIRED_ALIASES) {
    it(`has script: ${alias}`, () => {
      expect(scripts[alias]).toBeDefined()
      expect(typeof scripts[alias]).toBe('string')
      expect(scripts[alias].length).toBeGreaterThan(0)
    })
  }

  it('has preflight script', () => {
    expect(scripts['preflight']).toBeDefined()
    expect(scripts['preflight']).toContain('preflight.sh')
  })
})
