import { ArrowLeft, FileImage, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const tools = {
  "compress-pdf": {
    name: "Compress PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "merge-pdf": {
    name: "Merge PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "split-pdf": {
    name: "Split PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "pdf-to-jpg": {
    name: "PDF to JPG",
    type: "pdf",
    accept: ".pdf",
  },
  "jpg-to-pdf": {
    name: "JPG to PDF",
    type: "image",
    accept: "image/*",
  },
  "rotate-pdf": {
    name: "Rotate PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "crop-pdf": {
    name: "Crop PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "edit-pdf": {
    name: "Edit PDF",
    type: "pdf",
    accept: ".pdf",
  },
  "crop-image": {
    name: "Crop Image",
    type: "image",
    accept: "image/*",
  },
  "resize-image": {
    name: "Resize Image",
    type: "image",
    accept: "image/*",
  },
  "compress-image": {
    name: "Compress Image",
    type: "image",
    accept: "image/*",
  },
  "convert-image": {
    name: "Convert Image",
    type: "image",
    accept: "image/*",
  },
  "rotate-image": {
    name: "Rotate Image",
    type: "image",
    accept: "image/*",
  },
  "watermark-image": {
    name: "Add Watermark",
    type: "image",
    accept: "image/*",
  },
  "edit-image": {
    name: "Edit Image",
    type: "image",
    accept: "image/*",
  },
  "remove-background": {
    name: "Remove Background",
    type: "image",
    accept: "image/*",
  },
  "image-workspace": {
    name: "Image Workspace",
    description: "Edit, crop, resize, compress and convert in one place",
    accept: "image/*",
    icon: Upload,
  },
};

export default function ToolUpload() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);

  const tool = tools[toolId];

  if (!tool) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Tool not found</h1>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

 const handleFile = (selectedFile) => {
  if (!selectedFile) return;

  navigate(`/tool/${toolId}/work`, {
    state: {
      file: selectedFile,
    },
  });
};

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-[1200px] px-5 py-6 sm:px-8">
        {/* Back button - upper left */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600"
          >
            <ArrowLeft size={18} />
            Back to Tools
          </button>
        </div>

        {/* Heading */}
        <div className="mt-6 text-center sm:mt-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {tool?.name}
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            {tool?.description}
          </p>
        </div>

        {/* Attractive upload box */}
        <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
          <label
            htmlFor="file-upload"
            className="group relative block cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.15)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_25px_70px_-20px_rgba(79,70,229,0.22)]"
          >
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4 py-7 text-center sm:min-h-[280px] sm:px-6 sm:py-8">
              {/* Upload icon */}
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg shadow-indigo-100 transition-transform duration-300 group-hover:scale-110">
                  <Upload size={32} strokeWidth={2} />
                </div>

                <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
                  <span className="text-lg font-medium">+</span>
                </div>
              </div>

              <h2 className="mt-5 text-lg font-extrabold text-slate-900 sm:mt-6 sm:text-xl">
                Drop your file here
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                or click anywhere to browse from your device
              </p>

              <div className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition group-hover:bg-indigo-700">
                Choose File
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                <span>Fast</span>
                <span>•</span>
                <span>Easy to use</span>
                <span>•</span>
                <span>Browser based</span>
              </div>
            </div>

            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      </main>
    </div>
  );
}
