CREATE TABLE `clientes` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`nome` varchar(150) NOT NULL,
	`email` varchar(254) NOT NULL,
	`telefone` varchar(30) NOT NULL,
	`documento` varchar(30) NOT NULL,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` varchar(64) NOT NULL,
	`nome` varchar(150) NOT NULL,
	CONSTRAINT `empresas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paineis` (
	`tenant_id` varchar(64) NOT NULL,
	`resumo` text NOT NULL,
	`eficiencia` text NOT NULL,
	CONSTRAINT `paineis_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `rotas` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`nome` varchar(150) NOT NULL,
	`pedidos` int NOT NULL,
	`previsao` varchar(20) NOT NULL,
	`status` varchar(30) NOT NULL,
	CONSTRAINT `rotas_tenant_id_id_pk` PRIMARY KEY(`tenant_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `simulacoes` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`criada_em` varchar(30) NOT NULL,
	`dados` text NOT NULL,
	CONSTRAINT `simulacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transportadoras` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`nome` varchar(150) NOT NULL,
	`email` varchar(254) NOT NULL,
	`telefone` varchar(30) NOT NULL,
	`taxa_base` decimal(16,4) NOT NULL,
	`valor_kg` decimal(16,4) NOT NULL,
	`valor_km` decimal(16,4) NOT NULL,
	CONSTRAINT `transportadoras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(64) NOT NULL,
	`nome` varchar(150) NOT NULL,
	`email` varchar(254) NOT NULL,
	`senha_hash` varchar(256) NOT NULL,
	`perfil` enum('Administrador','Gestor','Operador') NOT NULL,
	`session_version` int NOT NULL DEFAULT 0,
	CONSTRAINT `usuarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `usuarios_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paineis` ADD CONSTRAINT `paineis_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rotas` ADD CONSTRAINT `rotas_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `simulacoes` ADD CONSTRAINT `simulacoes_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transportadoras` ADD CONSTRAINT `transportadoras_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_tenant_id_empresas_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `empresas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `clientes_tenant_idx` ON `clientes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `simulacoes_tenant_criada_idx` ON `simulacoes` (`tenant_id`,`criada_em`);--> statement-breakpoint
CREATE INDEX `transportadoras_tenant_idx` ON `transportadoras` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `usuarios_tenant_idx` ON `usuarios` (`tenant_id`);