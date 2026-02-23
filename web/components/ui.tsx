import type {ComponentPropsWithoutRef, ElementType, ReactNode} from 'react';

type ButtonProps<C extends ElementType> = {
  as?: C;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<C>, 'as' | 'className' | 'children'>;

export function Button<C extends ElementType = 'button'>({
  as,
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps<C>) {
  const Component = (as || 'button') as ElementType;
  const buttonProps =
    Component === 'button' && (props as Record<string, unknown>).type == null
      ? ({...props, type: 'button'} as Record<string, unknown>)
      : (props as Record<string, unknown>);

  return (
    <Component className={`ui-btn ui-btn-${variant} ${className}`.trim()} {...buttonProps}>
      {children}
    </Component>
  );
}

export function Card({
  className = '',
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<'section'>) {
  return (
    <section className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Container({
  className = '',
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={`cc-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function Section({
  className = '',
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<'section'>) {
  return (
    <section className={`cc-section ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Badge({
  variant = 'neutral',
  className = '',
  children
}: {
  variant?: 'neutral' | 'featured' | 'pending' | string;
  className?: string;
  children: ReactNode;
}) {
  return <span className={`ui-badge ui-badge-${variant} ${className}`.trim()}>{children}</span>;
}

export function TextInput({
  label,
  className = '',
  ...props
}: {
  label?: string;
  className?: string;
} & ComponentPropsWithoutRef<'input'>) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <input className="input" {...props} />
    </label>
  );
}

export function SelectInput({
  label,
  className = '',
  children,
  ...props
}: {
  label?: string;
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<'select'>) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <select className="input" {...props}>
        {children}
      </select>
    </label>
  );
}

export function ConfirmModal({
  open,
  title,
  text,
  loading,
  confirmText,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  text: string;
  loading?: boolean;
  confirmText?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  if (!open) return null;
  const effectiveConfirmText = confirmText || 'Confirm';

  return (
    <div className="modal-bg" role="dialog" aria-modal="true">
      <div className="modal">
        <h4>{title}</h4>
        <p>{text}</p>
        <div className="actions">
          <Button variant="ghost" type="button" onClick={onCancel} disabled={loading}>
            Back
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : effectiveConfirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({className = ''}: {className?: string}) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}
