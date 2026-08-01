import { readFileSync, writeFileSync } from 'node:fs'
import type { VerificationResult } from './verify'

export interface BackupManifest {
  createdAt: string // ISO-8601 UTC
  schemaVersion: number
  verification: VerificationResult
}

export function writeManifest(filePath: string, manifest: BackupManifest): void {
  writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8')
}

export function readManifest(filePath: string): BackupManifest {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as BackupManifest
}
