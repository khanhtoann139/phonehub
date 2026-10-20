import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { InventoryRow, Paged } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { DataTable, fmtDateTime, PAGE_SIZE, PageHeader, SearchBox, Segmented, StatusBadge, TableSkeleton, td, th, Toolbar, useListParams } from './shared'

type Status = '' | 'low' | 'out'

export default function InventoryPage() {
  const { values, page, set, setPage } = useListParams(['q', 'status'] as const)
  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'inventory', params],
    queryFn: () => api.get<Paged<InventoryRow>>('/api/admin/inventory', params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Seo title="Tồn kho — Quản trị" />
      <PageHeader title="Tồn kho" description="Điều chỉnh số lượng tồn và ngưỡng cảnh báo cho từng biến thể." />

      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Tìm theo SKU hoặc tên sản phẩm…" label="Tìm tồn kho" />
        <Segmented<Status> label="Lọc tồn kho" value={values.status as Status} onChange={v => set({ status: v })}
          options={[{ value: '', label: 'Tất cả' }, { value: 'low', label: 'Sắp hết' }, { value: 'out', label: 'Hết hàng' }]} />
      </Toolbar>

      {q.isPending ? <TableSkeleton cols={6} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<Boxes className="size-8" aria-hidden />} title="Không có biến thể nào"
            description={values.status ? 'Không có biến thể nào khớp bộ lọc — tồn kho đang ổn.' : 'Thử từ khóa khác.'} /></div>
        ) : (
          <>
            <DataTable head={<>
              <th className={th}>Sản phẩm</th><th className={th}>SKU</th><th className={th}>Tồn kho</th><th className={th}>Ngưỡng cảnh báo</th>
              <th className={th}>Tình trạng</th><th className={th}>Cập nhật</th><th className={th}><span className="sr-only">Lưu</span></th>
            </>}>
              {q.data.items.map(r => <Row key={`${r.variantId}-${r.quantity}-${r.lowStockThreshold}`} row={r} />)}
            </DataTable>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} biến thể</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}
    </>
  )
}

function Row({ row }: { row: InventoryRow }) {
  const qc = useQueryClient()
  const [qty, setQty] = useState(String(row.quantity))
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold))
  const qtyN = Number(qty)
  const thN = Number(threshold)
  const valid = qty !== '' && threshold !== '' && Number.isInteger(qtyN) && Number.isInteger(thN) && qtyN >= 0 && qtyN <= 1_000_000 && thN >= 0 && thN <= 10_000
  const changed = qtyN !== row.quantity || thN !== row.lowStockThreshold

  const save = useMutation({
    mutationFn: () => api.put(`/api/admin/inventory/${row.variantId}`, { quantity: qtyN, lowStockThreshold: thN }),
    onSuccess: () => {
      toast.success(`Đã cập nhật tồn kho ${row.sku}`)
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
    onError: e => toast.error(errorMessage(e)),
  })

  const out = row.quantity === 0
  const numInput = 'input w-24 py-1.5 text-right'
  return (
    <tr className={out ? 'bg-rose-50/50' : row.isLow ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}>
      <td className={td}>
        <p className="font-medium">{row.productName}</p>
        <p className="text-xs text-slate-500">{row.variantName}</p>
      </td>
      <td className={`${td} font-mono text-xs`}>{row.sku}</td>
      <td className={td}>
        <input type="number" min={0} className={numInput} aria-label={`Số lượng tồn ${row.sku}`} value={qty} onChange={e => setQty(e.target.value)}
          aria-invalid={!valid} onKeyDown={e => { if (e.key === 'Enter' && valid && changed) save.mutate() }} />
      </td>
      <td className={td}>
        <input type="number" min={0} className={numInput} aria-label={`Ngưỡng cảnh báo ${row.sku}`} value={threshold} onChange={e => setThreshold(e.target.value)}
          aria-invalid={!valid} onKeyDown={e => { if (e.key === 'Enter' && valid && changed) save.mutate() }} />
      </td>
      <td className={td}>
        {out ? <StatusBadge tone="red">Hết hàng</StatusBadge> : row.isLow ? <StatusBadge tone="amber">Sắp hết</StatusBadge> : <StatusBadge tone="green">Đủ hàng</StatusBadge>}
      </td>
      <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>{fmtDateTime(row.updatedAt)}</td>
      <td className={`${td} text-right`}>
        <Button size="sm" variant={changed ? 'primary' : 'outline'} disabled={!changed || !valid} loading={save.isPending}
          icon={<Save className="size-4" aria-hidden />} onClick={() => save.mutate()} aria-label={`Lưu tồn kho ${row.sku}`}>Lưu</Button>
      </td>
    </tr>
  )
}
