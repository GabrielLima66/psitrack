-- prontuario_evolucao é append-only (CLAUDE.md invariante de dado #1):
-- correção de um registro é uma linha nova com retifica_id apontando pra
-- original, nunca um UPDATE ou DELETE na linha existente. Isso é garantido
-- aqui por trigger, não só por convenção da camada de aplicação.
CREATE TRIGGER prontuario_evolucao_no_update
BEFORE UPDATE ON prontuario_evolucao
BEGIN
  SELECT RAISE(ABORT, 'prontuario_evolucao é append-only: correção é nova linha com retifica_id, não UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER prontuario_evolucao_no_delete
BEFORE DELETE ON prontuario_evolucao
BEGIN
  SELECT RAISE(ABORT, 'prontuario_evolucao é append-only: correção é nova linha com retifica_id, não DELETE');
END;
