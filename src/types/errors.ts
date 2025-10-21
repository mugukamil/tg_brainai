// Base error interface
export interface BaseError extends Error {
  code?: string | number;
  statusCode?: number;
  timestamp?: Date;
  context?: Record<string, any>;
  retryable?: boolean;
  cause?: Error;
}

// API Response error interface
export interface ApiError extends BaseError {
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestId?: string;
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
    headers?: Record<string, string>;
  };
  request?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    data?: unknown;
  };
}

// Telegram Bot API error
export interface TelegramBotError extends ApiError {
  error_code?: number;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

// Database operation error
export interface DatabaseError extends BaseError {
  table?: string;
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  query?: string;
  constraint?: string;
  detail?: string;
}

// Supabase specific error
export interface SupabaseError extends DatabaseError {
  hint?: string;
  details?: string;
  code?: string;
}

// Authentication/Authorization error
export interface AuthError extends BaseError {
  userId?: number;
  chatId?: number;
  requiredPermission?: string;
  currentPermissions?: string[];
}

// Rate limiting error
export interface RateLimitError extends BaseError {
  limit: number;
  windowMs: number;
  remaining: number;
  resetTime: Date;
  userId?: number;
  endpoint?: string;
}

// File processing error
export interface FileProcessingError extends BaseError {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  operation?: 'upload' | 'download' | 'convert' | 'validate' | 'process';
  expectedFormat?: string;
  actualFormat?: string;
}

// Image generation error
export interface ImageGenerationError extends ApiError {
  prompt?: string;
  provider?: 'goapi' | 'fal-ai' | 'openai';
  taskId?: string;
  parameters?: Record<string, any>;
}

// Video generation error
export interface VideoGenerationError extends ApiError {
  prompt?: string;
  imageUrl?: string;
  provider?: 'fal-ai' | 'goapi';
  taskId?: string;
  duration?: number;
  resolution?: string;
}

// Payment processing error
export interface PaymentError extends BaseError {
  paymentId?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  userId?: number;
  invoicePayload?: string;
}

// Webhook processing error
export interface WebhookError extends BaseError {
  updateId?: number;
  webhookUrl?: string;
  requestId?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// OpenAI API error
export interface OpenAIError extends ApiError {
  type?: 'invalid_request_error' | 'rate_limit_exceeded' | 'api_error' | 'overloaded_error';
  param?: string;
  details?: string;
}

// FAL AI error
export interface FalAIError extends ApiError {
  requestId?: string;
  taskId?: string;
  detail?: string;
  logs?: string[];
}

// GoAPI error
export interface GoAPIError extends ApiError {
  taskId?: string;
  detail?: unknown;
  logs?: unknown[];
}

// Configuration error
export interface ConfigError extends BaseError {
  configKey?: string;
  expectedType?: string;
  actualValue?: unknown;
  validValues?: unknown[];
}

// Validation error
export interface ValidationError extends BaseError {
  field?: string;
  value?: unknown;
  constraint?: string;
  validationRules?: string[];
}

// Network error
export interface NetworkError extends BaseError {
  url?: string;
  timeout?: number;
  connectionAttempts?: number;
  lastAttemptTime?: Date;
}

// Business logic error
export interface BusinessLogicError extends BaseError {
  operation?: string;
  requirements?: string[];
  currentState?: Record<string, any>;
}

// Quota exceeded error
export interface QuotaExceededError extends BaseError {
  quotaType: 'text_req_left' | 'image_req_left' | 'video_req_left';
  currentUsage: number;
  limit: number;
  resetDate?: Date;
  userId: number;
}

// External service error
export interface ExternalServiceError extends ApiError {
  service: 'telegram' | 'openai' | 'fal-ai' | 'goapi' | 'supabase' | 'ngrok';
  isTemporary?: boolean;
  retryAfter?: number;
}

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory =
  | 'api'
  | 'database'
  | 'auth'
  | 'rate_limit'
  | 'file'
  | 'payment'
  | 'webhook'
  | 'config'
  | 'validation'
  | 'network'
  | 'business'
  | 'quota'
  | 'external';

// Enhanced error interface with metadata
export interface EnhancedError extends BaseError {
  id: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  userId?: number;
  chatId?: number;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  stack?: string;
  innerError?: Error;
  correlationId?: string;
}

// Error handler result
export interface ErrorHandlerResult {
  handled: boolean;
  shouldRetry: boolean;
  retryAfter?: number;
  userMessage?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  additionalContext?: Record<string, any>;
}

// Error context for logging
export interface ErrorContext {
  userId?: number;
  chatId?: number;
  messageId?: number;
  updateId?: number;
  endpoint?: string;
  operation?: string;
  duration?: number;
  memoryUsage?: number;
  timestamp: Date;
  environment: 'development' | 'staging' | 'production';
  version: string;
}

// Error recovery strategies
export type ErrorRecoveryStrategy =
  | 'retry'
  | 'fallback'
  | 'ignore'
  | 'notify_user'
  | 'escalate'
  | 'circuit_breaker';

// Error recovery options
export interface ErrorRecoveryOptions {
  strategy: ErrorRecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  fallbackFunction?: () => Promise<unknown>;
  userNotification?: string;
  escalationThreshold?: number;
}

// Type guards for error identification
export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && error !== null && 'endpoint' in error);
}

