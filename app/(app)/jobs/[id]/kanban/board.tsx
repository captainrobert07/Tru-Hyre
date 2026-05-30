"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/primitives";
import { Avatar } from "@/components/avatar";
import { moveSubmissionAction } from "./actions";

export type Card = {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateRefId: string;
  candidateTitle: string | null;
  candidateExperience: string | null;
  starred: boolean;
  status: string;
  createdAt: string;
};

type Tone = "blue" | "green" | "amber" | "red";

const COLUMNS: Array<{ status: Card["status"]; label: string; tone: Tone }> = [
  { status: "submitted", label: "Submitted", tone: "blue" },
  { status: "shortlist", label: "Shortlist", tone: "green" },
  { status: "interview", label: "Interview", tone: "amber" },
  { status: "hold", label: "Hold", tone: "amber" },
  { status: "offer", label: "Offer", tone: "green" },
  { status: "joined", label: "Joined", tone: "green" },
  { status: "reject", label: "Rejected", tone: "red" },
];

export function Board({ initialCards }: { initialCards: Card[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState<number | null>(null);

  // Refresh from server on mount + when initialCards change so optimistic
  // state doesn't drift if someone else moves a card.
  useEffect(() => setCards(initialCards), [initialCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = Number(e.active.id);
    const newStatus = e.over?.id?.toString();
    if (!newStatus) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === newStatus) return;

    // Optimistic
    const previous = cards;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));

    start(async () => {
      const r = await moveSubmissionAction({ submissionId: id, status: newStatus });
      if (!r.ok) {
        // Roll back
        setCards(previous);
        toast.error(r.error);
        return;
      }
      toast.success(`Moved to ${newStatus}`);
      router.refresh();
    });
  };

  const grouped = new Map<string, Card[]>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const c of cards) if (grouped.has(c.status)) grouped.get(c.status)!.push(c);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(Number(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-4" aria-busy={pending}>
        {COLUMNS.map((col) => (
          <Column key={col.status} status={col.status} label={col.label} tone={col.tone} cards={grouped.get(col.status) || []} draggingId={activeId} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  status,
  label,
  tone,
  cards,
  draggingId,
}: {
  status: string;
  label: string;
  tone: Tone;
  cards: Card[];
  draggingId: number | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-canvas border rounded-xl2 min-h-[400px] transition-colors ${
        isOver && draggingId !== null ? "border-brand-400 bg-brand-50/60" : "border-hairline"
      }`}
    >
      <div className="px-3 py-2.5 border-b border-hairline flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <Badge tone={tone}>{cards.length}</Badge>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
        {cards.length === 0 ? (
          <div className="text-[11px] text-ink-muted text-center py-8">
            {isOver && draggingId !== null ? `Drop here to move to "${label}"` : "Empty"}
          </div>
        ) : (
          cards.map((c) => <CardItem key={c.id} card={c} />)
        )}
      </div>
    </div>
  );
}

function CardItem({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`block bg-surface rounded-lg p-3 select-none ${
        isDragging ? "shadow-pop ring-2 ring-brand-400 cursor-grabbing" : "shadow-card hover:shadow-pop cursor-grab"
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <Avatar name={card.candidateName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight line-clamp-2">
            {card.starred && <span className="text-amber-500 mr-1" aria-label="starred">★</span>}
            {card.candidateName}
          </div>
          <div className="text-[10px] font-mono text-ink-muted">{card.candidateRefId}</div>
        </div>
      </div>
      <div className="text-xs text-ink-soft line-clamp-1">{card.candidateTitle || "—"}</div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="text-[10px] text-ink-muted">
          {card.candidateExperience ? `${card.candidateExperience} yrs · ` : ""}
          {new Date(card.createdAt).toLocaleDateString()}
        </div>
        <Link
          href={`/candidates/${card.candidateId}`}
          className="text-[10px] text-brand-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Open →
        </Link>
      </div>
    </div>
  );
}
