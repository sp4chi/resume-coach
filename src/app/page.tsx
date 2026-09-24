import ResumeUpload from "@/components/ResumeUpload";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Resume coach</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Upload a resume to get feedback and interview prep.
        </p>
      </header>
      <ResumeUpload />
    </main>
  );
}
