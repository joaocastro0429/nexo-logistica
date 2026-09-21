CREATE TABLE `identidades_oauth` (
	`provider` enum('google','github') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`usuario_id` varchar(64) NOT NULL,
	CONSTRAINT `identidades_oauth_provider_subject_pk` PRIMARY KEY(`provider`,`subject`),
	CONSTRAINT `oauth_usuario_provider` UNIQUE(`usuario_id`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `usuarios` ADD `mfa_secret` text;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `mfa_last_step` int DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `recovery_hashes` text;--> statement-breakpoint
ALTER TABLE `identidades_oauth` ADD CONSTRAINT `identidades_oauth_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE cascade ON UPDATE no action;