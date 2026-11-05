-- AlterTable
ALTER TABLE `petty_cash_entries` ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `petty_cash_entries` ADD CONSTRAINT `petty_cash_entries_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
