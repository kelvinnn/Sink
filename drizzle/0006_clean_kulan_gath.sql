CREATE TABLE `clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`link_id` text,
	`slug` text NOT NULL,
	`tags` text,
	`destination` text,
	`served` text,
	`ip` text,
	`ip_v4` integer,
	`ip_v6` text,
	`asn` integer,
	`as_org` text,
	`network_type` text,
	`country` text,
	`region` text,
	`city` text,
	`postal_code` text,
	`latitude` real,
	`longitude` real,
	`timezone` text,
	`colo` text,
	`ua` text,
	`browser` text,
	`browser_version` text,
	`os` text,
	`os_version` text,
	`device_type` text,
	`device_vendor` text,
	`device_model` text,
	`in_app` text,
	`language` text,
	`referer` text,
	`referer_host` text,
	`query` text,
	`source` text,
	`visitor_id` text,
	`new_visitor` integer,
	`is_bot` integer DEFAULT false NOT NULL,
	`bot_reason` text,
	`known_ip_id` integer,
	`known_ip_label` text,
	`known_ip_exclude` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clicks_ts_idx` ON `clicks` (`ts`);--> statement-breakpoint
CREATE INDEX `clicks_slug_ts_idx` ON `clicks` (`slug`,`ts`);--> statement-breakpoint
CREATE INDEX `clicks_ip_idx` ON `clicks` (`ip`);--> statement-breakpoint
CREATE INDEX `clicks_ip_v4_idx` ON `clicks` (`ip_v4`);--> statement-breakpoint
CREATE INDEX `clicks_visitor_id_idx` ON `clicks` (`visitor_id`);--> statement-breakpoint
CREATE TABLE `known_ips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cidr` text NOT NULL,
	`label` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`exclude` integer DEFAULT true NOT NULL,
	`note` text,
	`v4_start` integer,
	`v4_end` integer,
	`v6_prefix` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `known_ips_cidr_unique` ON `known_ips` (`cidr`);