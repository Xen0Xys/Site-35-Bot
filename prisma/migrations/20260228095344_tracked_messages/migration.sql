-- CreateEnum
CREATE TYPE "message_types" AS ENUM ('STATUS');

-- CreateTable
CREATE TABLE "tracked_messages" (
    "message_id" BIGINT NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "type" "message_types" NOT NULL,

    CONSTRAINT "tracked_messages_pkey" PRIMARY KEY ("message_id","channel_id")
);
