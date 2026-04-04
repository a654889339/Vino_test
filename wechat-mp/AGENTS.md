# AGENTS.md

## WeChat Mini Program Rules
- For page changes, inspect the full page set: `.js`, `.wxml`, `.wxss`, and `.json`.
- Keep network access centralized through `getApp().request()` unless platform constraints require `wx.request()` or `wx.uploadFile()`.
- When changing login-sensitive flows, also check token storage, 401 handling, `globalData.userInfo`, and profile refresh behavior in `app.js`.
- When changing a tab page, also review `app.json` and `custom-tab-bar/`.
- Do not edit `project.private.config.json` unless the task explicitly targets local developer-tool behavior.
- Do not change `globalData.baseUrl` or other environment endpoints unless the task is specifically about environment configuration.
- If a new page is added, confirm whether it must be registered in `app.json`, whether it belongs in the tab bar, and whether it should include page tracking behavior.
- Reuse helpers from `utils/` where possible. Do not duplicate i18n, currency, URL, or page-track logic inside a page.
- Keep WeChat platform APIs explicit and minimal. Prefer existing patterns in neighboring pages over inventing abstractions.

## Page Checklist
- Data loading path is clear and handles empty, loading, and failure states.
- Navigation targets use the correct API: `navigateTo`, `redirectTo`, or `switchTab`.
- User-facing text goes through existing i18n helpers when the page already participates in i18n.
- If the page depends on auth, guard entry or action paths consistently with `app.checkLogin()`.
- If image, upload, or payment behavior changes, call out any developer-tool vs real-device validation differences.

## Validation Expectations
- Provide manual validation steps for WeChat Developer Tools.
- Call out cases that require real-device verification, especially login, payment, upload, phone call, clipboard, or web-view behavior.
