import { Search, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { calcularIdade } from './idade'
import { formatarDataBr, formatarStatus } from './formatters'
import { usePacientesStore } from './store'

const STATUS_BADGE_VARIANT = {
  ativo: 'success',
  pausado: 'warn',
  encerrado: 'outline'
} as const

const LARGURAS_SKELETON = ['70%', '45%', '85%', '55%', '65%', '40%', '75%']

/** Tela inicial pós-desbloqueio (SPEC-fase-1.md Etapa 6). Nenhum conteúdo clínico aparece aqui — nem preview de evolução. */
export function PacientesListScreen() {
  const store = usePacientesStore(
    useShallow((s) => ({
      pacientes: s.pacientes,
      loading: s.loading,
      listError: s.listError,
      filtroStatus: s.filtroStatus,
      filtroArquivados: s.filtroArquivados,
      busca: s.busca,
      carregarPacientes: s.carregarPacientes,
      setFiltroStatus: s.setFiltroStatus,
      setFiltroArquivados: s.setFiltroArquivados,
      setBusca: s.setBusca,
      abrirNovoPaciente: s.abrirNovoPaciente,
      abrirEdicaoPaciente: s.abrirEdicaoPaciente,
      arquivar: s.arquivar,
      restaurar: s.restaurar
    }))
  )

  useEffect(() => {
    void store.carregarPacientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ativos = store.pacientes.filter((p) => p.status === 'ativo').length
  const pausados = store.pacientes.filter((p) => p.status === 'pausado').length
  // filtroStatus começa em 'ativo' por padrão (não é uma escolha explícita da
  // usuária), então só busca/arquivados contam como "filtro ativo" aqui —
  // senão a mensagem de onboarding nunca apareceria na primeira execução.
  const semFiltroAtivo = !store.busca && !store.filtroArquivados

  return (
    <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col gap-6 overflow-y-auto px-8 py-7">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Pacientes</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {ativos} em atendimento · {pausados} pausada{pausados === 1 ? '' : 's'}
            </p>
          </div>
          <Button onClick={store.abrirNovoPaciente}>Novo paciente</Button>
        </div>

        <div className="flex items-center gap-[10px]">
          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF…"
              value={store.busca}
              onChange={(event) => store.setBusca(event.target.value)}
              className="pl-8"
            />
          </div>
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
      </div>

      {store.listError ? (
        <div className="flex flex-col items-center gap-3 rounded-[0.625rem] border border-border bg-card px-6 py-14 text-center">
          <TriangleAlert className="size-[26px] text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-foreground">Não foi possível carregar a lista</p>
            <p className="text-[13px] leading-[1.55] text-muted-foreground">Nenhum dado foi alterado. Tente novamente; se persistir, feche e reabra o app.</p>
          </div>
          <Button variant="outline" onClick={() => void store.carregarPacientes()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow className="h-9 hover:bg-transparent">
                <TableHead className="text-[12px] font-medium text-muted-foreground">Nome</TableHead>
                <TableHead className="w-[130px] text-[12px] font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="w-[90px] text-[12px] font-medium text-muted-foreground">Idade</TableHead>
                <TableHead className="w-[140px] text-[12px] font-medium text-muted-foreground">Última sessão</TableHead>
                <TableHead className="w-[110px] text-right text-[12px] font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.loading &&
                LARGURAS_SKELETON.map((largura, indice) => (
                  <TableRow key={`skeleton-${indice}`} className="h-11 animate-pulse hover:bg-transparent">
                    <TableCell>
                      <div className="h-[10px] rounded-[5px] bg-muted" style={{ width: largura }} />
                    </TableCell>
                    <TableCell>
                      <div className="h-[10px] w-16 rounded-[5px] bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-[10px] w-6 rounded-[5px] bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-[10px] w-14 rounded-[5px] bg-muted" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}

              {!store.loading &&
                store.pacientes.map((paciente) => (
                  <TableRow key={paciente.id} className="h-11 cursor-pointer" onClick={() => void store.abrirEdicaoPaciente(paciente)}>
                    <TableCell className="text-[13.5px] font-medium text-foreground">{paciente.nomeSocial || paciente.nome}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[paciente.status]}>{formatarStatus(paciente.status)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[13.5px]">{paciente.dataNascimento ? calcularIdade(paciente.dataNascimento) : '—'}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{paciente.ultimaSessao ? formatarDataBr(paciente.ultimaSessao) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        className="text-[13px] text-muted-foreground hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (store.filtroArquivados) void store.restaurar(paciente.id)
                          else void store.arquivar(paciente.id)
                        }}
                      >
                        {store.filtroArquivados ? 'Restaurar' : 'Arquivar'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}

              {!store.loading && store.pacientes.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                      <div className="size-14 rounded-[14px] border border-dashed border-input bg-muted" />
                      {semFiltroAtivo ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <p className="text-base font-semibold text-foreground">Nenhuma paciente cadastrada</p>
                            <p className="max-w-sm text-[13px] leading-[1.55] text-muted-foreground">
                              O cadastro guarda os dados de contato e abre a ficha com prontuário, financeiro e documentos.
                            </p>
                          </div>
                          <Button onClick={store.abrirNovoPaciente}>Cadastrar a primeira</Button>
                        </>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">Nenhuma paciente encontrada para esse filtro.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
