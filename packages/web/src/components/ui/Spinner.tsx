'use client';

type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-4',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        sizeClasses[size],
        className,
      ].join(' ')}
    />
  );
}
