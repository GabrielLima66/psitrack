-- `nome_busca`/`data_sessao` abaixo levam `DEFAULT ''` só porque o SQLite
-- exige default em ADD COLUMN NOT NULL — nunca usado de verdade: as duas
-- tabelas estão vazias em todo deploy real até aqui (Fase 0 não tinha tela
-- de domínio), e o repositório sempre grava valor real no insert.
CREATE TABLE `anotacao_privada` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`titulo` text,
	`conteudo` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `paciente_responsavel` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`nome` text NOT NULL,
	`cpf` text,
	`parentesco` text NOT NULL,
	`telefone` text,
	`email` text,
	`principal` integer DEFAULT false NOT NULL,
	`pagador` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_resp_paciente` ON `paciente_responsavel` (`paciente_id`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `pacientes` ADD `nome_social` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `nome_busca` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `data_nascimento` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `cpf` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `telefone` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `email` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `status` text DEFAULT 'ativo' NOT NULL;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `motivo_encerramento` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `status_alterado_em` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `origem` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pacientes_cpf` ON `pacientes` (`cpf`) WHERE "pacientes"."cpf" is not null and "pacientes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `idx_pacientes_busca` ON `pacientes` (`nome_busca`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_status` ON `pacientes` (`status`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `prontuario_evolucao` ADD `data_sessao` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `prontuario_evolucao` ADD `tipo` text DEFAULT 'sessao' NOT NULL;--> statement-breakpoint
ALTER TABLE `prontuario_evolucao` ADD `motivo_retificacao` text;--> statement-breakpoint
-- ALTER TABLE ADD COLUMN não invalida trigger no SQLite (a nossa nem
-- referencia coluna nenhuma no corpo), mas recriamos por segurança e porque
-- o teste de regressão deve provar que UPDATE/DELETE continuam bloqueados
-- depois do ALTER, inclusive tentando mexer nas colunas novas.
DROP TRIGGER IF EXISTS prontuario_evolucao_no_update;--> statement-breakpoint
DROP TRIGGER IF EXISTS prontuario_evolucao_no_delete;--> statement-breakpoint
CREATE TRIGGER prontuario_evolucao_no_update
BEFORE UPDATE ON prontuario_evolucao
BEGIN
  SELECT RAISE(ABORT, 'prontuario_evolucao é append-only: correção é nova linha com retifica_id, não UPDATE');
END;--> statement-breakpoint
CREATE TRIGGER prontuario_evolucao_no_delete
BEFORE DELETE ON prontuario_evolucao
BEGIN
  SELECT RAISE(ABORT, 'prontuario_evolucao é append-only: correção é nova linha com retifica_id, não DELETE');
END;