"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export function InlineEdit({
  field,
  defaultValue,
  placeholder = "—",
  multiline,
  onSave,
}: {
  field: string;
  defaultValue: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();

  const submit = () => {
    if (value === defaultValue) {
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("field", field);
    fd.set("value", value);
    start(async () => {
      await onSave(fd);
      setEditing(false);
      toast.success("Saved");
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group text-left w-full inline-flex items-center gap-1 text-ink hover:text-brand-700 transition-colors"
      >
        <span className={value ? "" : "text-ink-muted"}>{value || placeholder}</span>
        <Pencil size={11} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {multiline ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className="input text-sm py-2 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(defaultValue);
              setEditing(false);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
      ) : (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input text-sm flex-1 h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              setValue(defaultValue);
              setEditing(false);
            }
          }}
        />
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="size-7 inline-flex items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
        aria-label="Save"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(defaultValue);
          setEditing(false);
        }}
        className="size-7 inline-flex items-center justify-center rounded-md bg-canvas text-ink-soft hover:text-ink"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
