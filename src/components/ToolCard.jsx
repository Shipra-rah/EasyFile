import {
  Crop,
  Droplets,
  FileImage,
  FilePlus2,
  FileText,
  ImageMinus,
  Maximize,
  Minimize2,
  Pencil,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const icons = {
  compress: Minimize2,
  merge: FilePlus2,
  split: Scissors,
  "pdf-to-jpg": FileImage,
  "jpg-to-pdf": FileText,
  rotate: RefreshCw,
  crop: Crop,
  edit: Pencil,
  resize: Maximize,
  convert: RefreshCw,
  watermark: Droplets,
  "remove-background": ImageMinus,
  workspace: SlidersHorizontal,
};

export default function ToolCard({ tool, type }) {
  const navigate = useNavigate();

  if (!tool) return null;

  const Icon = icons[tool.icon] || SlidersHorizontal;

  return (
    <button
      type="button"
      onClick={() => navigate(`/tool/${tool.id}/upload`)}
      className="flex min-h-[205px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-xl ${
          type === "pdf"
            ? "bg-red-50 text-red-600"
            : "bg-blue-50 text-blue-600"
        }`}
      >
        <Icon size={28} strokeWidth={2.2} />
      </div>

      <h3 className="mt-5 text-base font-bold leading-6 text-slate-900">
        {tool.name}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {tool.description}
      </p>
    </button>
  );
}