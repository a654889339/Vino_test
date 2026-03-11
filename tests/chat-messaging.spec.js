/**
 * Chat Messaging System E2E Test
 * Run with: npx playwright test tests/chat-messaging.spec.js
 *
 * Prerequisites: npm install -D @playwright/test
 *               npx playwright install chromium
 */
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://106.54.50.88:5201';
const ADMIN_URL = 'http://106.54.50.88:5202';
const USERNAME = 'admin';
const PASSWORD = 'Vino@2024admin';

test.describe('Chat Messaging System', () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for network requests
    test.setTimeout(60000);
  });

  test('Step 1-2: Navigate to frontend and verify chat button', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    // Take screenshot
    await page.screenshot({ path: 'test-results/01-frontend-home.png', fullPage: true });
    // Find the red chat floating button (chat-o icon)
    const chatFab = page.locator('.chat-fab');
    await expect(chatFab).toBeVisible();
  });

  test('Step 3-5: Click chat button and verify login hint when not logged in', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.locator('.chat-fab').click();
    // Wait for popup to show
    await page.waitForSelector('.chat-panel', { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/02-chat-panel-not-logged-in.png', fullPage: true });
    // Verify "请先登录后发送消息" hint
    const loginHint = page.locator('.chat-login-hint');
    await expect(loginHint).toBeVisible();
    await expect(loginHint).toHaveText('请先登录后发送消息');
  });

  test('Step 6-8: Login on frontend and take screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.getByPlaceholder(/请输入用户名|用户名/).fill(USERNAME);
    await page.getByPlaceholder(/请输入密码|密码/).fill(PASSWORD);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/^(?!.*login)/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/03-after-login.png', fullPage: true });
  });

  test('Step 9-13: Send message as logged-in user', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.getByPlaceholder(/请输入用户名|用户名/).fill(USERNAME);
    await page.getByPlaceholder(/请输入密码|密码/).fill(PASSWORD);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(2000);

    // Navigate to home
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.locator('.chat-fab').click();
    await page.waitForSelector('.chat-panel', { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/04-chat-panel-logged-in.png', fullPage: true });

    // Type and send message
    const input = page.locator('.chat-input');
    await input.fill('测试消息');
    await page.locator('.chat-send-btn').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/05-message-sent.png', fullPage: true });

    // Verify message appears
    const chatMsg = page.locator('.chat-msg').filter({ hasText: '测试消息' });
    await expect(chatMsg).toBeVisible({ timeout: 5000 });
  });

  test('Step 14-19: Admin panel - view and reply to message', async ({ page }) => {
    // Login to admin panel
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('#loginUser', USERNAME);
    await page.fill('#loginPass', PASSWORD);
    await page.click('#loginBtn');
    await page.waitForSelector('.dashboard', { state: 'visible', timeout: 10000 });
    await page.screenshot({ path: 'test-results/06-admin-dashboard.png', fullPage: true });

    // Click 留言板 tab
    await page.click('text=留言板');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/07-admin-message-board.png', fullPage: true });

    // Click on a conversation if any
    const convItem = page.locator('#convListBody > div').first();
    if (await convItem.isVisible()) {
      await convItem.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/08-admin-conversation.png', fullPage: true });

      // Type reply and send
      const replyInput = page.locator('#adminReplyInput');
      await replyInput.fill('收到您的消息');
      await page.click('button:has-text("发送")');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/09-admin-reply-sent.png', fullPage: true });

      // Verify reply appears
      const replyBubble = page.locator('#chatMessages').filter({ hasText: '收到您的消息' });
      await expect(replyBubble).toBeVisible({ timeout: 5000 });
    } else {
      // No conversations - just note this
      console.log('No conversations found - user may need to send a message first');
    }
  });
});
