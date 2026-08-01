export type IpcResult<T extends object = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * `ipcMain.handle` deixando o erro escapar via `throw` não dá uma mensagem
 * limpa no renderer — o Electron embrulha em algo como
 * "Error invoking remote method '<canal>': Error: <mensagem>.". Por isso os
 * handlers de todo domínio usam isto pra devolver `{ ok: false, error }`
 * como valor normal, nunca como rejeição de promise.
 */
export async function safely<T extends object>(work: () => Promise<T> | T): Promise<IpcResult<T>> {
  try {
    return { ok: true, ...(await work()) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
