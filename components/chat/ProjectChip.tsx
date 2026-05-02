'use client';

// @MX:NOTE ProjectChip — topbar breadcrumb showing current project name.
// Reads currentProjectId from useUIStore, renders project name, and opens
// a dropdown listing recent projects for fast switching.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-045, REQ-BREADTH-047)

import { FolderOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useProjects } from '@/lib/queries/useProjects';
import { useUIStore } from '@/stores/ui';

type ProjectRow = { id: string; name: string };

function useProjectById(id: string | null, projects: ProjectRow[]): ProjectRow | undefined {
  if (!id) return undefined;
  return projects.find((p) => p.id === id);
}

export function ProjectChip() {
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const recentProjects = useUIStore((s) => s.recentProjects);
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);

  const { data = [] } = useProjects();
  const allProjects = data as ProjectRow[];

  const currentProject = useProjectById(currentProjectId, allProjects);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build dropdown list from recentProjects IDs resolved to project objects.
  const recentList = recentProjects
    .map((id) => allProjects.find((p) => p.id === id))
    .filter((p): p is ProjectRow => p !== undefined);

  // If no recent projects yet, show all projects.
  const dropdownItems = recentList.length > 0 ? recentList : allProjects;

  const handleSelect = (projectId: string) => {
    setCurrentProjectId(projectId);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border-soft bg-surface-elevated px-3 py-1 text-sm text-ink-700 hover:bg-surface-soft transition-colors"
      >
        <FolderOpen size={14} className="text-brand-600 shrink-0" />
        <span>{currentProject?.name ?? '프로젝트 선택'}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="프로젝트 목록"
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border-soft bg-white py-1 shadow-md"
        >
          {dropdownItems.map((p) => (
            <li key={p.id}>
              <button
                role="option"
                aria-selected={p.id === currentProjectId}
                type="button"
                onClick={() => handleSelect(p.id)}
                className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-soft ${
                  p.id === currentProjectId ? 'font-medium text-brand-700' : 'text-ink-700'
                }`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
