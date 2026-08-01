import { defineConfig } from 'drizzle-kit'

// `dbCredentials.url` só é exigido pelo tipo de config do drizzle-kit para o
// dialect 'sqlite' — não é usado por `drizzle-kit generate` (só diffa
// schema.ts contra o journal de migrations, não abre banco nenhum). O banco
// real é cifrado (SQLCipher) e só é aberto em runtime via
// electron/main/db/connection.ts, com a DEK; nunca pelas ferramentas do
// drizzle-kit (`push`/`studio` não sabem setar PRAGMA key).
export default defineConfig({
  dialect: 'sqlite',
  schema: './electron/main/db/schema.ts',
  out: './electron/main/db/migrations',
  dbCredentials: {
    url: 'file:./electron/main/db/migrations/.unused-placeholder.db'
  }
})
