import { FileText, ImageIcon } from "lucide-react";
import ToolCard from "./ToolCard";

const pdfTools = [
  {
    id: "compress-pdf",
    name: "Compress PDF",
    icon: "compress",
    description: "Reduce PDF size",
  },
  {
    id: "merge-pdf",
    name: "Merge PDF",
    icon: "merge",
    description: "Combine PDF files",
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    icon: "split",
    description: "Split pages",
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    icon: "pdf-to-jpg",
    description: "Convert PDF pages",
  },
  {
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    icon: "jpg-to-pdf",
    description: "Create PDF",
  },
  {
    id: "rotate-pdf",
    name: "Rotate PDF",
    icon: "rotate",
    description: "Rotate pages",
  },
  {
    id: "crop-pdf",
    name: "Crop PDF",
    icon: "crop",
    description: "Crop document",
  },
  {
    id: "edit-pdf",
    name: "Edit PDF",
    icon: "edit",
    description: "Edit document",
  },
];

const imageTools = [
  {
    id: "crop-image",
    name: "Crop Image",
    icon: "crop",
    description: "Crop image",
  },
  {
    id: "resize-image",
    name: "Resize Image",
    icon: "resize",
    description: "Change dimensions",
  },
  {
    id: "compress-image",
    name: "Compress Image",
    icon: "compress",
    description: "Reduce image size",
  },
  {
    id: "convert-image",
    name: "Convert Image",
    icon: "convert",
    description: "Change format",
  },
  {
    id: "rotate-image",
    name: "Rotate Image",
    icon: "rotate",
    description: "Rotate image",
  },
  {
    id: "watermark-image",
    name: "Add Watermark",
    icon: "watermark",
    description: "Add watermark",
  },
  {
    id: "edit-image",
    name: "Edit Image",
    icon: "edit",
    description: "Edit image",
  },
  {
  id: "image-workspace",
  name: "Image Workspace",
  icon: "workspace",
  description: "All image tools in one place",
},
  // {
  //   id: "remove-background",
  //   name: "Remove Background",
  //   icon: "remove-background",
  //   description: "Remove background",
  // },
];

function ToolGroup({ title, type, tools, id }) {
  const isPdf = type === "pdf";

  return (
    <section
      id={id}
      className={`rounded-[22px] p-4 sm:p-5 ${
        isPdf ? "bg-red-50" : "bg-blue-50"
      }`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              isPdf
                ? "bg-red-500 text-white"
                : "bg-blue-500 text-white"
            }`}
          >
            {isPdf ? (
              <FileText size={23} />
            ) : (
              <ImageIcon size={23} />
            )}
          </div>

          <h2 className="text-[22px] font-extrabold text-slate-900">
            {title}
          </h2>
        </div>

        <span
          className={`text-sm font-bold ${
            isPdf ? "text-red-500" : "text-blue-600"
          }`}
        >
          View All →
        </span>
      </div>

      {/* 4 × 2 grid */}
      <div className="grid grid-cols-4 gap-3">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            type={type}
          />
        ))}
      </div>
    </section>
  );
}

export default function ToolSection() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center bg-white py-6">
      <div className="mx-auto w-[90%] max-w-[1400px]">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ToolGroup
            id="pdf-tools"
            title="PDF Tools"
            type="pdf"
            tools={pdfTools}
          />

          <ToolGroup
            id="image-tools"
            title="Image Tools"
            type="image"
            tools={imageTools}
          />
        </div>
      </div>
    </main>
  );
}