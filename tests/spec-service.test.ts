import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rename, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SpecService } from '../src/main/spec-service'
import { SpecsWatcher } from '../src/main/watcher'
import { parseFrontmatter } from '@shared/frontmatter'
import type { FsEvent } from '@shared/types'

let root: string
let service: SpecService

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'speccraft-'))
  service = new SpecService()
  await service.open(root)
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const create = (slug = 'auth-service') =>
  service.createSpec({
    slug,
    title: 'Autenticação e Sessão',
    templateId: 'builtin:standard',
    requirements: ['Login com e-mail', ' ', 'Logout'],
    language: 'pt-BR'
  })

describe('SpecService', () => {
  it('reports a missing specs/ folder and initializes it', async () => {
    expect((await service.getState()).specsExists).toBe(false)
    await expect(create()).rejects.toMatchObject({ code: 'SPECS_MISSING' })
    expect((await service.initSpecs()).specsExists).toBe(true)
  })

  it('creates a module with frontmatter, template and requirements', async () => {
    await service.initSpecs()
    const summary = await create()
    expect(summary).toMatchObject({ slug: 'auth-service', title: 'Autenticação e Sessão', status: 'draft', version: '1.0.0' })
    expect(summary.progress.total).toBe(6)
    const raw = await readFile(join(root, 'specs/auth-service/requirements.md'), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    expect(data).toMatchObject({ module: 'auth-service', status: 'draft' })
    expect(data?.updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)
    expect(body).toContain('- Login com e-mail\n- Logout')
    expect(body).toContain('# Autenticação e Sessão — Requisitos')
  })

  it('rejects invalid and colliding slugs', async () => {
    await service.initSpecs()
    await create()
    await expect(create('Auth-Service')).rejects.toMatchObject({ code: 'INVALID_SLUG' })
    await mkdir(join(root, 'specs/billing'))
    await expect(create('billing')).rejects.toMatchObject({ code: 'MODULE_EXISTS' })
    await expect(service.readSpecFile('../../etc', 'tasks')).rejects.toMatchObject({ code: 'INVALID_SLUG' })
    await expect(service.readSpecFile('a/../../x', 'tasks')).rejects.toBeTruthy()
  })

  it('writes with optimistic concurrency and preserves frontmatter', async () => {
    await service.initSpecs()
    await create()
    const file = await service.readSpecFile('auth-service', 'tasks')
    expect(file.bodyLineOffset).toBe(8)
    const res = await service.writeSpecFile({ slug: 'auth-service', kind: 'tasks', body: '- [x] a\n- [ ] b\n', expectedMtimeMs: file.mtimeMs })
    expect(res.mtimeMs).toBeGreaterThan(0)
    expect((await service.getState()).specs[0].progress).toEqual({ done: 1, total: 2 })

    // External edit → stale write is rejected, forced write wins.
    await new Promise((r) => setTimeout(r, 20))
    const path = join(root, 'specs/auth-service/tasks.md')
    await writeFile(path, (await readFile(path, 'utf8')).replace('- [ ] b', '- [ ] c'))
    await expect(
      service.writeSpecFile({ slug: 'auth-service', kind: 'tasks', body: 'mine', expectedMtimeMs: res.mtimeMs })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await service.writeSpecFile({ slug: 'auth-service', kind: 'tasks', body: 'mine', expectedMtimeMs: res.mtimeMs, force: true })
    const after = parseFrontmatter(await readFile(path, 'utf8'))
    expect(after.body).toBe('mine\n')
    expect(after.data?.module).toBe('auth-service')
  })

  it('handles externally deleted files and restores them', async () => {
    await service.initSpecs()
    await create()
    await rm(join(root, 'specs/auth-service/design.md'))
    const state = await service.getState()
    expect(state.specs[0].files.design).toBe(false)
    const missing = await service.readSpecFile('auth-service', 'design')
    expect(missing.exists).toBe(false)
    await service.writeSpecFile({ slug: 'auth-service', kind: 'design', body: '# D', expectedMtimeMs: null })
    const restored = parseFrontmatter(await readFile(join(root, 'specs/auth-service/design.md'), 'utf8'))
    expect(restored.data).toMatchObject({ module: 'auth-service', title: 'Autenticação e Sessão' })
  })

  it('updates status in all files while keeping comments', async () => {
    await service.initSpecs()
    await create()
    const path = join(root, 'specs/auth-service/requirements.md')
    await writeFile(path, (await readFile(path, 'utf8')).replace('status: draft', 'status: draft # draft | in-progress | completed'))
    await service.setStatus('auth-service', 'in-progress')
    expect((await service.getState()).specs[0].status).toBe('in-progress')
    const raw = await readFile(path, 'utf8')
    expect(raw).toContain('# draft | in-progress | completed')
    const tasks = parseFrontmatter(await readFile(join(root, 'specs/auth-service/tasks.md'), 'utf8'))
    expect(tasks.data?.status).toBe('in-progress')
  })

  it('ejects, lists, uses and deletes local templates', async () => {
    await service.initSpecs()
    await service.ejectBuiltinTemplate('builtin:minimal', 'standard', 'en')
    const tplPath = join(root, 'specs/.templates/standard/tasks.template.md')
    await writeFile(tplPath, '---\nowner: platform\n---\n# {{title}}\n\n- [ ] Custom for {{module}}\n')
    const list = await service.listTemplates('en')
    expect(list.map((t) => t.id)).toEqual(['local:standard', 'builtin:standard', 'builtin:minimal'])
    await service.createSpec({ slug: 'billing', title: 'Billing', templateId: 'local:standard', requirements: [], language: 'en' })
    const tasks = parseFrontmatter(await readFile(join(root, 'specs/billing/tasks.md'), 'utf8'))
    expect(tasks.body).toContain('- [ ] Custom for billing')
    expect(tasks.data).toMatchObject({ owner: 'platform', module: 'billing', status: 'draft' })
    // .templates must not appear as a module
    expect((await service.getState()).specs.map((s) => s.slug)).toEqual(['billing'])
    await service.deleteLocalTemplate('local:standard')
    expect((await service.listTemplates('en')).every((t) => t.source === 'builtin')).toBe(true)
  })
})

describe('SpecsWatcher', () => {
  it('ignores own writes and reports external changes, removals and renames', async () => {
    await service.initSpecs()
    await create()
    const events: FsEvent[] = []
    const watcher = new SpecsWatcher(service, (e) => events.push(e))
    await watcher.start(root)
    await new Promise((r) => setTimeout(r, 300))
    const wait = () => new Promise((r) => setTimeout(r, 700))

    const file = await service.readSpecFile('auth-service', 'tasks')
    await service.writeSpecFile({ slug: 'auth-service', kind: 'tasks', body: '- [x] self', expectedMtimeMs: file.mtimeMs })
    await wait()
    expect(events.some((e) => e.type === 'file-changed')).toBe(false)
    expect(events.some((e) => e.type === 'specs-changed')).toBe(true)

    events.length = 0
    await writeFile(join(root, 'specs/auth-service/tasks.md'), '- [ ] external\n')
    await wait()
    expect(events).toContainEqual({ type: 'file-changed', slug: 'auth-service', kind: 'tasks' })

    events.length = 0
    await rm(join(root, 'specs/auth-service/design.md'))
    await wait()
    expect(events).toContainEqual({ type: 'file-removed', slug: 'auth-service', kind: 'design' })

    events.length = 0
    await rename(join(root, 'specs/auth-service'), join(root, 'specs/auth'))
    await wait()
    expect(events.some((e) => e.type === 'specs-changed')).toBe(true)
    expect((await service.getState()).specs.map((s) => s.slug)).toEqual(['auth'])
    await watcher.stop()
  }, 15000)
})
