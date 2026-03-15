-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "flagReasons" TEXT[],
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false;
