CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "categories_position_range" CHECK("categories"."position" BETWEEN 1 AND 9),
	CONSTRAINT "categories_name_not_empty" CHECK(length(trim("categories"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_position_unique` ON `categories` (`user_id`,`position`);--> statement-breakpoint
CREATE INDEX `categories_user_updated_idx` ON `categories` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `debt_people` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "debt_people_name_not_empty" CHECK(length(trim("debt_people"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `debt_people_user_name_unique` ON `debt_people` (`user_id`,lower("name"));--> statement-breakpoint
CREATE INDEX `debt_people_user_updated_idx` ON `debt_people` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `debt_repayments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`debt_id` text NOT NULL,
	`amount_da` integer NOT NULL,
	`currency` text NOT NULL,
	`original_amount_cents` integer,
	`eur_rate` real,
	`date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "debt_repayments_amount_positive" CHECK("debt_repayments"."amount_da" > 0),
	CONSTRAINT "debt_repayments_eur_fields" CHECK(("debt_repayments"."currency" = 'DZD' AND "debt_repayments"."original_amount_cents" IS NULL AND "debt_repayments"."eur_rate" IS NULL)
      OR ("debt_repayments"."currency" = 'EUR' AND "debt_repayments"."original_amount_cents" IS NOT NULL AND "debt_repayments"."original_amount_cents" > 0
        AND "debt_repayments"."eur_rate" IS NOT NULL AND "debt_repayments"."eur_rate" > 0))
);
--> statement-breakpoint
CREATE INDEX `debt_repayments_debt_idx` ON `debt_repayments` (`debt_id`);--> statement-breakpoint
CREATE INDEX `debt_repayments_user_updated_idx` ON `debt_repayments` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`direction` text NOT NULL,
	`person_id` text NOT NULL,
	`amount_da` integer NOT NULL,
	`currency` text NOT NULL,
	`original_amount_cents` integer,
	`eur_rate` real,
	`date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "debts_amount_positive" CHECK("debts"."amount_da" > 0),
	CONSTRAINT "debts_eur_fields" CHECK(("debts"."currency" = 'DZD' AND "debts"."original_amount_cents" IS NULL AND "debts"."eur_rate" IS NULL)
      OR ("debts"."currency" = 'EUR' AND "debts"."original_amount_cents" IS NOT NULL AND "debts"."original_amount_cents" > 0
        AND "debts"."eur_rate" IS NOT NULL AND "debts"."eur_rate" > 0))
);
--> statement-breakpoint
CREATE INDEX `debts_user_direction_idx` ON `debts` (`user_id`,`direction`);--> statement-breakpoint
CREATE INDEX `debts_user_updated_idx` ON `debts` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `debts_person_idx` ON `debts` (`person_id`);--> statement-breakpoint
CREATE TABLE `recurring_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recurring_payment_id` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_occurrences_payment_due_unique` ON `recurring_occurrences` (`recurring_payment_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `recurring_occurrences_user_updated_idx` ON `recurring_occurrences` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `recurring_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_da` integer NOT NULL,
	`category_id` text NOT NULL,
	`frequency` text NOT NULL,
	`day_of_month` integer NOT NULL,
	`month` integer,
	`start_date` text NOT NULL,
	`active` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "recurring_payments_amount_positive" CHECK("recurring_payments"."amount_da" > 0),
	CONSTRAINT "recurring_payments_day_range" CHECK("recurring_payments"."day_of_month" BETWEEN 1 AND 31),
	CONSTRAINT "recurring_payments_month_by_frequency" CHECK(("recurring_payments"."frequency" = 'monthly' AND "recurring_payments"."month" IS NULL)
        OR ("recurring_payments"."frequency" = 'yearly' AND "recurring_payments"."month" IS NOT NULL AND "recurring_payments"."month" BETWEEN 1 AND 12)),
	CONSTRAINT "recurring_payments_name_not_empty" CHECK(length(trim("recurring_payments"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `recurring_payments_user_updated_idx` ON `recurring_payments` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `recurring_payments_category_idx` ON `recurring_payments` (`category_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_queue_user_created_idx` ON `sync_queue` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_da` integer NOT NULL,
	`currency` text NOT NULL,
	`original_amount_cents` integer,
	`eur_rate` real,
	`category_id` text,
	`note` text,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "transactions_amount_positive" CHECK("transactions"."amount_da" > 0),
	CONSTRAINT "transactions_eur_fields" CHECK(("transactions"."currency" = 'DZD' AND "transactions"."original_amount_cents" IS NULL AND "transactions"."eur_rate" IS NULL)
      OR ("transactions"."currency" = 'EUR' AND "transactions"."original_amount_cents" IS NOT NULL AND "transactions"."original_amount_cents" > 0
        AND "transactions"."eur_rate" IS NOT NULL AND "transactions"."eur_rate" > 0)),
	CONSTRAINT "transactions_category_by_type" CHECK(("transactions"."type" = 'expense' AND "transactions"."category_id" IS NOT NULL)
        OR ("transactions"."type" = 'income' AND "transactions"."category_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_user_updated_idx` ON `transactions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);