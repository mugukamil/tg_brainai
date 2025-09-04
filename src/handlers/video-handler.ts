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
    ...(GOAPI_API_KEY ? { 'x-api-key': GOAPI_API_KEY } : {}),
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

export async function generateVideo(
  prompt: string,
  options: Partial<VideoGenerationParams> = {},
): Promise<ApiResponse<VideoGenerationResponse>> {
  try {
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
    const mode: 'std' | 'pro' =
      version === '2.0' || version === '2.1-master' ? 'pro' : (requestedMode ?? 'std');

    const body: any = {
      model: 'kling',
      task_type: 'video_generation',
      input: {
        prompt,
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
        // ...(version ? { version } : {}),
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

    console.log(body);
    const response = await goapi.post<any>('/task', body);
    console.log(response.data);
    const data = response.data;
    return {
      success: true,
      data: {
        prediction_id: data.data.task_id,
        status: mapKlingStatus(data.data.status),
        urls: { get: `/task/${data.data.task_id}`, cancel: '' },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? { message: error.response?.data?.message ?? error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

export async function getPredictionStatus(predictionId: string): Promise<ApiResponse<any>> {
  try {
    const response = await goapi.get(`/task/${predictionId}`);
    const data = response.data?.data;
    const works = data?.output?.works ?? [];
    const videoUrl = works[0]?.video?.resource_without_watermark ?? works[0]?.video?.resource;

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
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? { message: error.response?.data?.message ?? error.message }
        : { message: error instanceof Error ? error.message : 'Unknown error' },
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
      version: '2.1',
    },
  };
}

export function formatStatusMessage(status: string): string {
  return `Статус видео: ${status}`;
}

export function validateParams(_params: VideoGenerationParams): ValidationResult {
  return {
    valid: true,
    errors: [],
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
