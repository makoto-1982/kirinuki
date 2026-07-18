CREATE TABLE `favorites` (
	`clip_id` text NOT NULL,
	`device_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`clip_id`, `device_id`)
);
