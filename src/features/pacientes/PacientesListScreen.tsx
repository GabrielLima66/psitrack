import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { calcularIdade } from './idade'
import { formatarDataBr, formatarStatus } from './formatters'
import { usePacientesStore } from './store'

const STATUS_BADGE_VARIANT = {
  ativo: 'default',
  pausado: 'secondary',
  encerrado: 'outline'
} as const

/** Tela inicial pós-desbloqueio (SPEC-fase-1.md Etapa 6). Nenhum conteúdo clínico aparece aqui — nem preview de evolução. */
export function PacientesListScreen() {
  const store = usePacientesStore()

  useEffect(() => {
    void store.carregarPacientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex h-screen max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Pacientes</h1>
        <Button onClick={store.abrirNovoPaciente}>Novo paciente</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nome ou CPF…"
          value={store.busca}
          onChange={(event) => store.setBusca(event.target.value)}
          className="max-w-xs"
        />
        {!store.filtroArquivados && (
          <Select
            value={store.filtroStatus ?? 'todos'}
            onValueChange={(value) => store.setFiltroStatus(value === 'todos' ? undefined : (value as 'ativo' | 'pausado' | 'encerrado'))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          variant={store.filtroArquivados ? 'default' : 'outline'}
          onClick={() => store.setFiltroArquivados(!store.filtroArquivados)}
        >
          {store.filtroArquivados ? 'Vendo arquivados' : 'Ver arquivados'}
        </Button>
      </div>

      {store.listError && <p className="text-sm text-destructive">{store.listError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Idade</TableHead>
            <TableHead>Última sessão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {store.pacientes.map((paciente) => (
            <TableRow key={paciente.id} className="cursor-pointer" onClick={() => void store.abrirEdicaoPaciente(paciente)}>
              <TableCell className="font-medium">{paciente.nomeSocial || paciente.nome}</TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[paciente.status]}>{formatarStatus(paciente.status)}</Badge>
              </TableCell>
              <TableCell>{paciente.dataNascimento ? calcularIdade(paciente.dataNascimento) : '—'}</TableCell>
              <TableCell>{paciente.ultimaSessao ? formatarDataBr(paciente.ultimaSessao) : '—'}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (store.filtroArquivados) void store.restaurar(paciente.id)
                    else void store.arquivar(paciente.id)
                  }}
                >
                  {store.filtroArquivados ? 'Restaurar' : 'Arquivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!store.loading && store.pacientes.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum paciente encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
