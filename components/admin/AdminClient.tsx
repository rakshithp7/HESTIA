'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AdminReportsPanel } from '@/components/admin/AdminReportsPanel';

type AdminNavItemId = 'reports';

const ADMIN_NAV_ITEMS: { id: AdminNavItemId; label: string }[] = [{ id: 'reports', label: 'Reports' }];

type AdminClientProps = {
  displayName: string;
  initialSection?: string;
};

export function AdminClient({ displayName, initialSection }: AdminClientProps) {
  const sanitizeSection = React.useCallback((section?: string): AdminNavItemId => {
    const candidate = section as AdminNavItemId | undefined;
    return candidate && ADMIN_NAV_ITEMS.some((item) => item.id === candidate) ? candidate : 'reports';
  }, []);

  const [activeSection, setActiveSection] = React.useState<AdminNavItemId>(() => sanitizeSection(initialSection));

  React.useEffect(() => {
    setActiveSection(sanitizeSection(initialSection));
  }, [initialSection, sanitizeSection]);

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-5xl space-y-8 text-foreground">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.15em] text-foreground/80">Admin Console</p>
          <h1 className="text-3xl md:text-4xl font-semibold">Welcome back, {displayName}</h1>
          <p className="text-foreground">Manage moderation workflows and safety actions for the community.</p>
        </header>

        <div className="md:hidden">
          <Select value={activeSection} onValueChange={(value) => setActiveSection(value as AdminNavItemId)}>
            <SelectTrigger className="w-full justify-between h-12! text-foreground">
              <SelectValue placeholder="Choose section" />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_NAV_ITEMS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="hidden md:block md:w-64">
            <nav className="rounded-2xl border border-border/70 bg-card/20 p-4 shadow-sm text-foreground">
              <ul className="space-y-2">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full justify-start rounded-lg px-3 py-2 text-base font-semibold transition-all text-left h-12',
                          isActive
                            ? 'bg-primary/80 text-primary-foreground shadow-sm ring-1 ring-border/60'
                            : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                        )}>
                        {item.label}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <main className="flex-1 space-y-8">
            {activeSection === 'reports' ? <AdminReportsPanel variant="embedded" /> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
