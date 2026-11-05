-- AlterTable
ALTER TABLE `students` ADD COLUMN `certificateIssuedAt` DATETIME(3) NULL,
    ADD COLUMN `certificateNo` VARCHAR(191) NULL,
    ADD COLUMN `certificationStatus` ENUM('NOT_ISSUED', 'ISSUED') NOT NULL DEFAULT 'NOT_ISSUED',
    ADD COLUMN `placedAt` DATETIME(3) NULL,
    ADD COLUMN `placementCompany` VARCHAR(191) NULL,
    ADD COLUMN `placementPackageLPA` DECIMAL(6, 2) NULL,
    ADD COLUMN `placementRole` VARCHAR(191) NULL,
    ADD COLUMN `placementStatus` ENUM('NOT_PLACED', 'IN_PROGRESS', 'PLACED') NOT NULL DEFAULT 'NOT_PLACED';

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_companyId_idx`(`companyId`),
    INDEX `audit_logs_branchId_idx`(`branchId`),
    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_reminders` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'CALL', 'SMS', 'EMAIL', 'OTHER') NOT NULL,
    `notes` VARCHAR(191) NULL,
    `sentById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fee_reminders_companyId_idx`(`companyId`),
    INDEX `fee_reminders_branchId_idx`(`branchId`),
    INDEX `fee_reminders_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_targets` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `targetAmount` DECIMAL(12, 2) NOT NULL,
    `setById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `branch_targets_companyId_idx`(`companyId`),
    UNIQUE INDEX `branch_targets_branchId_year_month_key`(`branchId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_reminders` ADD CONSTRAINT `fee_reminders_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_reminders` ADD CONSTRAINT `fee_reminders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_reminders` ADD CONSTRAINT `fee_reminders_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_reminders` ADD CONSTRAINT `fee_reminders_sentById_fkey` FOREIGN KEY (`sentById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_targets` ADD CONSTRAINT `branch_targets_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_targets` ADD CONSTRAINT `branch_targets_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_targets` ADD CONSTRAINT `branch_targets_setById_fkey` FOREIGN KEY (`setById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
