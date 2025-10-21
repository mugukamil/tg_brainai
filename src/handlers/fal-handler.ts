import { fal } from '@fal-ai/client';
import type { ApiResponse } from '@/types/index.js';

if (isFalConfigured()) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

export interface NanoBananaTextToImageRequest {
  prompt: string;
  num_images?: number;
  output_format?: 'jpeg' | 'png' | 'webp';
  aspect_ratio?: '21:9' | '1:1' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '3:4' | '16:9' | '9:16';
  sync_mode?: boolean;
}

export interface NanoBananaImageToImageRequest {
  prompt: string;
  image_urls: string[];
  num_images?: number;
  output_format?: 'jpeg' | 'png' | 'webp';
  aspect_ratio?: '21:9' | '1:1' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '3:4' | '16:9' | '9:16';
  sync_mode?: boolean;
}

export interface NanoBananaResponse {
  images: Array<{
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  }>;
  description: string;
}

export interface NanoBananaTaskResponse {
  task_id?: string;
  status?: string;
  data?: NanoBananaResponse;
  error?: {
    message: string;
  };
}

/**
 * Generate images using fal.ai Nano Banana model (text-to-image)
 * @param prompt - The text prompt describing what you want to see
 * @param options - Additional options for image generation
 * @returns Promise with API response
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  options: Omit<NanoBananaTextToImageRequest, 'prompt'> = {},
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    if (!prompt || prompt.trim().length < 3) {
      return {
        success: false,
        error: { message: 'Запрос должен содержать не менее 3 символов' },
      };
    }

    console.log('🍌 Generating image with fal.ai Nano Banana (text-to-image)...');
    console.log('Prompt:', prompt);
    console.log('Options:', options);

    const input: NanoBananaTextToImageRequest = {
      prompt: prompt.trim(),
      num_images: Math.min(Math.max(options.num_images || 1, 1), 4),
      output_format: options.output_format || 'jpeg',
      aspect_ratio: options.aspect_ratio || '1:1',
      ...(options.sync_mode !== undefined && { sync_mode: options.sync_mode }),
    };

    // Use fal.subscribe for real-time generation with progress updates
    const result = await fal.subscribe('fal-ai/nano-banana', {
      input,
      logs: true,
      onQueueUpdate: update => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map(log => log.message).forEach(console.log);
        }
      },
    });

    console.log('✅ Nano Banana text-to-image generation completed');
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
        data: result.data as NanoBananaResponse,
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error generating image with Nano Banana:', error);

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
 * Edit images using fal.ai Nano Banana model (image-to-image)
 * @param prompt - The text prompt describing what you want to change
 * @param imageUrls - Array of image URLs to edit
 * @param options - Additional options for image editing
 * @returns Promise with API response
 */
export async function editImageWithNanoBanana(
  prompt: string,
  imageUrls: string[],
  options: Omit<NanoBananaImageToImageRequest, 'prompt' | 'image_urls'> = {},
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    if (!prompt || prompt.trim().length < 3) {
      return {
        success: false,
        error: { message: 'Запрос должен содержать не менее 3 символов' },
      };
    }

    if (!imageUrls || imageUrls.length === 0) {
      return {
        success: false,
        error: { message: 'Необходимо предоставить хотя бы одно изображение для редактирования' },
      };
    }

    console.log('🍌 Editing images with fal.ai Nano Banana (image-to-image)...');
    console.log('Prompt:', prompt);
    console.log('Image URLs:', imageUrls);
    console.log('Options:', options);

    const input: NanoBananaImageToImageRequest = {
      prompt: prompt.trim(),
      image_urls: imageUrls,
      num_images: Math.min(Math.max(options.num_images || 1, 1), 4),
      output_format: options.output_format || 'jpeg',
      ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
      ...(options.sync_mode !== undefined && { sync_mode: options.sync_mode }),
    };

    // Use fal.subscribe for real-time generation with progress updates
    const result = await fal.subscribe('fal-ai/nano-banana/edit', {
      input,
      logs: true,
      onQueueUpdate: update => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map(log => log.message).forEach(console.log);
        }
      },
    });

    console.log('✅ Nano Banana image-to-image editing completed');
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
        data: result.data as NanoBananaResponse,
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error editing image with Nano Banana:', error);

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
 * Generate or edit images using fal.ai Nano Banana (convenience method)
 * Automatically chooses between text-to-image and image-to-image based on whether imageUrls are provided
 * @param prompt - The text prompt
 * @param options - Generation/editing options
 * @param imageUrls - Optional image URLs for image-to-image editing
 * @returns Promise with API response
 */
