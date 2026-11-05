-- CreateTable
CREATE TABLE `petty_cash_requisitions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED') NOT NULL DEFAULT 'PENDING',
    `requestedById` VARCHAR(191) NOT NULL,
    `decisionById` VARCHAR(191) NULL,
    `decisionAt` DATETIME(3) NULL,
    `decisionNotes` TEXT NULL,
    `fulfilledById` VARCHAR(191) NULL,
    `fulfilledAt` DATETIME(3) NULL,
    `pettyCashEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `petty_cash_requisitions_pettyCashEntryId_key`(`pettyCashEntryId`),
    INDEX `petty_cash_requisitions_companyId_idx`(`companyId`),
    INDEX `petty_cash_requisitions_branchId_idx`(`branchId`),
    INDEX `petty_cash_requisitions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_decisionById_fkey` FOREIGN KEY (`decisionById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_fulfilledById_fkey` FOREIGN KEY (`fulfilledById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `petty_cash_requisitions` ADD CONSTRAINT `petty_cash_requisitions_pettyCashEntryId_fkey` FOREIGN KEY (`pettyCashEntryId`) REFERENCES `petty_cash_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
