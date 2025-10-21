import { createThread } from './handlers/openai-handler';
import { createUser, findUser } from './handlers/supabase-handler';
import { DbUser } from './types';

export const findOrCreate = async (userId: number): Promise<DbUser | null> => {
  let user = await findUser(userId);
  if (!user) {
    const thread = await createThread();
    user = await createUser(userId, thread.id);
  }
  return user;
};
