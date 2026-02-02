'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type UserAvatarProps = {
  initials: string;
  onSignOut: () => void | Promise<void>;
  className?: string;
  isAdmin?: boolean;
};

export default function UserAvatar({
  initials,
  onSignOut,
  className,
  isAdmin,
}: UserAvatarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          aria-label="User menu"
          className={cn(
            'size-10 rounded-full bg-foreground text-background font-bold flex items-center justify-center cursor-pointer',
            className
          )}
        >
          {initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="text-base">
            {' '}
            Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="text-base">
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onSignOut()} className="text-base">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
