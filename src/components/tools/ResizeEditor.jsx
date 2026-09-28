import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Minus,
  Plus,
  RefreshCcw,
  Unlock,
  Zap,
} from "lucide-react";

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };

    image.src = url;
  });
}

const scaleOptions = [25, 50, 75, 100, 125, 150];

const sizePresets = [
  { name: "Square", width: 1080, height: 1080 },
  { name: "HD", width: 1920, height: 1080 },
  { name: "Portrait", width: 1080, height: 1350 },
  { name: "Story", width: 1080, height: 1920 },
];

const formatOptions = [
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpeg" },
  { label: "WebP", value: "webp" },
];

export default function ResizeEditor({ file, onResult }) {
  const [imageUrl, setImageUrl] = useState("");
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const [lockRatio, setLockRatio] = useState(true);
  const [selectedScale, setSelectedScale] = useState(100);

  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(0.9);

  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const resultUrlRef = useRef("");

  const aspectRatio = useMemo(() => {
    if (!originalWidth || !originalHeight) return 1;
    return originalWidth / originalHeight;
  }, [originalWidth, originalHeight]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);

    setImageUrl(url);
    setDone(false);
    setSelectedScale(100);
    setLockRatio(true);

    const image = new Image();

    image.onload = () => {
      setOriginalWidth(image.naturalWidth);
      setOriginalHeight(image.naturalHeight);
      setWidth(image.naturalWidth);
      setHeight(image.naturalHeight);
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = "";
      }
    };
  }, [file]);

  const updateWidth = (value) => {
    const newWidth = Math.max(1, Math.round(Number(value) || 1));

    setWidth(newWidth);

    if (lockRatio) {
      setHeight(Math.max(1, Math.round(newWidth / aspectRatio)));
    }

    setSelectedScale(null);
    setDone(false);
  };

  const updateHeight = (value) => {
    const newHeight = Math.max(1, Math.round(Number(value) || 1));

    setHeight(newHeight);

    if (lockRatio) {
      setWidth(Math.max(1, Math.round(newHeight * aspectRatio)));
    }

    setSelectedScale(null);
    setDone(false);
  };

  const applyScale = (scale) => {
    const nextWidth = Math.max(
      1,
      Math.round((originalWidth * scale) / 100),
    );

    const nextHeight = Math.max(
      1,
      Math.round((originalHeight * scale) / 100),
    );

    setWidth(nextWidth);
    setHeight(nextHeight);
    setSelectedScale(scale);
    setDone(false);
  };

  const applyPreset = (preset) => {
    setWidth(preset.width);
    setHeight(preset.height);
    setSelectedScale(null);
    setDone(false);

    if (preset.width / preset.height === aspectRatio) {
      setLockRatio(true);
    } else {
      setLockRatio(false);
    }
  };

  const resetResize = () => {
    setWidth(originalWidth);
    setHeight(originalHeight);
    setLockRatio(true);
    setSelectedScale(100);
    setFormat("png");
    setQuality(0.9);
    setDone(false);
  };

  const resizeImage = async () => {
    if (!imageUrl || !width || !height) return;

    try {
      setProcessing(true);

      const image = await loadImage(file);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is not supported.");
      }

      canvas.width = width;
      canvas.height = height;

      // JPG has no transparency, so use a white background.
      if (format === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      context.drawImage(
        image,
        0,
        0,
        width,
        height,
      );

      const mimeType =
        format === "png"
          ? "image/png"
          : format === "jpeg"
            ? "image/jpeg"
            : "image/webp";

      const result = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not create resized image."));
              return;
            }

            resolve(blob);
          },
          mimeType,
          format === "png" ? undefined : quality,
        );
      });

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }

      const resultUrl = URL.createObjectURL(result);
      resultUrlRef.current = resultUrl;

      onResult(
        resultUrl,
        format === "jpeg" ? "jpg" : format,
      );

      setDone(true);
    } catch (error) {
      console.error("Resize failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!resultUrlRef.current) return;

    const extension = format === "jpeg" ? "jpg" : format;

    const link = document.createElement("a");
    link.href = resultUrlRef.current;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const previewRatio =
    width && height ? `${width} / ${height}` : "1 / 1";

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1250px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_-25px_rgba(15,23,42,0.2)] lg:flex-row">

        {/* LEFT SIDE */}
        <div className="relative flex min-h-[420px] flex-1 items-center justify-center bg-[#171717] p-4 sm:p-6">

          {/* Workspace */}
          <div className="relative flex h-full min-h-[390px] w-full max-w-[720px] items-center justify-center overflow-hidden rounded-[24px] bg-[#262626]">

            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)",
                backgroundSize: "24px 24px",
                backgroundPosition:
                  "0 0, 0 12px, 12px -12px, -12px 0",
              }}
            />

            {/* Live preview */}
            <div
              className="relative z-10 max-h-[78%] max-w-[85%] overflow-hidden rounded-lg bg-white shadow-2xl transition-all duration-300"
              style={{
                aspectRatio: previewRatio,
              }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Resize preview"
                  className="h-full w-full object-fill"
                />
              )}
            </div>

            {/* Live badge */}
            <div className="absolute left-4 top-4 z-20">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                <Zap size={14} className="text-amber-400" />
                Live Preview
              </div>
            </div>

            {/* Dimension display */}
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                {width} × {height} px
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex w-full flex-col bg-[#fafafa] lg:w-[390px]">

          {/* Header */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
                  Image Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Resize Image
                </h2>
              </div>

              <button
                type="button"
                onClick={resetResize}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Reset"
              >
                <RefreshCcw size={17} />
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* Original size */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <ImageIcon size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Original Size
                  </p>

                  <p className="mt-1 text-sm font-extrabold text-slate-800">
                    {originalWidth} × {originalHeight} px
                  </p>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Dimensions
                </h3>

                <button
                  type="button"
                  onClick={() => setLockRatio((value) => !value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    lockRatio
                      ? "bg-violet-50 text-violet-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {lockRatio ? (
                    <Lock size={13} />
                  ) : (
                    <Unlock size={13} />
                  )}

                  {lockRatio ? "Ratio Locked" : "Free Resize"}
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-500">
                    Width
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={width || ""}
                    onChange={(e) => updateWidth(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                <div className="pb-3 text-slate-300">
                  ×
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-500">
                    Height
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={height || ""}
                    onChange={(e) => updateHeight(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
            </div>

            {/* Quick scale */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Quick Scale
                </h3>

                <span className="text-xs font-medium text-slate-400">
                  From original
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {scaleOptions.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => applyScale(scale)}
                    className={`rounded-xl border py-2.5 text-xs font-extrabold transition ${
                      selectedScale === scale
                        ? "border-orange-300 bg-orange-50 text-orange-600"
                        : "border-slate-200 bg-white text-slate-500 hover:border-orange-200 hover:bg-orange-50"
                    }`}
                  >
                    {scale}%
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Presets
                </h3>

                <Maximize2 size={15} className="text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {sizePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-50"
                  >
                    <p className="text-xs font-extrabold text-slate-700">
                      {preset.name}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {preset.width} × {preset.height}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Output Format
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {formatOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFormat(option.value);
                      setDone(false);
                    }}
                    className={`rounded-xl border py-3 text-xs font-extrabold transition ${
                      format === option.value
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            {format !== "png" && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    Quality
                  </h3>

                  <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-600">
                    {Math.round(quality * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Minus size={15} className="text-slate-400" />

                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    onChange={(e) => {
                      setQuality(Number(e.target.value));
                      setDone(false);
                    }}
                    className="w-full accent-pink-500"
                  />

                  <Plus size={15} className="text-slate-400" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="border-t border-slate-200 bg-white p-4">
            {!done ? (
              <button
                type="button"
                onClick={resizeImage}
                disabled={processing || !width || !height}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={18} />

                {processing ? "Resizing..." : "Apply Resize"}
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadImage}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600"
              >
                <Download size={18} />
                Download Resized Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
