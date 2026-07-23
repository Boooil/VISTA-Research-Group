async page => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('http://127.0.0.1:1313/');
  assert(response && response.ok(), 'homepage should return HTTP 200');

  const groups = page.locator('[data-team-group]');
  const groupCount = await groups.count();
  assert(groupCount > 0, 'homepage should render at least one team group');
  assert((await groups.evaluateAll(items => items.every(item => !item.open))), 'all team groups should be closed initially');

  const summaries = await groups.locator('summary').allInnerTexts();
  assert(summaries.every(text => /\d+ 位成员/.test(text)), 'each group summary should show a member count');
  const previewCounts = await groups.evaluateAll(items => items.map(item => item.querySelectorAll('.team-group__avatar').length));
  assert(previewCounts.every(count => count <= 4), 'each group should show no more than four avatar previews');
  const remainderPositionedRight = await page.locator('.team-group__remainder').evaluateAll(items => items.every(item => {
    const remainderLeft = item.getBoundingClientRect().left;
    const avatarLefts = [...item.parentElement.querySelectorAll('.team-group__avatar')]
      .map(avatar => avatar.getBoundingClientRect().left);
    const toggleLeft = item.closest('.team-group__actions').querySelector('.team-group__toggle').getBoundingClientRect().left;
    return avatarLefts.every(left => left < remainderLeft) && item.getBoundingClientRect().right < toggleLeft;
  }));
  assert(remainderPositionedRight, 'the +N remainder should sit to the right of all avatar previews and left of the toggle');

  await groups.nth(0).locator('summary').click();
  assert(await groups.nth(0).evaluate(item => item.open), 'clicking the first group should open it');

  await groups.nth(1).locator('summary').click();
  const afterSecond = await groups.evaluateAll(items => items.map(item => item.open));
  assert(afterSecond[0] === false && afterSecond[1] === true, 'opening another group should close the previous group');

  await groups.nth(1).locator('summary').click();
  assert((await groups.evaluateAll(items => items.every(item => !item.open))), 'clicking the open group should close it');

  await groups.nth(2).locator('summary').focus();
  await page.keyboard.press('Enter');
  assert(await groups.nth(2).evaluate(item => item.open), 'Enter should open the focused group');
  await page.keyboard.press('Space');
  assert(!(await groups.nth(2).evaluate(item => item.open)), 'Space should close the focused group');

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const layout = await page.locator('#team').evaluate(section => ({
    fitsViewport: section.scrollWidth <= section.clientWidth,
    summariesFit: [...section.querySelectorAll('.team-group__summary')].every(item => item.scrollWidth <= item.clientWidth),
    transitionDuration: getComputedStyle(section.querySelector('.team-group__panel')).transitionDuration,
  }));
  assert(layout.fitsViewport && layout.summariesFit, 'mobile layout should not overflow horizontally');
  assert(layout.transitionDuration === '0s', 'reduced-motion should disable panel transitions');

  return JSON.stringify({ status: 'PASS', groupCount, summaries, previewCounts, remainderPositionedRight, layout });
}
