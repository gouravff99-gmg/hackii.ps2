import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
}

const BASE =
  "w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 transition focus:outline-none focus:ring-4";
const OK = "border-ink-200 focus:border-brand-400 focus:ring-brand-100";
const BAD = "border-red-300 focus:border-red-400 focus:ring-red-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, hint, error, className = "", id, ...rest }, ref) {
    const inputId = id ?? rest.name ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`${BASE} h-11 ${error ? BAD : OK} ${className}`}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ label, hint, error, className = "", id, children, ...rest }, ref) {
  const selectId = id ?? rest.name ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={`${BASE} h-11 ${error ? BAD : OK} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
});