export async function generateImageWithFal(
  prompt: string,
  options: Omit<NanoBananaTextToImageRequest, 'prompt'> = {},
  imageUrls?: string[],
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  if (imageUrls && imageUrls.length > 0) {
    // Use image-to-image editing
    return await editImageWithNanoBanana(prompt, imageUrls, options);
  } else {
    // Use text-to-image generation
    return await generateImageWithNanoBanana(prompt, options);
  }
}

/**
 * Submit image generation/editing task using fal.ai queue system (for long-running requests)
 * @param prompt - The text prompt
 * @param options - Generation/editing options
 * @param imageUrls - Optional image URLs for image-to-image editing
 * @returns Promise with task submission response
 */
export async function submitFalImageTask(
  prompt: string,
  options: Omit<NanoBananaTextToImageRequest, 'prompt'> = {},
  imageUrls?: string[],
): Promise<ApiResponse<{ request_id: string }>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    if (!prompt || prompt.trim().length < 3) {
      return {
        success: false,
        error: { message: 'Prompt must be at least 3 characters long' },
      };
    }

    console.log('🍌 Submitting Nano Banana task to fal.ai queue...');

    let endpoint: string;
    let input: NanoBananaTextToImageRequest | NanoBananaImageToImageRequest;

    if (imageUrls && imageUrls.length > 0) {
      // Use image-to-image endpoint
      endpoint = 'fal-ai/nano-banana/edit';
      input = {
        prompt: prompt.trim(),
        image_urls: imageUrls,
        num_images: Math.min(Math.max(options.num_images || 1, 1), 4),
        output_format: options.output_format || 'jpeg',
        ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
        ...(options.sync_mode !== undefined && { sync_mode: options.sync_mode }),
      };
    } else {
      // Use text-to-image endpoint
      endpoint = 'fal-ai/nano-banana';
      input = {
        prompt: prompt.trim(),
        num_images: Math.min(Math.max(options.num_images || 1, 1), 4),
        output_format: options.output_format || 'jpeg',
        aspect_ratio: options.aspect_ratio || '1:1',
        ...(options.sync_mode !== undefined && { sync_mode: options.sync_mode }),
      };
    }

    const { request_id } = await fal.queue.submit(endpoint, {
      input,
    });

    console.log('✅ Nano Banana task submitted with ID:', request_id);

    return {
      success: true,
      data: { request_id },
    };
  } catch (error: unknown) {
    console.error('❌ Error submitting Nano Banana task:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to submit task to fal.ai',
      },
    };
  }
}

/**
 * Get the status of a fal.ai Nano Banana task
 * @param requestId - The request ID from task submission
 * @param isImageToImage - Whether this is an image-to-image task
 * @returns Promise with task status
 */
export async function getFalTaskStatus(
  requestId: string,
  isImageToImage = false,
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    const endpoint = isImageToImage ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';
    const status = await fal.queue.status(endpoint, {
      requestId,
      logs: true,
    });

    console.log('📊 Nano Banana task status:', status.status);

    return {
      success: true,
      data: {
        task_id: requestId,
        status: status.status,
        ...(status.status === 'COMPLETED' && { data: status as unknown as NanoBananaResponse }),
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error getting Nano Banana task status:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to get task status',
      },
    };
  }
}

/**
 * Get the result of a completed fal.ai Nano Banana task
 * @param requestId - The request ID from task submission
 * @param isImageToImage - Whether this is an image-to-image task
 * @returns Promise with task result
 */
export async function getFalTaskResult(
  requestId: string,
  isImageToImage = false,
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    const endpoint = isImageToImage ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';
    const result = await fal.queue.result(endpoint, {
      requestId,
    });

    console.log('✅ Nano Banana task result received');

    return {
      success: true,
      data: {
        task_id: requestId,
        status: 'completed',
        data: result.data as NanoBananaResponse,
      },
    };
  } catch (error: unknown) {
    console.error('❌ Error getting Nano Banana task result:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to get task result',
      },
    };
  }
}

