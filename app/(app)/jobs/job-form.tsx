"use client";

import Link from "next/link";

type Option = { id: number; name: string };

export function JobForm({
  action,
  clients,
  vendors,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Option[];
  vendors: Option[];
  initial?: {
    title?: string;
    clientAccountId?: number | null;
    status?: string;
    priority?: string;
    location?: string | null;
    workMode?: string | null;
    experienceMin?: string | null;
    experienceMax?: string | null;
    ctcMin?: string | null;
    ctcMax?: string | null;
    positions?: number;
    description?: string | null;
    skills?: string[] | null;
    closeBy?: string | null;
    vendorIds?: number[];
  };
}) {
  const v = initial || {};
  const vendorIdsCsv = (v.vendorIds || []).join(",");
  return (
    <form action={action} className="card p-6 max-w-3xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="title" className="label">Title</label>
          <input id="title" name="title" required defaultValue={v.title || ""} className="input" />
        </div>

        <div>
          <label htmlFor="clientAccountId" className="label">Client</label>
          <select id="clientAccountId" name="clientAccountId" required defaultValue={v.clientAccountId ?? ""} className="input">
            <option value="" disabled>Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="positions" className="label">Positions</label>
          <input id="positions" name="positions" type="number" min={1} defaultValue={v.positions ?? 1} className="input" />
        </div>

        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={v.status || "open"} className="input">
            <option value="open">Open</option>
            <option value="hold">Hold</option>
            <option value="closing">Closing</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="label">Priority</label>
          <select id="priority" name="priority" defaultValue={v.priority || "normal"} className="input">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label htmlFor="location" className="label">Location</label>
          <input id="location" name="location" defaultValue={v.location || ""} className="input" />
        </div>

        <div>
          <label htmlFor="workMode" className="label">Work mode</label>
          <input id="workMode" name="workMode" placeholder="Onsite / Hybrid / Remote" defaultValue={v.workMode || ""} className="input" />
        </div>

        <div>
          <label htmlFor="experienceMin" className="label">Experience min (yrs)</label>
          <input id="experienceMin" name="experienceMin" defaultValue={v.experienceMin || ""} className="input" />
        </div>
        <div>
          <label htmlFor="experienceMax" className="label">Experience max (yrs)</label>
          <input id="experienceMax" name="experienceMax" defaultValue={v.experienceMax || ""} className="input" />
        </div>

        <div>
          <label htmlFor="ctcMin" className="label">CTC min</label>
          <input id="ctcMin" name="ctcMin" defaultValue={v.ctcMin || ""} className="input" />
        </div>
        <div>
          <label htmlFor="ctcMax" className="label">CTC max</label>
          <input id="ctcMax" name="ctcMax" defaultValue={v.ctcMax || ""} className="input" />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="closeBy" className="label">Close by</label>
          <input id="closeBy" name="closeBy" type="date" defaultValue={v.closeBy || ""} className="input" />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="skillsCsv" className="label">Skills (comma-separated)</label>
          <input id="skillsCsv" name="skillsCsv" defaultValue={(v.skills || []).join(", ")} className="input" placeholder="Java, Kafka, AWS" />
        </div>

        <div className="md:col-span-2">
          <label className="label">Assigned vendors</label>
          <input type="hidden" name="vendorIdsCsv" id="vendorIdsCsv" defaultValue={vendorIdsCsv} />
          <VendorChips vendors={vendors} initial={v.vendorIds || []} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" name="description" rows={6} defaultValue={v.description || ""} className="input py-2 leading-relaxed" />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">Save</button>
        <Link href="/jobs" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}

function VendorChips({ vendors, initial }: { vendors: Option[]; initial: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" id="vendor-chips">
      {vendors.length === 0 && <div className="text-xs text-ink-muted">No vendors yet — add one under Vendors.</div>}
      {vendors.map((v) => (
        <label
          key={v.id}
          className="flex items-center gap-1.5 px-2 h-7 rounded-full border border-hairline bg-canvas text-xs cursor-pointer hover:bg-surface select-none has-[:checked]:bg-brand-50 has-[:checked]:border-brand-100 has-[:checked]:text-brand-700"
        >
          <input
            type="checkbox"
            value={v.id}
            defaultChecked={initial.includes(v.id)}
            className="sr-only"
            onChange={(e) => {
              const input = document.getElementById("vendorIdsCsv") as HTMLInputElement | null;
              if (!input) return;
              const ids = new Set((input.value || "").split(",").map((s) => s.trim()).filter(Boolean));
              if (e.currentTarget.checked) ids.add(String(v.id));
              else ids.delete(String(v.id));
              input.value = [...ids].join(",");
            }}
          />
          {v.name}
        </label>
      ))}
    </div>
  );
}
