import { expect, test, type Page } from '@playwright/test';

// Ввод одной кнопкой и вид уровня в собранной игре — настоящими нажатиями (клавиатура на ПК, касания на телефоне).

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });
  return errors;
}

/** Нажатие кнопки прыжка тем способом, каким играют в этой раскладке: пробел на ПК, касание поля на телефоне. */
async function tap(page: Page, phone: boolean): Promise<void> {
  if (phone) {
    const p = await page.evaluate(() => window.__game!.toScreen(12, 4));
    await page.touchscreen.tap(p.x, p.y);
  } else await page.keyboard.press('Space');
}

test('первое нажатие — старт, следующее — прыжок', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  await expect(page.getByTestId('play-msg')).toBeVisible();
  await tap(page, phone);
  await page.waitForFunction(() => window.__game!.state().state === 'play');
  await expect(page.getByTestId('play-msg')).toBeHidden();
  // Первое нажатие не прыгает: желейка бежит по земле.
  await page.waitForFunction(() => window.__game!.state().hero.x > 2);
  expect((await page.evaluate(() => window.__game!.state())).hero.grounded).toBe(true);
  await tap(page, phone);
  await page.waitForFunction(() => !window.__game!.state().hero.grounded, null, { timeout: 2000 });
  expect(errors).toEqual([]);
});

test('«Заново» — клавишей R и кнопкой', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(3000)); // первая желейка гибнет на шипах «Ямы»
  expect((await page.evaluate(() => window.__game!.state())).bodies.length).toBeGreaterThan(0);
  if (phone) await page.getByTestId('restart').tap();
  else await page.keyboard.press('KeyR');
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.state).toBe('ready');
  expect(s.bodies).toEqual([]);
  expect(s.legion).toBe(0);
  await page.getByTestId('restart').click();
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  expect(errors).toEqual([]);
});

test('«Плита»: тело на плите, финиш, переход к следующему уровню', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(8000));
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.state).toBe('done');
  expect(s.bodies).toEqual([{ c: 12, r: 10 }]);
  await expect(page.getByTestId('play-msg')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `build/shots/m0-02_done_${info.project.name}.png` });
  // Нажатие принимается через done_input_delay_s (0,6 с) по времени кадров, поэтому — повтор нажатия, пока не сработает
  // (сама пауза проверена в tests/unit/flow.test.ts); нажатие, которое открыло уровень, его не запускает.
  await expect
    .poll(async () => {
      await tap(page, phone);
      return page.evaluate(() => window.__game!.state().level);
    }, { timeout: 10_000 })
    .toBe('p-03');
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  expect(errors).toEqual([]);
});

test('портрет: камера идёт за желейкой', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'камера двигается только в портрете');
  const errors = await open(page);
  expect(await page.evaluate(() => window.__game!.camera())).toBe(0);
  // Ядро на паузе: старт касанием и ровно 1,2 с игры — желейка у края ямы «Ямы» (x ≈ 6,9); кадры идут, камера догоняет.
  await page.evaluate(() => window.__game!.pauseCore(true));
  await tap(page, true);
  await page.evaluate(() => window.__game!.advance(1200));
  // Камера догнала: желейка на доле camera_lead (0,38) ширины окна поля; поле в портрете — во всю ширину экрана.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__game!;
          const h = g.state().hero;
          return g.toScreen(h.x, h.y).x / window.innerWidth;
        }),
      { timeout: 10_000 },
    )
    .toBeCloseTo(0.38, 2);
  expect(await page.evaluate(() => window.__game!.camera())).toBeGreaterThan(50);
  await page.screenshot({ path: `build/shots/m0-02_camera_${info.project.name}.png` });
  expect(errors).toEqual([]);
});
