import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AgeVerificationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-xl w-full p-8 text-center">
        <h2 className="text-xl md:text-2xl font-serif tracking-wide">AGE VERIFICATION</h2>
        <div className="text-left text-base md:text-lg text-primary-dark space-y-4 font-serif my-6">
          <p>Hi! Great to see you. We are so glad you have found us, and are excited to hear your story.</p>
          <p>
            Before you can chat with others, we ask that you verify your age with us (it&apos;s easy, I promise!)
            through uploading a photo ID and real-time selfie.
          </p>
          <p>
            We want to make sure that all users are at least 16 years old, but also ensure that users are matched with
            chat buddies within their age group. Once you complete this step, you have the option to create an account
            and save your verification information. Otherwise, feel free to continue as a guest (though you will have to
            re-verify).
          </p>
        </div>
        <Button asChild variant="outline" className="hover:underline text-sm">
          <Link href="/verify">Verify my age</Link>
        </Button>
      </div>
    </div>
  );
}
