-- AlterTable
ALTER TABLE "Bot" ADD COLUMN "knowledgeSource" TEXT NOT NULL DEFAULT 'ai',
ADD COLUMN "judgeKnowledgeSource" TEXT NOT NULL DEFAULT 'ai';

-- AlterTable
ALTER TABLE "BotStyle" ADD COLUMN "knowledgeSource" TEXT NOT NULL DEFAULT 'default';
