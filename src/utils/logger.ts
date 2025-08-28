import { promises as fs } from 'fs';
import path from 'path';
import { insertInteractionLog } from '../handlers/supabase-handler.js';

type Direction = 'user' | 'bot' | 'system';
type ContentType = 'text' | 'image' | 'voice' | 'video' | 'callback' | 'other';

export interface InteractionLogEntry {
  userId: number;
  chatId: number;
  direction: Direction;
  type: ContentType;
  content: string;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

function getLogFilePath(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const fileName = `interactions-${yyyy}-${mm}-${dd}.jsonl`;
  return path.resolve(process.cwd(), 'logs', fileName);
}

export async function logInteraction(entry: InteractionLogEntry): Promise<void> {
  try {
    const enriched = { ...entry, timestamp: new Date().toISOString() };
    const filePath = getLogFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, JSON.stringify(enriched) + '\n', 'utf8');
  } catch (error) {
    // Avoid throwing from logger
    // eslint-disable-next-line no-console
    console.error('Logger error:', error);
  }

  // Optional central logging to Supabase
  try {
    if (process.env.LOG_TO_SUPABASE === 'true') {
      await insertInteractionLog({
        user_id: entry.userId,
        chat_id: entry.chatId,
        direction: entry.direction,
        type: entry.type,
        content: entry.content,
        meta: entry.meta || null,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Central logger error:', error);
  }
}


