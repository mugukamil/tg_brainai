export interface BotUser {
  id: number;
  telegram_id: number;
  openai_thread_id?: string;
  current_mode: 'txt' | 'photo' | 'video';
  text_req_left: number;
  image_req_left: number;
  video_req_left: number;
  accepted_terms: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  telegram_id: number;
  openai_thread_id: string;
  current_mode?: 'txt' | 'photo' | 'video';
  text_req_left?: number;
  image_req_left?: number;
  video_req_left?: number;
  accepted_terms?: boolean;
  is_premium?: boolean;
}

export interface UpdateUserData {
  current_mode?: 'txt' | 'photo' | 'video';
  text_req_left?: number;
  image_req_left?: number;
  video_req_left?: number;
  accepted_terms?: boolean;
  is_premium?: boolean;
  openai_thread_id?: string;
}

export interface UserStats {
  telegram_id: number;
  current_mode: 'txt' | 'photo' | 'video';
  text_req_left: number;
  image_req_left: number;
  video_req_left: number;
  is_premium: boolean;
  accepted_terms: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code?: string | number;
  status?: number;
  detail?: any;
}

export interface GoApiImageRequest {
  prompt: string;
  aspect_ratio?: string;
  process_mode?: 'fast' | 'turbo' | 'relax';
  skip_prompt_check?: boolean;
  service_mode?: 'public' | 'private';
  bot_id?: number;
}

export interface GoApiImageResponse {
  code: number;
  data: {
    task_id: string;
    model: string;
    task_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'staged';
    config: {
      service_mode: string;
      webhook_config: {
        endpoint: string;
        secret: string;
      };
    };
    input: Record<string, any>;
    output: {
      image_url: string;
      image_urls?: string[];
      temporary_image_urls?: string[];
      discord_image_url: string;
      actions: string[];
      progress: number;
      intermediate_image_urls?: string[];
    };
    meta: Record<string, any>;
    detail?: any;
    logs: any[];
    error: {
      code: number;
      raw_message: string;
      message: string;
      detail?: any;
    };
  };
  message: string;
}

export interface GoApiUpscaleRequest {
  origin_task_id: string;
  index: number;
}

export interface ImageGenerationParams {
  prompt: string;
  aspect_ratio: string;
  process_mode: string;
  skip_prompt_check: boolean;
  service_mode: string;
}

export interface VideoGenerationParams {
  prompt: string;
  resolution: '480p' | '720p' | '1080p';
  duration: number;
  fps: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  model?: string;
  additionalParams?: Record<string, any>;
}

export interface VideoGenerationResponse {
  prediction_id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  urls?: {
    get: string;
    cancel: string;
  };
}

export interface ReplicateStatus {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: any;
  error?: string;
  logs?: string[];
  metrics?: {
    predict_time?: number;
  };
}

export interface PaymentInvoice {
  title: string;
  description: string;
  payload: string;
  provider_token: string;
  currency: string;
  prices: Array<{
    label: string;
    amount: number;
  }>;
  start_parameter?: string;
  photo_url?: string;
  photo_size?: number;
  photo_width?: number;
  photo_height?: number;
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;
  send_phone_number_to_provider?: boolean;
  send_email_to_provider?: boolean;
  is_flexible?: boolean;
}

export interface PaymentPayload {
  type: string;
  duration?: string;
}

export interface WebhookConfig {
  url: string;
  allowed_updates: string[];
  drop_pending_updates: boolean;
  max_connections?: number;
  secret_token?: string;
}

export interface WebhookStatus {
  webhook: any;
  local: {
    webhookUrl: string | null;
    ngrokUrl: string | null;
    serverRunning: boolean;
  };
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  webhook: string | null;
  ngrok: string | null;
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  };
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PerformanceMetrics {
  requests: number;
  totalTime: number;
  errors: number;
  memoryBefore: number;
  memoryAfter: number;
  avgResponseTime: number;
  requestsPerSecond: number;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>
  >;
}

export interface TelegramReplyKeyboard {
  keyboard: Array<
    Array<{
      text: string;
    }>
  >;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

export interface CallbackData {
  action: string;
  t_id?: string;
  idx?: number;
  user_id?: number;
  [key: string]: any;
}

export interface OpenAIThread {
  id: string;
  object: string;
  created_at: number;
  metadata: Record<string, any>;
}

export interface OpenAIMessage {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  role: 'user' | 'assistant';
  content: Array<{
    type: string;
    text: {
      value: string;
      annotations: any[];
    };
  }>;
  file_ids: string[];
  assistant_id?: string;
  run_id?: string;
  metadata: Record<string, any>;
}

export interface OpenAIRun {
  id: string;
  object: string;
  created_at: number;
  assistant_id: string;
  thread_id: string;
  status:
    | 'queued'
    | 'in_progress'
    | 'requires_action'
    | 'cancelling'
    | 'cancelled'
    | 'failed'
    | 'completed'
    | 'expired';
  started_at?: number;
  expires_at?: number;
  cancelled_at?: number;
  failed_at?: number;
  completed_at?: number;
  last_error?: {
    code: string;
    message: string;
  };
  model: string;
  instructions?: string;
  tools: any[];
  file_ids: string[];
  metadata: Record<string, any>;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
}

export interface ImageAnalysisResponse {
  content: string;
  confidence?: number;
  detected_objects?: string[];
}

export interface ConfigOptions {
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
}

export type RequestType = 'text_req_left' | 'image_req_left' | 'video_req_left';

export type ProcessingMode = 'fast' | 'turbo' | 'relax';

export type AspectRatio =
  | '1:1'
  | '1:2'
  | '2:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9'
  | '9:21';

export type VideoResolution = '480p' | '720p' | '1080p';

export type BotMode = 'txt' | 'photo' | 'video';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'staged';

export type PaymentMode = 'public' | 'private';

export interface ModelResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export interface FastifyRouteOptions {
  schema?: {
    description?: string;
    tags?: string[];
    params?: Record<string, any>;
    body?: Record<string, any>;
    response?: Record<number, Record<string, any>>;
  };
  config?: ConfigOptions;
}

export interface LogContext {
  update?: any;
  error?: any;
  processingTime?: number;
  url?: string;
  ip?: string;
  responseTime?: number;
}

export interface NgrokConfig {
  addr: number;
  region?: string;
  authtoken?: string;
}

export interface ServerConfig {
  port: number;
  host?: string;
  logger?: {
    level: string;
    prettyPrint?: boolean;
  };
  trustProxy?: boolean;
  bodyLimit?: number;
}
