CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openPhoneId` varchar(128) NOT NULL,
	`firstName` text,
	`lastName` text,
	`phone` varchar(32),
	`email` varchar(320),
	`company` text,
	`vehicleYearMakeModel` text,
	`vin` varchar(64),
	`keyCode` varchar(128),
	`dealerComparison` text,
	`partNumber` varchar(128),
	`address` text,
	`rawJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contacts_openPhoneId_unique` UNIQUE(`openPhoneId`)
);
