import ResumeCoach from "@/components/ResumeCoach";

export default function Home() {
  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Resume coach</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Upload a resume, then ask for feedback or interview practice.
        </p>
      </header>
      <ResumeCoach />
    </main>
  );
}
