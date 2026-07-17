/**
 * Clickable avatar that navigates to a user's profile page.
 * Use everywhere an author photo / username appears in the app.
 */
import { useLocation } from 'wouter';
import { User } from 'lucide-react';

interface UserAvatarProps {
  userId?: string | null;
  photoUrl?: string | null;
  displayName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

const ICON_SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export function UserAvatar({
  userId,
  photoUrl,
  displayName,
  size = 'sm',
  showName = false,
  className = '',
}: UserAvatarProps) {
  const [, navigate] = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    if (!userId) return;
    e.stopPropagation();
    e.preventDefault();
    navigate(`/profile/${userId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!userId}
      className={`flex items-center gap-2 group ${userId ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    >
      <div
        className={`${SIZE_MAP[size]} rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 transition-all ${userId ? 'group-hover:border-primary/50 group-hover:shadow-[0_0_8px_rgba(201,168,76,0.2)]' : ''}`}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={displayName ?? ''} className="w-full h-full object-cover" />
        ) : (
          <User className={`${ICON_SIZE_MAP[size]} text-muted-foreground`} />
        )}
      </div>
      {showName && displayName && (
        <span className={`text-sm font-medium text-foreground truncate ${userId ? 'group-hover:text-primary transition-colors' : ''}`}>
          {displayName}
        </span>
      )}
    </button>
  );
}
