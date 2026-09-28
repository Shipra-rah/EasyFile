import { ArrowLeft, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

// Image editors
import CompressEditor from "../components/tools/CompressEditor";
import ConvertEditor from "../components/tools/ConvertEditor";
import CropEditor from "../components/tools/CropEditor";
import EditEditor from "../components/tools/EditEditor";
import ImageWorkspace from "../components/tools/ImageWorkspace";
import ResizeEditor from "../components/tools/ResizeEditor";
import RotateEditor from "../components/tools/RotateEditor";
import WatermarkEditor from "../components/tools/WatermarkEditor";

// PDF editors
import CompressPdfEditor from "../components/tools/pdf/CompressPdfEditor";
import MergePdfEditor from "../components/tools/pdf/MergePdfEditor";
import SplitPdfEditor from "../components/tools/pdf/SplitPdfEditor";
import PdfToJpgEditor from "../components/tools/pdf/PdfToJpgEditor";
import JpgToPdfEditor from "../components/tools/pdf/JpgToPdfEditor";
import RotatePdfEditor from "../components/tools/pdf/RotatePdfEditor";
import CropPdfEditor from "../components/tools/pdf/CropPdfEditor";
import EditPdfEditor from "../components/tools/pdf/EditPdfEditor";

// Tool names
const toolNames = {
  // PDF
  "compress-pdf": "Compress PDF",
  "merge-pdf": "Merge PDF",
  "split-pdf": "Split PDF",
  "pdf-to-jpg": "PDF to JPG",
  "jpg-to-pdf": "JPG to PDF",
  "rotate-pdf": "Rotate PDF",
  "crop-pdf": "Crop PDF",
  "edit-pdf": "Edit PDF",

  // Image
  "crop-image": "Crop Image",
  "resize-image": "Resize Image",
  "compress-image": "Compress Image",
  "convert-image": "Convert Image",
  "rotate-image": "Rotate Image",
  "watermark-image": "Add Watermark",
  "edit-image": "Edit Image",
  "image-workspace": "Image Workspace",
  "remove-background": "Remove Background",
};

// Generate random 6–7 digit download name
function createRandomDownloadName(extension = "png") {
  const number = Math.floor(100000 + Math.random() * 9000000);

  return `${number}.${extension.replace(".", "")}`;
}

export default function ToolWork() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const file = location.state?.file;

  const [resultUrl, setResultUrl] = useState("");
  const [resultExtension, setResultExtension] = useState("");

  const toolName = toolNames[toolId];

  // If no file was selected, go back to upload page
  useEffect(() => {
    if (!file) {
      navigate(`/tool/${toolId}/upload`, {
        replace: true,
      });
    }
  }, [file, navigate, toolId]);

  if (!file || !toolName) {
    return null;
  }

  // Editor sends processed result here
  const handleResult = (url, extension = "pdf") => {
    setResultUrl(url);
    setResultExtension(extension);
  };

  // Download processed result
  const downloadResult = () => {
    if (!resultUrl) return;

    const link = document.createElement("a");

    link.href = resultUrl;
    link.download = createRandomDownloadName(resultExtension || "pdf");

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Back to upload page
  const goBack = () => {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
    }

    setResultUrl("");
    setResultExtension("");

    navigate(`/tool/${toolId}/upload`);
  };

  // Render correct editor
  const renderEditor = () => {
    switch (toolId) {
      // ==========================================
      // IMAGE TOOLS
      // ==========================================

      case "crop-image":
        return <CropEditor file={file} onResult={handleResult} />;

      case "resize-image":
        return <ResizeEditor file={file} onResult={handleResult} />;

      case "compress-image":
        return <CompressEditor file={file} onResult={handleResult} />;

      case "convert-image":
        return <ConvertEditor file={file} onResult={handleResult} />;

      case "rotate-image":
        return <RotateEditor file={file} onResult={handleResult} />;

      case "edit-image":
        return <EditEditor file={file} onResult={handleResult} />;

      case "watermark-image":
        return <WatermarkEditor file={file} onResult={handleResult} />;

      case "image-workspace":
        return <ImageWorkspace file={file} onResult={handleResult} />;

      // ==========================================
      // PDF TOOLS
      // ==========================================

      case "compress-pdf":
        return <CompressPdfEditor file={file} onResult={handleResult} />;

      case "merge-pdf":
        return <MergePdfEditor file={file} onResult={handleResult} />;

      case "split-pdf":
        return <SplitPdfEditor file={file} onResult={handleResult} />;

      case "pdf-to-jpg":
        return <PdfToJpgEditor file={file} onResult={handleResult} />;

      case "jpg-to-pdf":
        return <JpgToPdfEditor file={file} onResult={handleResult} />;

      case "rotate-pdf":
        return <RotatePdfEditor file={file} onResult={handleResult} />;

      case "crop-pdf":
        return <CropPdfEditor file={file} onResult={handleResult} />;

      case "edit-pdf":
        return <EditPdfEditor file={file} onResult={handleResult} />;

      // ==========================================
      // NOT IMPLEMENTED YET
      // ==========================================

      case "remove-background":
        return (
          <div className="flex h-full items-center justify-center rounded-2xl bg-white">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-slate-900">
                Remove Background
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Background removal editor will be connected next.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex h-full items-center justify-center rounded-2xl bg-white">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-slate-900">
                {toolName}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                This operation will be connected next.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 md:h-dvh md:overflow-hidden">
      <main className="mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8 md:h-full md:min-h-0">
        {/* TOP BAR */}
        <div className="flex h-12 shrink-0 items-center justify-between">
          {/* BACK */}
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:text-indigo-600"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          {/* TOOL NAME */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 text-center sm:block">
            <h1 className="text-lg font-extrabold text-slate-900">
              {toolName}
            </h1>

            <p className="max-w-[250px] truncate text-xs text-slate-400">
              {file.name}
            </p>
          </div>

          {/* DOWNLOAD */}
          <button
            type="button"
            onClick={downloadResult}
            disabled={!resultUrl}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            <Download size={17} />
            Download
          </button>
        </div>

        {/* MOBILE TITLE */}
        <div className="shrink-0 py-3 text-center sm:hidden">
          <h1 className="text-xl font-extrabold text-slate-900">{toolName}</h1>

          <p className="mt-1 max-w-full truncate text-xs text-slate-400">
            {file.name}
          </p>
        </div>

        {/* WORKSPACE */}
        <div className="min-h-[65dvh] flex-1 py-3 md:min-h-0">{renderEditor()}</div>
      </main>
    </div>
  );
}
