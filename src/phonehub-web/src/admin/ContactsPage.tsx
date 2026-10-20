import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { ContactMessage, Paged } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { fmtDateTime, PAGE_SIZE, PageHeader, Segmented, StatusBadge, TableSkeleton, Toolbar, useListParams } from './shared'

type Status = '' | 'open'

export default function ContactsPage() {
  const { values, page, set, setPage } = useListParams(['status'] as const)
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'contacts', params],
    queryFn: () => api.get<Paged<ContactMessage>>('/api/admin/contacts', params),
    placeholderData: keepPreviousData,
  })

  const handled = useMutation({
    mutationFn: (id: number) => api.put(`/api/admin/contacts/${id}/handled`),
    onSuccess: () => { toast.success('Đã đánh dấu là đã xử lý'); qc.invalidateQueries({ queryKey: ['admin', 'contacts'] }) },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <>
      <Seo title="Liên hệ — Quản trị" />
      <PageHeader title="Liên hệ" description="Tin nhắn khách gửi từ trang liên hệ." />

      <Toolbar>
        <Segmented<Status> label="Lọc tin nhắn" value={values.status as Status} onChange={v => set({ status: v })}
          options={[{ value: '', label: 'Tất cả' }, { value: 'open', label: 'Chưa xử lý' }]} />
      </Toolbar>

      {q.isPending ? <TableSkeleton rows={5} cols={3} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<Mail className="size-8" aria-hidden />} title={values.status ? 'Không còn tin nhắn chưa xử lý' : 'Chưa có tin nhắn nào'} /></div>
        ) : (
          <>
            <ul className="card divide-y divide-slate-100 overflow-hidden">
              {q.data.items.map(c => {
                const open = expanded === c.id
                return (
                  <li key={c.id} className={c.isHandled ? '' : 'bg-brand-50/30'}>
                    <button type="button" aria-expanded={open} aria-controls={`contact-${c.id}`} onClick={() => setExpanded(open ? null : c.id)}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${c.isHandled ? 'bg-slate-300' : 'bg-brand-600'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`text-sm ${c.isHandled ? 'font-medium' : 'font-semibold'} text-ink`}>{c.subject}</span>
                          <StatusBadge tone={c.isHandled ? 'gray' : 'amber'}>{c.isHandled ? 'Đã xử lý' : 'Chưa xử lý'}</StatusBadge>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{c.name} · {c.email} · {fmtDateTime(c.createdAt)}</span>
                        {!open && <span className="mt-1 line-clamp-1 block text-sm text-slate-600">{c.message}</span>}
                      </span>
                      <ChevronDown className={`mt-1 size-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {open && (
                      <div id={`contact-${c.id}`} className="px-5 pb-5 pl-10">
                        <p className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{c.message}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.subject}`)}`} className="font-medium text-brand-700 hover:underline">Trả lời qua email</a>
                          {c.phone && <a href={`tel:${c.phone}`} className="font-medium text-brand-700 hover:underline">Gọi {c.phone}</a>}
                          {!c.isHandled && (
                            <Button size="sm" className="ml-auto" icon={<Check className="size-4" aria-hidden />}
                              loading={handled.isPending && handled.variables === c.id} onClick={() => handled.mutate(c.id)}>Đánh dấu đã xử lý</Button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} tin nhắn</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}
    </>
  )
}
