import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import type { AuditLog, Paged } from '@/lib/types'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { DataTable, fmtDateTime, PageHeader, SearchBox, TableSkeleton, td, th, Toolbar, useListParams } from './shared'

const ACTION_TONE: Record<string, string> = {
  create: 'text-emerald-700 bg-emerald-50', update: 'text-brand-700 bg-brand-50', delete: 'text-rose-700 bg-rose-50', deactivate: 'text-amber-700 bg-amber-50',
}

export default function AuditLogsPage() {
  const { values, page, set, setPage } = useListParams(['q'] as const)
  const params = { ...values, page, pageSize: 50 }
  const q = useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => api.get<Paged<AuditLog>>('/api/admin/audit-logs', params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Seo title="Nhật ký — Quản trị" />
      <PageHeader title="Nhật ký hoạt động" description="Lịch sử thao tác của quản trị viên và hệ thống." />

      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Hành động, đối tượng hoặc ID (khớp chính xác)…" label="Lọc nhật ký" />
      </Toolbar>

      {q.isPending ? <TableSkeleton rows={8} cols={5} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<History className="size-8" aria-hidden />} title="Không có bản ghi"
            description={values.q ? 'Bộ lọc khớp chính xác theo hành động (vd: update), đối tượng (vd: product) hoặc ID.' : undefined} /></div>
        ) : (
          <>
            <DataTable head={<>
              <th className={th}>Thời gian</th><th className={th}>Người thực hiện</th><th className={th}>Hành động</th><th className={th}>Đối tượng</th>
              <th className={th}>Dữ liệu</th><th className={th}>IP</th>
            </>}>
              {q.data.items.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{fmtDateTime(a.createdAt)}</td>
                  <td className={td}>{a.userEmail ?? (a.userId ? `#${a.userId}` : <span className="text-slate-400">Hệ thống</span>)}</td>
                  <td className={td}>
                    <button type="button" onClick={() => set({ q: a.action })} title="Lọc theo hành động này"
                      className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${ACTION_TONE[a.action] ?? 'bg-slate-100 text-slate-700'}`}>{a.action}</button>
                  </td>
                  <td className={`${td} whitespace-nowrap font-mono text-xs`}>
                    <button type="button" onClick={() => set({ q: a.entity })} className="hover:text-brand-700" title="Lọc theo đối tượng này">{a.entity}</button>
                    {a.entityId && <span className="text-slate-400"> #{a.entityId}</span>}
                  </td>
                  <td className={`${td} max-w-xs truncate font-mono text-xs text-slate-600`} title={a.data ?? undefined}>{a.data ?? '—'}</td>
                  <td className={`${td} whitespace-nowrap font-mono text-xs text-slate-500`}>{a.ip ?? '—'}</td>
                </tr>
              ))}
            </DataTable>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} bản ghi</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}
    </>
  )
}
