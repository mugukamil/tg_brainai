import type {
  Chat,
  PhotoSize,
  Voice,
  VideoNote,
  Document,
  Animation,
  Video,
  Sticker,
  Audio,
  Contact,
  Location,
  Venue,
  Poll,
  Dice,
  MessageEntity,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  ForceReply,
  SuccessfulPayment,
  Invoice,
  PassportData,
  Game,
  LanguageCode,
} from '@telegram.ts/types';

// Enhanced Telegram message type with all commonly used fields
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: Chat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: Chat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  is_automatic_forward?: boolean;
  reply_to_message?: TelegramMessage;
  via_bot?: TelegramUser;
  edit_date?: number;
  has_protected_content?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: MessageEntity[];
  animation?: Animation;
  audio?: Audio;
  document?: Document;
  photo?: PhotoSize[];
  sticker?: Sticker;
  video?: Video;
  video_note?: VideoNote;
  voice?: Voice;
  caption?: string;
  caption_entities?: MessageEntity[];
  contact?: Contact;
  dice?: Dice;
  game?: Game;
  poll?: Poll;
  venue?: Venue;
  location?: Location;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  new_chat_title?: string;
  new_chat_photo?: PhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  message_auto_delete_timer_changed?: Record<string, unknown>;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: TelegramMessage;
  invoice?: Invoice;
  successful_payment?: SuccessfulPayment;
  connected_website?: string;
  passport_data?: PassportData;
  proximity_alert_triggered?: Record<string, unknown>;
  video_chat_scheduled?: Record<string, unknown>;
  video_chat_started?: Record<string, unknown>;
  video_chat_ended?: Record<string, unknown>;
  video_chat_participants_invited?: Record<string, unknown>;
  web_app_data?: Record<string, unknown>;
  reply_markup?: InlineKeyboardMarkup;
}

// Enhanced user type
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: LanguageCode;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

// Enhanced chat type
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo?: Record<string, unknown>; // ChatPhoto type
  bio?: string;
  has_private_forwards?: boolean;
  has_restricted_voice_and_video_messages?: boolean;
  join_to_send_messages?: boolean;
  join_by_request?: boolean;
  description?: string;
  invite_link?: string;
  pinned_message?: TelegramMessage;
  permissions?: Record<string, unknown>; // ChatPermissions type
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  has_protected_content?: boolean;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  linked_chat_id?: number;
  location?: Record<string, unknown>; // ChatLocation type
}

// Enhanced callback query type
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

// Enhanced pre-checkout query type
export interface TelegramPreCheckoutQuery {
  id: string;
  from: TelegramUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: Record<string, unknown>; // OrderInfo type
}

// Bot send options interface
export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: MessageEntity[];
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  protect_content?: boolean;
  reply_to_message_id?: number;
  allow_sending_without_reply?: boolean;
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
}

export interface SendPhotoOptions extends SendMessageOptions {
  caption?: string;
  caption_entities?: MessageEntity[];
  has_spoiler?: boolean;
}

export interface SendVideoOptions extends SendPhotoOptions {
  duration?: number;
  width?: number;
  height?: number;
  thumb?: string | Buffer; // InputFile | string
  supports_streaming?: boolean;
}

export interface SendAnimationOptions extends SendVideoOptions {
  // Inherits all video options
}

export interface SendDocumentOptions extends SendMessageOptions {
  thumb?: string | Buffer; // InputFile | string
  caption?: string;
  caption_entities?: MessageEntity[];
  disable_content_type_detection?: boolean;
}

export interface EditMessageTextOptions {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: MessageEntity[];
  disable_web_page_preview?: boolean;
  reply_markup?: InlineKeyboardMarkup;
}

export interface FileOptions {
  filename?: string;
  contentType?: string;
}

