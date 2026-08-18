/**
 * `telefone` é texto livre desde sempre neste app — nunca validado em lugar
 * nenhum até agora (nem no cadastro de paciente, nem no de responsável).
 * Esta função só normaliza pra uso num link `wa.me` (mensagens/whatsapp.ts);
 * não valida em nenhum outro ponto de entrada, e não tenta resolver DDD
 * ausente (8/9 dígitos sem contexto de região) nem distinguir fixo de
 * celular — um fixo de 10/12 dígitos normaliza "com sucesso" e só se mostra
 * inválido quando o link não abre no WhatsApp. Resolver isso plenamente
 * exigiria uma tabela de DDDs válidos, precisão especulativa que este
 * projeto evita até virar problema real.
 */
export function normalizarTelefoneBr(bruto: string | null): string | null {
  if (!bruto || !bruto.trim()) return null

  const digitos = bruto.replace(/\D/g, '')
  if (digitos.startsWith('0800') || digitos.startsWith('0300')) return null

  switch (digitos.length) {
    case 10: // DDD + fixo, sem DDI
    case 11: // DDD + celular, sem DDI
      return `55${digitos}`
    case 12: // DDI + DDD + fixo
    case 13: // DDI + DDD + celular
      return digitos.startsWith('55') ? digitos : null
    default:
      return null
  }
}
