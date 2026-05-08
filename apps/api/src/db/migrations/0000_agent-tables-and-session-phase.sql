CREATE TABLE "agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"phase" text NOT NULL,
	"step_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"sequence" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_answer" jsonb NOT NULL,
	"is_correct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"dimension_id" text NOT NULL,
	"idx" integer NOT NULL,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" jsonb NOT NULL,
	"difficulty" text NOT NULL,
	"explanation" text,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"overall_score" integer NOT NULL,
	"mastery_label" text NOT NULL,
	"dimensions" jsonb NOT NULL,
	"weakness_top3" jsonb NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"phase" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'input' NOT NULL,
	"workflow_phase" text DEFAULT 'clarify' NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"raw_topic" text NOT NULL,
	"refined_topic" text,
	"dimensions" jsonb,
	"total_questions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"stream_cursor" bigint DEFAULT 1 NOT NULL,
	"summary" text NOT NULL,
	"client_visible_seq" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_checkpoints" ADD CONSTRAINT "stream_checkpoints_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_steps_session_sequence_uidx" ON "agent_steps" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "agent_steps_session_seq_idx" ON "agent_steps" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "session_messages_session_created_idx" ON "session_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "session_messages_session_phase_idx" ON "session_messages" USING btree ("session_id","phase");--> statement-breakpoint
CREATE INDEX "sessions_owner_created_idx" ON "sessions" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "stream_ckpt_session_phase_created_idx" ON "stream_checkpoints" USING btree ("session_id","phase","created_at");