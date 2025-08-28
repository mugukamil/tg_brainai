import axios from 'axios';
import type {
  GoApiImageRequest,
  GoApiImageResponse,
  ApiResponse,
  AspectRatio,
  TelegramInlineKeyboard,
} from '../types/index';

const GOAPI_API_KEY = process.env.GOAPI_API_KEY;

if (!GOAPI_API_KEY) {
  throw new Error('GOAPI_API_KEY is required');
}

const goapi = axios.create({
  baseURL: 'https://api.goapi.ai/api/v1',
  headers: {
    'x-api-key': GOAPI_API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Generate images using Midjourney API
 * @param {string} prompt - The text prompt for image generation
 * @param {Object} options - Additional options for image generation
 * @param {string} options.aspect_ratio - Aspect ratio (default: "1:1")
 * @param {string} options.process_mode - Processing mode: "relax", "fast", "turbo"
 * @param {boolean} options.skip_prompt_check - Skip internal prompt check
 * @param {string} options.service_mode - "public" (PAYG) or "private" (HYA)
 * @param {Object} options.webhook_config - Webhook configuration
 * @returns {Promise<Object>} Task creation response
 */
export async function generateImage(
  prompt: string,
  options: Partial<GoApiImageRequest> = {},
): Promise<ApiResponse<GoApiImageResponse>> {
  try {
    const requestBody = {
      model: 'midjourney',
      task_type: 'imagine',
      input: {
        prompt: prompt,
        aspect_ratio: options.aspect_ratio || '1:1',
        ...(options.process_mode && { process_mode: options.process_mode }),
        skip_prompt_check: options.skip_prompt_check || false,
        ...(options.bot_id && { bot_id: options.bot_id }),
      },
      config: {
        ...(options.service_mode && { service_mode: options.service_mode }),
      },
    };

    const response = await goapi.post('/task', requestBody);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      'Error generating image:',
      axios.isAxiosError(error) ? error.response?.data : error,
    );
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data || { message: error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Upscale a specific image from a generated grid
 * @param {string} taskId - Original task ID
 * @param {number} index - Index of the image to upscale (1-4)
 * @returns {Promise<Object>} Upscale task response
 */
export async function upscaleImage(
  taskId: string,
  index: number,
): Promise<ApiResponse<GoApiImageResponse>> {
  try {
    const response = await goapi.post('/task', {
      model: 'midjourney',
      task_type: 'upscale',
      input: {
        origin_task_id: taskId,
        index: String(index),
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      'Error upscaling image:',
      axios.isAxiosError(error) ? error.response?.data : error,
    );
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data || { message: error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Create variations of a specific image from a generated grid
 * @param {string} taskId - Original task ID
 * @param {number} index - Index of the image to vary (1-4)
 * @returns {Promise<Object>} Variation task response
 */
export async function variateImage(
  taskId: string,
  index: number,
): Promise<ApiResponse<GoApiImageResponse>> {
  try {
    const response = await goapi.post('/task', {
      model: 'midjourney',
      task_type: 'variation',
      input: {
        origin_task_id: taskId,
        index: String(index),
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      'Error creating variation:',
      axios.isAxiosError(error) ? error.response?.data : error,
    );
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data || { message: error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Get the status of a task
 * @param {string} taskId - Task ID to check
 * @returns {Promise<Object>} Task status response
 */
export async function getTaskStatus(taskId: string): Promise<ApiResponse<GoApiImageResponse>> {
  try {
    const response = await goapi.get(`/task/${taskId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      'Error getting task status:',
      axios.isAxiosError(error) ? error.response?.data : error,
    );
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data || { message: error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Wait for task completion with polling
 * @param {string} taskId - Task ID to monitor
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 300000 = 5 minutes)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 5000 = 5 seconds)
 * @returns {Promise<Object>} Final task status
 */
export async function waitForTaskCompletion(
  taskId: string,
  maxWaitTime: number = 300000,
  pollInterval: number = 5000,
): Promise<ApiResponse<GoApiImageResponse>> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const statusResult = await getTaskStatus(taskId);

    if (!statusResult.success) {
      return statusResult;
    }

    const status = statusResult.data?.data?.status;

    if (status === 'completed') {
      return statusResult;
    } else if (status === 'failed') {
      return {
        success: false,
        error: statusResult.data?.data?.error || { message: 'Задача не выполнена' },
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    success: false,
    error: { message: 'Тайм-аут задачи — превышено максимальное время ожидания' },
  };
}

/**
 * Generate image and wait for completion
 * @param {string} prompt - The text prompt for image generation
 * @param {Object} options - Additional options for image generation
 * @returns {Promise<Object>} Completed task with image URLs
 */
export async function generateImageAndWait(
  prompt: string,
  options: Partial<GoApiImageRequest> = {},
): Promise<ApiResponse<GoApiImageResponse>> {
  const generateResult = await generateImage(prompt, options);

  if (!generateResult.success) {
    return generateResult;
  }

  const taskId = generateResult.data?.data?.task_id;
  if (!taskId) {
    return {
      success: false,
      error: { message: 'Идентификатор задачи не получен из запроса на генерацию' },
    };
  }

  return await waitForTaskCompletion(taskId);
}

/**
 * Parse aspect ratio string and validate it
 * @param {string} aspectRatio - Aspect ratio string like "16:9", "1:1", etc.
 * @returns {boolean} Whether the aspect ratio is valid
 */
export function isValidAspectRatio(aspectRatio: string): aspectRatio is AspectRatio {
  const validRatios: AspectRatio[] = [
    '1:1',
    '1:2',
    '2:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
    '9:21',
  ];
  return validRatios.includes(aspectRatio as AspectRatio);
}

/**
 * Create inline keyboard for image actions (upscale, variations)
 * @param {string} taskId - Task ID
 * @returns {Object} Telegram inline keyboard markup
 */
export function createImageActionKeyboard(taskId: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: 'U1',
          callback_data: JSON.stringify({ action: 'upscale', t_id: taskId, idx: 1 }),
        },
        {
          text: 'U2',
          callback_data: JSON.stringify({ action: 'upscale', t_id: taskId, idx: 2 }),
        },
        {
          text: 'U3',
          callback_data: JSON.stringify({ action: 'upscale', t_id: taskId, idx: 3 }),
        },
        {
          text: 'U4',
          callback_data: JSON.stringify({ action: 'upscale', t_id: taskId, idx: 4 }),
        },
      ],
      [
        {
          text: 'V1',
          callback_data: JSON.stringify({ action: 'variation', t_id: taskId, idx: 1 }),
        },
        {
          text: 'V2',
          callback_data: JSON.stringify({ action: 'variation', t_id: taskId, idx: 2 }),
        },
        {
          text: 'V3',
          callback_data: JSON.stringify({ action: 'variation', t_id: taskId, idx: 3 }),
        },
        {
          text: 'V4',
          callback_data: JSON.stringify({ action: 'variation', t_id: taskId, idx: 4 }),
        },
      ],
    ],
  };
}
