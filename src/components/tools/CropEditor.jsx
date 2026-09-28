import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { createRandomDownloadName } from "../../utils/downloadName";
import {
  Check,
  Download,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Smartphone,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCcw,
} from "lucide-react";

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function getCroppedImage(
  imageSrc,
  crop,
  rotation = 0,
  flipHorizontal = false,
  flipVertical = false,
) {
  const image = await createImage(imageSrc);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image for cropping.");

  const radians = (rotation * Math.PI) / 180;

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  const maxSize = Math.max(naturalWidth, naturalHeight);

  canvas.width = maxSize * 2;
  canvas.height = maxSize * 2;

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);

  context.scale(
    flipHorizontal ? -1 : 1,
    flipVertical ? -1 : 1,
  );

  context.drawImage(
    image,
    -naturalWidth / 2,
    -naturalHeight / 2,
    naturalWidth,
    naturalHeight,
  );

  const croppedCanvas = document.createElement("canvas");
  const croppedContext = croppedCanvas.getContext("2d");
  if (!croppedContext) throw new Error("Could not create cropped image.");

  croppedCanvas.width = crop.width;
  croppedCanvas.height = crop.height;

  croppedContext.drawImage(
    canvas,
    canvas.width / 2 - crop.x - crop.width / 2,
    canvas.height / 2 - crop.y - crop.height / 2,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create cropped image."));
          return;
        }

        resolve(URL.createObjectURL(blob));
      },
      "image/png",
      1,
    );
  });
}

const aspectOptions = [
  {
    label: "Free",
    value: null,
    icon: Maximize2,
  },
  {
    label: "1:1",
    value: 1,
    icon: Square,
  },
  {
    label: "4:5",
    value: 4 / 5,
    icon: RectangleVertical,
  },
  {
    label: "16:9",
    value: 16 / 9,
    icon: RectangleHorizontal,
  },
];

export default function CropEditor({ file, onResult }) {
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [aspect, setAspect] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const resultUrlRef = useRef("");
  const onResultRef = useRef(onResult);
  const cropRequestRef = useRef(0);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    cropRequestRef.current += 1;

    if (!done) return;

    setDone(false);
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
    onResultRef.current?.("", "");
  }, [crop, zoom, rotation, flipHorizontal, flipVertical, aspect, croppedAreaPixels]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setAspect(null);
    setCroppedAreaPixels(null);
    setProcessing(false);
    setDone(false);
    onResultRef.current?.("", "");

    return () => {
      cropRequestRef.current += 1;
      URL.revokeObjectURL(url);

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = "";
      }
    };
  }, [file]);

  const handleCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCrop = async () => {
    if (!imageUrl || !croppedAreaPixels) return;

    const requestId = cropRequestRef.current;

    try {
      setProcessing(true);

      const result = await getCroppedImage(
        imageUrl,
        croppedAreaPixels,
        rotation,
        flipHorizontal,
        flipVertical,
      );

      if (requestId !== cropRequestRef.current) {
        URL.revokeObjectURL(result);
        return;
      }

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }

      resultUrlRef.current = result;

      onResultRef.current?.(result, "png");
      setDone(true);
    } catch (error) {
      console.error("Crop failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadCrop = () => {
    if (!resultUrlRef.current) return;

    const link = document.createElement("a");
    link.href = resultUrlRef.current;
    link.download = createRandomDownloadName("png");

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const resetEditor = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setAspect(null);
    setCroppedAreaPixels(null);
    setDone(false);

    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }

    onResultRef.current?.("", "");
  };

  const rotateLeft = () => {
    setRotation((current) => (current - 90 + 360) % 360);
  };

  const rotateRight = () => {
    setRotation((current) => (current + 90) % 360);
  };

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1250px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_-25px_rgba(15,23,42,0.2)] lg:flex-row">

        {/* LEFT — IMAGE */}
        <div className="relative flex min-h-[420px] flex-1 items-center justify-center bg-[#18181b] p-4 sm:p-6">

          {/* Phone-style editor frame */}
          <div className="relative h-full min-h-[390px] w-full max-w-[720px] overflow-hidden rounded-[24px] bg-black shadow-2xl">
            {imageUrl && (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                transform={`translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`}
                aspect={aspect || undefined}
                cropShape="rect"
                showGrid
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
              />
            )}

            {/* Top editor badge */}
            <div className="pointer-events-none absolute left-4 top-4 z-10">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
                <Smartphone size={14} />
                Live Preview
              </div>
            </div>

            {/* Image dimensions */}
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
                Drag to reposition • Pinch / scroll to zoom
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — CONTROLS */}
        <div className="flex w-full flex-col bg-[#fafafa] lg:w-[390px]">

          {/* Header */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
                  Image Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Crop Image
                </h2>
              </div>

              <button
                type="button"
                onClick={resetEditor}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Reset"
              >
                <RefreshCcw size={17} />
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* Aspect Ratio */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Aspect Ratio
                </h3>

                <span className="text-xs font-medium text-slate-400">
                  Choose size
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {aspectOptions.map((option) => {
                  const Icon = option.icon;
                  const active = aspect === option.value;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setAspect(option.value)}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition ${
                        active
                          ? "border-violet-400 bg-violet-50 text-violet-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      <Icon size={17} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zoom */}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Zoom
                </h3>

                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((value) => Math.max(1, value - 0.1))
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-amber-50 hover:text-amber-600"
                >
                  <Minus size={17} />
                </button>

                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setZoom((value) => Math.min(3, value + 0.1))
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-amber-50 hover:text-amber-600"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>

            {/* Rotate */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Rotate
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={rotateLeft}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <RotateCcw size={17} />
                  Left
                </button>

                <button
                  type="button"
                  onClick={rotateRight}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <RotateCw size={17} />
                  Right
                </button>
              </div>
            </div>

            {/* Flip */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Flip
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFlipHorizontal((value) => !value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition ${
                    flipHorizontal
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  <FlipHorizontal size={17} />
                  Horizontal
                </button>

                <button
                  type="button"
                  onClick={() => setFlipVertical((value) => !value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition ${
                    flipVertical
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  <FlipVertical size={17} />
                  Vertical
                </button>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="border-t border-slate-200 bg-white p-4">
            {!done ? (
              <button
                type="button"
                onClick={handleCrop}
                disabled={processing || !imageUrl || !croppedAreaPixels}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={18} />

                {processing ? "Creating Crop..." : "Apply Crop"}
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadCrop}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600"
              >
                <Download size={18} />
                Download Cropped Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
