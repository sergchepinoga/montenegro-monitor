// Telegram notifications for monitoring changes

export async function sendTelegram(msg: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // silently skip if not configured

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch { /* ignore network errors */ }
}

export function buildChangeAlert(sourceName: string, summary: string, checkedAt: string): string {
  return (
    `🔔 <b>Montenegro Monitor</b>\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📡 Источник: <b>${sourceName}</b>\n` +
    `📋 ${summary}\n` +
    `🕐 ${checkedAt}\n` +
    `🔗 montenegro.chepinoga.com`
  );
}
