// src/components/tools/WatermarkEditor.jsx

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Droplets,
  FileDown,
  ImagePlus,
  RotateCcw,
  Type,
  Upload,
} from "lucide-react";

const FONTS = [
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier", value: "monospace" },
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

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function WatermarkEditor({ file, onResult }) {
  const previewAreaRef = useRef(null);
  const watermarkRef = useRef(null);

  const imageUrlRef = useRef("");
  const watermarkImageUrlRef = useRef("");
  const resultUrlRef = useRef("");

  const dragRef = useRef(null);

  const [imageUrl, setImageUrl] = useState("");
  const [watermarkImageUrl, setWatermarkImageUrl] = useState("");

  const [previewSize, setPreviewSize] = useState({
    width: 0,
    height: 0,
  });

  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);
  const [resultSize, setResultSize] = useState(0);

  const [mode, setMode] = useState("text");

  const [text, setText] = useState("YOUR BRAND");
  const [font, setFont] = useState("Inter");
  const [fontSize, setFontSize] = useState(7);
  const [color, setColor] = useState("#ffffff");
  const [bold, setBold] = useState(true);

  const [imageScale, setImageScale] = useState(22);

  const [opacity, setOpacity] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Normalized position: 0 -> 1
  const [position, setPosition] = useState({
    x: 0.78,
    y: 0.84,
  });

  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    imageUrlRef.current = url;

    setImageUrl(url);
    setOriginalSize(file.size);
    setResultSize(0);
    setDone(false);
    setProcessing(false);
    setMode("text");

    image.onload = () => {
      setImageWidth(image.naturalWidth);
      setImageHeight(image.naturalHeight);
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);

      if (watermarkImageUrlRef.current) {
        URL.revokeObjectURL(watermarkImageUrlRef.current);
        watermarkImageUrlRef.current = "";
      }

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = "";
      }
    };
  }, [file]);

  useEffect(() => {
    const area = previewAreaRef.current;

    if (!area || !imageWidth || !imageHeight) return;

    const updatePreviewSize = () => {
      const maxWidth = area.clientWidth * 0.94;
      const maxHeight = area.clientHeight * 0.84;

      const ratio = imageWidth / imageHeight;

      let width = maxWidth;
      let height = width / ratio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }

      setPreviewSize({
        width,
        height,
      });
    };

    updatePreviewSize();

    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(area);

    return () => observer.disconnect();
  }, [imageWidth, imageHeight]);

  const startDrag = (event) => {
    event.preventDefault();

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: position.x,
      startPositionY: position.y,
    };

    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event) => {
      if (!dragRef.current || !previewSize.width || !previewSize.height) {
        return;
      }

      const dx =
        (event.clientX - dragRef.current.startX) /
        previewSize.width;

      const dy =
        (event.clientY - dragRef.current.startY) /
        previewSize.height;

      setPosition({
        x: clamp(
          dragRef.current.startPositionX + dx,
          0.03,
          0.97,
        ),
        y: clamp(
          dragRef.current.startPositionY + dy,
          0.03,
          0.97,
        ),
      });
    };

    const stopDrag = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener(
        "pointercancel",
        stopDrag,
      );
    };
  }, [dragging, previewSize]);

  const handleWatermarkImage = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      return;
    }

    if (watermarkImageUrlRef.current) {
      URL.revokeObjectURL(watermarkImageUrlRef.current);
    }

    const url = URL.createObjectURL(selectedFile);

    watermarkImageUrlRef.current = url;

    setWatermarkImageUrl(url);
    setMode("image");
    setDone(false);
    setResultSize(0);
  };

  const removeWatermarkImage = () => {
    if (watermarkImageUrlRef.current) {
      URL.revokeObjectURL(watermarkImageUrlRef.current);
      watermarkImageUrlRef.current = "";
    }

    setWatermarkImageUrl("");
    setMode("text");
    setDone(false);
    setResultSize(0);
  };

  const reset = () => {
    setMode("text");
    setText("YOUR BRAND");
    setFont("Inter");
    setFontSize(7);
    setColor("#ffffff");
    setBold(true);
    setImageScale(22);
    setOpacity(100);
    setRotation(-0);
    setPosition({
      x: 0.78,
      y: 0.84,
    });

    setDone(false);
    setResultSize(0);

    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
  };

  const createWatermarkedImage = async () => {
    if (!imageUrl || !imageWidth || !imageHeight) {
      throw new Error("Image is not ready.");
    }

    if (mode === "text" && !text.trim()) {
      throw new Error("Watermark text is empty.");
    }

    if (mode === "image" && !watermarkImageUrl) {
      throw new Error("Watermark image is missing.");
    }

    const image = await loadImage(imageUrl);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported.");
    }

    canvas.width = imageWidth;
    canvas.height = imageHeight;

    context.drawImage(
      image,
      0,
      0,
      imageWidth,
      imageHeight,
    );

    context.save();

    context.globalAlpha = opacity / 100;
    context.translate(
      imageWidth * position.x,
      imageHeight * position.y,
    );

    context.rotate(
      (rotation * Math.PI) / 180,
    );

    if (mode === "text") {
      const size = Math.max(
        12,
        Math.round(
          Math.min(imageWidth, imageHeight) *
            (fontSize / 100),
        ),
      );

      context.font = `${
        bold ? "700" : "400"
      } ${size}px ${font}`;

      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = color;

      context.fillText(
        text.trim(),
        0,
        0,
      );
    } else {
      const watermarkImage =
        await loadImage(watermarkImageUrl);

      const outputWidth =
        imageWidth * (imageScale / 100);

      const imageRatio =
        watermarkImage.naturalWidth /
        watermarkImage.naturalHeight;

      const outputHeight =
        outputWidth / imageRatio;

      context.drawImage(
        watermarkImage,
        -outputWidth / 2,
        -outputHeight / 2,
        outputWidth,
        outputHeight,
      );
    }

    context.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Could not create watermarked image.",
              ),
            );
            return;
          }

          resolve(blob);
        },
        "image/png",
        1,
      );
    });
  };

  const applyWatermark = async () => {
    try {
      setProcessing(true);

      const blob = await createWatermarkedImage();

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }

      const resultUrl = URL.createObjectURL(blob);

      resultUrlRef.current = resultUrl;

      setResultSize(blob.size);
      setDone(true);

      onResult(resultUrl, "png");
    } catch (error) {
      console.error("Watermark failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrlRef.current) return;

    const link = document.createElement("a");

    link.href = resultUrlRef.current;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const previewTextSize =
    Math.max(12, previewSize.width * (fontSize / 100));

  const previewImageWidth =
    previewSize.width * (imageScale / 100);

  const previewStyle = {
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    opacity: opacity / 100,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };

  const savedPercent =
    originalSize && resultSize
      ? Math.max(
          0,
          Math.round(
            ((originalSize - resultSize) /
              originalSize) *
              100,
          ),
        )
      : 0;

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1300px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_-30px_rgba(15,23,42,0.22)] lg:flex-row">

        {/* LEFT — LIVE CANVAS */}
        <div className="flex min-h-[500px] flex-1 flex-col bg-[#141414] p-4 sm:p-6">

          <div
            ref={previewAreaRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#222]"
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#4a4a4a 25%,transparent 25%),linear-gradient(-45deg,#4a4a4a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#4a4a4a 75%),linear-gradient(-45deg,transparent 75%,#4a4a4a 75%)",
                backgroundSize: "28px 28px",
                backgroundPosition:
                  "0 0,0 14px,14px -14px,-14px 0",
              }}
            />

            {imageUrl && previewSize.width > 0 && (
              <div
                className="relative shrink-0 overflow-hidden rounded-lg bg-black shadow-2xl"
                style={{
                  width: previewSize.width,
                  height: previewSize.height,
                }}
              >
                <img
                  src={imageUrl}
                  alt="Watermark preview"
                  className="absolute inset-0 h-full w-full select-none object-fill"
                  draggable="false"
                />

                {/* DRAGGABLE WATERMARK */}
                {((mode === "text" && text.trim()) ||
                  (mode === "image" && watermarkImageUrl)) && (
                  <div
                    ref={watermarkRef}
                    onPointerDown={startDrag}
                    className={`absolute z-10 flex cursor-move select-none items-center justify-center rounded-md border border-dashed transition ${
                      dragging
                        ? "border-white bg-white/10"
                        : "border-white/0 hover:border-white/70 hover:bg-white/5"
                    }`}
                    style={{
                      ...previewStyle,
                      padding:
                        mode === "text"
                          ? "6px 10px"
                          : "4px",
                    }}
                  >
                    {mode === "text" ? (
                      <span
                        style={{
                          color,
                          fontFamily: font,
                          fontSize: previewTextSize,
                          fontWeight: bold
                            ? 700
                            : 400,
                          lineHeight: 1,
                          whiteSpace: "nowrap",
                          textShadow:
                            "0 2px 8px rgba(0,0,0,0.35)",
                        }}
                      >
                        {text}
                      </span>
                    ) : (
                      <img
                        src={watermarkImageUrl}
                        alt="Watermark"
                        className="block object-contain"
                        style={{
                          width: previewImageWidth,
                          maxWidth: "45vw",
                        }}
                        draggable="false"
                      />
                    )}
                  </div>
                )}

                {/* Drag helper */}
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
                  <div className="rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-md">
                    Drag watermark with cursor
                  </div>
                </div>
              </div>
            )}

            {/* LIVE PREVIEW BADGE */}
            <div className="absolute left-4 top-4 z-30">
              <div className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur-md">
                <Droplets
                  size={14}
                  className="text-fuchsia-400"
                />
                Live Preview
              </div>
            </div>

            {/* POSITION */}
            <div className="absolute right-4 top-4 z-30">
              <div className="rounded-full bg-black/65 px-3 py-2 text-[11px] font-bold text-white backdrop-blur-md">
                {Math.round(position.x * 100)}% ×{" "}
                {Math.round(position.y * 100)}%
              </div>
            </div>
          </div>

          {/* LIVE INFO */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#202020] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              <div className="rounded-xl bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40">
                  Dimensions
                </p>
                <p className="mt-1 text-xs font-extrabold text-white">
                  {imageWidth} × {imageHeight}
                </p>
              </div>

              <div className="rounded-xl bg-fuchsia-500/10 px-3 py-3">
                <p className="text-[10px] text-fuchsia-300/60">
                  Watermark
                </p>
                <p className="mt-1 text-xs font-extrabold text-fuchsia-300">
                  {mode === "text" ? "Text" : "Image"}
                </p>
              </div>

              <div className="rounded-xl bg-amber-500/10 px-3 py-3">
                <p className="text-[10px] text-amber-300/60">
                  Opacity
                </p>
                <p className="mt-1 text-xs font-extrabold text-amber-300">
                  {opacity}%
                </p>
              </div>

              <div className="rounded-xl bg-emerald-500/10 px-3 py-3">
                <p className="text-[10px] text-emerald-300/60">
                  Output
                </p>
                <p className="mt-1 text-xs font-extrabold text-emerald-300">
                  PNG
                </p>
              </div>
            </div>

            {resultSize > 0 && (
              <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-center">
                <span className="text-xs font-bold text-emerald-400">
                  Ready • {formatBytes(resultSize)}
                  {savedPercent > 0
                    ? ` • ${savedPercent}% smaller`
                    : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — CONTROLS */}
        <div className="flex w-full flex-col bg-[#fafafa] lg:w-[400px]">

          {/* HEADER */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-500">
                  Image Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Watermark
                </h2>
              </div>

              <button
                type="button"
                onClick={reset}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Reset"
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* FILE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
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

            {/* TYPE */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Watermark Type
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("text");
                    setDone(false);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-extrabold transition ${
                    mode === "text"
                      ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-fuchsia-200"
                  }`}
                >
                  <Type size={17} />
                  Text
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("image");
                    setDone(false);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-extrabold transition ${
                    mode === "image"
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-violet-200"
                  }`}
                >
                  <ImagePlus size={17} />
                  Image
                </button>
              </div>
            </div>

            {/* TEXT WATERMARK */}
            {mode === "text" && (
              <>
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      Watermark Text
                    </h3>

                    <Type
                      size={16}
                      className="text-fuchsia-500"
                    />
                  </div>

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setDone(false);
                    }}
                    placeholder="Enter watermark..."
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                  />
                </div>

                {/* FONT */}
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold text-slate-800">
                    Font
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    {FONTS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setFont(item.value);
                          setDone(false);
                        }}
                        className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${
                          font === item.value
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-violet-200"
                        }`}
                        style={{
                          fontFamily: item.value,
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COLOR */}
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      Text Color
                    </h3>

                    <span className="text-xs font-mono text-slate-400">
                      {color.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setDone(false);
                      }}
                      className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />

                    <input
                      type="text"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setDone(false);
                      }}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-mono font-bold text-slate-700 outline-none focus:border-fuchsia-400"
                    />
                  </div>
                </div>

                {/* TEXT SIZE */}
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      Text Size
                    </h3>

                    <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-600">
                      {fontSize}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="2"
                    max="15"
                    step="1"
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(Number(e.target.value));
                      setDone(false);
                    }}
                    className="w-full accent-violet-500"
                  />

                  <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Small</span>
                    <span>Medium</span>
                    <span>Large</span>
                  </div>
                </div>

                {/* BOLD */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setBold((value) => !value);
                      setDone(false);
                    }}
                    className={`w-full rounded-xl border py-3 text-xs font-extrabold transition ${
                      bold
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {bold ? "Bold Text" : "Regular Text"}
                  </button>
                </div>
              </>
            )}

            {/* IMAGE WATERMARK */}
            {mode === "image" && (
              <>
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold text-slate-800">
                    Watermark Image
                  </h3>

                  {!watermarkImageUrl ? (
                    <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-7 text-center transition hover:border-violet-400 hover:bg-violet-50/40">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:scale-105">
                        <Upload size={21} />
                      </div>

                      <p className="mt-3 text-sm font-extrabold text-slate-800">
                        Upload watermark
                      </p>

                      <p className="mt-1 text-[11px] text-slate-400">
                        PNG, JPG or WebP
                      </p>

                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWatermarkImage}
                      />
                    </label>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                          <img
                            src={watermarkImageUrl}
                            alt="Watermark"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800">
                            Watermark selected
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Drag it directly on the preview
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={removeWatermarkImage}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* IMAGE SIZE */}
                {watermarkImageUrl && (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">
                        Watermark Size
                      </h3>

                      <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-600">
                        {imageScale}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={imageScale}
                      onChange={(e) => {
                        setImageScale(Number(e.target.value));
                        setDone(false);
                      }}
                      className="w-full accent-violet-500"
                    />

                    <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Small</span>
                      <span>Medium</span>
                      <span>Large</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* OPACITY */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Opacity
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Set manually
                  </p>
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-600">
                  {opacity}%
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={opacity}
                  onChange={(e) => {
                    setOpacity(Number(e.target.value));
                    setDone(false);
                  }}
                  className="w-full accent-amber-500"
                />

                <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* ROTATION */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Rotation
                </h3>

                <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-600">
                  {rotation}°
                </span>
              </div>

              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={rotation}
                onChange={(e) => {
                  setRotation(Number(e.target.value));
                  setDone(false);
                }}
                className="w-full accent-rose-500"
              />

              <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                <span>-45°</span>
                <span>0°</span>
                <span>45°</span>
              </div>
            </div>

            {/* POSITION INFO */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Position
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Drag the watermark directly on the image
                  </p>
                </div>

                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                  Cursor
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-400">
                    X Position
                  </p>

                  <p className="mt-1 text-xs font-extrabold text-slate-700">
                    {Math.round(position.x * 100)}%
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-400">
                    Y Position
                  </p>

                  <p className="mt-1 text-xs font-extrabold text-slate-700">
                    {Math.round(position.y * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION */}
          <div className="border-t border-slate-200 bg-white p-4">
            {!done ? (
              <button
                type="button"
                onClick={applyWatermark}
                disabled={
                  processing ||
                  !imageUrl ||
                  (mode === "text"
                    ? !text.trim()
                    : !watermarkImageUrl)
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <RotateCcw
                      size={18}
                      className="animate-spin"
                    />
                    Creating Watermark...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Apply Watermark
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadResult}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600"
              >
                <Download size={18} />
                Download Watermarked Image
              </button>
            )}

            <p className="mt-2 text-center text-[11px] text-slate-400">
              Drag placement with your cursor • Full-resolution PNG output
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
