-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."gpt_tg_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "telegram_id" BIGINT,
    "openai_thread_id" TEXT,
    "text_req_left" INTEGER NOT NULL DEFAULT 15,
    "image_req_left" INTEGER NOT NULL DEFAULT 3,
    "video_req_left" INTEGER NOT NULL DEFAULT 3,
    "accepted_terms" BOOLEAN DEFAULT false,
    "current_mode" TEXT NOT NULL DEFAULT 'text',
    "is_premium" BOOLEAN DEFAULT false,
    "premium_end_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "premium_started_at" TIMESTAMPTZ(6),
    "free_period_start" DATE,
    "image_provider" VARCHAR(10) DEFAULT 'goapi',

    CONSTRAINT "gpt_tg_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telegram_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    "telegram_id" BIGINT,
    "openai_thread_id" TEXT,

    CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_quotas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "text_used" INTEGER NOT NULL DEFAULT 0,
    "image_used" INTEGER NOT NULL DEFAULT 0,
    "video_used" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_gpt_tg_users_telegram_id" ON "public"."gpt_tg_users"("telegram_id");

-- CreateIndex
CREATE INDEX "idx_user_quotas_period_start" ON "public"."user_quotas"("period_start");

-- CreateIndex
CREATE INDEX "idx_user_quotas_user_id_period_start" ON "public"."user_quotas"("user_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "user_quotas_user_id_period_start_key" ON "public"."user_quotas"("user_id", "period_start");

-- AddForeignKey
ALTER TABLE "public"."user_quotas" ADD CONSTRAINT "user_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."gpt_tg_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

