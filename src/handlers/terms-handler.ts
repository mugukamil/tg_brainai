import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import { getUserStats } from './supabase-handler.js';

export async function showTermsOfService(
  bot: TelegramBot,
  chatId: number,
  _userId: number,
): Promise<void> {
  await bot.sendMessage(chatId, 'Функциональность условий обслуживания — реализация заглушки');
}

export async function handleTermsAcceptance(
  _bot: TelegramBot,
  _chatId: number,
  _userId: number,
): Promise<boolean> {
  return true;
}

export async function handleTermsDecline(bot: TelegramBot, chatId: number): Promise<void> {
  await bot.sendMessage(chatId, 'Условия отклонены');
}

export async function hasAcceptedTerms(userId: number): Promise<boolean> {
  const userStats = await getUserStats(userId);
  return userStats ? userStats.accepted_terms : false;
}

export async function handleTermsCallback(
  _bot: TelegramBot,
  _callbackQuery: any,
): Promise<boolean> {
  return false;
}

export async function showTermsReminder(
  bot: TelegramBot,
  chatId: number,
  _userId: number,
): Promise<void> {
  await bot.sendMessage(chatId, 'Please accept terms');
}

export async function requireTermsAcceptance(
  userId: number,
  callback: () => Promise<void>,
  termsRequiredCallback: () => Promise<void>,
): Promise<void> {
  const accepted = await hasAcceptedTerms(userId);
  if (accepted) {
    await callback();
  } else {
    await termsRequiredCallback();
  }
}
