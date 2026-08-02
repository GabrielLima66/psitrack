import { extname } from 'node:path'

/**
 * Diálogo nativo de seleção de arquivo não devolve mime-type, só o caminho —
 * uma tabela pequena por extensão resolve os formatos que importam aqui
 * (preview de PDF/imagem, D28) sem justificar dependência nova. Formato
 * desconhecido cai em `application/octet-stream`: sem preview, só "salvar cópia".
 */
const MIME_POR_EXTENSAO: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain'
}

export function mimeFromExtensao(caminho: string): string {
  return MIME_POR_EXTENSAO[extname(caminho).toLowerCase()] ?? 'application/octet-stream'
}
