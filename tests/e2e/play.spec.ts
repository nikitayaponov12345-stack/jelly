import { expect, test, type Page } from '@playwright/test';

// Ввод одной кнопкой, строка счёта и окна в собранной игре — настоящими нажатиями (клавиатура на ПК, касания на телефоне).
// Паузы интерфейса (надпись уровня, пауза окна) идут во времени кадров: в медленном headless-браузере — дольше, отсюда тайм-ауты.

/** Игра с уровнями прототипа (`?set=proto`): сценарии ниже написаны на них. */
async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?set=proto');
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

/** Окно целиком на экране (TESTPLAN, «Интерфейс до вехи арта»). */
async function fitsScreen(page: Page, testid: string): Promise<void> {
  const box = (await page.getByTestId(testid).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
}

/** «Плита» с начала до финиша: старт одной кнопкой, без прыжков (первая желейка держит плиту). */
async function finishPlate(page: Page, phone: boolean): Promise<void> {
  await tap(page, phone);
  await page.evaluate(() => window.__game!.advance(8000));
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('done');
}

test('первое нажатие — старт, следующее — прыжок', async ({ page }, info) => {
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  expect((await page.evaluate(() => window.__game!.state())).state).toBe('ready');
  await expect(page.getByTestId('tap-msg')).toBeVisible();
  await tap(page, phone);
  await page.waitForFunction(() => window.__game!.state().state === 'play');
  await expect(page.getByTestId('tap-msg')).toBeHidden();
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

test('строка счёта, надпись уровня и подсказка', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const errors = await open(page);
  await expect(page.getByTestId('hud-level')).toContainText(/(Уровень|Level) 1 · (Яма|The Pit)/);
  await expect(page.getByTestId('hud-legion')).toContainText(/0 \/ (пар|par) \d+/);
  await expect(page.getByTestId('hud-time')).toHaveText('0:00');
  await expect(page.getByTestId('intro')).toContainText(/(Уровень|Level) 1 — (Яма|The Pit)/);
  await expect(page.getByTestId('intro')).toContainText(/(Желейный легион|Jelly Legion)/); // при запуске — и название игры
  // После надписи (intro_s) — плашка подсказки уровня.
  await expect(page.getByTestId('hint')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('intro')).toBeHidden();
  await expect(page.getByTestId('hint')).toContainText(/(Прыгай позже|Jump later)/);
  // Счёт идёт за попыткой: гибель на шипах — легион 1, время — минуты и секунды.
  await page.evaluate(() => {
    const g = window.__game!;
    g.command.press();
    g.command.release();
    g.advance(2500);
  });
  await expect(page.getByTestId('hud-legion')).toContainText(/1 \/ (пар|par) \d+/);
  await expect(page.getByTestId('hud-time')).toHaveText('0:02');
  await page.screenshot({ path: `build/shots/m0-03_hud_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('«Плита»: окно итога, «Ещё раз» и «Дальше»', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await finishPlate(page, phone);
  const result = page.getByTestId('result');
  await expect(result).toBeVisible();
  expect(await page.evaluate(() => window.__game!.screen())).toBe('result');
  await expect(page.getByTestId('result-used')).toContainText(/1 \((пар|par) 1\)/);
  await expect(page.locator('[data-testid=stars] .star.on')).toHaveCount(3);
  await expect(page.getByTestId('result-time')).toContainText(/0:07[.,]7/);
  await fitsScreen(page, 'result');
  // Пауза окна (done_input_delay_s): кнопки неактивны, потом нажимаются.
  await expect(page.getByTestId('next')).toBeEnabled({ timeout: 10_000 });
  await page.screenshot({ path: `build/shots/m0-03_result_${info.project.name}.png` });
  // «Ещё раз» — тот же уровень с начала.
  await page.getByTestId('retry').click();
  await expect(result).toBeHidden();
  const again = await page.evaluate(() => window.__game!.state());
  expect(again.level).toBe('p-02');
  expect(again.state).toBe('ready');
  expect(again.bodies).toEqual([]);
  // Снова финиш; одна кнопка (пробел или касание поля) — «Дальше»: «Лазер», третий уровень набора.
  await finishPlate(page, phone);
  await expect(page.getByTestId('next')).toBeEnabled({ timeout: 10_000 });
  await tap(page, phone);
  const next = await page.evaluate(() => window.__game!.state());
  expect(next.level).toBe('p-03');
  expect(next.state).toBe('ready');
  expect(await page.evaluate(() => window.__game!.screen())).toBe('level');
  await expect(result).toBeHidden();
  await expect(page.getByTestId('intro')).toContainText(/(Уровень|Level) 3/);
  await expect(page.getByTestId('intro')).not.toContainText(/(Желейный легион|Jelly Legion)/); // название игры — только при запуске
  expect(errors).toEqual([]);
});

test('итог набора и «Сначала»', async ({ page }, info) => {
  test.setTimeout(90_000); // долгий сценарий: в медленном headless-браузере кадры редкие
  const phone = info.project.name === 'phone';
  const errors = await open(page);
  await page.evaluate(() => window.__game!.setLevel('p-02'));
  await finishPlate(page, phone);
  await expect(page.getByTestId('result')).toBeVisible();
  await page.evaluate(() => window.__game!.showPack());
  const pack = page.getByTestId('pack');
  await expect(pack).toBeVisible();
  await expect(page.getByTestId('result')).toBeHidden();
  await expect(page.getByTestId('restart')).toBeHidden();
  await expect(page.getByTestId('hud')).toBeHidden();
  await expect(page.getByTestId('pack-used')).toContainText('1');
  await expect(page.getByTestId('pack-time')).toContainText(/0:07[.,]7/);
  await expect(page.getByTestId('pack-stars')).toContainText(/3 (из|of) 18/);
  await fitsScreen(page, 'pack');
  await expect(page.getByTestId('from-start')).toBeEnabled({ timeout: 10_000 });
  await page.screenshot({ path: `build/shots/m0-03_pack_${info.project.name}.png` });
  await page.getByTestId('from-start').click();
  await expect(pack).toBeHidden();
  await expect(page.getByTestId('restart')).toBeVisible();
  await expect(page.getByTestId('hud-level')).toContainText(/(Уровень|Level) 1 · (Яма|The Pit)/);
  const s = await page.evaluate(() => window.__game!.state());
  expect(s.level).toBe('p-01');
  expect(s.state).toBe('ready');
  expect(await page.evaluate(() => window.__game!.screen())).toBe('level');
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
  await page.screenshot({ path: `build/shots/m0-03_camera_${info.project.name}.png` });
  expect(errors).toEqual([]);
});
