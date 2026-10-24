import { useState } from 'react';
import { avatarFor, cn, initials } from '../../lib/utils';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-24 w-24 text-2xl',
};

// Image avatar that gracefully falls back to initials if the image fails to load.
export function Avatar({ person, src, name, size = 'md', className }) {
  const displayName = name || person?.name || '';
  const url = src || avatarFor(person || { name: displayName });
  const [failedUrl, setFailedUrl] = useState(null);
  const failed = failedUrl === url;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-semibold text-brand-800 ring-1 ring-slate-200',
        SIZES[size],
        className
      )}
    >
      {failed ? (
        <span aria-hidden="true">{initials(displayName)}</span>
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      )}
      <span className="sr-only">{displayName}</span>
    </span>
  );
}

export default Avatar;
