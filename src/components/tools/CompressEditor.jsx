import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileDown,
  Image as ImageIcon,
  RefreshCcw,
} from "lucide-react";

const FORMATS = {
  jpeg: {
    label: "JPG",
    mime: "image/jpeg",
    extension: "jpg",
  },
  png: {
    label: "PNG",
    mime: "image/png",
    extension: "png",
  },
  webp: {
    label: "WebP",
    mime: "image/webp",
    extension: "webp",
  },
};

const QUALITY_LABELS = [
  { value: 10, label: "Very Small" },
  { value: 30, label: "Small File" },
  { value: 50, label: "Balanced" },
  { value: 70, label: "High Quality" },
  { value: 90, label: "Near Original" },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getSavedPercent(original, compressed) {
  if (!original || !compressed) return 0;

  return Math.max(
    0,
    Math.round(((original - compressed) / original) * 100),
  );
}

function createBlob(image, width, height, format, quality) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Canvas is not supported."));
      return;
    }

    canvas.width = width;
    canvas.height = height;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create compressed image."));
          return;
        }

        resolve(blob);
      },
      FORMATS[format].mime,
      format === "png" ? undefined : quality,
    );
  });
}

export default function CompressEditor({ file, onResult }) {
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const [originalSize, setOriginalSize] = useState(0);
  const [previewSize, setPreviewSize] = useState(0);

  const [percent, setPercent] = useState(70);
  const [format, setFormat] = useState("jpeg");

  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const previewRef = useRef("");
  const resultRef = useRef("");
  const previewTimer = useRef(null);
  const requestRef = useRef(0);

  const quality = percent / 100;
  const savedPercent = getSavedPercent(
    originalSize,
    previewSize,
  );

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    setImageUrl(url);
    setPreviewUrl(url);
    setOriginalSize(file.size);
    setPreviewSize(0);
    setDone(false);
    setProcessing(false);

    image.onload = () => {
      setWidth(image.naturalWidth);
      setHeight(image.naturalHeight);
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);

      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = "";
      }

      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current);
        resultRef.current = "";
      }
    };
  }, [file]);

  useEffect(() => {
    if (!imageUrl || !width || !height) return;

    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }

    const requestId = ++requestRef.current;

    previewTimer.current = setTimeout(async () => {
      try {
        const image = await loadImage(imageUrl);

        const blob = await createBlob(
          image,
          width,
          height,
          format,
          quality,
        );

        if (requestId !== requestRef.current) return;

        if (previewRef.current) {
          URL.revokeObjectURL(previewRef.current);
        }

        const url = URL.createObjectURL(blob);

        previewRef.current = url;

        setPreviewUrl(url);
        setPreviewSize(blob.size);
      } catch (error) {
        console.error("Live preview failed:", error);
      }
    }, 180);

    return () => clearTimeout(previewTimer.current);
  }, [imageUrl, width, height, format, quality]);

  const handleCompress = async () => {
    if (!imageUrl || !width || !height) return;

    try {
      setProcessing(true);

      const image = await loadImage(imageUrl);

      const blob = await createBlob(
        image,
        width,
        height,
        format,
        quality,
      );

      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current);
      }

      const resultUrl = URL.createObjectURL(blob);

      resultRef.current = resultUrl;

      setPreviewUrl(resultUrl);
      setPreviewSize(blob.size);
      setDone(true);

      onResult(
        resultUrl,
        FORMATS[format].extension,
      );
    } catch (error) {
      console.error("Compression failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultRef.current) return;

    const link = document.createElement("a");

    link.href = resultRef.current;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const reset = () => {
    setPercent(70);
    setFormat("jpeg");
    setDone(false);

    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = "";
    }
  };

  const currentLabel =
    QUALITY_LABELS.reduce((closest, item) => {
      return Math.abs(item.value - percent) <
        Math.abs(closest.value - percent)
        ? item
        : closest;
    }).label;

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1250px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_-25px_rgba(15,23,42,0.2)] lg:flex-row">

        {/* PREVIEW */}
        <div className="flex min-h-[460px] flex-1 flex-col bg-[#151515] p-4 sm:p-6">

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#242424]">

            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#505050 25%,transparent 25%),linear-gradient(-45deg,#505050 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#505050 75%),linear-gradient(-45deg,transparent 75%,#505050 75%)",
                backgroundSize: "28px 28px",
                backgroundPosition:
                  "0 0,0 14px,14px -14px,-14px 0",
              }}
            />

            {/* Fixed-size preview.
                No zoom.
                No transform.
                No dimension changes.
            */}
            <div className="relative z-10 flex h-[80%] w-[88%] items-center justify-center">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Compressed preview"
                  className="block max-h-full max-w-full object-contain"
                  draggable="false"
                />
              )}
            </div>

            <div className="absolute left-4 top-4 z-20">
              <div className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                <ImageIcon
                  size={14}
                  className="text-orange-400"
                />
                Live Preview
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                {width} × {height} px
              </div>
            </div>
          </div>

          {/* LIVE SIZE */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#202020] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-400">
                  Live Result
                </p>
                <p className="mt-1 text-[11px] text-white/40">
                  Dimensions never change
                </p>
              </div>

              {previewSize > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  {savedPercent}% smaller
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="text-[11px] text-white/40">
                  Original
                </p>
                <p className="mt-1 text-sm font-extrabold text-white">
                  {formatBytes(originalSize)}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-500/10 px-4 py-3">
                <p className="text-[11px] text-emerald-300/60">
                  Compressed
                </p>
                <p className="mt-1 text-sm font-extrabold text-emerald-300">
                  {previewSize
                    ? formatBytes(previewSize)
                    : "Calculating..."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex w-full flex-col bg-[#fafafa] lg:w-[390px]">

          {/* HEADER */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">
                  Image Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Compress Image
                </h2>
              </div>

              <button
                type="button"
                onClick={reset}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Reset"
              >
                <RefreshCcw size={17} />
              </button>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* FILE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <FileDown size={20} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-400">
                    Original File
                  </p>

                  <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
                    {file?.name || "Image"}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatBytes(originalSize)}
                  </p>
                </div>
              </div>
            </div>

            {/* SIZE PERCENT */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Image Size
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Compression quality
                  </p>
                </div>

                <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-orange-600">
                  {percent}%
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={percent}
                  onChange={(e) => {
                    setPercent(Number(e.target.value));
                    setDone(false);
                  }}
                  className="w-full accent-orange-500"
                />

                <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>

                <div className="mt-4 rounded-xl bg-orange-50 px-3 py-2.5 text-center">
                  <p className="text-xs font-bold text-orange-700">
                    {currentLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* QUICK SIZE */}
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Quick Quality
              </h3>

              <div className="grid grid-cols-5 gap-2">
                {[10, 30, 50, 70, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPercent(value);
                      setDone(false);
                    }}
                    className={`rounded-xl border py-2.5 text-xs font-extrabold transition ${
                      percent === value
                        ? "border-orange-300 bg-orange-50 text-orange-600"
                        : "border-slate-200 bg-white text-slate-500 hover:border-orange-200 hover:bg-orange-50"
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>

            {/* FORMAT */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Output Format
                </h3>

                <span className="text-[11px] text-slate-400">
                  Same dimensions
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Object.entries(FORMATS).map(
                  ([value, option]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFormat(value);
                        setDone(false);
                      }}
                      className={`rounded-xl border py-3 text-xs font-extrabold transition ${
                        format === value
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* INFO */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    Dimensions
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {width} × {height}px
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    Format
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {FORMATS[format].label}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    Quality
                  </span>
                  <span className="text-xs font-bold text-orange-600">
                    {percent}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION */}
          <div className="border-t border-slate-200 bg-white p-4">
            {!done ? (
              <button
                type="button"
                onClick={handleCompress}
                disabled={processing || !imageUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <RefreshCcw
                      size={18}
                      className="animate-spin"
                    />
                    Compressing...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Compress Image
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600"
              >
                <Download size={18} />
                Download Compressed Image
              </button>
            )}

            <p className="mt-2 text-center text-[11px] text-slate-400">
              Original dimensions stay exactly the same
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
