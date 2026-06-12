import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AiSearch } from "@/components/ai-search";
import { aiSearchAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI search" };

export default async function AiSearchPage() {
  await requireStaff();
  if (!(await isFeatureEnabled("ai_search"))) redirect("/candidates");

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/candidates", label: "Candidates" },
          { label: "AI search" },
        ]}
      />
      <PageHeader
        title="AI candidate search"
        subtitle="Describe who you need in plain English — Tru Hyre turns it into structured filters and ranks your pool."
      />
      <AiSearch
        onSearch={async (query) => {
          "use server";
          return await aiSearchAction(query);
        }}
      />
    </>
  );
}
