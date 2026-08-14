-- CreateTable
CREATE TABLE "parents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birth_year" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_consents" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "consent_version" TEXT NOT NULL,
    "verification_method" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ,

    CONSTRAINT "child_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topics" TEXT[],
    "estimated_minutes" SMALLINT,
    "thumbnail_url" TEXT,
    "post_activity_config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_scenes" (
    "id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "scene_order" SMALLINT NOT NULL,
    "scene_type" TEXT NOT NULL,
    "image_url" TEXT,
    "scene_description" TEXT,
    "conflict" TEXT,
    "character_name" TEXT,
    "character_opening" TEXT,
    "character_closing" TEXT,
    "scene_goal" TEXT,
    "required_elements" TEXT[],
    "preferred_turns" SMALLINT,
    "max_turns" SMALLINT,

    CONSTRAINT "story_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_sessions" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "current_scene_id" UUID,
    "current_child_turn_count" SMALLINT NOT NULL DEFAULT 0,
    "accumulated_elements" TEXT[],
    "last_detected_elements" TEXT[],
    "last_response_mode" TEXT,
    "last_guidance_target" TEXT,
    "turns_without_new_element" SMALLINT NOT NULL DEFAULT 0,
    "consecutive_low_information_turns" SMALLINT NOT NULL DEFAULT 0,
    "scene_goal_met" BOOLEAN NOT NULL DEFAULT false,
    "scene_end_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "scene_id" UUID NOT NULL,
    "speaker_type" TEXT NOT NULL,
    "turn_order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "stt_raw_text" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utterance_analyses" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "child_intent" TEXT NOT NULL,
    "main_point" TEXT,
    "detected_elements" JSONB NOT NULL,
    "utterance_validity" TEXT NOT NULL,
    "analysis_version" TEXT NOT NULL DEFAULT 'mvp_v1',

    CONSTRAINT "utterance_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_activity_results" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "submitted_order" TEXT[],
    "is_order_correct" BOOLEAN,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "retelling_text" TEXT,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "post_activity_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_scenes_story_id_scene_order_key" ON "story_scenes"("story_id", "scene_order");

-- CreateIndex
CREATE UNIQUE INDEX "utterance_analyses_message_id_key" ON "utterance_analyses"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_activity_results_session_id_key" ON "post_activity_results"("session_id");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_consents" ADD CONSTRAINT "child_consents_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_scenes" ADD CONSTRAINT "story_scenes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sessions" ADD CONSTRAINT "story_sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sessions" ADD CONSTRAINT "story_sessions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sessions" ADD CONSTRAINT "story_sessions_current_scene_id_fkey" FOREIGN KEY ("current_scene_id") REFERENCES "story_scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "story_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "story_scenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utterance_analyses" ADD CONSTRAINT "utterance_analyses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_activity_results" ADD CONSTRAINT "post_activity_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "story_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
