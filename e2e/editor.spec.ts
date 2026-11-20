// End-to-end: drives the built app (npm run build first). OS file dialogs are stubbed in the main process.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'

const FF = ffmpeg as unknown as string
const dir = mkdtempSync(join(tmpdir(), 've-e2e-'))
const clip = join(dir, 'beach clip.mp4')
const png = join(dir, 'logo.png')
const out = join(dir, 'final.mp4')

let app: ElectronApplication
let page: Page
const errors: string[] = []

async function stubDialogs(open: string[], save = out) {
  await app.evaluate(({ dialog }, [open, save]) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: open })) as never
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: save })) as never
  }, [open, save] as const)
}

// AxeBuilder needs to open a second page, which Electron does not allow, so run axe-core in the window directly.
const AXE = readFileSync(createRequire(__filename).resolve('axe-core/axe.min.js'), 'utf8')
async function a11y(name: string) {
  await page.evaluate(AXE)
  const violations: { id: string; nodes: { target: string[] }[] }[] = await page.evaluate(
    // @ts-expect-error axe is a global after the eval above
    () => axe.run(document, { rules: { region: { enabled: false } } }).then((r) => r.violations)
  )
  expect(violations.map((v) => `${name}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test.beforeAll(async () => {
  execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=4', '-f', 'lavfi', '-i', 'sine=d=4', '-shortest', '-pix_fmt', 'yuv420p', clip])
  execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=300x300', '-frames:v', '1', png])
  const env = { ...process.env, VE_USER_DATA: join(dir, 'data') }
  // E2E_EXE=dist/win-unpacked/Reelwright.exe tests the packaged app (asar-unpacked ffmpeg paths)
  app = await electron.launch(process.env.E2E_EXE ? { executablePath: process.env.E2E_EXE, env } : { args: ['.'], env })
  page = await app.firstWindow()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(dir, { recursive: true, force: true })
})

test.afterEach(() => expect(errors).toEqual([]))

test('F01 make a short video from scratch, F03 split/delete/undo', async () => {
  await expect(page.getByText('No projects yet')).toBeVisible()
  await a11y('S01 empty')
  await page.getByRole('button', { name: 'New project' }).first().click()
  await expect(page.getByText('Select a clip to edit it.')).toBeVisible()
  await a11y('S02 empty')

  await stubDialogs([clip, png])
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('button', { name: /beach clip\.mp4/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /logo\.png/ })).toBeVisible()

  await page.getByRole('button', { name: /beach clip\.mp4/ }).first().click() // adds to timeline
  await page.getByRole('button', { name: /logo\.png/ }).first().click()
  const vidClips = page.getByRole('button', { name: /^beach clip\.mp4, / })
  await expect(vidClips).toHaveCount(1)
  await expect(page.getByText('00:00:00 / 00:07:00')).toBeVisible()
  // Preview draws real frames through media:// (testsrc2 is colourful, never all black)
  await expect
    .poll(() => page.evaluate(() => {
      const c = document.querySelector('canvas')!
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let lit = 0
      for (let i = 0; i < d.length; i += 4 * 997) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++
      return lit
    }), { timeout: 10_000 })
    .toBeGreaterThan(20)
  await page.screenshot({ path: 'replica/clone-screens/S02.png' })

  // F03: move playhead 1s, split, delete the right half, undo
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('s')
  await expect(vidClips).toHaveCount(2)
  await page.keyboard.press('Delete')
  await expect(vidClips).toHaveCount(1)
  await expect(page.getByText(/ \/ 00:04:00/)).toBeVisible() // rippled: 1s + 3s image
  await page.keyboard.press('Control+z')
  await expect(vidClips).toHaveCount(2)

  // Text
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('button', { name: 'Plain' }).click()
  await page.getByLabel('Content').fill('Summer sale – 50% off ☀️')
  await expect(page.getByRole('button', { name: /^Summer sale/ })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Size' }).fill('120')
  await a11y('S02 filled + S07 text')
  await page.screenshot({ path: 'replica/clone-screens/S07.png' })

  // Chroma key on the image clip; park the playhead on it so the keyed preview path runs (fails on console errors)
  await page.getByRole('button', { name: /^logo\.png, / }).click()
  await page.getByLabel('Remove a background colour').check()
  await expect(page.getByRole('slider', { name: 'Strength' })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Strength' }).fill('40')
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight') // 1s -> 4s, start of logo.png
  await page.waitForTimeout(500)
  await a11y('S07 chroma key')
  await page.screenshot({ path: 'replica/clone-screens/S07-chroma.png' })

  // Export (F01 end)
  await page.getByRole('button', { name: 'Export' }).click()
  await a11y('S09 settings')
  await page.screenshot({ path: 'replica/clone-screens/S09.png' })
  await page.getByLabel('Resolution').selectOption('720')
  await page.getByRole('button', { name: 'Choose file and export' }).click()
  await expect(page.getByText('Saved to')).toBeVisible({ timeout: 60_000 })
  const len = parseFloat(execFileSync(ffprobe.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString())
  expect(len).toBeCloseTo(7, 0)
  await page.getByRole('button', { name: 'Done' }).click()
})

test('F02 reopen and continue; S01 rename + delete', async () => {
  await page.getByRole('button', { name: 'Back to projects' }).click()
  const card = page.getByRole('button', { name: /^Open Project/ })
  await expect(card).toHaveCount(1)
  await a11y('S01 filled')
  await page.screenshot({ path: 'replica/clone-screens/S01.png' })
  await card.click()
  await expect(page.getByRole('button', { name: /^beach clip\.mp4, / })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Summer sale/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back to projects' }).click()

  await page.getByLabel(/^Actions for/).click()
  await page.getByRole('button', { name: 'Rename' }).click()
  const long = 'A very long project name that goes on and on and on for sixty'
  await page.getByLabel('Project name').fill(long)
  await page.keyboard.press('Enter')
  await expect(page.getByText(long)).toBeVisible()

  await page.getByLabel(/^Actions for/).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()
  expect(existsSync(clip)).toBe(true) // original media untouched
})

test('F01-N1 export of an empty timeline is blocked; N2 unsupported file shows an error', async () => {
  await page.getByRole('button', { name: 'New project' }).first().click()
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled()
  const bad = join(dir, 'notes.txt')
  execFileSync(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(bad)}, 'hi')`])
  await stubDialogs([bad])
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't import notes.txt")
  await page.getByRole('button', { name: 'Dismiss' }).click()
})
