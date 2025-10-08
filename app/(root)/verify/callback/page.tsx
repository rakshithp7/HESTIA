import { redirect } from 'next/navigation';

export default function VerifyCallbackPage() {
  redirect('/verify?result=completed');
}
