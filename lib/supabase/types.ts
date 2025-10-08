export type ProfileVerificationStatus = 'unverified' | 'pending' | 'requires_input' | 'verified' | 'failed';

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
};
