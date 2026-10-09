import { expect, test } from '@playwright/test';

// Смоук собранной игры: страница открывается без ошибок, холст есть, раскладка верная, ядро уровня шагает.
test('игра запускается и рисует сцену', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  const canvas = page.locator('#game canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);

  // Ядро шагает в тикере: 0,3 с игрового времени. Без жёсткого окна в 1 с — в медленном headless-браузере кадры редкие.
  const before = await page.evaluate(() => window.__game!.gameMs());
  await page.waitForFunction((b) => window.__game!.gameMs() > b + 300, before, { timeout: 10_000 });

  const layout = await page.evaluate(() => window.__game!.layout());
  expect(layout).toBe(info.project.name === 'phone' ? 'portrait' : 'landscape');

  const calls = await page.evaluate(() => window.__game!.platformLog().map((c) => c.name));
  expect(calls).toContain('loadingFinished');

  // Сборка `npm run check` идёт без метки публикации.
  expect(await page.evaluate(() => window.__game!.build)).toBe('dev');
  // Язык страницы берётся из браузера: ru — «Желейный легион», иначе «Jelly Legion».
  await expect(page.getByTestId('debug-line')).toContainText(/(Желейный легион|Jelly Legion) 0\.0\.7/);

  await page.screenshot({ path: `build/shots/m0-03_${info.project.name}.png` });
  expect(errors).toEqual([]);
});

// Ядро в собранной игре: первая желейка ждёт нажатия; «Плита» проходится без прыжков с одной гибелью.
test('ядро уровня: старт по нажатию и «Плита» без прыжков', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 20_000 });

  expect(await page.evaluate(() => window.__game!.levels())).toEqual(['p-01', 'p-02', 'p-03', 'p-04', 'p-05', 'p-06']);
  const s0 = await page.evaluate(() => window.__game!.state());
  expect(s0.level).toBe('p-01');
  expect(s0.state).toBe('ready');
  await page.evaluate(() => window.__game!.advance(1000));
  expect(await page.evaluate(() => window.__game!.state().hero.x)).toBe(1.5); // ждёт на старте

  const s1 = await page.evaluate(() => {
    const g = window.__game!;
    g.setLevel('p-02');
    g.command.press();
    g.command.release();
    g.advance(8000);
    return g.state();
  });
  expect(s1.state).toBe('done');
  expect(s1.legion).toBe(1);
  expect(s1.stars).toBe(3);
  expect(s1.bodies).toEqual([{ c: 12, r: 10 }]);
  expect(s1.time).toBeCloseTo(7.7333, 3);
  expect(errors).toEqual([]);
});
