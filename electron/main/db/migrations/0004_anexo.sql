CREATE TABLE `anexo` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`evolucao_id` text,
	`classificacao` text NOT NULL,
	`nome_original` text NOT NULL,
	`mime` text NOT NULL,
	`tamanho_bytes` integer NOT NULL,
	`sha256_cifrado` text NOT NULL,
	`nonce` text NOT NULL,
	`chave_envelopada` text NOT NULL,
	`descricao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evolucao_id`) REFERENCES `prontuario_evolucao`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_anexo_paciente` ON `anexo` (`paciente_id`,`classificacao`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_anexo_evolucao` ON `anexo` (`evolucao_id`);