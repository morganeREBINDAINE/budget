-- 12 catégories : positions 1 à 12 (la migration Supabase crée les positions 10 à 12 des comptes existants).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "categories_position_range" CHECK("__new_categories"."position" BETWEEN 1 AND 12),
	CONSTRAINT "categories_name_not_empty" CHECK(length(trim("__new_categories"."name")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "user_id", "name", "color", "icon", "position", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "name", "color", "icon", "position", "created_at", "updated_at", "deleted_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_position_unique` ON `categories` (`user_id`,`position`);--> statement-breakpoint
CREATE INDEX `categories_user_updated_idx` ON `categories` (`user_id`,`updated_at`);