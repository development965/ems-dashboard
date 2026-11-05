-- CreateTable
CREATE TABLE `petty_cash_entries` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `type` ENUM('TOP_UP', 'EXPENSE') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `petty_cash_entries_companyId_idx`(`companyId`),
    INDEX `petty_cash_entries_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `petty_cash_entries` ADD CONSTRAINT `petty_cash_entries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_entries` ADD CONSTRAINT `petty_cash_entries_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_entries` ADD CONSTRAINT `petty_cash_entries_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
