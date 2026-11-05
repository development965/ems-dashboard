import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  addFeeStructure,
  createCourse,
  deleteCourse,
  deleteFeeStructure,
  fetchCourses,
  updateFeeStructure,
} from "@/lib/coursesApi";
import { formatINR } from "@/lib/format";
import type { Course, CourseMode, FeeStructure } from "@/types/course";

const modes: CourseMode[] = ["ONLINE", "OFFLINE", "HYBRID"];

export function CoursesPage() {
  const queryClient = useQueryClient();
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [durationText, setDurationText] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createCourse({ name, code, durationText: durationText || undefined }),
    onSuccess: () => {
      setName("");
      setCode("");
      setDurationText("");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Course name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required className="input w-32" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Duration</span>
          <input
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            placeholder="e.g. 6 weeks"
            className="input"
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Add course
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {coursesQuery.data?.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
        {coursesQuery.isSuccess && coursesQuery.data.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            No courses yet.
          </p>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [label, setLabel] = useState("Standard");
  const [mode, setMode] = useState<CourseMode>("OFFLINE");
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: () => addFeeStructure(course.id, { label, mode, amount: Number(amount) }),
    onSuccess: () => {
      setAmount("");
      setShowFeeForm(false);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });

  const deleteCourseError =
    deleteCourseMutation.isError &&
    ((deleteCourseMutation.error as AxiosError<{ error: string }>).response?.data?.error ?? "Failed to delete course");

  const handleDeleteCourse = () => {
    if (window.confirm(`Delete "${course.name}"? This can't be undone.`)) {
      deleteCourseMutation.mutate();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {course.name} <span className="font-normal text-slate-400">({course.code})</span>
          </p>
          {course.durationText && <p className="text-sm text-slate-500">{course.durationText}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFeeForm((v) => !v)} className="text-sm font-medium text-brand-600 hover:underline">
            + Fee structure
          </button>
          <button
            onClick={handleDeleteCourse}
            disabled={deleteCourseMutation.isPending}
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
      {deleteCourseError && <p className="mt-2 text-sm text-red-600">{deleteCourseError}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {course.feeStructures.map((fee) => (
          <FeeStructureRow key={fee.id} courseId={course.id} fee={fee} />
        ))}
        {course.feeStructures.length === 0 && <span className="text-xs text-slate-400">No fee structures yet.</span>}
      </div>

      {showFeeForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} required className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as CourseMode)} className="input">
              {modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input w-32"
            />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function FeeStructureRow({ courseId, fee }: { courseId: string; fee: FeeStructure }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(fee.label);
  const [mode, setMode] = useState<CourseMode>(fee.mode);
  const [amount, setAmount] = useState(String(fee.amount));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["courses"] });

  const updateMutation = useMutation({
    mutationFn: () => updateFeeStructure(courseId, fee.id, { label, mode, amount: Number(amount) }),
    onSuccess: () => {
      setIsEditing(false);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFeeStructure(courseId, fee.id),
    onSuccess: invalidate,
  });

  const handleDelete = () => {
    if (window.confirm(`Delete the "${fee.label}" fee structure? This can't be undone.`)) {
      deleteMutation.mutate();
    }
  };

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} required className="input" />
        <select value={mode} onChange={(e) => setMode(e.target.value as CourseMode)} className="input">
          {modes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input w-28"
        />
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        {fee.label} · {fee.mode} · {formatINR(fee.amount)}
      </span>
      <button onClick={() => setIsEditing(true)} className="text-xs font-medium text-brand-600 hover:underline">
        Edit
      </button>
      <button
        onClick={handleDelete}
        disabled={deleteMutation.isPending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  );
}
