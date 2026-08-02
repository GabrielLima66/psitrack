CREATE TABLE `contrato_preco` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`modalidade` text NOT NULL,
	`valor_centavos` integer,
	`politica_falta` text DEFAULT 'cobra_sem_aviso' NOT NULL,
	`aviso_minimo_horas` integer DEFAULT 24 NOT NULL,
	`vigencia_inicio` text NOT NULL,
	`observacao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contrato_vigencia` ON `contrato_preco` (`paciente_id`,`vigencia_inicio`);--> statement-breakpoint
CREATE TABLE `lancamento` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`sessao_id` text,
	`competencia` text NOT NULL,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`pagamento_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sessao_id`) REFERENCES `sessao`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pagamento_id`) REFERENCES `pagamento`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lancamento_sessao` ON `lancamento` (`sessao_id`) WHERE "lancamento"."sessao_id" is not null and "lancamento"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `idx_lancamento_pendentes` ON `lancamento` (`paciente_id`,`status`,`competencia`);--> statement-breakpoint
CREATE TABLE `pagamento` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`data` text NOT NULL,
	`meio` text NOT NULL,
	`pagador_nome` text NOT NULL,
	`pagador_cpf` text,
	`recibo_emitido_em` text,
	`recibo_referencia` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recorrencia` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`dia_semana` integer NOT NULL,
	`hora_local` text NOT NULL,
	`duracao_min` integer DEFAULT 50 NOT NULL,
	`modalidade` text NOT NULL,
	`vigencia_inicio` text NOT NULL,
	`vigencia_fim` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessao` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`recorrencia_id` text,
	`inicio_utc` text NOT NULL,
	`duracao_min` integer NOT NULL,
	`modalidade` text NOT NULL,
	`status` text DEFAULT 'agendada' NOT NULL,
	`status_alterado_em` text,
	`avisada_em` text,
	`motivo` text,
	`remarcada_para_id` text,
	`observacao` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorrencia_id`) REFERENCES `recorrencia`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`remarcada_para_id`) REFERENCES `sessao`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessao_agenda` ON `sessao` (`inicio_utc`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_sessao_paciente` ON `sessao` (`paciente_id`,`inicio_utc`);--> statement-breakpoint
ALTER TABLE `prontuario_evolucao` ADD `sessao_id` text REFERENCES sessao(id);--> statement-breakpoint
-- ALTER TABLE ADD COLUMN não invalida trigger no SQLite (a nossa nem
-- referencia coluna nenhuma no corpo), mas recriamos por segurança e porque
-- o teste de regressão deve provar que UPDATE/DELETE continuam bloqueados
-- depois do ALTER, inclusive tentando mexer na coluna nova (sessao_id).
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