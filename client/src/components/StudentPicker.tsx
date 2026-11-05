import { useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/format";

export interface StudentPickerOption {
  id: string;
  name: string;
  phone: string;
  balanceDue: number;
}

interface StudentPickerProps {
  students: StudentPickerOption[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
  className?: string;
}

const MAX_RESULTS = 20;

/** Type-to-search combobox — a plain <select> doesn't scale to thousands of students. */
export function StudentPicker({ students, value, onChange, placeholder, className }: StudentPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = students.find((s) => s.id === value);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source = term ? students.filter((s) => s.name.toLowerCase().includes(term) || s.phone.includes(term)) : students;
    return source.slice(0, MAX_RESULTS);
  }, [students, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (student: StudentPickerOption) => {
    onChange(student.id);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 ${className ?? ""}`}>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? query : selected ? `${selected.name} — ${selected.phone}` : ""}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          placeholder={placeholder ?? "Search by name or phone..."}
          autoComplete="off"
          className="input w-full pr-7"
        />
        {selected && !isOpen && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear selected student"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No students match.</p>}
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="truncate">
                {s.name} <span className="text-slate-400">— {s.phone}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">due {formatINR(s.balanceDue)}</span>
            </button>
          ))}
          {students.length > MAX_RESULTS && filtered.length === MAX_RESULTS && (
            <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">
              Showing first {MAX_RESULTS} — keep typing to narrow down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