export function isTelegramBotError(error: unknown): error is TelegramBotError {
  return Boolean(error && typeof error === 'object' && error !== null && 'error_code' in error);
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return Boolean(
    error && typeof error === 'object' && error !== null && ('table' in error || 'query' in error),
  );
}

export function isSupabaseError(error: unknown): error is SupabaseError {
  return Boolean(
    isDatabaseError(error) && typeof error === 'object' && error !== null && 'hint' in error,
  );
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return Boolean(
    error && typeof error === 'object' && error !== null && 'limit' in error && 'windowMs' in error,
  );
}

export function isQuotaExceededError(error: unknown): error is QuotaExceededError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      error !== null &&
      'quotaType' in error &&
      'currentUsage' in error,
  );
}

export function isValidationError(error: unknown): error is ValidationError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      error !== null &&
      ('field' in error || 'validationRules' in error),
  );
}

export function isNetworkError(error: unknown): error is NetworkError {
  return Boolean(
    error && typeof error === 'object' && error !== null && ('url' in error || 'timeout' in error),
  );
}

export function isRetryableError(error: BaseError): boolean {
  return Boolean(
    error.retryable === true ||
      isNetworkError(error) ||
      (isApiError(error) && error.response?.status !== undefined && error.response.status >= 500),
  );
}

// Error factory functions
export function createApiError(
  message: string,
  endpoint?: string,
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
    headers?: Record<string, string>;
  },
  options?: Partial<ApiError>,
): ApiError {
  return {
    name: 'ApiError',
    message,
    endpoint,
    response,
    timestamp: new Date(),
    retryable: response?.status !== undefined && response.status >= 500,
    ...options,
  };
}

export function createValidationError(
  message: string,
  field?: string,
  value?: unknown,
  options?: Partial<ValidationError>,
): ValidationError {
  const baseError: ValidationError = {
    name: 'ValidationError',
    message,
    timestamp: new Date(),
    retryable: false,
    ...options,
  };

  if (field !== undefined) {
    baseError.field = field;
  }

  if (value !== undefined) {
    baseError.value = value;
  }

  return baseError;
}

export function createQuotaExceededError(
  quotaType: QuotaExceededError['quotaType'],
  currentUsage: number,
  limit: number,
  userId: number,
  options?: Partial<QuotaExceededError>,
): QuotaExceededError {
  return {
    name: 'QuotaExceededError',
    message: `Quota exceeded for ${quotaType}: ${currentUsage}/${limit}`,
    quotaType,
    currentUsage,
    limit,
    userId,
    timestamp: new Date(),
    retryable: false,
    ...options,
  };
}
