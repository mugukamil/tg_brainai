import type { TelegramLikeBot as TelegramBot } from '../../tg-client.js';
import type { CallbackData } from '../../types/index.js';
import {
    findUser,
    canConsumeRequest,
    decreaseRequests,
    getUserStats,
} from "../supabase-handler.js";
import { getTaskStatus, upscaleImage } from "../goapi-handler.js";
import { safeEditMessageText, fetchImageBuffer } from "../handler-utils.js";
import { logInteraction } from "../../utils/logger.js";
import { handlePaymentCallback } from "../payment-handler.js";
import { handleTermsCallback } from "../terms-handler.js";

export async function handleCallbackQuery(bot: TelegramBot, callbackQuery: any): Promise<void> {
    const msg = callbackQuery.message;
    if (!msg) return;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;

    try {
        const paymentHandled = await handlePaymentCallback(bot, callbackQuery);
        if (paymentHandled) return;
    } catch {}
    try {
        const termsHandled = await handleTermsCallback(bot, callbackQuery);
        if (termsHandled) return;
    } catch {}

    if (!callbackQuery.data) return;
    let data: CallbackData;
    try {
        data = JSON.parse(callbackQuery.data);
    } catch {
        // Not an image-related callback, ignore silently
        return;
    }
    const { t_id: taskId, idx: index } = data;
    if (index === undefined) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: "❌ Неверный индекс",
            show_alert: true,
        });
        return;
    }
    let user = await findUser(userId);
    if (!user) return;
    const canUse = await canConsumeRequest(userId, "image_req_left");
    if (!canUse) {
        const stats = await getUserStats(userId);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: `❌ Нет запросов. Осталось: Изображения ${stats?.image_req_left ?? 0}`,
            show_alert: true,
        });
        return;
    }
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Processing upscale ${index}...` });
    const statusMsg = await bot.sendMessage(chatId, `↗ Улучшаем качество изображения ...`);
    try {
        if (!taskId) {
            await safeEditMessageText(bot, chatId, statusMsg.message_id, "❌ Неверный task ID");
            return;
        }
        const upscaleResult = await upscaleImage(taskId, index);
        if (!upscaleResult.success) {
            await safeEditMessageText(
                bot,
                chatId,
                statusMsg.message_id,
                `❌ Улучшение изображения не удалось: ${upscaleResult.error?.message}`,
            );
            return;
        }
        const newTaskId = upscaleResult.data?.data?.task_id;
        if (!newTaskId) {
            await safeEditMessageText(
                bot,
                chatId,
                statusMsg.message_id,
                "❌ Нет task ID улучшения изображения",
            );
            return;
        }
        const maxAttempts = 40;
        let attempts = 0;
        const pollInterval = setInterval(async () => {
            try {
                attempts++;
                const statusResult = await getTaskStatus(newTaskId);
                if (statusResult.success) {
                    const taskData = statusResult.data?.data;
                    if (!taskData) return;
                    const status = taskData.status;
                    if (status === "completed") {
                        clearInterval(pollInterval);
                        const imageUrl = taskData.output.image_url;
                        if (imageUrl) {
                            try {
                                const { buffer, filename, contentType } =
                                    await fetchImageBuffer(imageUrl);
                                const fileOptions: any = contentType
                                    ? { filename, contentType }
                                    : { filename };
                                await bot.sendPhoto(
                                    chatId,
                                    buffer,
                                    { caption: `✅ Улучшенное изображение ${index}` },
                                    fileOptions,
                                );
                            } catch {
                                await bot.sendPhoto(chatId, imageUrl, {
                                    caption: `✅ Улучшенное изображение ${index}`,
                                });
                            }
                            await logInteraction({
                                userId,
                                chatId,
                                direction: "bot",
                                type: "image",
                                content: imageUrl,
                                meta: { upscaledIndex: index },
                            });
                            try {
                                await bot.deleteMessage(chatId, statusMsg.message_id);
                            } catch {}
                            await decreaseRequests(userId, "image_req_left", 1);
                        } else {
                            await safeEditMessageText(
                                bot,
                                chatId,
                                statusMsg.message_id,
                                "❌ Улучшение изображения завершено, но нет изображения",
                            );
                        }
                    } else if (status === "failed") {
                        clearInterval(pollInterval);
                        await safeEditMessageText(
                            bot,
                            chatId,
                            statusMsg.message_id,
                            "❌ Ошибка, попробуйте другой запрос",
                        );
                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        await safeEditMessageText(
                            bot,
                            chatId,
                            statusMsg.message_id,
                            "⏰ Улучшение изображения завершено",
                        );
                    }
                }
            } catch (error) {
                clearInterval(pollInterval);
                console.error("Ошибка в polling улучшения изображения:", error);
            }
        }, 5000);
    } catch (error) {
        console.error("Ошибка в handleCallbackQuery:", error);
        await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            "❌ Ошибка при обработке запроса",
        );
    }
}


