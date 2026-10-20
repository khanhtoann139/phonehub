import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, type UseFormRegister, type UseFormSetValue, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ImageIcon, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, assetUrl } from '@/lib/api'
import { errorMessage } from '@/lib/hooks'
import type { AdminProduct } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'
import { applyFieldErrors, Card, IconButton, PageHeader, UploadButton, useAdminBrands, useAdminCategories } from './shared'

// ───────────── Schema ─────────────
const num = (msg = 'Số không hợp lệ') => z.coerce.number({ invalid_type_error: msg })
const optNum = z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: 'Số không hợp lệ' }).min(0, 'Không được âm').nullable())

const variantSchema = z.object({
  variantId: z.number().nullable(),
  sku: z.string().trim().min(1, 'Nhập SKU').max(64).regex(/^[A-Za-z0-9_-]+$/, 'SKU chỉ gồm chữ, số, -, _'),
  color: z.string().trim().min(1, 'Nhập màu').max(60),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Dạng #RRGGBB'),
  storageGb: num().int().min(1, 'Từ 1GB').max(4096),
  ramGb: num().int().min(1, 'Từ 1GB').max(64),
  price: num('Nhập giá').min(1000, 'Giá tối thiểu 1.000₫').max(1_000_000_000),
  compareAtPrice: optNum,
  stock: num().int('Số nguyên').min(0, 'Không được âm').max(1_000_000),
  isActive: z.boolean(),
})

const schema = z.object({
  name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(200),
  slug: z.string().trim().max(220).regex(/^[a-z0-9-]*$/, 'Slug chỉ gồm a-z, 0-9, -'),
  brandId: num().int().min(1, 'Chọn thương hiệu'),
  categoryId: num().int().min(1, 'Chọn danh mục'),
  shortDescription: z.string().max(500, 'Tối đa 500 ký tự'),
  description: z.string().max(20000),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  variants: z.array(variantSchema).min(1, 'Cần ít nhất một biến thể'),
  images: z.array(z.object({
    url: z.string().trim().min(1, 'Chưa có ảnh').max(500),
    alt: z.string().max(200),
    color: z.string().max(60),
    sortOrder: num().int(),
  })),
  specs: z.array(z.object({ key: z.string().trim().max(100), value: z.string().trim().max(500) })),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const emptyVariant = (): FormIn['variants'][number] => ({
  variantId: null, sku: '', color: '', colorHex: '#1f2937', storageGb: 128, ramGb: 8, price: 0, compareAtPrice: '', stock: 0, isActive: true,
})

const EMPTY: FormIn = {
  name: '', slug: '', brandId: 0, categoryId: 0, shortDescription: '', description: '', isActive: true, isFeatured: false,
  variants: [emptyVariant()], images: [], specs: [{ key: '', value: '' }],
}

function toForm(p: AdminProduct): FormIn {
  return {
    name: p.name, slug: p.slug, brandId: p.brandId, categoryId: p.categoryId, shortDescription: p.shortDescription, description: p.description,
    isActive: p.isActive, isFeatured: p.isFeatured,
    variants: p.variants.map(v => ({
      variantId: v.id, sku: v.sku, color: v.color, colorHex: v.colorHex, storageGb: v.storageGb, ramGb: v.ramGb,
      price: v.price, compareAtPrice: v.compareAtPrice ?? '', stock: v.stock, isActive: v.isActive,
    })),
    images: p.images.map(i => ({ url: i.url, alt: i.alt, color: i.color ?? '', sortOrder: i.sortOrder })),
    specs: Object.entries(p.specs).map(([key, value]) => ({ key, value })),
  }
}

function toRequest(f: FormOut) {
  return {
    name: f.name, slug: f.slug || null, brandId: f.brandId, categoryId: f.categoryId,
    shortDescription: f.shortDescription || null, description: f.description || null,
    specs: Object.fromEntries(f.specs.filter(s => s.key).map(s => [s.key, s.value])),
    isActive: f.isActive, isFeatured: f.isFeatured,
    variants: f.variants.map(v => ({
      id: v.variantId, sku: v.sku, color: v.color, colorHex: v.colorHex, storageGb: v.storageGb, ramGb: v.ramGb,
      price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock, isActive: v.isActive,
    })),
    images: f.images.map((img, i) => ({ url: img.url, alt: img.alt || null, color: img.color || null, sortOrder: img.sortOrder || i + 1 })),
  }
}

// ───────────── Trang ─────────────
export default function ProductEditPage() {
  const { id } = useParams()
  const isNew = !id || id === 'moi'
  const brands = useAdminBrands()
  const categories = useAdminCategories()
  const product = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => api.get<AdminProduct>(`/api/admin/products/${id}`), enabled: !isNew })

  const title = isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm'
  const queries = isNew ? [brands, categories] : [brands, categories, product]
  const failed = queries.find(x => x.isError)

  return (
    <>
      <Seo title={`${title} — Quản trị`} />
      <Link to="/admin/san-pham" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách sản phẩm
      </Link>
      <PageHeader title={product.data ? product.data.name : title} description={isNew ? 'Tạo sản phẩm mới kèm biến thể, hình ảnh và thông số.' : 'Cập nhật thông tin, biến thể, hình ảnh và thông số.'} />
      {failed ? <div className="card"><ErrorState error={failed.error} onRetry={() => queries.forEach(x => x.refetch())} /></div>
        : queries.some(x => x.isPending) ? <FormSkeleton />
          : <ProductForm key={id ?? 'new'} id={isNew ? null : Number(id)} initial={product.data ? toForm(product.data) : EMPTY} />}
    </>
  )
}

