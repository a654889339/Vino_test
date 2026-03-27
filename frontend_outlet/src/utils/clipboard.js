/**
 * 同步复制（execCommand），适合在用户点击回调内调用；iOS Safari / 非 HTTPS 下更可靠。
 */
export function copyTextToClipboardSync(text) {
  const str = String(text ?? '');
  if (!str) return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '0';
    ta.style.top = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    ta.style.fontSize = '16px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, str.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 复制文本：优先同步 execCommand（利于 iOS 手势链），再尝试 Clipboard API。
 */
export async function copyTextToClipboard(text) {
  const str = String(text ?? '');
  if (!str) return false;
  if (copyTextToClipboardSync(str)) return true;
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {
      return copyTextToClipboardSync(str);
    }
  }
  return false;
}
