CREATE TABLE `pacientes` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `prontuario_evolucao` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`conteudo` text NOT NULL,
	`retifica_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retifica_id`) REFERENCES `prontuario_evolucao`(`id`) ON UPDATE no action ON DELETE no action
);
