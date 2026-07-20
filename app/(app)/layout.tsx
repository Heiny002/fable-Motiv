import { redirect } from "next/navigation";
import SWRegister from "@/components/SWRegister";
import TabBar from "@/components/TabBar";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-20">
      <SWRegister />
      {children}
      <TabBar />
    </div>
  );
}
