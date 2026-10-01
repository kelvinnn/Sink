CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`actor_email` text NOT NULL,
	`actor_role` text NOT NULL,
	`auth_method` text NOT NULL,
	`ip` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`target_label` text,
	`before` text,
	`after` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `activity_ts_idx` ON `activity` (`ts`);--> statement-breakpoint
CREATE INDEX `activity_target_idx` ON `activity` (`target_type`,`target_id`,`ts`);--> statement-breakpoint
CREATE INDEX `activity_label_idx` ON `activity` (`target_type`,`target_label`,`ts`);--> statement-breakpoint
CREATE INDEX `activity_actor_idx` ON `activity` (`actor_email`,`ts`);--> statement-breakpoint
CREATE TABLE `link_locks` (
	`link_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`locked_by` text NOT NULL,
	`locked_at` integer NOT NULL,
	`expires_at` integer,
	`reason` text
);
--> statement-breakpoint
CREATE INDEX `link_locks_slug_idx` ON `link_locks` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	`updated_by` text
);
