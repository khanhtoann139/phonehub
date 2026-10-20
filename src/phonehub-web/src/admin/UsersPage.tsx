import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatNumber, formatPrice } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { AdminUser, Paged } from '@/lib/types'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { DataTable, fmtDate, PAGE_SIZE, PageHeader, SearchBox, Segmented, StatusBadge, TableSkeleton, td, th, Toolbar, useListParams } from './shared'

type Role = AdminUser['role']

export default function UsersPage() {
  const { values, page, set, setPage } = useListParams(['q', 'status'] as const)
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get<Paged<AdminUser>>('/api/admin/users', params),
    placeholderData: keepPreviousData,
  })

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; role: Role; isActive: boolean }) => api.put(`/api/admin/users/${id}`, body),
    onSuccess: () => { toast.success('Đã cập nhật người dùng'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <>
      <Seo title="Người dùng — Quản trị" />
      <PageHeader title="Người dùng" description="Phân quyền và khóa / mở khóa tài khoản." />

      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Tìm theo email, họ tên, SĐT…" label="Tìm người dùng" />
        <Segmented<'' | Role> label="Lọc theo vai trò" value={values.status as '' | Role} onChange={v => set({ status: v })}
          options={[{ value: '', label: 'Tất cả' }, { value: 'customer', label: 'Khách hàng' }, { value: 'admin', label: 'Quản trị viên' }]} />
      </Toolbar>

      {q.isPending ? <TableSkeleton cols={6} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<Users className="size-8" aria-hidden />} title="Không tìm thấy người dùng" /></div>
        ) : (
          <>
            <DataTable head={<>
              <th className={th}>Người dùng</th><th className={th}>Ngày tham gia</th><th className={`${th} text-center`}>Đơn hàng</th>
              <th className={`${th} text-right`}>Chi tiêu</th><th className={th}>Vai trò</th><th className={th}>Trạng thái</th>
            </>}>
              {q.data.items.map(u => {
                const self = u.id === me?.id
                const busy = update.isPending && update.variables?.id === u.id
                return (
                  <tr key={u.id} className={`hover:bg-slate-50/60 ${u.isActive ? '' : 'bg-slate-50 text-slate-500'}`}>
                    <td className={td}>
                      <p className="font-medium text-ink">{u.fullName}{self && <span className="ml-1.5 text-xs font-normal text-brand-600">(bạn)</span>}</p>
                      <p className="text-xs text-slate-500">{u.email}{u.phone && ` · ${u.phone}`}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(u.createdAt)}</td>
                    <td className={`${td} text-center`}>{formatNumber(u.orderCount)}</td>
                    <td className={`${td} whitespace-nowrap text-right font-medium`}>{formatPrice(u.totalSpent)}</td>
                    <td className={td}>
                      <select aria-label={`Vai trò của ${u.email}`} className="input w-auto py-1.5 pr-8" value={u.role} disabled={self || busy}
                        onChange={e => update.mutate({ id: u.id, role: e.target.value as Role, isActive: u.isActive })}>
                        <option value="customer">Khách hàng</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <button type="button" role="switch" aria-checked={u.isActive} aria-label={`${u.isActive ? 'Khóa' : 'Mở khóa'} tài khoản ${u.email}`}
                          disabled={self || busy} onClick={() => update.mutate({ id: u.id, role: u.role, isActive: !u.isActive })}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${u.isActive ? 'bg-brand-600' : 'bg-slate-300'}`}>
                          <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${u.isActive ? 'translate-x-5' : ''}`} />
                        </button>
                        <StatusBadge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</StatusBadge>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </DataTable>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} người dùng</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}
    </>
  )
}