// Update type that encompasses all possible updates
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: Record<string, unknown>; // InlineQuery type
  chosen_inline_result?: Record<string, unknown>; // ChosenInlineResult type
  callback_query?: TelegramCallbackQuery;
  shipping_query?: Record<string, unknown>; // ShippingQuery type
  pre_checkout_query?: TelegramPreCheckoutQuery;
  poll?: Poll;
  poll_answer?: Record<string, unknown>; // PollAnswer type
  my_chat_member?: Record<string, unknown>; // ChatMemberUpdated type
  chat_member?: Record<string, unknown>; // ChatMemberUpdated type
  chat_join_request?: Record<string, unknown>; // ChatJoinRequest type
}

// Webhook handler types
export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

// Bot response types
export interface BotResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

// File info type
export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

// Common inline keyboard button
export interface InlineKeyboardButton {
  text: string;
  url?: string;
  login_url?: Record<string, unknown>;
  callback_data?: string;
  web_app?: Record<string, unknown>;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  switch_inline_query_chosen_chat?: Record<string, unknown>;
  callback_game?: Record<string, unknown>;
  pay?: boolean;
}

// Common reply keyboard button
export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: Record<string, unknown>;
  web_app?: Record<string, unknown>;
}

// Chat action types
export type ChatAction =
  | 'typing'
  | 'upload_photo'
  | 'record_video'
  | 'upload_video'
  | 'record_voice'
  | 'upload_voice'
  | 'upload_document'
  | 'choose_sticker'
  | 'find_location'
  | 'record_video_note'
  | 'upload_video_note';

// Input media types for media groups
export interface InputMediaPhoto {
  type: 'photo';
  media: string | Buffer;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  has_spoiler?: boolean;
}

export interface InputMediaVideo {
  type: 'video';
  media: string | Buffer;
  thumb?: string | Buffer;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  width?: number;
  height?: number;
  duration?: number;
  supports_streaming?: boolean;
  has_spoiler?: boolean;
}

export interface InputMediaAnimation {
  type: 'animation';
  media: string | Buffer;
  thumb?: string | Buffer;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  width?: number;
  height?: number;
  duration?: number;
  has_spoiler?: boolean;
}

export interface InputMediaAudio {
  type: 'audio';
  media: string | Buffer;
  thumb?: string | Buffer;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  duration?: number;
  performer?: string;
  title?: string;
}

export interface InputMediaDocument {
  type: 'document';
  media: string | Buffer;
  thumb?: string | Buffer;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  disable_content_type_detection?: boolean;
}

export type InputMedia =
  | InputMediaPhoto
  | InputMediaVideo
  | InputMediaAnimation
  | InputMediaAudio
  | InputMediaDocument;

// Error response interface
export interface TelegramError extends Error {
  code?: number;
  response?: {
    statusCode?: number;
    body?: unknown;
  };
  on_retry?: boolean;
}

// Type guards for checking message types
export function hasText(msg: TelegramMessage): msg is TelegramMessage & { text: string } {
  return typeof msg.text === 'string' && msg.text.length > 0;
}

export function hasPhoto(msg: TelegramMessage): msg is TelegramMessage & { photo: PhotoSize[] } {
  return Array.isArray(msg.photo) && msg.photo.length > 0;
}

export function hasVoice(msg: TelegramMessage): msg is TelegramMessage & { voice: Voice } {
  return msg.voice !== undefined;
}

export function hasVideo(msg: TelegramMessage): msg is TelegramMessage & { video: Video } {
  return msg.video !== undefined;
}

export function hasDocument(msg: TelegramMessage): msg is TelegramMessage & { document: Document } {
  return msg.document !== undefined;
}

export function hasCaption(msg: TelegramMessage): msg is TelegramMessage & { caption: string } {
  return typeof msg.caption === 'string' && msg.caption.length > 0;
}

export function isPrivateChat(chat: TelegramChat): boolean {
  return chat.type === 'private';
}

export function isGroupChat(chat: TelegramChat): boolean {
  return chat.type === 'group' || chat.type === 'supergroup';
}

export function isChannelChat(chat: TelegramChat): boolean {
  return chat.type === 'channel';
}
