CREATE TABLE `paciente_diagnostico` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`descricao` text NOT NULL,
	`cid` text,
	`data` text,
	`profissional` text,
	`observacao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_diagnostico_paciente` ON `paciente_diagnostico` (`paciente_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `paciente_encaminhamento` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`para_quem` text NOT NULL,
	`especialidade` text,
	`data` text NOT NULL,
	`motivo` text,
	`observacao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_encaminhamento_paciente` ON `paciente_encaminhamento` (`paciente_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `paciente_ficha_clinica` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`demanda_inicial` text,
	`abordagem` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ficha_clinica_paciente` ON `paciente_ficha_clinica` (`paciente_id`) WHERE "paciente_ficha_clinica"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `paciente_medicamento` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`nome` text NOT NULL,
	`dose` text,
	`prescritor` text,
	`inicio` text,
	`fim` text,
	`observacao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_medicamento_paciente` ON `paciente_medicamento` (`paciente_id`,`deleted_at`);