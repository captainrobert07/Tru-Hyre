"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";

type CommentRow = {
  id: number;
  body: string;
  authorEmail: string | null;
  authorId: number | null;
  createdAt: string;
};

export function Comments({
  comments,
  currentUserId,
  isAdmin,
  onAdd,
  onDelete,
}: {
  comments: CommentRow[];
  currentUserId: number;
  isAdmin: boolean;
  onAdd: (formData: FormData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const confirm = useConfirm();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("body", text);
    start(async () => {
      await onAdd(fd);
      setBody("");
      toast.success("Comment posted");
    });
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete this comment?",
      description: "This is irreversible.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    start(async () => {
      await onDelete(id);
      toast.success("Comment deleted");
    });
  };

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3">Comments</h2>

      <form onSubmit={submit} className="space-y-2 mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note. @ mention a teammate by their email."
          rows={3}
          className="input py-2 text-sm leading-relaxed"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              const form = (e.target as HTMLTextAreaElement).form;
              if (form) form.requestSubmit();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-ink-muted">
            Use @user@truhyre.app to notify them. <kbd className="px-1 rounded bg-canvas font-mono text-[10px]">⌘↵</kbd> to post.
          </p>
          <button type="submit" disabled={pending || !body.trim()} className="btn-brand text-xs h-9 px-4 disabled:opacity-50">
            {pending ? "Posting…" : "Comment"}
          </button>
        </div>
      </form>

      {comments.length === 0 ? (
        <div className="text-sm text-ink-muted py-4 text-center">No comments yet.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const canDelete = isAdmin || c.authorId === currentUserId;
            return (
              <li key={c.id} className="flex gap-3">
                <span className="size-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                  {(c.authorEmail || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium truncate">{c.authorEmail || "—"}</span>
                    <span className="text-ink-muted">{new Date(c.createdAt).toLocaleString()}</span>
                    {canDelete && (
                      <button onClick={() => handleDelete(c.id)} className="ml-auto text-ink-muted hover:text-red-700 text-[11px]">
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink mt-1 whitespace-pre-wrap leading-relaxed">{highlightMentions(c.body)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function highlightMentions(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(?<![\w@])@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    parts.push(<span key={`m${key++}`} className="bg-brand-50 text-brand-700 rounded px-1 py-0.5 text-xs font-medium">@{match[1]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts;
}
