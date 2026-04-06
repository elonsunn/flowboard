'use client';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Deterministic hue from name so the same person always gets the same color
function hueForName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const base = [
    'inline-flex items-center justify-center rounded-full font-medium select-none flex-shrink-0',
    sizeClasses[size],
    className,
  ].join(' ');

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={[base, 'object-cover'].join(' ')} />
    );
  }

  const hue = hueForName(name);

  return (
    <span
      className={base}
      style={{
        backgroundColor: `hsl(${hue} 60% 85%)`,
        color: `hsl(${hue} 60% 30%)`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
