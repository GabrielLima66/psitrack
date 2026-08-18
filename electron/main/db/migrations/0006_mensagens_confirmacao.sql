CREATE TABLE `mensagem_template` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`corpo` text NOT NULL,
	`padrao` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
ALTER TABLE `sessao` ADD `lembrete_enviado_em` text;