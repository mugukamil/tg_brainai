import axios from 'axios';
import type {
  VideoGenerationParams,
  VideoGenerationResponse,
  ApiResponse,
  ValidationResult,
} from '../types/index.js';

const GOAPI_API_KEY = process.env.GOAPI_API_KEY;

const goapi = axios.create({
  baseURL: 'https://api.goapi.ai/api/v1',
  headers: {
    'x-api-key': GOAPI_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 1200000,
});

if (!GOAPI_API_KEY) {
  console.error('GOAPI_API_KEY is not set in environment variables');
}

export async function generateVideo(
  prompt: string,
  options: Partial<VideoGenerationParams> = {},
): Promise<ApiResponse<VideoGenerationResponse>> {
  try {
    if (!GOAPI_API_KEY) {
      return {
        success: false,
        error: { message: 'Video generation is not configured. API key is missing.' },
      };
    }
    const duration = Math.max(5, Math.min(10, options.duration ?? 5));
    const aspectMap: Record<string, string> = {
      '480p': '1:1',
      '720p': '1:1',
      '1080p': '16:9',
    };
    const aspect_ratio = aspectMap[options.resolution ?? '720p'] ?? '1:1';
    const requestedMode = options.additionalParams?.mode as 'std' | 'pro' | undefined;
    const version = options.additionalParams?.version as
      | '1.0'
      | '1.5'
      | '1.6'
      | '2.0'
      | '2.1'
      | '2.1-master'
      | undefined;
    // Map versions to API-expected format
    const apiVersion = version || '1.6'; // Default to 1.5 if not specified
    console.log('Video generation version handling:', {
      requestedVersion: options.additionalParams?.version,
      resolvedVersion: version,
      apiVersion: apiVersion,
      requestedMode: requestedMode,
    });

    // Determine mode based on version
    let mode: 'std' | 'pro' = 'std';
    if (apiVersion === '2.0' || apiVersion === '2.1' || apiVersion === '2.1-master') {
      mode = 'pro';
    } else if (requestedMode) {
      mode = requestedMode;
    }
    console.log('Selected mode based on version:', { apiVersion, mode });

    const body: any = {
      model: 'kling',
      task_type: 'video_generation',
      input: {
        prompt: prompt.trim(),
        negative_prompt: '',
        cfg_scale: 0.5,
        duration,
        aspect_ratio,
        camera_control: {
          type: 'simple',
          config: {
            horizontal: 0,
            vertical: 0,
            pan: -10,
            tilt: 0,
            roll: 0,
            zoom: 0,
          },
        },
        mode,
        version: apiVersion,
        output_format: 'mp4',
        output_type: 'video',
      },
    };

    // Build config only when provided to satisfy enum validation
    const config: { service_mode?: string; webhook_config?: any } = {};
    if (options.additionalParams?.service_mode) {
      config.service_mode = options.additionalParams.service_mode;
    }
    if (options.additionalParams?.webhook_config) {
      config.webhook_config = options.additionalParams.webhook_config;
    }
    if (Object.keys(config).length > 0) {
      body.config = config;
    }

    try {
      const response = await goapi.post<any>('/task', body);
      console.log('=== VIDEO GENERATION RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      const data = response.data;
      return {
        success: true,
        data: {
          prediction_id: data.data.task_id,
          status: mapKlingStatus(data.data.status),
          urls: { get: `/task/${data.data.task_id}`, cancel: '' },
        },
      };
    } catch (innerError) {
      throw innerError;
    }
  } catch (error) {
    console.error('=== VIDEO GENERATION ERROR ===');
    console.error('Error details:', {
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
      statusText: axios.isAxiosError(error) ? error.response?.statusText : undefined,
      responseData: axios.isAxiosError(error) ? error.response?.data : undefined,
      requestConfig: axios.isAxiosError(error)
        ? {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
          }
        : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Log specific error format for debugging
    if (axios.isAxiosError(error) && error.response?.data) {
      console.error('Raw API error response:', JSON.stringify(error.response.data, null, 2));
    }
    // Parse error message from various possible formats
    let errorMessage = 'Unknown error occurred';
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data;
      errorMessage =
        data.message ||
        data.error ||
        data.error_message ||
        data.detail ||
        (typeof data === 'string' ? data : JSON.stringify(data));
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: { message: errorMessage },
    };
  }
}

export async function getPredictionStatus(predictionId: string): Promise<ApiResponse<any>> {
  try {
    const response = await goapi.get(`/task/${predictionId}`);
    const data = response.data?.data;

    // Debug logging for response structure
    console.log('=== VIDEO STATUS RESPONSE ===');
    console.log('Full response data:', JSON.stringify(response.data, null, 2));
    console.log('Output data:', JSON.stringify(data?.output, null, 2));

    const works = data?.output?.works ?? [];
    console.log('Works array:', JSON.stringify(works, null, 2));

    // Check all available video formats
    const videoResource = works[0]?.video;
    if (videoResource) {
      console.log('Video resource details:', {
        resource: videoResource.resource,
        resource_without_watermark: videoResource.resource_without_watermark,
        format: videoResource.format,
        mime_type: videoResource.mime_type,
        duration: videoResource.duration,
        width: videoResource.width,
        height: videoResource.height,
      });
    }

    const videoUrl = works[0]?.video?.resource_without_watermark ?? works[0]?.video?.resource;
    console.log('Selected video URL:', videoUrl);
    console.log('URL extension:', videoUrl ? videoUrl.split('.').pop()?.split('?')[0] : 'none');

    return {
      success: true,
      data: {
        id: predictionId,
        status: mapKlingStatus(data?.status),
        output: videoUrl ? [videoUrl] : undefined,
        logs: [],
        metrics: { predict_time: undefined },
      },
    };
  } catch (error) {
    // Parse error message from various possible formats
    let errorMessage = 'Failed to get prediction status';
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data;
      errorMessage =
        data.message ||
        data.error ||
        data.error_message ||
        data.detail ||
        (typeof data === 'string' ? data : error.message);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: { message: errorMessage },
    };
  }
}

export function parseVideoCommand(text: string): VideoGenerationParams {
  return {
    prompt: text,
    resolution: '720p',
    duration: 5,
    fps: 24,
    additionalParams: {
      version: '1.6',
      mode: 'std',
    },
  };
}

export function formatStatusMessage(status: string): string {
  return `Статус видео: ${status}`;
}

export function validateParams(params: VideoGenerationParams): ValidationResult {
  const errors: string[] = [];

  // Validate prompt
  if (!params.prompt || params.prompt.trim().length === 0) {
    errors.push('Prompt cannot be empty');
  } else if (params.prompt.length < 3) {
    errors.push('Prompt must be at least 3 characters long');
  } else if (params.prompt.length > 1000) {
    errors.push('Prompt must be less than 1000 characters');
  }

  // Validate duration
  if (params.duration && (params.duration < 5 || params.duration > 10)) {
    errors.push('Duration must be between 5 and 10 seconds');
  }

  // Validate resolution
  const validResolutions = ['480p', '720p', '1080p'];
  if (params.resolution && !validResolutions.includes(params.resolution)) {
    errors.push(`Resolution must be one of: ${validResolutions.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isAvailable(): boolean {
  return Boolean(GOAPI_API_KEY);
}

function mapKlingStatus(status: string): VideoGenerationResponse['status'] {
  switch (String(status).toLowerCase()) {
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'pending':
    case 'staged':
    case 'processing':
    default:
      return 'processing';
  }
}
