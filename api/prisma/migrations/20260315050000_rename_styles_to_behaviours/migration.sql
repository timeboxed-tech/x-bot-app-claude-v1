-- Rename BotStyle table to BotBehaviour
ALTER TABLE "BotStyle" RENAME TO "BotBehaviour";

-- Add weight column
ALTER TABLE "BotBehaviour" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 0;

-- Rename style columns on Post
ALTER TABLE "Post" RENAME COLUMN "stylePrompt" TO "behaviourPrompt";
ALTER TABLE "Post" RENAME COLUMN "styleTitle" TO "behaviourTitle";
