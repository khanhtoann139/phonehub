import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (id: string, describedBy?: string) => ReactNode
}

/** Bọc label + thông báo lỗi có aria-describedby cho mọi ô nhập. */
export function Field({ label, error, hint, required, className = '', children }: FieldProps) {
  const id = useId()
  const descId = error || hint ? `${id}-desc` : undefined
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label} {required && <span className="text-rose-500" aria-hidden>*</span>}
        </label>
      )}
      {children(id, descId)}
      {error ? (
        <p id={descId} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p id={descId} className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

type Base = { label?: string; error?: string; hint?: string; wrapperClassName?: string }

export function Input({ label, error, hint, wrapperClassName, className = '', ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & Base & { ref?: Ref<HTMLInputElement> }) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName}>
      {(id, desc) => <input id={id} ref={ref} aria-invalid={!!error} aria-describedby={desc} className={`input ${className}`} {...rest} />}
    </Field>
  )
}

export function Textarea({ label, error, hint, wrapperClassName, className = '', ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & Base & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName}>
      {(id, desc) => <textarea id={id} ref={ref} aria-invalid={!!error} aria-describedby={desc} className={`input min-h-28 ${className}`} {...rest} />}
    </Field>
  )
}

export function Select({ label, error, hint, wrapperClassName, className = '', children, ref, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & Base & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName}>
      {(id, desc) => (
        <select id={id} ref={ref} aria-invalid={!!error} aria-describedby={desc} className={`input pr-8 ${className}`} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function Checkbox({ label, className = '', ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; ref?: Ref<HTMLInputElement> }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${className}`}>
      <input type="checkbox" ref={ref} className="size-4 rounded border-slate-300 accent-brand-600" {...rest} />
      {label}
    </label>
  )
}