function ProductForm({ id, initial }: { id: number | null; initial: FormIn }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const brands = useAdminBrands().data ?? []
  const categories = useAdminCategories().data ?? []

  const { register, control, handleSubmit, setError, setValue, watch, formState: { errors, isDirty } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  const variants = useFieldArray({ control, name: 'variants' })
  const images = useFieldArray({ control, name: 'images' })
  const specs = useFieldArray({ control, name: 'specs' })

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof toRequest>) =>
      id ? api.put<AdminProduct>(`/api/admin/products/${id}`, body) : api.post<AdminProduct>('/api/admin/products', body),
    onSuccess: p => {
      toast.success(id ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm')
      qc.setQueryData(['admin', 'product', String(p.id)], p)
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      navigate('/admin/san-pham')
    },
    onError: e => {
      applyFieldErrors(e, setError)
      toast.error(errorMessage(e))
    },
  })

  const onInvalid = () => toast.error('Vui lòng kiểm tra lại các trường được đánh dấu')

  return (
    <form onSubmit={handleSubmit(f => save.mutate(toRequest(f)), onInvalid)} noValidate className="space-y-6 pb-4">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Thông tin chung" className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Tên sản phẩm" required {...register('name')} error={errors.name?.message} wrapperClassName="sm:col-span-2" />
            <Input label="Slug" placeholder="Để trống để tự tạo từ tên" {...register('slug')} error={errors.slug?.message} wrapperClassName="sm:col-span-2" />
            <Select label="Thương hiệu" required {...register('brandId')} error={errors.brandId?.message}>
              <option value={0}>— Chọn thương hiệu —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}{b.isActive ? '' : ' (ẩn)'}</option>)}
            </Select>
            <Select label="Danh mục" required {...register('categoryId')} error={errors.categoryId?.message}>
              <option value={0}>— Chọn danh mục —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (ẩn)'}</option>)}
            </Select>
            <Textarea label="Mô tả ngắn" rows={2} className="min-h-0" {...register('shortDescription')} error={errors.shortDescription?.message} wrapperClassName="sm:col-span-2" />
            <Textarea label="Mô tả chi tiết" rows={8} {...register('description')} error={errors.description?.message} wrapperClassName="sm:col-span-2" hint="Hỗ trợ văn bản thuần, xuống dòng được giữ nguyên." />
          </div>
        </Card>

        <Card title="Hiển thị">
          <div className="space-y-3">
            <Checkbox label="Đang bán (hiển thị trên cửa hàng)" {...register('isActive')} />
            <Checkbox label="Sản phẩm nổi bật" {...register('isFeatured')} />
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Thông số kỹ thuật</h3>
              <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => specs.append({ key: '', value: '' })}>Thêm</Button>
            </div>
            <div className="space-y-2">
              {specs.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <input aria-label={`Tên thông số ${i + 1}`} placeholder="Màn hình" className="input w-2/5 py-2" {...register(`specs.${i}.key`)} />
                  <input aria-label={`Giá trị thông số ${i + 1}`} placeholder='6.1" OLED' className="input flex-1 py-2" {...register(`specs.${i}.value`)} />
                  <IconButton label={`Xóa thông số ${i + 1}`} tone="danger" onClick={() => specs.remove(i)}><Trash2 className="size-4" /></IconButton>
                </div>
              ))}
              {specs.fields.length === 0 && <p className="text-sm text-slate-500">Chưa có thông số.</p>}
            </div>
          </div>
        </Card>
      </div>

      <Card title={`Biến thể (${variants.fields.length})`}
        actions={<Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => variants.append(emptyVariant())}>Thêm biến thể</Button>}>
        {errors.variants?.root?.message || errors.variants?.message
          ? <p role="alert" className="mb-3 text-sm font-medium text-rose-600">{errors.variants.root?.message ?? errors.variants.message}</p> : null}
        <div className="space-y-4">
          {variants.fields.map((f, i) => (
            <VariantRow key={f.id} index={i} register={register} errors={errors} setValue={setValue}
              colorHex={watch(`variants.${i}.colorHex`)} onRemove={variants.fields.length > 1 ? () => variants.remove(i) : undefined} />
          ))}
        </div>
      </Card>

      <Card title={`Hình ảnh (${images.fields.length})`}
        actions={<div className="flex gap-2">
          <UploadButton label="Tải ảnh mới" onUploaded={url => images.append({ url, alt: '', color: '', sortOrder: images.fields.length + 1 })} />
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />}
            onClick={() => images.append({ url: '', alt: '', color: '', sortOrder: images.fields.length + 1 })}>Thêm dòng</Button>
        </div>}>
        {images.fields.length === 0 ? <p className="text-sm text-slate-500">Chưa có ảnh. Ảnh đầu tiên (thứ tự nhỏ nhất) sẽ là ảnh đại diện.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {images.fields.map((f, i) => {
              const url = watch(`images.${i}.url`)
              const e = errors.images?.[i]
              return (
                <div key={f.id} className="flex gap-4 rounded-xl border border-slate-200 p-3">
                  <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    {url ? <img src={assetUrl(url)} alt={`Ảnh ${i + 1}`} className="size-full object-contain" /> : <ImageIcon className="size-8 text-slate-300" aria-hidden />}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input label="URL ảnh" className="py-2" {...register(`images.${i}.url`)} error={e?.url?.message} wrapperClassName="sm:col-span-2" />
                    <Input label="Mô tả (alt)" className="py-2" {...register(`images.${i}.alt`)} error={e?.alt?.message} />
                    <Input label="Màu" className="py-2" placeholder="Theo màu biến thể" {...register(`images.${i}.color`)} error={e?.color?.message} />
                    <Input label="Thứ tự" type="number" className="py-2" {...register(`images.${i}.sortOrder`)} error={e?.sortOrder?.message} />
                    <div className="flex items-end justify-end gap-1">
                      <UploadButton label="Tải lên" onUploaded={u => setValue(`images.${i}.url`, u, { shouldDirty: true, shouldValidate: true })} />
                      <IconButton label={`Xóa ảnh ${i + 1}`} tone="danger" onClick={() => images.remove(i)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {isDirty && <span className="mr-auto text-sm text-amber-600">Có thay đổi chưa lưu</span>}
        <Button variant="ghost" onClick={() => navigate('/admin/san-pham')}>Hủy</Button>
        <Button type="submit" loading={save.isPending} icon={<Save className="size-4" aria-hidden />}>{id ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</Button>
      </div>
    </form>
  )
}

function VariantRow({ index: i, register, errors, setValue, colorHex, onRemove }: {
  index: number; register: UseFormRegister<FormIn>; errors: FieldErrors<FormIn>
  setValue: UseFormSetValue<FormIn>; colorHex: string; onRemove?: () => void
}) {
  const e = errors.variants?.[i]
  const c = 'py-2'
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="sr-only">Biến thể {i + 1}</legend>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Biến thể #{i + 1}</span>
        <div className="flex items-center gap-3">
          <Checkbox label="Đang bán" {...register(`variants.${i}.isActive`)} />
          {onRemove && <IconButton label={`Xóa biến thể ${i + 1}`} tone="danger" onClick={onRemove}><Trash2 className="size-4" /></IconButton>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Input label="SKU" className={`${c} uppercase`} {...register(`variants.${i}.sku`)} error={e?.sku?.message} wrapperClassName="col-span-2" />
        <Input label="Màu" className={c} {...register(`variants.${i}.color`)} error={e?.color?.message} />
        <div>
          <label className="label" htmlFor={`v${i}-hex`}>Mã màu</label>
          <div className="flex gap-1.5">
            <input type="color" aria-label={`Chọn màu biến thể ${i + 1}`} value={/^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#000000'}
              onChange={ev => setValue(`variants.${i}.colorHex`, ev.target.value, { shouldDirty: true, shouldValidate: true })}
              className="h-[38px] w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
            <input id={`v${i}-hex`} className={`input ${c} min-w-0 font-mono`} aria-invalid={!!e?.colorHex} {...register(`variants.${i}.colorHex`)} />
          </div>
          {e?.colorHex && <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{e.colorHex.message}</p>}
        </div>
        <Input label="Bộ nhớ (GB)" type="number" min={1} className={c} {...register(`variants.${i}.storageGb`)} error={e?.storageGb?.message} />
        <Input label="RAM (GB)" type="number" min={1} className={c} {...register(`variants.${i}.ramGb`)} error={e?.ramGb?.message} />
        <Input label="Tồn kho" type="number" min={0} className={c} {...register(`variants.${i}.stock`)} error={e?.stock?.message} />
        <Input label="Giá bán (₫)" type="number" min={0} step={1000} className={c} {...register(`variants.${i}.price`)} error={e?.price?.message} wrapperClassName="col-span-2 md:col-span-2" />
        <Input label="Giá gốc (₫)" type="number" min={0} step={1000} className={c} placeholder="Không bắt buộc" {...register(`variants.${i}.compareAtPrice`)} error={e?.compareAtPrice?.message} wrapperClassName="col-span-2 md:col-span-2" />
      </div>
    </fieldset>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải">
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  )
}
