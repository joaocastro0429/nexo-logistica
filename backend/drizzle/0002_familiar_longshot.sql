CREATE TABLE `auditoria` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64),
	`usuario_id` varchar(64),
	`acao` varchar(80) NOT NULL,
	`recurso` varchar(80),
	`recurso_id` varchar(64),
	`ip` varchar(45),
	`detalhes` text,
	`criada_em` varchar(30) NOT NULL,
	CONSTRAINT `auditoria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auditoria_tenant_criada_idx` ON `auditoria` (`tenant_id`,`criada_em`);--> statement-breakpoint
CREATE INDEX `auditoria_acao_criada_idx` ON `auditoria` (`acao`,`criada_em`);