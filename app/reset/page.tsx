import ResetForm from "@/components/ResetForm";

export default function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-extrabold">Choose a new password</h1>
      <p className="mb-8 text-slate-600">Pick something at least 8 characters long.</p>
      <ResetForm token={searchParams.token ?? ""} />
    </main>
  );
}
