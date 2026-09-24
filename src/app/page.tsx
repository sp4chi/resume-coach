import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import ResumeCoach from "@/components/ResumeCoach";

// Clerk Core 3 removed <SignedIn> and <SignedOut>. The replacement is
// <Show when="signed-in"> with an optional fallback.

function SignInPrompt() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Sign in to upload a resume. Your resume and chat stay private to you.
      </p>
      <SignInButton mode="modal">
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Resume coach</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Upload a resume, then ask for feedback or interview practice.
          </p>
        </div>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>

      <Show when="signed-in" fallback={<SignInPrompt />}>
        <ResumeCoach />
      </Show>
    </main>
  );
}
