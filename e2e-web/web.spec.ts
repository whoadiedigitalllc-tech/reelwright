// Web build, real Chromium: import through the file picker, edit, export to a browser download, reload and reopen.
import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'

const FF = ffmpeg as unknown as string
const dir = mkdtempSync(join(tmpdir(), 've-web-'))
const clip = join(dir, 'beach clip.mp4')
const png = join(dir, 'logo.png')
const AXE = readFileSync(createRequire(__filename).resolve('axe-core/axe.min.js'), 'utf8')

test.describe.configure({ mode: 'serial' })
let page: Page
const errors: string[] = []

async function a11y(name: string) {
  await page.evaluate(AXE)
  const v: { id: string; nodes: { target: string[] }[] }[] = await page.evaluate(
    // @ts-expect-error axe is a global after the eval above
    () => axe.run(document, { rules: { region: { enabled: false } } }).then((r) => r.violations)
  )
  expect(v.map((x) => `${name}: ${x.id} ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test.beforeAll(async ({ browser }) => {
  execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=4', '-f', 'lavfi', '-i', 'sine=d=4', '-shortest', '-pix_fmt', 'yuv420p', clip])
  execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=300x300', '-frames:v', '1', png])
  page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
})
test.afterAll(() => rmSync(dir, { recursive: true, force: true }))
test.afterEach(() => expect(errors).toEqual([]))

test('F01 import, edit, chroma key, export as a download', async () => {
  await expect(page.getByText('No projects yet')).toBeVisible()
  await a11y('S01 empty')
  await page.getByRole('button', { name: 'New project' }).first().click()

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import' }).click()
  await (await chooser).setFiles([clip, png])
  await expect(page.getByRole('button', { name: /beach clip\.mp4/ })).toBeVisible({ timeout: 60_000 }) // first import loads ffmpeg.wasm
  await expect(page.getByRole('button', { name: /logo\.png/ })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: /beach clip\.mp4/ }).first().click()
  await page.getByRole('button', { name: /logo\.png/ }).first().click()
  await expect(page.getByText('00:00:00 / 00:07:00')).toBeVisible()
  // the preview draws real frames from browser storage
  await expect
    .poll(() => page.evaluate(() => {
      const c = document.querySelector('canvas')!
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let lit = 0
      for (let i = 0; i < d.length; i += 4 * 997) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++
      return lit
    }), { timeout: 10_000 })
    .toBeGreaterThan(20)

  await page.locator('body').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('s')
  await expect(page.getByRole('button', { name: /^beach clip\.mp4, / })).toHaveCount(2)

  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('button', { name: 'Plain' }).click()
  await page.getByLabel('Content').fill('Summer sale – 50% off ☀️')

  await page.getByRole('button', { name: /^logo\.png, / }).click()
  await page.getByLabel('Remove a background colour').check()
  await a11y('S02 + S07')
  await page.screenshot({ path: 'replica/web/clone-screens/S02.png' })

  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByLabel('Resolution').selectOption('720')
  const download = page.waitForEvent('download', { timeout: 240_000 })
  await page.getByRole('button', { name: 'Choose file and export' }).click()
  const d = await download
  expect(d.suggestedFilename()).toMatch(/\.mp4$/)
  const out = join(dir, 'out.mp4')
  await d.saveAs(out)
  const len = parseFloat(execFileSync(ffprobe.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString())
  expect(len).toBeCloseTo(7, 0)
  await expect(page.getByText(/Saved to/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show in folder' })).toHaveCount(0) // desktop only
  await page.getByRole('button', { name: 'Done' }).click()
})

test('F02 projects survive a reload', async () => {
  await page.waitForTimeout(1200) // let the debounced autosave land
  await page.reload()
  const card = page.getByRole('button', { name: /^Open Project/ })
  await expect(card).toHaveCount(1)
  await a11y('S01 filled')
  await card.click()
  await expect(page.getByRole('button', { name: /^beach clip\.mp4, / })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Summer sale/ })).toBeVisible()
  await expect(page.getByText('Missing')).toHaveCount(0) // media came back from browser storage
  await page.getByRole('button', { name: 'Back to projects' }).click()
  await page.getByLabel(/^Actions for/).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()
})

test('F01-N2 unsupported file shows an error', async () => {
  await page.getByRole('button', { name: 'New project' }).first().click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import' }).click()
  await (await chooser).setFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }])
  await expect(page.getByRole('alert')).toContainText("Couldn't import notes.txt")
})

test('S11 narrow window shows a notice', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Reelwright needs a wider window' })).toBeVisible()
  await a11y('S11')
  await page.screenshot({ path: 'replica/web/clone-screens/S11.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
})
