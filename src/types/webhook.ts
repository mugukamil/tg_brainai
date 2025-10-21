import type { TelegramUpdate, WebhookInfo } from './telegram.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { BaseError, ApiError, WebhookError } from './errors.js';

// Webhook configuration interface
export interface WebhookConfig {
  url: string;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
  max_connections?: number;
  secret_token?: string;
  ip_address?: string;
}

// Local server configuration
export interface LocalServerConfig {
  port: number;
  host?: string;
  prefix?: string;
  cors?: {
    origin?: boolean | string | string[];
    credentials?: boolean;
  };
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
}

// Ngrok configuration
export interface NgrokConfig {
  addr: number;
  region?: 'us' | 'eu' | 'au' | 'ap' | 'sa' | 'jp' | 'in';
  authtoken?: string;
  subdomain?: string;
  hostname?: string;
  proto?: 'http' | 'tcp' | 'tls';
}

// Webhook status response
export interface WebhookStatus {
  webhook?: WebhookInfo;
  local?: LocalWebhookInfo;
  error?: string;
}

// Local webhook information
export interface LocalWebhookInfo {
  webhookUrl: string | null;
  ngrokUrl: string | null;
  serverRunning: boolean;
  port?: number;
  host?: string;
}

// Webhook handler interface
export interface IWebhookHandler {
  startServer(port?: number): Promise<string>;
  stopServer(): Promise<void>;
  getStatus(): Promise<WebhookStatus>;
  isServerRunning(): boolean;
  getWebhookUrl(): string | null;
  getNgrokUrl(): string | null;
}

// Webhook route handler types
export type WebhookRouteHandler = (
  request: FastifyRequest<{
    Body: TelegramUpdate;
    Params: Record<string, string>;
    Querystring: Record<string, string>;
  }>,
  reply: FastifyReply,
) => Promise<void>;

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  webhook: string | null;
  ngrok: string | null;
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
    arrayBuffers: string;
  };
  version: string;
  processedUpdates?: number;
  errors?: number;
}

// Webhook server options
export interface WebhookServerOptions {
  port: number;
  host?: string;
  prefix?: string;
  webhookPath?: string;
  healthPath?: string;
  enableCors?: boolean;
  enableRateLimit?: boolean;
  rateLimitConfig?: {
    max: number;
    timeWindow: string;
  };
  enableHelmet?: boolean;
  trustProxy?: boolean;
  bodyLimit?: number;
  logger?:
    | boolean
    | {
        level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
        prettyPrint?: boolean;
      };
}

// Webhook processing result
export interface WebhookProcessingResult {
  success: boolean;
  updateId?: number;
  processingTime?: number;
  error?: WebhookError | BaseError;
}

// Update processor interface
export interface UpdateProcessor {
  processUpdate(update: TelegramUpdate): Promise<WebhookProcessingResult>;
  canProcess(update: TelegramUpdate): boolean;
  getProcessorName(): string;
}

// Webhook middleware types
export type WebhookMiddleware = (
  request: FastifyRequest,
  reply: FastifyReply,
  next: () => void,
) => void | Promise<void>;

// Server metrics
export interface ServerMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  updates: {
    processed: number;
    failed: number;
    duplicates: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  uptime: number;
  startTime: Date;
}

// Webhook event types
export type WebhookEventType =
  | 'server_started'
  | 'server_stopped'
  | 'webhook_set'
  | 'webhook_deleted'
  | 'ngrok_connected'
  | 'ngrok_disconnected'
  | 'update_received'
  | 'update_processed'
  | 'update_failed'
  | 'error_occurred';

// Webhook event handler
export type WebhookEventHandler<T = any> = (eventType: WebhookEventType, data?: T) => void;

// Webhook validation result
export interface WebhookValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Request context for webhook processing
export interface WebhookRequestContext {
  requestId: string;
  timestamp: Date;
  ip: string;
  userAgent?: string;
  contentLength?: number;
  headers: Record<string, string>;
}

// Response context for webhook processing
export interface WebhookResponseContext {
  requestId: string;
  statusCode: number;
  responseTime: number;
  error?: WebhookError | ApiError | BaseError;
  cached?: boolean;
}

// Webhook cache configuration
export interface WebhookCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cached items
  keyGenerator?: (update: TelegramUpdate) => string;
}

// Development webhook configuration
export interface DevWebhookConfig extends WebhookServerOptions {
  ngrok?: NgrokConfig;
  autoRestart?: boolean;
  watchFiles?: string[];
  env?: 'development' | 'staging' | 'production';
  debugWebhook?: boolean;
}

// Webhook statistics
export interface WebhookStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  updatesProcessed: number;
  duplicatesIgnored: number;
  errorsEncountered: number;
  uptimeSeconds: number;
}
