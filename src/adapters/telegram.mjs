import { buildIntakeEvent } from '../intake/engine.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

function requireText(value, name) {
  const text = clean(value);
  if (!text) throw new Error(`${name}_required`);
  return text;
}

/**
 * Convert a Telegram Bot API update into the provider-neutral intake contract.
 * This module deliberately does not call Telegram or Supabase; transport and
 * persistence stay outside the deterministic intake core.
 */
export function telegramUpdateToIntakeEvent(update) {
  if (!update || typeof update !== 'object') {
    throw new Error('telegram_update_required');
  }

  const message = update.message ?? update.edited_message ?? update.channel_post;
  if (!message || typeof message !== 'object') {
    throw new Error('telegram_message_not_found');
  }

  const rawText = clean(message.text ?? message.caption);
  requireText(rawText, 'telegram_message_text');

  const senderId = message.from?.id != null ? String(message.from.id) : null;
  const chatId = message.chat?.id != null ? String(message.chat.id) : null;
  const externalEventId = update.update_id != null ? String(update.update_id) : null;

  return buildIntakeEvent({
    channel: 'telegram',
    externalEventId,
    senderId,
    chatId,
    rawText,
  });
}

export function telegramCommand(update) {
  const message = update?.message ?? update?.edited_message ?? update?.channel_post;
  const text = clean(message?.text ?? message?.caption);
  if (!text.startsWith('/')) return null;

  const [commandToken, ...args] = text.split(/\s+/);
  const [command, mention] = commandToken.slice(1).split('@');

  return {
    command: command.toLowerCase(),
    mention: mention || null,
    args,
    raw_text: text,
    sender_id: message?.from?.id != null ? String(message.from.id) : null,
    chat_id: message?.chat?.id != null ? String(message.chat.id) : null,
  };
}
