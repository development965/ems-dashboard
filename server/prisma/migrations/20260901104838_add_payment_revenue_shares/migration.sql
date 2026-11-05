-- CreateTable
CREATE TABLE `payment_revenue_shares` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `fromBranchId` VARCHAR(191) NOT NULL,
    `toBranchId` VARCHAR(191) NOT NULL,
    `splitPercent` DECIMAL(5, 2) NULL,
    `shareAmount` DECIMAL(10, 2) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('PENDING', 'SETTLED') NOT NULL DEFAULT 'PENDING',
    `recordedById` VARCHAR(191) NOT NULL,
    `settledById` VARCHAR(191) NULL,
    `settledAt` DATETIME(3) NULL,
    `settlementNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_revenue_shares_companyId_idx`(`companyId`),
    INDEX `payment_revenue_shares_paymentId_idx`(`paymentId`),
    INDEX `payment_revenue_shares_fromBranchId_idx`(`fromBranchId`),
    INDEX `payment_revenue_shares_toBranchId_idx`(`toBranchId`),
    INDEX `payment_revenue_shares_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_fromBranchId_fkey` FOREIGN KEY (`fromBranchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_toBranchId_fkey` FOREIGN KEY (`toBranchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_revenue_shares` ADD CONSTRAINT `payment_revenue_shares_settledById_fkey` FOREIGN KEY (`settledById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
