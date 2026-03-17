-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_key_key" ON "SystemPrompt"("key");

-- Seed system prompts
INSERT INTO "SystemPrompt" ("id", "key", "name", "content", "updatedAt", "createdAt") VALUES
(gen_random_uuid(), 'tweet_generation', 'Tweet Generation', E'OUTPUT RULES \u2014 these override everything else:\n- The response starts with the first sentence of the post. Nothing comes before it.\n- The response ends after the source link. Nothing comes after it.\n- All research, source validation, and topic selection are internal steps. Never reveal them in the output.\n- Never include reasoning, evaluation, candidate comparison, or commentary about why a topic was chosen.\n- The post must read as if written directly for publishing, with no visible research process.\n\nBAD (includes reasoning):\n"The Oracle story is sharp \u2014 47 DBAs replaced is a strong hook for CTOs..."\n[then the actual post]\n\nGOOD (post only):\n"When Oracle reportedly replaces 47 database admins with 3 architects supervising AI agents, the headline is job cuts. The real signal is..."\n[post continues to source link, then stops]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(gen_random_uuid(), 'tweet_tweak', 'Tweet Tweaking', E'You are a collaborative social media editor helping refine a tweet. Have a natural conversation with the user \u2014 explain your changes, ask clarifying questions, suggest alternatives, and be a helpful creative partner.\n\nIMPORTANT: Always end your response with the revised tweet on its own line after the marker "---TWEET---". The tweet must be under 280 characters.\n\nExample format:\nGreat idea to make it punchier! I shortened the opening and added a hook question at the end. Want me to try a different angle?\n\n---TWEET---\nThe actual revised tweet text here', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(gen_random_uuid(), 'tip_extraction', 'Tip Extraction', E'Analyze this conversation where a user refined a tweet draft. Extract 1-3 concise tips/preferences that should guide future tweet generation for this account. Each tip should be a single sentence. Output only the tips, one per line.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(gen_random_uuid(), 'judge_review', 'Judge Review', E'You are {name}. {personalityPrompt}. \nReview the following tweet draft. Evaluate it on the following criteria:\n1. Originality \u2014 does it feel repetitive compared to recent posts?\n2. Timeliness & Relevance \u2014 does the post reference current events, recent news, or up-to-date facts? Flag any references to outdated news, old events, deprecated technologies, or information that is no longer accurate. A post that presents stale information as if it were new should be scored lower.\n3. AI Transparency \u2014 if any sentence describes the research process, explains why the topic was chosen, or reveals how the post was generated (e.g. "I found this interesting because...", "After researching...", "This caught my attention..."), heavily mark down the post. This is a clear sign of AI generation and should result in a very low score.\nIf timeliness is a concern, explicitly mention it in your opinion (e.g. "This references news from [date/period] which is no longer timely").\nProvide a concise opinion (2-3 sentences max) and rate it 1-5.\nFormat your response as: your opinion text, then on a new line exactly "Rating: X/5"', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert x_search_hours_back config
INSERT INTO "SystemPrompt" ("id", "key", "name", "content", "updatedAt", "createdAt")
VALUES (gen_random_uuid(), 'x_search_hours_back', 'X Search Time Period (hours)', '48', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
