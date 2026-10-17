import type { ButtonHTMLAttributes } from 'react';

import { cx } from '@/lib/cx';

/** The site's button: filled for the main action, outline for the rest. */
export const Button = ({
  variant = 'filled',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'filled' | 'outline' }) => (
  <button
    className={cx('button', variant === 'outline' && 'button-outline', className)}
    {...props}
  />
);
