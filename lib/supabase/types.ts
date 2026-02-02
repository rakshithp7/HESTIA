import type { ChatMessage } from '@/lib/webrtc/useRTCSession';

export type ProfileVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'requires_input'
  | 'verified'
  | 'failed';
export type ProfileRole = 'member' | 'admin';
export type ModerationReportStatus = 'pending' | 'resolved' | 'dismissed';
export type BanDurationLabel = '1d' | '1w' | '1m' | '1y' | 'custom';

export type Profile = {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  verification_status: ProfileVerificationStatus;
  verification_required: boolean;
  verification_attempts: number;
  stripe_session_id: string | null;
  stripe_verification_id: string | null;
  verification_initiated_at: string | null;
  verification_completed_at: string | null;
  role: ProfileRole;
};

export type ModerationReport = {
  id: string;
  room_id: string;
  topic: string;
  mode: 'voice' | 'chat';
  reporter_id: string;
  reporter_email: string | null;
  reported_id: string;
  reported_email: string | null;
  reasons: string[];
  notes: string | null;
  chat_log: ChatMessage[] | null;
  status: ModerationReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UserBan = {
  id: string;
  user_id: string;
  report_id: string | null;
  reason: string | null;
  notes: string | null;
  duration_label: BanDurationLabel;
  issued_by: string;
  starts_at: string;
  ends_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ActiveUserBan = UserBan;
