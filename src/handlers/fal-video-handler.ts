import { fal } from '@fal-ai/client';
import type { ApiResponse, ValidationResult } from '@/types/index.js';

if (isFalVideoConfigured()) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

export interface FalKlingVideoRequest {
  prompt: string;
  image_url?: string; // Optional for text-to-video
  duration?: '5' | '10';
  aspect_ratio?: '16:9' | '9:16' | '1:1'; // For text-to-video
  negative_prompt?: string;
  cfg_scale?: number;
}

export interface FalKlingVideoResponse {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
}

export interface FalVideoTaskResponse {
  task_id?: string;
  request_id?: string;
  status?: string;
  data?: FalKlingVideoResponse;
  error?: {
    message: string;
  };
}

/**
 * Generate video using fal.ai Kling 2.5 Turbo Pro
 * Automatically detects image-to-video or text-to-video based on imageUrl
 * @param prompt - The text prompt describing the video motion/action
 * @param imageUrl - Optional URL of the image to animate (for image-to-video)
 * @param options - Additional options for video generation
 * @returns Promise with API response
 */
export async function generateVideoWithFal(
  prompt: string,
  imageUrl?: string,
  options: Omit<FalKlingVideoRequest, 'prompt' | 'image_url'> = {},
): Promise<ApiResponse<FalVideoTaskResponse>> {
  try {
    if (!isFalVideoConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    if (!prompt || prompt.trim().length < 5) {
      return {
        success: false,
        error: { message: 'Запрос должен содержать не менее 5 символов' },
      };
    }

    // Determine if this is image-to-video or text-to-video
    const isImageToVideo = imageUrl && isValidUrl(imageUrl);
    const modelEndpoint = isImageToVideo
      ? 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'
      : 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video';

    console.log(
      `🎬 Generating video with fal.ai Kling (${isImageToVideo ? 'image-to-video' : 'text-to-video'})...`,
    );
    console.log('Prompt:', prompt);
    if (isImageToVideo) {
      console.log('Image URL:', imageUrl);
    }
    console.log('Options:', options);

    const input: FalKlingVideoRequest = {
      prompt: prompt.trim(),
      duration: options.duration || '5',
      negative_prompt: options.negative_prompt || 'blur, distort, and low quality',
      cfg_scale: options.cfg_scale !== undefined ? options.cfg_scale : 0.5,
    };

    // Add image_url for image-to-video
    if (isImageToVideo) {
      input.image_url = imageUrl;
    }

    // Add aspect_ratio for text-to-video
    if (!isImageToVideo) {
      input.aspect_ratio = options.aspect_ratio || '16:9';
    }

    // Validate cfg_scale range
    if (input.cfg_scale !== undefined && (input.cfg_scale < 0 || input.cfg_scale > 1)) {
      return {
        success: false,
        error: { message: 'cfg_scale must be between 0 and 1' },
      };
    }

    // Use fal.subscribe for real-time generation with progress updates
    const result = await fal.subscribe(modelEndpoint, {
      input,
      logs: true,
      onQueueUpdate: update => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map(log => log.message).forEach(console.log);
        }
      },
    });

    console.log('✅ fal.ai Kling video generation completed');
    console.log('Result:', result);

    if (!result.data) {
      return {
        success: false,
        error: { message: 'Данные не получены от fal.ai API' },
      };
    }

    return {
      success: true,
      data: {
        task_id: result.requestId,
        status: 'completed',
        data: result.data as FalKlingVideoResponse,
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error generating video with fal.ai Kling:', error);

    let errorMessage = 'Unknown error occurred';
    if (error && typeof error === 'object') {
      const err = error as any;
      if (err.message) {
        errorMessage = err.message;
      } else if (err.detail) {
        errorMessage = err.detail;
      } else if (err.error?.message) {
        errorMessage = err.error.message;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return {
      success: false,
      error: { message: errorMessage },
    };
  }
}

/**
 * Generate video using fal.ai queue system (for long-running requests)
 * Automatically detects image-to-video or text-to-video based on imageUrl
 * @param prompt - The text prompt describing the video motion/action
 * @param imageUrl - Optional URL of the image to animate (for image-to-video)
 * @param options - Additional options for video generation
 * @returns Promise with task submission response
 */
export async function submitFalVideoTask(
  prompt: string,
  imageUrl?: string,
  options: Omit<FalKlingVideoRequest, 'prompt' | 'image_url'> = {},
): Promise<ApiResponse<{ request_id: string }>> {
  try {
    if (!isFalVideoConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    if (!prompt || prompt.trim().length < 5) {
      return {
        success: false,
        error: { message: 'Prompt must be at least 5 characters long' },
      };
    }

    // Determine if this is image-to-video or text-to-video
    const isImageToVideo = imageUrl && isValidUrl(imageUrl);
    const modelEndpoint = isImageToVideo
      ? 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'
      : 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video';

    console.log(
      `🎬 Submitting video task to fal.ai queue (${isImageToVideo ? 'image-to-video' : 'text-to-video'})...`,
    );

    const input: FalKlingVideoRequest = {
      prompt: prompt.trim(),
      duration: options.duration || '5',
      negative_prompt: options.negative_prompt || 'blur, distort, and low quality',
      cfg_scale: options.cfg_scale !== undefined ? options.cfg_scale : 0.5,
    };

    // Add image_url for image-to-video
    if (isImageToVideo) {
      input.image_url = imageUrl;
    }

    // Add aspect_ratio for text-to-video
    if (!isImageToVideo) {
      input.aspect_ratio = options.aspect_ratio || '16:9';
    }

    const { request_id } = await fal.queue.submit(modelEndpoint, {
      input,
    });

    console.log('✅ fal.ai video task submitted with ID:', request_id);

    return {
      success: true,
      data: { request_id },
    };
  } catch (error: unknown) {
    console.error('❌ Error submitting fal.ai video task:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to submit video task to fal.ai',
      },
    };
  }
}

/**
 * Get the status of a fal.ai video task
 * @param requestId - The request ID from task submission
 * @param modelType - Type of model used ('image-to-video' or 'text-to-video')
 * @returns Promise with task status
 */
export async function getFalVideoTaskStatus(
  requestId: string,
  modelType: 'image-to-video' | 'text-to-video' = 'image-to-video',
): Promise<ApiResponse<FalVideoTaskResponse>> {
  try {
    if (!isFalVideoConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    const modelEndpoint =
      modelType === 'text-to-video'
        ? 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video'
        : 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';

    const status = await fal.queue.status(modelEndpoint, {
      requestId,
      logs: true,
    });

    console.log('📊 fal.ai video task status:', status.status);

    return {
      success: true,
      data: {
        request_id: requestId,
        status: status.status,
        ...(status.status === 'COMPLETED' && { data: status as unknown as FalKlingVideoResponse }),
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error getting fal.ai video task status:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to get video task status',
      },
    };
  }
}

/**
 * Get the result of a completed fal.ai video task
 * @param requestId - The request ID from task submission
 * @param modelType - Type of model used ('image-to-video' or 'text-to-video')
 * @returns Promise with task result
 */
export async function getFalVideoTaskResult(
  requestId: string,
  modelType: 'image-to-video' | 'text-to-video' = 'image-to-video',
): Promise<ApiResponse<FalVideoTaskResponse>> {
  try {
    if (!isFalVideoConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    const modelEndpoint =
      modelType === 'text-to-video'
        ? 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video'
        : 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';

    const result = await fal.queue.result(modelEndpoint, {
      requestId,
    });

    console.log('✅ fal.ai video task result received');

    return {
      success: true,
      data: {
        request_id: requestId,
        status: 'completed',
        data: result.data as FalKlingVideoResponse,
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error getting fal.ai video task result:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to get video task result',
      },
    };
  }
}

/**
 * Wait for a fal.ai video task to complete with polling
 * @param requestId - The request ID from task submission
 * @param maxWaitTime - Maximum wait time in milliseconds (default: 600000 = 10 minutes)
 * @param pollInterval - Polling interval in milliseconds (default: 5000 = 5 seconds)
 * @param modelType - Type of model used ('image-to-video' or 'text-to-video')
 * @returns Promise with final task result
 */
export async function waitForFalVideoTaskCompletion(
  requestId: string,
  maxWaitTime = 600000,
  pollInterval = 5000,
  modelType: 'image-to-video' | 'text-to-video' = 'image-to-video',
): Promise<ApiResponse<FalVideoTaskResponse>> {
  const startTime = Date.now();

  console.log('⏳ Waiting for fal.ai video task completion...');

  while (Date.now() - startTime < maxWaitTime) {
    const statusResult = await getFalVideoTaskStatus(requestId, modelType);

    if (!statusResult.success) {
      return statusResult;
    }

    const status = statusResult.data?.status;

    if (status === 'COMPLETED' || status === 'completed') {
      console.log('✅ fal.ai video task completed');
      return await getFalVideoTaskResult(requestId, modelType);
    } else if (status === 'FAILED' || status === 'failed') {
      return {
        success: false,
        error: { message: 'fal.ai video task failed' },
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    success: false,
    error: { message: 'Video task timeout - maximum wait time exceeded' },
  };
}

/**
 * Check if fal.ai video generation is properly configured
 * @returns boolean indicating if fal.ai video is ready to use
 */
export function isFalVideoConfigured(): boolean {
  return !!process.env.FAL_KEY;
}

/**
 * Validate fal.ai Kling video generation parameters
 * @param options - Video generation options to validate
 * @returns Validation result with any errors
 */
export function validateFalVideoOptions(options: Partial<FalKlingVideoRequest>): ValidationResult {
  const errors: string[] = [];

  // Validate prompt
  if (options.prompt !== undefined) {
    if (!options.prompt || options.prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty');
    } else if (options.prompt.length < 5) {
      errors.push('Prompt must be at least 5 characters long');
    } else if (options.prompt.length > 1000) {
      errors.push('Prompt must be less than 1000 characters');
    }
  }

  // Validate image_url (optional for text-to-video)
  if (options.image_url !== undefined && options.image_url !== '') {
    if (!isValidUrl(options.image_url)) {
      errors.push('Invalid image URL format');
    }
  }

  // Validate aspect_ratio (for text-to-video)
  const validAspectRatios = ['16:9', '9:16', '1:1'];
  if (options.aspect_ratio && !validAspectRatios.includes(options.aspect_ratio)) {
    errors.push(`Aspect ratio must be one of: ${validAspectRatios.join(', ')}`);
  }

  // Validate duration
  const validDurations = ['5', '10'];
  if (options.duration && !validDurations.includes(options.duration)) {
    errors.push(`Duration must be one of: ${validDurations.join(', ')}`);
  }

  // Validate cfg_scale
  if (options.cfg_scale !== undefined && (options.cfg_scale < 0 || options.cfg_scale > 1)) {
    errors.push('cfg_scale must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to validate URL
 * @param url - URL to validate
 * @returns boolean indicating if URL is valid
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse video command text to extract prompt and options
 * @param text - Command text from user
 * @param imageUrl - Optional image URL for video generation (for image-to-video)
 * @returns Parsed video generation parameters
 */
export function parseVideoCommand(
  text: string,
  imageUrl?: string,
): FalKlingVideoRequest & { duration: '5' | '10' } {
  // Extract duration if specified (e.g., "/video 10 <prompt>" or "/video duration:10 <prompt>")
  let duration: '5' | '10' = '5';
  let prompt = text;

  // Check for duration patterns
  const durationMatch = text.match(/^(?:\/video\s+)?(?:duration:)?(\d+)\s+(.+)$/i);
  if (durationMatch && durationMatch[2]) {
    const requestedDuration = durationMatch[1];
    if (requestedDuration === '10') {
      duration = '10';
    }
    prompt = durationMatch[2];
  } else {
    // Remove /video command if present
    const cleaned = text.replace(/^\/video\s+/i, '').trim();
    prompt = cleaned || text;
  }

  const result: FalKlingVideoRequest & { duration: '5' | '10' } = {
    prompt: prompt.trim(),
    duration,
    negative_prompt: 'blur, distort, and low quality',
    cfg_scale: 0.5,
  };

  // Add image_url if provided (image-to-video)
  if (imageUrl) {
    result.image_url = imageUrl;
  } else {
    // Add default aspect_ratio for text-to-video
    result.aspect_ratio = '16:9';
  }

  return result;
}

/**
 * Format video status message for display
 * @param status - Status string from fal.ai
 * @returns Formatted status message
 */
export function formatVideoStatusMessage(status: string): string {
  const statusMap: Record<string, string> = {
    IN_QUEUE: '⏳ В очереди...',
    IN_PROGRESS: '🎬 Генерация видео...',
    COMPLETED: '✅ Видео готово!',
    FAILED: '❌ Ошибка генерации',
    completed: '✅ Видео готово!',
    failed: '❌ Ошибка генерации',
    processing: '🎬 Обработка...',
    queued: '⏳ В очереди...',
  };

  return statusMap[status] || `Статус: ${status}`;
}
