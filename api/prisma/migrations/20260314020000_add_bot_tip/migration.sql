-- CreateTable
CREATE TABLE "BotTip" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotTip_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BotTip" ADD CONSTRAINT "BotTip_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
