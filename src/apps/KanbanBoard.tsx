/**
 * @file Mission Board: a Kanban task board.
 *
 * Uses the native HTML5 Drag and Drop API (no library), with arrow button fallbacks
 * so every action also works from the keyboard. Tasks persist in localStorage.
 */
import { useMemo, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Column = "todo" | "doing" | "done";

type Priority = "low" | "med" | "high";

interface Task {
  /** Generated with crypto.randomUUID(), so ids never collide. */
  id: string;
  text: string;
  column: Column;
  priority: Priority;
}

const COLUMNS: { id: Column; title: string; accent: string }[] = [
  { id: "todo", title: "Backlog", accent: "text-muted" },
  { id: "doing", title: "In progress", accent: "text-accent" },
  { id: "done", title: "Shipped", accent: "text-good" },
];

const PRIORITY_STYLES: Record<Priority, string> = { low: "border-good/50 text-good", med: "border-warn/50 text-warn", high: "border-bad/50 text-bad" };
/** Clicking a priority tag cycles low, med, high, and back to low. */
const NEXT_PRIORITY: Record<Priority, Priority> = { low: "med", med: "high", high: "low" };

/** Starter tasks shown on a first visit (and after "Reset board"). */
const SEED: Task[] = [
  { id: "1", text: "Polish portfolio README", column: "done", priority: "med" },
  { id: "2", text: "Apply to software engineer roles", column: "doing", priority: "high" },
  { id: "3", text: "Write blog post about canvas game loops", column: "todo", priority: "low" },
  { id: "4", text: "Practice data structures and algorithms", column: "todo", priority: "med" },
];

export default function KanbanBoard() {
  const [tasks, setTasks, resetTasks] = useLocalStorage<Task[]>("ngt:kanban", SEED);
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState<Column | null>(null);

  /**
   * Group tasks by column in a single O(n) pass. The naive approach filters the whole
   * list once per column, which is O(columns * n) on every render.
   */
  const byColumn = useMemo(() => {
    const groups: Record<Column, Task[]> = { todo: [], doing: [], done: [] };
    for (const task of tasks) groups[task.column].push(task);
    return groups;
  }, [tasks]);

  const move = (id: string, column: Column) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, column } : t)));
  const remove = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));
  const cyclePriority = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, priority: NEXT_PRIORITY[t.priority] } : t)));

  /** Adds a task from the form. Input is trimmed and length capped before it is stored. */
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 120);
    if (!text) return;
    setTasks((ts) => [...ts, { id: crypto.randomUUID(), text, column: "todo", priority: "med" }]);
    setDraft("");
  };

  /** Keyboard friendly alternative to dragging: move a task one column left or right. */
  const shift = (task: Task, dir: -1 | 1) => {
    const idx = COLUMNS.findIndex((c) => c.id === task.column) + dir;
    const target = COLUMNS[idx];
    if (target) move(task.id, target.id);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task and press Enter" maxLength={120} aria-label="New task" />
        <button className="btn btn-primary shrink-0 !py-2" type="submit">Add</button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = byColumn[col.id];
          return (
            <section
              key={col.id}
              aria-label={col.title}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                // The dragged task's id travels in the drag event's data payload.
                const id = e.dataTransfer.getData("text/plain");
                if (id) move(id, col.id);
                setDragOver(null);
              }}
              className={`panel min-h-40 p-3 transition-colors ${dragOver === col.id ? "border-accent bg-accent/5" : ""}`}
            >
              <h4 className={`mb-2 flex justify-between font-mono text-sm ${col.accent}`}>
                {col.title} <span className="text-muted">{items.length}</span>
              </h4>
              <ul className="space-y-2">
                {items.map((t) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="group cursor-grab rounded-lg border border-border bg-bg p-2 text-sm active:cursor-grabbing"
                  >
                    <p className={t.column === "done" ? "text-muted line-through" : ""}>{t.text}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <button onClick={() => cyclePriority(t.id)} className={`chip !px-2 !py-0 ${PRIORITY_STYLES[t.priority]}`} title="Change priority">
                        {t.priority}
                      </button>
                      <span className="flex-1" />
                      <button onClick={() => shift(t, -1)} disabled={col.id === "todo"} className="px-1 text-muted hover:text-accent disabled:opacity-20" aria-label="Move left">←</button>
                      <button onClick={() => shift(t, 1)} disabled={col.id === "done"} className="px-1 text-muted hover:text-accent disabled:opacity-20" aria-label="Move right">→</button>
                      <button onClick={() => remove(t.id)} className="px-1 text-muted hover:text-bad" aria-label="Delete task">✕</button>
                    </div>
                  </li>
                ))}
                {items.length === 0 && <li className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">Drop tasks here</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>Drag cards between columns. Saved automatically in your browser.</span>
        <button onClick={resetTasks} className="hover:text-accent">Reset board</button>
      </div>
    </div>
  );
}
