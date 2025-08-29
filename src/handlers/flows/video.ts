import type { TelegramLikeBot as TelegramBot } from '../../tg-client.js';
import { isAvailable as isVideoAvailable, parseVideoCommand, validateParams as validateVideoParams, generateVideo, getPredictionStatus } from '../video-handler.js';
import { decreaseRequests, hasRequestsLeft } from '../supabase-handler.js';
import { safeEditMessageText } from '../handler-utils.js';
import { findUser } from '../supabase-handler.js';
import { logInteraction } from "../../utils/logger.js";

export async function handleVideoGeneration(bot: TelegramBot, msg: any): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;
    if (!isVideoAvailable()) {
        await bot.sendMessage(
            chatId,
            "❌ Генерация видео в настоящее время недоступна. Обратитесь в службу поддержки.",
        );
        return;
    }
    const userId = msg.from?.id;
    if (!userId) return;
    const user = await findUser(userId);
    const canUse = hasRequestsLeft(user, "video_req_left" as any);
    if (!canUse) {
        await bot.sendMessage(
            chatId,
            "❌ У вас закончились видео-запросы. Оформите премиум в разделе ✨ Премиум.",
        );
        return;
    }
    const params = parseVideoCommand(text);
    const validation = validateVideoParams(params);
    if (!validation.valid) {
        await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join("\n")}`);
        return;
    }
    const statusMsg = await bot.sendMessage(chatId, "🎬 Генерация видео запущена...");
    try {
        await logInteraction({
            userId: userId!,
            chatId,
            direction: "user",
            type: "video",
            content: params.prompt,
        });
        const start = await generateVideo(params.prompt, params);
        if (!start.success || !start.data?.prediction_id) {
            await safeEditMessageText(
                bot,
                chatId,
                statusMsg.message_id,
                `❌ Ошибка запуска: ${start.error?.message || "unknown"}`,
            );
            return;
        }
        const id = start.data.prediction_id;
        let attempts = 0;
        const maxAttempts = 180; // up to 15 min at 5s interval
        let lastStatus = "";
        let transientErrors = 0;
        const maxTransientErrors = 5;
        const timer = setInterval(async () => {
            attempts++;
            try {
                const st = await getPredictionStatus(id);
                if (!st.success) {
                    transientErrors++;
                    if (transientErrors >= maxTransientErrors) {
                        clearInterval(timer);
                        await safeEditMessageText(
                            bot,
                            chatId,
                            statusMsg.message_id,
                            `❌ Ошибка статуса: ${st.error?.message || "Неизвестная ошибка"}`,
                        );
                        return;
                    }
                    return; // skip this tick, continue polling
                }
                transientErrors = 0;
                const status = st.data?.status || "processing";
                if (status !== lastStatus) {
                    lastStatus = status;
                    await safeEditMessageText(
                        bot,
                        chatId,
                        statusMsg.message_id,
                        `🎬 Статус: ${status}`,
                    );
                }
                if (status === "succeeded") {
                    clearInterval(timer);
                    const url = Array.isArray(st.data?.output) ? st.data?.output[0] : undefined;
                    if (url) {
                        await (bot as any).sendVideo(chatId, url, {
                            caption: `Видео по запросу: ${params.prompt}`,
                        });
                        await logInteraction({
                            userId: userId!,
                            chatId,
                            direction: "bot",
                            type: "video",
                            content: url,
                            meta: { prompt: params.prompt },
                        });
                        await decreaseRequests(userId, "video_req_left" as any, 1);
                        try {
                            await bot.deleteMessage(chatId, statusMsg.message_id);
                        } catch {}
                    } else {
                        await safeEditMessageText(
                            bot,
                            chatId,
                            statusMsg.message_id,
                            "✅ Видео готово, но URL не получен.",
                        );
                    }
                } else if (status === "failed") {
                    clearInterval(timer);
                    await safeEditMessageText(
                        bot,
                        chatId,
                        statusMsg.message_id,
                        "❌ Задача не выполнена. Попробуйте другой запрос.",
                    );
                } else if (attempts >= maxAttempts) {
                    clearInterval(timer);
                    await safeEditMessageText(
                        bot,
                        chatId,
                        statusMsg.message_id,
                        "⏰ Тайм-аут ожидания видео. Попробуйте снова.",
                    );
                }
            } catch (e) {
                clearInterval(timer);
                await safeEditMessageText(
                    bot,
                    chatId,
                    statusMsg.message_id,
                    "❌ Ошибка мониторинга видео.",
                );
            }
        }, 5000);
    } catch (e: any) {
        await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            `❌ Ошибка: ${e?.message || "unknown"}`,
        );
    }
}