/**
 * Wait for a fal.ai Nano Banana task to complete with polling
 * @param requestId - The request ID from task submission
 * @param isImageToImage - Whether this is an image-to-image task
 * @param maxWaitTime - Maximum wait time in milliseconds (default: 300000 = 5 minutes)
 * @param pollInterval - Polling interval in milliseconds (default: 3000 = 3 seconds)
 * @returns Promise with final task result
 */
export async function waitForFalTaskCompletion(
  requestId: string,
  isImageToImage = false,
  maxWaitTime = 300000,
  pollInterval = 3000,
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  const startTime = Date.now();

  console.log('⏳ Waiting for Nano Banana task completion...');

  while (Date.now() - startTime < maxWaitTime) {
    const statusResult = await getFalTaskStatus(requestId, isImageToImage);

    if (!statusResult.success) {
      return statusResult;
    }

    const status = statusResult.data?.status;

    if (status === 'completed') {
      console.log('✅ Nano Banana task completed');
      return await getFalTaskResult(requestId, isImageToImage);
    } else if (status === 'failed') {
      return {
        success: false,
        error: { message: 'Nano Banana task failed' },
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    success: false,
    error: { message: 'Task timeout - maximum wait time exceeded' },
  };
}

/**
 * Generate/edit image with fal.ai Nano Banana and wait for completion (convenience method)
 * @param prompt - The text prompt
 * @param options - Generation/editing options
 * @param imageUrls - Optional image URLs for image-to-image editing
 * @returns Promise with completed task result
 */
export async function generateFalImageAndWait(
  prompt: string,
  options: Omit<NanoBananaTextToImageRequest, 'prompt'> = {},
  imageUrls?: string[],
): Promise<ApiResponse<NanoBananaTaskResponse>> {
  // For simple use cases, use direct generation/editing
  return await generateImageWithFal(prompt, options, imageUrls);
}

/**
 * Upload a file to fal.ai storage
 * @param file - File object or buffer to upload
 * @param filename - Optional filename
 * @returns Promise with uploaded file URL
 */
export async function uploadFileToFal(
  file: File | Buffer,
  filename?: string,
): Promise<ApiResponse<{ url: string }>> {
  try {
    if (!isFalConfigured()) {
      return {
        success: false,
        error: { message: 'FAL_KEY environment variable is not set' },
      };
    }

    let fileToUpload: File;

    if (Buffer.isBuffer(file)) {
      fileToUpload = new File([file], filename || 'upload.jpg', { type: 'image/jpeg' });
    } else {
      fileToUpload = file as File;
    }

    const url = await fal.storage.upload(fileToUpload);

    console.log('📤 File uploaded to fal.ai storage:', url);

    return {
      success: true,
      data: { url },
    };
  } catch (error: unknown) {
    console.error('❌ Error uploading file to fal.ai:', error);

    return {
      success: false,
      error: {
        message:
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as any).message === 'string'
            ? (error as any).message
            : 'Failed to upload file',
      },
    };
  }
}

/**
 * Check if fal.ai is properly configured
 * @returns boolean indicating if fal.ai is ready to use
 */
export function isFalConfigured(): boolean {
  return !!process.env.FAL_KEY;
}

/**
 * Validate fal.ai Nano Banana image generation/editing parameters
 * @param options - Options to validate
 * @returns Validation result with any errors
 */
export function validateNanoBananaOptions(options: Partial<NanoBananaTextToImageRequest>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate aspect ratio
  const validAspectRatios = [
    '21:9',
    '1:1',
    '4:3',
    '3:2',
    '2:3',
    '5:4',
    '4:5',
    '3:4',
    '16:9',
    '9:16',
  ];
  if (options.aspect_ratio && !validAspectRatios.includes(options.aspect_ratio)) {
    errors.push(`Invalid aspect ratio. Must be one of: ${validAspectRatios.join(', ')}`);
  }

  // Validate number of images
  if (options.num_images && (options.num_images < 1 || options.num_images > 4)) {
    errors.push('Number of images must be between 1 and 4');
  }

  // Validate output format
  const validFormats = ['jpeg', 'png', 'webp'];
  if (options.output_format && !validFormats.includes(options.output_format)) {
    errors.push(`Invalid output format. Must be one of: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Legacy compatibility - keeping old function names but pointing to new implementation
export const validateFalImageOptions = validateNanoBananaOptions;

// Backward compatibility type exports
export type FalImageRequest = NanoBananaTextToImageRequest;
export type FalImageResponse = NanoBananaResponse;
export type FalTaskResponse = NanoBananaTaskResponse;
