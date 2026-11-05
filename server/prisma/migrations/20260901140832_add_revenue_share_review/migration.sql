-- AlterTable
ALTER TABLE `payment_revenue_shares` ADD COLUMN `disputeNote` TEXT NULL,
    ADD COLUMN `reviewStatus` ENUM('UNREVIEWED', 'ACCEPTED', 'DISPUTED') NOT NULL DEFAULT 'UNREVIEWED',
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `payment_revenue_shares_reviewStatus_idx` ON `payment_revenue_shares`(`reviewStatus`);

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
