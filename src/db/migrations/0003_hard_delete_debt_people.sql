-- Personnes : suppression définitive à la place de la suppression logique (docs/STORAGE.md §2).
-- Personnes déjà supprimées logiquement : effacées avec leurs entrées en attente (la migration
-- Supabase les efface aussi côté serveur) ; payloads restants sans deletedAt (colonne retirée).
DELETE FROM `sync_queue` WHERE `table_name` = 'debt_people' AND `row_id` IN (SELECT `id` FROM `debt_people` WHERE `deleted_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `debt_people` WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
UPDATE `sync_queue` SET `payload` = json_remove(`payload`, '$.deletedAt') WHERE `table_name` = 'debt_people';--> statement-breakpoint
ALTER TABLE `debt_people` DROP COLUMN `deleted_at`;
