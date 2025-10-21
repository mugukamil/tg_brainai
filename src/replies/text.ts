import { createMainKeyboard } from '@/handlers/handler-utils';
import { logInteraction } from '@/utils/logger';
import { TelegramLikeBot } from '@/tg-client';
import { updateUser } from '@/handlers/supabase-handler';
import { DbUser } from '@/types';

export const textReply = async (
  user: DbUser,
  userId: number,
  chatId: number,
  text: string,
  bot: TelegramLikeBot,
) => {
  await logInteraction({
    userId,
    chatId,
    direction: 'user',
    type: 'text',
    content: text,
  });
  if (user.current_mode !== 'text') {
    await updateUser(userId, { current_mode: 'text' });
  }
  await bot.sendMessage(chatId, 'Вы в режиме ChatGPT. Напишите в чат 👇', {
    reply_markup: createMainKeyboard(),
  });
};
