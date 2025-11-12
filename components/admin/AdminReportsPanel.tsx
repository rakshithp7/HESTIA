'use client';

import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
  ActiveUserBan,
  BanDurationLabel,
  ModerationReport,
  ModerationReportStatus,
  UserBan,
} from '@/lib/supabase/types';
import { isBanActive } from '@/lib/moderation/bans';

type ReportWithActiveBan = ModerationReport & { activeBan: ActiveUserBan | null };

type ReportDetail = {
  report: ModerationReport;
  bans: UserBan[];
  activeBan: ActiveUserBan | null;
};

type AdminReportsPanelProps = {
  variant?: 'page' | 'embedded';
};

const STATUS_FILTERS: (ModerationReportStatus | 'all')[] = ['all', 'pending', 'resolved', 'dismissed'];
const BAN_OPTIONS: { label: string; value: BanDurationLabel }[] = [
  { label: '1 day', value: '1d' },
  { label: '1 week', value: '1w' },
  { label: '1 month', value: '1m' },
  { label: '1 year', value: '1y' },
];

export function AdminReportsPanel({ variant = 'page' }: AdminReportsPanelProps) {
  const [reports, setReports] = React.useState<ReportWithActiveBan[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<ModerationReportStatus | 'all'>('pending');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState<ReportWithActiveBan | null>(null);
  const [detail, setDetail] = React.useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [resolutionStatus, setResolutionStatus] = React.useState<ModerationReportStatus>('resolved');
  const [resolutionNotes, setResolutionNotes] = React.useState('');
  const [customBanUntil, setCustomBanUntil] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);

  const fetchReports = React.useCallback(async (filter: ModerationReportStatus | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const response = await fetch(`/api/admin/reports${query}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load reports');
      }
      const payload = (await response.json()) as { reports: ReportWithActiveBan[] };
      setReports(payload.reports);
    } catch (err) {
      console.error('[admin/reports] fetch error', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchReports(statusFilter);
  }, [fetchReports, statusFilter]);

  const handleOpenReport = React.useCallback(async (report: ReportWithActiveBan) => {
    setSelectedReport(report);
    setIsDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setResolutionStatus(report.status === 'pending' ? 'resolved' : report.status);
    setResolutionNotes('');
    try {
      const response = await fetch(`/api/admin/reports/${report.id}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load report');
      }
      const payload = (await response.json()) as ReportDetail;
      setDetail(payload);
    } catch (err) {
      console.error('[admin/report] detail error', err);
      toast.error((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshData = React.useCallback(async () => {
    await fetchReports(statusFilter);
    if (selectedReport) {
      await handleOpenReport(selectedReport);
    }
  }, [fetchReports, handleOpenReport, selectedReport, statusFilter]);

  const handleResolve = React.useCallback(
    async (newStatus: ModerationReportStatus) => {
      if (!selectedReport) return;
      setActionLoading(true);
      try {
        const response = await fetch(`/api/admin/reports/${selectedReport.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, notes: resolutionNotes }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update report');
        }
        toast.success('Report updated');
        await refreshData();
      } catch (err) {
        console.error('[admin/report] resolve error', err);
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [resolutionNotes, selectedReport, refreshData]
  );

  const handleBan = React.useCallback(
    async (durationLabel: BanDurationLabel, customEndsAt?: string) => {
      if (!selectedReport) return;
      setActionLoading(true);
      try {
        const response = await fetch(`/api/admin/reports/${selectedReport.id}/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationLabel, customEndsAt }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to issue ban');
        }
        toast.success('Ban issued');
        await refreshData();
      } catch (err) {
        console.error('[admin/report] ban error', err);
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshData, selectedReport]
  );

  const handleLiftBan = React.useCallback(
    async (banId: string) => {
      setActionLoading(true);
      try {
        const response = await fetch(`/api/admin/bans/${banId}/lift`, { method: 'POST' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to lift ban');
        }
        toast.success('Ban lifted');
        await refreshData();
      } catch (err) {
        console.error('[admin/ban] lift error', err);
        toast.error((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshData]
  );

  const closeDetail = React.useCallback(() => {
    setIsDetailOpen(false);
    setSelectedReport(null);
    setDetail(null);
    setCustomBanUntil('');
    setResolutionNotes('');
  }, []);

  const cardWrapperClass =
    variant === 'embedded' ? 'space-y-4 rounded-2xl border border-border/60 bg-card/20 p-6 shadow-sm' : 'space-y-6';

  return (
    <div className={variant === 'embedded' ? cardWrapperClass : 'space-y-6'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Moderation Reports</h1>
          <p className="text-sm text-secondary-foreground">Review escalations, issue bans, and resolve sessions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ModerationReportStatus | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === 'all' ? 'All statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => fetchReports(statusFilter)}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-secondary-foreground">
          Loading reports…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-destructive">{error}</div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-secondary-foreground">
          No reports found for this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-secondary-foreground">{formatDateTime(report.created_at)}</p>
                  <h2 className="text-lg font-semibold">{report.topic}</h2>
                  <p className="text-sm text-secondary-foreground">
                    Reporter: {report.reporter_email ?? report.reporter_id} · Reported:{' '}
                    {report.reported_email ?? report.reported_id}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={report.status} />
                  {report.activeBan && <BanBadge endsAt={report.activeBan.ends_at} />}
                  <Button size="sm" onClick={() => void handleOpenReport(report)}>
                    View details
                  </Button>
                </div>
              </div>
              <div className="mt-3 text-sm">
                <strong>Reasons:</strong> {report.reasons.join(', ')}
              </div>
              {report.notes && (
                <p className="mt-1 text-sm text-secondary-foreground">
                  <strong>Notes:</strong> {report.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={(open) => (open ? undefined : closeDetail())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Report details</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail || !selectedReport ? (
            <div className="py-8 text-center text-sm text-secondary-foreground">Loading report…</div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">Conversation context</h3>
                <div className="mt-2 grid gap-2 text-sm text-secondary-foreground sm:grid-cols-2">
                  <p>
                    <strong>Topic:</strong> {detail.report.topic}
                  </p>
                  <p>
                    <strong>Mode:</strong> {detail.report.mode}
                  </p>
                  <p>
                    <strong>Reporter:</strong> {detail.report.reporter_email ?? detail.report.reporter_id}
                  </p>
                  <p>
                    <strong>Reported:</strong> {detail.report.reported_email ?? detail.report.reported_id}
                  </p>
                  <p>
                    <strong>Created:</strong> {formatDateTime(detail.report.created_at)}
                  </p>
                  <p>
                    <strong>Status:</strong> <StatusBadge status={detail.report.status} />
                  </p>
                </div>
                <div className="mt-3">
                  <p className="text-sm">
                    <strong>Reasons:</strong> {detail.report.reasons.join(', ')}
                  </p>
                  {detail.report.notes && (
                    <p className="mt-1 text-sm text-secondary-foreground">
                      <strong>Reporter notes:</strong> {detail.report.notes}
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">Chat transcript</h3>
                {detail.report.chat_log && detail.report.chat_log.length > 0 ? (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3 text-sm">
                    {detail.report.chat_log.map((message) => (
                      <div key={message.id} className="space-y-1">
                        <p className="text-secondary-foreground">
                          <strong>{message.sender === 'me' ? 'Reporter' : 'Peer'}</strong> ·{' '}
                          {formatDateTime(message.timestamp)}
                        </p>
                        <p>{message.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-secondary-foreground">No chat transcript available.</p>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Ban controls</h3>
                  {detail.activeBan ? (
                    <BanBadge endsAt={detail.activeBan.ends_at} />
                  ) : (
                    <span className="text-xs uppercase text-secondary-foreground">No active ban</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {BAN_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => void handleBan(option.value)}>
                      Ban {option.label}
                    </Button>
                  ))}
                </div>
                <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
                  <span className="text-sm font-medium">Custom until</span>
                  <Input
                    type="datetime-local"
                    value={customBanUntil}
                    onChange={(event) => setCustomBanUntil(event.target.value)}
                    disabled={actionLoading}
                  />
                  <Button
                    size="sm"
                    disabled={!customBanUntil || actionLoading}
                    onClick={() => void handleBan('custom', customBanUntil)}>
                    Ban until
                  </Button>
                </div>
                {detail.activeBan && (
                  <Button
                    variant="destructive"
                    disabled={actionLoading}
                    onClick={() => void handleLiftBan(detail.activeBan!.id)}>
                    Lift active ban
                  </Button>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Resolve report</h3>
                  <StatusBadge status={detail.report.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Select
                      value={resolutionStatus}
                      onValueChange={(value) => setResolutionStatus(value as ModerationReportStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Set status" />
                      </SelectTrigger>
                      <SelectContent>
                        {['resolved', 'dismissed'].map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button disabled={actionLoading} onClick={() => void handleResolve(resolutionStatus)}>
                      Update status
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add resolution notes…"
                      value={resolutionNotes}
                      onChange={(event) => setResolutionNotes(event.target.value)}
                      disabled={actionLoading}
                    />
                    <p className="text-right text-xs text-secondary-foreground">{resolutionNotes.length}/500</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">Ban history</h3>
                {detail.bans.length === 0 ? (
                  <p className="text-sm text-secondary-foreground">No bans recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.bans.map((ban) => (
                      <div key={ban.id} className="rounded-lg border border-border/60 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p>
                              <strong>Duration:</strong> {ban.duration_label}
                            </p>
                            <p>
                              <strong>Issued:</strong> {formatDateTime(ban.starts_at)}
                            </p>
                          </div>
                          {isBanActive(ban) ? (
                            <BanBadge endsAt={ban.ends_at} />
                          ) : (
                            <span className="text-xs uppercase tracking-wide text-secondary-foreground">Expired</span>
                          )}
                        </div>
                        <p>
                          <strong>Ends:</strong> {formatDateTime(ban.ends_at)}
                        </p>
                        {ban.reason && (
                          <p className="text-secondary-foreground">
                            <strong>Reason:</strong> {ban.reason}
                          </p>
                        )}
                        {ban.notes && (
                          <p className="text-secondary-foreground">
                            <strong>Notes:</strong> {ban.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ModerationReportStatus }) {
  const styles: Record<ModerationReportStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    dismissed: 'bg-slate-200 text-slate-800',
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{status}</span>;
}

function BanBadge({ endsAt }: { endsAt: string }) {
  return (
    <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
      Banned until {formatDateTime(endsAt)}
    </span>
  );
}

function formatDateTime(date: string | number): string {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}
