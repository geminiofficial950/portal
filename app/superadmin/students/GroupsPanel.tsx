"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { TrashIcon } from "../../dashboard/_components/icons";
import { GROUP_NAME_MAX, type GroupDTO } from "@/lib/group-meta";
import { createGroupAction, deleteGroupAction, renameGroupAction } from "./actions";

// Super Admin: create, rename and delete student groups
export default function GroupsPanel({
  groups,
  onChange,
  onDeleted,
  onClose,
}: {
  groups: GroupDTO[];
  onChange: (groups: GroupDTO[]) => void;
  onDeleted: (groupId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ groupId: string; name: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const sorted = (list: GroupDTO[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await createGroupAction(name);
      if (!res.ok) return void toast.error(res.error);
      onChange(sorted([...groups, res.group]));
      setName("");
      toast.success(`Group “${res.group.name}” created`);
    });
  };

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    startSaving(async () => {
      const res = await renameGroupAction(editing.groupId, editing.name);
      if (!res.ok) return void toast.error(res.error);
      onChange(sorted(groups.map((g) => (g.groupId === editing.groupId ? { ...g, name: res.name } : g))));
      setEditing(null);
      toast.success("Group renamed");
    });
  };

  const remove = (g: GroupDTO) => {
    const note = g.students ? ` Its ${g.students} student${g.students === 1 ? "" : "s"} will stay, just without a group.` : "";
    if (!window.confirm(`Delete the group “${g.name}”?${note}`)) return;
    startSaving(async () => {
      const res = await deleteGroupAction(g.groupId);
      if (!res.ok) return void toast.error(res.error);
      onChange(groups.filter((x) => x.groupId !== g.groupId));
      onDeleted(g.groupId);
      toast.success(`Group “${g.name}” deleted`);
    });
  };

  const inputClass =
    "min-w-0 flex-1 rounded-xl bg-white px-4 py-2.5 text-sm outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30";

  return (
    <section className="space-y-4 rounded-[1.75rem] bg-lilac/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-ink">Student groups</h2>
          <p className="mt-0.5 text-xs text-ink/60">Make groups (for example a batch or class), then put students in them from the table below.</p>
        </div>
        <button onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-white/70">
          Close
        </button>
      </div>

      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input
          required
          value={name}
          maxLength={GROUP_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group name, e.g. Batch A – Nov 2026"
          aria-label="New group name"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
        >
          Create group
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-ink/55">No groups yet.</p>
      ) : (
        <ul className="divide-y divide-ink/5 overflow-hidden rounded-2xl bg-white">
          {groups.map((g) => (
            <li key={g.groupId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {editing?.groupId === g.groupId ? (
                <form onSubmit={rename} className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <input
                    autoFocus
                    required
                    value={editing.name}
                    maxLength={GROUP_NAME_MAX}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    aria-label={`New name for ${g.name}`}
                    className={`${inputClass} bg-lilac`}
                  />
                  <button type="submit" disabled={saving} className="rounded-full bg-plum px-4 py-2 text-xs font-medium text-white disabled:opacity-60">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-full px-3 py-2 text-xs text-ink/60 hover:bg-lilac">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{g.name}</span>
                  <span className="text-xs text-ink/55">
                    {g.students} student{g.students === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => setEditing({ groupId: g.groupId, name: g.name })}
                    className="rounded-full bg-lilac px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-plum/10 hover:text-plum"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => remove(g)}
                    disabled={saving}
                    aria-label={`Delete ${g.name}`}
                    className="rounded-full p-1.5 text-ink/40 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
