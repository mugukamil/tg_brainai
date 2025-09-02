import OpenAI from 'openai';
import axios from 'axios';
import type { TranscriptionResponse } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history in memory (in production, use a database)
const conversationHistory = new Map<
  string,
  Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
>();

export async function transcribeAudio(fileUrl: string): Promise<TranscriptionResponse> {
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const audioBuffer = Buffer.from(response.data, 'binary');

  // Create a File-like object for OpenAI
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
  });

  return {
    text: transcription.text,
  };
}

export async function analyzeImage(imageUrl: string, caption?: string): Promise<string> {
    const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
            {
                role: "system",
                content:
                    "Respond in Russian unless the user asks otherwise. Keep the answer under 3500 characters.",
            },
            {
                role: "user",
                content: [
                    { type: "text", text: caption || "Describe this image." },
                    {
                        type: "image_url",
                        image_url: { url: imageUrl },
                    },
                ],
            },
        ],
        max_tokens: 900,
    });

    return response.choices[0]?.message?.content || "Описание отсутствует.";
}

export async function createThread(): Promise<{ id: string }> {
    // Generate a simple thread ID for conversation tracking
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize conversation with system message
    conversationHistory.set(threadId, [
        {
            role: "system",
            content:
                "You are a helpful AI assistant. Respond in Russian unless the user specifically asks for another language. Be conversational and helpful. Keep each answer under 3500 characters.",
        },
    ]);

    return { id: threadId };
}

export async function createMessage(threadId: string, content: string): Promise<{ id: string }> {
    // Add user message to conversation history
    const conversation = conversationHistory.get(threadId) || [];
    conversation.push({
        role: "user",
        content: content,
    });

    if (conversation.length > 10) {
        const systemMessage = conversation[0]!;
        const recentMessages = conversation.slice(-9);
        conversationHistory.set(threadId, [systemMessage, ...recentMessages]);
    } else {
        conversationHistory.set(threadId, conversation);
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { id: messageId };
}

export async function getAssistantResponse(threadId: string): Promise<string> {
    const conversation = conversationHistory.get(threadId) || [];

    if (!conversation) {
        throw new Error("Thread not found");
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: conversation as any,
            max_completion_tokens: 900,
        });

        const assistantMessage = response.choices[0]?.message?.content ?? "";

        if (!assistantMessage) {
            return "Извините, не удалось получить ответ. Попробуйте еще раз.";
        }

        // Add assistant response to conversation history
        conversation.push({
            role: "assistant",
            content: assistantMessage,
        });

        conversationHistory.set(threadId, conversation);

        return assistantMessage;
    } catch (error) {
        console.error("Error getting chat completion:", error);
        return "Извините, произошла ошибка при обработке вашего запроса. Попробуйте позже.";
    }
}
