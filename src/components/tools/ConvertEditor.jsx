import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FileDown,
  Image as ImageIcon,
  RefreshCcw,
} from "lucide-react";

const FORMATS = {
  png: {
    label: "PNG",
    mime: "image/png",
    extension: "png",
    description: "Best for transparency",
  },
  jpeg: {
    label: "JPG",
    mime: "image/jpeg",
    extension: "jpg",
    description: "Small, widely supported",
  },
  webp: {
    label: "WebP",
    mime: "image/webp",
    extension: "webp",
    description: "Modern web format",
  },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createConvertedBlob(image, width, height, format, quality) {
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

    /*
      JPG cannot store transparency.
      Use white background when converting to JPG.
    */
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, 0, 0, width, height);

    const config = FORMATS[format];

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create converted image."));
          return;
        }

        resolve(blob);
      },
      config.mime,
      format === "png" ? undefined : quality,
    );
  });
}

export default function ConvertEditor({ file, onResult }) {
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const [sourceFormat, setSourceFormat] = useState("");
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(90);

  const [originalSize, setOriginalSize] = useState(0);
  const [convertedSize, setConvertedSize] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const previewRef = useRef("");
  const resultRef = useRef("");
  const previewTimer = useRef(null);
  const requestRef = useRef(0);

  const selectedFormat = useMemo(
    () => FORMATS[format],
    [format],
  );

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    const detectedFormat =
      file.type === "image/jpeg"
        ? "JPG"
        : file.type === "image/png"
          ? "PNG"
          : file.type === "image/webp"
            ? "WebP"
            : file.type || "Image";

    setImageUrl(url);
    setPreviewUrl(url);
    setOriginalSize(file.size);
    setSourceFormat(detectedFormat);
    setConvertedSize(0);
    setDone(false);
    setProcessing(false);
    setQuality(90);

    /*
      Automatically choose a useful target format.
    */
    if (file.type === "image/jpeg") {
      setFormat("png");
    } else if (file.type === "image/png") {
      setFormat("webp");
    } else if (file.type === "image/webp") {
      setFormat("png");
    } else {
      setFormat("png");
    }

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
    if (!imageUrl || !width || !height || !format) return;

    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }

    const requestId = ++requestRef.current;

    previewTimer.current = setTimeout(async () => {
      try {
        const image = await loadImage(imageUrl);

        const blob = await createConvertedBlob(
          image,
          width,
          height,
          format,
          quality / 100,
        );

        if (requestId !== requestRef.current) return;

        if (previewRef.current) {
          URL.revokeObjectURL(previewRef.current);
        }

        const url = URL.createObjectURL(blob);

        previewRef.current = url;

        setPreviewUrl(url);
        setConvertedSize(blob.size);
      } catch (error) {
        console.error("Live conversion preview failed:", error);
      }
    }, 180);

    return () => clearTimeout(previewTimer.current);
  }, [imageUrl, width, height, format, quality]);

  const handleConvert = async () => {
    if (!imageUrl || !width || !height) return;

    try {
      setProcessing(true);

      const image = await loadImage(imageUrl);

      const blob = await createConvertedBlob(
        image,
        width,
        height,
        format,
        quality / 100,
      );

      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current);
      }

      const resultUrl = URL.createObjectURL(blob);

      resultRef.current = resultUrl;

      setPreviewUrl(resultUrl);
      setConvertedSize(blob.size);
      setDone(true);

      onResult(
        resultUrl,
        selectedFormat.extension,
      );
    } catch (error) {
      console.error("Image conversion failed:", error);
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
    setDone(false);
    setConvertedSize(0);
    setQuality(90);

    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = "";
    }
  };

  const chooseFormat = (nextFormat) => {
    if (nextFormat === format) return;

    setFormat(nextFormat);
    setDone(false);
    setConvertedSize(0);

    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = "";
    }
  };

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1250px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_-25px_rgba(15,23,42,0.2)] lg:flex-row">

        {/* LEFT — LIVE PREVIEW */}
        <div className="flex min-h-[460px] flex-1 flex-col bg-[#151515] p-4 sm:p-6">

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#242424]">

            {/* Checkerboard */}
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

            {/* Fixed preview
                No zoom
                No dimension resize
                Original aspect ratio preserved
            */}
            <div className="relative z-10 flex h-[80%] w-[88%] items-center justify-center">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Converted preview"
                  className="block max-h-full max-w-full object-contain"
                  draggable="false"
                />
              )}
            </div>

            {/* Live badge */}
            <div className="absolute left-4 top-4 z-20">
              <div className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                <ImageIcon
                  size={14}
                  className="text-violet-400"
                />
                Live Preview
              </div>
            </div>

            {/* Format badge */}
            <div className="absolute right-4 top-4 z-20">
              <div className="rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                {sourceFormat} → {selectedFormat.label}
              </div>
            </div>

            {/* Dimensions */}
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                {width} × {height} px
              </div>
            </div>
          </div>

          {/* LIVE RESULT */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#202020] p-4">

            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-400">
                  Live Result
                </p>

                <p className="mt-1 text-[11px] text-white/40">
                  Image dimensions stay unchanged
                </p>
              </div>

              <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                {selectedFormat.label}
              </span>
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

              <div className="rounded-xl bg-violet-500/10 px-4 py-3">
                <p className="text-[11px] text-violet-300/60">
                  Converted
                </p>

                <p className="mt-1 text-sm font-extrabold text-violet-300">
                  {convertedSize
                    ? formatBytes(convertedSize)
                    : "Preparing..."}
                </p>
              </div>
            </div>

            <div className="mt-3 text-center text-[11px] text-white/35">
              {width} × {height}px • {selectedFormat.label}
            </div>
          </div>
        </div>

        {/* RIGHT — CONTROLS */}
        <div className="flex w-full flex-col bg-[#fafafa] lg:w-[390px]">

          {/* HEADER */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
                  Image Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Convert Image
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

            {/* FILE INFO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
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
                    {formatBytes(originalSize)} • {sourceFormat}
                  </p>
                </div>
              </div>
            </div>

            {/* FORMAT */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Convert To
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Choose the output format
                  </p>
                </div>

                <span className="text-xs font-bold text-slate-400">
                  {selectedFormat.label}
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(FORMATS).map(
                  ([value, option]) => {
                    const active = format === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => chooseFormat(value)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-violet-300 bg-violet-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black ${
                              active
                                ? "bg-violet-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {option.label}
                          </div>

                          <div>
                            <p
                              className={`text-sm font-extrabold ${
                                active
                                  ? "text-violet-700"
                                  : "text-slate-800"
                              }`}
                            >
                              {option.label}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {option.description}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            active
                              ? "border-violet-600 bg-violet-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {active && (
                            <Check
                              size={12}
                              className="text-white"
                            />
                          )}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* QUALITY */}
            {format !== "png" && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Quality
                    </h3>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Higher gives sharper output
                    </p>
                  </div>

                  <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-orange-600">
                    {quality}%
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={quality}
                    onChange={(e) => {
                      setQuality(Number(e.target.value));
                      setDone(false);
                    }}
                    className="w-full accent-orange-500"
                  />

                  <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                    <span>10%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}

            {/* DIMENSIONS */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400">
                    Image Dimensions
                  </p>

                  <p className="mt-1 text-sm font-extrabold text-slate-800">
                    {width} × {height} px
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                  <ImageIcon size={18} />
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-center text-xs font-bold text-emerald-700">
                  Dimensions remain unchanged
                </p>
              </div>
            </div>

            {/* CONVERSION INFO */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-2.5">

                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    From
                  </span>

                  <span className="text-xs font-bold text-slate-700">
                    {sourceFormat}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    To
                  </span>

                  <span className="text-xs font-bold text-violet-600">
                    {selectedFormat.label}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">
                    Dimensions
                  </span>

                  <span className="text-xs font-bold text-slate-700">
                    {width} × {height}
                  </span>
                </div>

                {format !== "png" && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">
                      Quality
                    </span>

                    <span className="text-xs font-bold text-orange-600">
                      {quality}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* JPG TRANSPARENCY NOTE */}
            {format === "jpeg" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold leading-4 text-amber-700">
                  JPG does not support transparency. Transparent areas
                  are converted to white.
                </p>
              </div>
            )}
          </div>

          {/* ACTION */}
          <div className="border-t border-slate-200 bg-white p-4">

            {!done ? (
              <button
                type="button"
                onClick={handleConvert}
                disabled={processing || !imageUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <RefreshCcw
                      size={18}
                      className="animate-spin"
                    />
                    Converting...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Convert to {selectedFormat.label}
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
                Download {selectedFormat.label}
              </button>
            )}

            <p className="mt-2 text-center text-[11px] text-slate-400">
              Conversion happens directly in your browser
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
