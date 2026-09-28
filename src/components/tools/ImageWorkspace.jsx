// src/components/tools/ImageWorkspace.jsx

import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import {
  Check,
  Crop,
  Droplets,
  Download,
  FileDown,
  FileImage,
  FlipHorizontal,
  ImagePlus,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Type,
  Upload,
} from "lucide-react";

const TOOLS = [
  { id: "crop", name: "Crop", icon: Crop, color: "text-fuchsia-500" },
  { id: "resize", name: "Resize", icon: Maximize2, color: "text-orange-500" },
  { id: "compress", name: "Compress", icon: FileDown, color: "text-amber-500" },
  { id: "convert", name: "Convert", icon: FileImage, color: "text-violet-500" },
  { id: "rotate", name: "Rotate", icon: RotateCw, color: "text-rose-500" },
  { id: "edit", name: "Edit", icon: Pencil, color: "text-emerald-500" },
  { id: "watermark", name: "Watermark", icon: Droplets, color: "text-cyan-500" },
];

const ASPECTS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
];

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

const EDIT_DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getInitialFormat(type) {
  if (type === "image/jpeg") return "jpeg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "png";
}

function getRotatedDimensions(width, height, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  };
}

export default function ImageWorkspace({ file, onResult }) {
  const stageRef = useRef(null);
  const imageUrlRef = useRef("");
  const watermarkImageUrlRef = useRef("");
  const resultUrlRef = useRef("");
  const previewUrlRef = useRef("");
  const onResultRef = useRef(onResult);
  const liveTimerRef = useRef(null);
  const dragRef = useRef(null);


  const [imageUrl, setImageUrl] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [activeTool, setActiveTool] = useState("crop");

  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);
  const [liveSize, setLiveSize] = useState(0);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropAspect, setCropAspect] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);

  const [compression, setCompression] = useState(70);

  const [format, setFormat] = useState("png");
  const [formatQuality, setFormatQuality] = useState(90);

  const [rotation, setRotation] = useState(0);

  const [brightness, setBrightness] = useState(
    EDIT_DEFAULTS.brightness,
  );
  const [contrast, setContrast] = useState(
    EDIT_DEFAULTS.contrast,
  );
  const [saturation, setSaturation] = useState(
    EDIT_DEFAULTS.saturation,
  );
  const [grayscale, setGrayscale] = useState(
    EDIT_DEFAULTS.grayscale,
  );

  const [watermarkType, setWatermarkType] = useState("text");
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkImageUrl, setWatermarkImageUrl] = useState("");
  const [watermarkOpacity, setWatermarkOpacity] = useState(60);
  const [watermarkSize, setWatermarkSize] = useState(7);
  const [watermarkRotation, setWatermarkRotation] = useState(-12);
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarkPosition, setWatermarkPosition] = useState({
    x: 0.78,
    y: 0.84,
  });

  const [previewZoom, setPreviewZoom] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!done) return;

    setDone(false);
    onResultRef.current?.("", "");
  }, [
    activeTool,
    crop,
    cropZoom,
    cropAspect,
    croppedAreaPixels,
    resizeWidth,
    resizeHeight,
    lockRatio,
    compression,
    format,
    formatQuality,
    rotation,
    brightness,
    contrast,
    saturation,
    grayscale,
    watermarkType,
    watermarkText,
    watermarkImageUrl,
    watermarkOpacity,
    watermarkSize,
    watermarkRotation,
    watermarkColor,
    watermarkPosition,
    done,
  ]);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    imageUrlRef.current = url;

    setImageUrl(url);
    setPreviewImageUrl("");
    setOriginalSize(file.size);
    setLiveSize(0);
    setFormat(getInitialFormat(file.type));
    setDone(false);
    setProcessing(false);

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      setImageWidth(width);
      setImageHeight(height);
      setResizeWidth(width);
      setResizeHeight(height);
      setCroppedAreaPixels({
        x: 0,
        y: 0,
        width,
        height,
      });
    };

    image.src = url;

    return () => {
      URL.revokeObjectURL(url);

      if (liveTimerRef.current) {
        clearTimeout(liveTimerRef.current);
      }

      if (watermarkImageUrlRef.current) {
        URL.revokeObjectURL(watermarkImageUrlRef.current);
        watermarkImageUrlRef.current = "";
      }

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = "";
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    };
  }, [file]);

  const getCropDimensions = () => {
    if (
      croppedAreaPixels?.width &&
      croppedAreaPixels?.height
    ) {
      return {
        width: Math.round(croppedAreaPixels.width),
        height: Math.round(croppedAreaPixels.height),
      };
    }

    return {
      width: imageWidth,
      height: imageHeight,
    };
  };

  const getOutputDimensions = () => {
    let { width, height } = getCropDimensions();

    if (
      activeTool === "resize" ||
      (resizeWidth && resizeHeight)
    ) {
      if (activeTool === "resize") {
        width = Math.max(1, Math.round(resizeWidth || width));
        height = Math.max(
          1,
          Math.round(resizeHeight || height),
        );
      }
    }

    const rotated = getRotatedDimensions(
      width,
      height,
      activeTool === "rotate" || rotation !== 0
        ? rotation
        : 0,
    );

    return rotated;
  };

  const outputDimensions = getOutputDimensions();

  const getWatermarkPosition = () => {
    if (!stageRef.current) return watermarkPosition;

    return watermarkPosition;
  };

  const startWatermarkDrag = (event) => {
    event.preventDefault();

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: watermarkPosition.x,
      startPositionY: watermarkPosition.y,
    };

    event.currentTarget.setPointerCapture?.(
      event.pointerId,
    );
  };

  useEffect(() => {
    const move = (event) => {
      if (!dragRef.current || !stageRef.current) return;

      const rect = stageRef.current.getBoundingClientRect();

      const dx =
        (event.clientX - dragRef.current.startX) /
        rect.width;

      const dy =
        (event.clientY - dragRef.current.startY) /
        rect.height;

      setWatermarkPosition({
        x: Math.min(
          0.97,
          Math.max(
            0.03,
            dragRef.current.startPositionX + dx,
          ),
        ),
        y: Math.min(
          0.97,
          Math.max(
            0.03,
            dragRef.current.startPositionY + dy,
          ),
        ),
      });
    };

    const stop = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [watermarkPosition]);

  const getWorkingWatermark = async () => {
    if (
      watermarkType === "image" &&
      watermarkImageUrl
    ) {
      return loadImage(watermarkImageUrl);
    }

    return null;
  };

  async function createOutputBlob(includeWatermark = true) {
    if (!imageUrl || !imageWidth || !imageHeight) {
      throw new Error("Image is not ready.");
    }

    const source = await loadImage(imageUrl);

    let sourceCanvas = document.createElement("canvas");
    let sourceContext = sourceCanvas.getContext("2d");

    sourceCanvas.width = source.naturalWidth;
    sourceCanvas.height = source.naturalHeight;

    sourceContext.drawImage(
      source,
      0,
      0,
      source.naturalWidth,
      source.naturalHeight,
    );

    const cropData =
      croppedAreaPixels || {
        x: 0,
        y: 0,
        width: source.naturalWidth,
        height: source.naturalHeight,
      };

    const cropCanvas = document.createElement("canvas");
    const cropContext = cropCanvas.getContext("2d");

    cropCanvas.width = Math.max(
      1,
      Math.round(cropData.width),
    );
    cropCanvas.height = Math.max(
      1,
      Math.round(cropData.height),
    );

    cropContext.drawImage(
      sourceCanvas,
      Math.round(cropData.x),
      Math.round(cropData.y),
      Math.round(cropData.width),
      Math.round(cropData.height),
      0,
      0,
      cropCanvas.width,
      cropCanvas.height,
    );

    sourceCanvas = cropCanvas;

    if (
      activeTool === "resize" ||
      (resizeWidth && resizeHeight)
    ) {
      const targetWidth =
        activeTool === "resize"
          ? Math.max(
              1,
              Math.round(resizeWidth),
            )
          : sourceCanvas.width;

      const targetHeight =
        activeTool === "resize"
          ? Math.max(
              1,
              Math.round(resizeHeight),
            )
          : sourceCanvas.height;

      const resizedCanvas =
        document.createElement("canvas");
      const resizedContext =
        resizedCanvas.getContext("2d");

      resizedCanvas.width = targetWidth;
      resizedCanvas.height = targetHeight;

      resizedContext.imageSmoothingEnabled = true;
      resizedContext.imageSmoothingQuality = "high";

      resizedContext.drawImage(
        sourceCanvas,
        0,
        0,
        targetWidth,
        targetHeight,
      );

      sourceCanvas = resizedCanvas;
    }

    if (rotation !== 0) {
      const rotatedDimensions =
        getRotatedDimensions(
          sourceCanvas.width,
          sourceCanvas.height,
          rotation,
        );

      const rotatedCanvas =
        document.createElement("canvas");
      const rotatedContext =
        rotatedCanvas.getContext("2d");

      rotatedCanvas.width = rotatedDimensions.width;
      rotatedCanvas.height =
        rotatedDimensions.height;

      rotatedContext.translate(
        rotatedCanvas.width / 2,
        rotatedCanvas.height / 2,
      );

      rotatedContext.rotate(
        (rotation * Math.PI) / 180,
      );

      rotatedContext.drawImage(
        sourceCanvas,
        -sourceCanvas.width / 2,
        -sourceCanvas.height / 2,
      );

      sourceCanvas = rotatedCanvas;
    }

    const finalCanvas =
      document.createElement("canvas");
    const finalContext =
      finalCanvas.getContext("2d");

    finalCanvas.width = sourceCanvas.width;
    finalCanvas.height = sourceCanvas.height;

    if (format === "jpeg") {
      finalContext.fillStyle = "#ffffff";
      finalContext.fillRect(
        0,
        0,
        finalCanvas.width,
        finalCanvas.height,
      );
    }

    finalContext.filter =
      `brightness(${brightness}%) ` +
      `contrast(${contrast}%) ` +
      `saturate(${saturation}%) ` +
      `grayscale(${grayscale}%)`;

    finalContext.drawImage(
      sourceCanvas,
      0,
      0,
      finalCanvas.width,
      finalCanvas.height,
    );

    finalContext.filter = "none";

    const watermarkEnabled =
      Boolean(watermarkText.trim()) ||
      Boolean(watermarkImageUrl);

    if (includeWatermark && watermarkEnabled) {
      finalContext.save();

      finalContext.globalAlpha =
        watermarkOpacity / 100;

      finalContext.translate(
        finalCanvas.width *
          getWatermarkPosition().x,
        finalCanvas.height *
          getWatermarkPosition().y,
      );

      finalContext.rotate(
        (watermarkRotation * Math.PI) / 180,
      );

      if (
        watermarkType === "image" &&
        watermarkImageUrl
      ) {
        const watermarkImage =
          await getWorkingWatermark();

        const watermarkWidth =
          finalCanvas.width *
          (watermarkSize / 100);

        const ratio =
          watermarkImage.naturalWidth /
          watermarkImage.naturalHeight;

        const watermarkHeight =
          watermarkWidth / ratio;

        finalContext.drawImage(
          watermarkImage,
          -watermarkWidth / 2,
          -watermarkHeight / 2,
          watermarkWidth,
          watermarkHeight,
        );
      } else if (watermarkText.trim()) {
        const textSize = Math.max(
          12,
          Math.round(
            Math.min(
              finalCanvas.width,
              finalCanvas.height,
            ) *
              (watermarkSize / 100),
          ),
        );

        finalContext.font = `700 ${textSize}px Inter, Arial, sans-serif`;
        finalContext.textAlign = "center";
        finalContext.textBaseline = "middle";
        finalContext.fillStyle = watermarkColor;

        finalContext.fillText(
          watermarkText.trim(),
          0,
          0,
        );
      }

      finalContext.restore();
    }

    const selectedFormat = FORMATS[format];

    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error("Could not create output image."),
            );
            return;
          }

          resolve(blob);
        },
        selectedFormat.mime,
        format === "png"
          ? undefined
          : activeTool === "compress"
            ? compression / 100
            : formatQuality / 100,
      );
    });
  }

  useEffect(() => {
    if (
      !imageUrl ||
      !imageWidth ||
      !imageHeight ||
      !croppedAreaPixels ||
      activeTool === "crop"
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const blob = await createOutputBlob(false);
        const url = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }

        previewUrlRef.current = url;
        setPreviewImageUrl(url);
      } catch (error) {
        console.error("Preview update failed:", error);
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // `createOutputBlob` closes over the same values listed here.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTool,
    compression,
    format,
    formatQuality,
    brightness,
    contrast,
    saturation,
    grayscale,
    rotation,
    resizeWidth,
    resizeHeight,
    croppedAreaPixels,
    watermarkText,
    watermarkImageUrl,
    watermarkOpacity,
    watermarkSize,
    watermarkRotation,
    watermarkColor,
    watermarkPosition,
    watermarkType,
    imageUrl,
    imageWidth,
    imageHeight,
  ]);

  useEffect(() => {
    if (
      !imageUrl ||
      !imageWidth ||
      !imageHeight ||
      !croppedAreaPixels
    ) {
      return;
    }

    if (
      activeTool !== "compress" &&
      activeTool !== "convert"
    ) {
      return;
    }

    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
    }

    liveTimerRef.current = setTimeout(async () => {
      try {
        const blob = await createOutputBlob();
        setLiveSize(blob.size);
      } catch (error) {
        console.error("Live size update failed:", error);
      }
    }, 260);

    return () => {
      if (liveTimerRef.current) {
        clearTimeout(liveTimerRef.current);
      }
    };
  }, [
    activeTool,
    compression,
    format,
    formatQuality,
    brightness,
    contrast,
    saturation,
    grayscale,
    rotation,
    resizeWidth,
    resizeHeight,
    croppedAreaPixels,
    watermarkText,
    watermarkImageUrl,
    watermarkOpacity,
    watermarkSize,
    watermarkRotation,
    watermarkColor,
    watermarkPosition,
    watermarkType,
    imageUrl,
    imageWidth,
    imageHeight,
  ]);

  const applyChanges = async () => {
    try {
      setProcessing(true);

      const blob = await createOutputBlob();

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }

      const url = URL.createObjectURL(blob);

      resultUrlRef.current = url;

      setLiveSize(blob.size);
      setDone(true);

      onResult(
        url,
        FORMATS[format].extension,
      );
    } catch (error) {
      console.error("Export failed:", error);
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

  const resetAll = () => {
    setCrop({ x: 0, y: 0 });
    setCropZoom(1);
    setCropAspect(null);

    setResizeWidth(imageWidth);
    setResizeHeight(imageHeight);
    setLockRatio(true);

    setCompression(70);

    setFormat(getInitialFormat(file?.type));
    setFormatQuality(90);

    setRotation(0);

    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);

    setWatermarkText("");
    setWatermarkType("text");
    setWatermarkImageUrl("");
    if (watermarkImageUrlRef.current) {
      URL.revokeObjectURL(watermarkImageUrlRef.current);
      watermarkImageUrlRef.current = "";
    }
    setWatermarkOpacity(60);
    setWatermarkSize(7);
    setWatermarkRotation(-12);
    setWatermarkColor("#ffffff");
    setWatermarkPosition({
      x: 0.78,
      y: 0.84,
    });

    setDone(false);
    setLiveSize(0);

    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }

    onResultRef.current?.("", "");
  };

  const handleResizeWidth = (value) => {
    const nextWidth = Math.max(
      1,
      Number(value) || 1,
    );

    setResizeWidth(nextWidth);

    const ratioDimensions = getCropDimensions();

    if (
      lockRatio &&
      ratioDimensions.width &&
      ratioDimensions.height
    ) {
      setResizeHeight(
        Math.max(
          1,
          Math.round(
            (nextWidth / ratioDimensions.width) *
              ratioDimensions.height,
          ),
        ),
      );
    }

    setDone(false);
  };

  const handleResizeHeight = (value) => {
    const nextHeight = Math.max(
      1,
      Number(value) || 1,
    );

    setResizeHeight(nextHeight);

    const ratioDimensions = getCropDimensions();

    if (
      lockRatio &&
      ratioDimensions.width &&
      ratioDimensions.height
    ) {
      setResizeWidth(
        Math.max(
          1,
          Math.round(
            (nextHeight / ratioDimensions.height) *
              ratioDimensions.width,
          ),
        ),
      );
    }

    setDone(false);
  };

  const handleWatermarkImage = (event) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) return;

    if (
      !selectedFile.type.startsWith("image/")
    ) {
      return;
    }

    if (watermarkImageUrlRef.current) {
      URL.revokeObjectURL(
        watermarkImageUrlRef.current,
      );
    }

    const url = URL.createObjectURL(
      selectedFile,
    );

    watermarkImageUrlRef.current = url;

    setWatermarkImageUrl(url);
    setWatermarkType("image");
    setDone(false);
  };

  const selectedTool =
    TOOLS.find((tool) => tool.id === activeTool) ||
    TOOLS[0];

  const ToolIcon = selectedTool.icon;

  const watermarkPositionStyle = {
    left: `${watermarkPosition.x * 100}%`,
    top: `${watermarkPosition.y * 100}%`,
    opacity: watermarkOpacity / 100,
    transform: `translate(-50%, -50%) rotate(${watermarkRotation}deg)`,
  };

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#e9edf3] p-2 sm:p-4">
      <div className="flex h-full min-h-0 w-full max-w-[1500px] overflow-hidden rounded-[24px] border border-slate-300 bg-[#f8fafc] shadow-[0_30px_100px_-35px_rgba(15,23,42,0.35)]">

        {/* TOOL RAIL */}
        <aside className="w-[82px] shrink-0 border-r border-slate-200 bg-white">
          <div className="flex h-full flex-col items-center py-3">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <SlidersHorizontal size={18} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const active =
                  activeTool === tool.id;

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setActiveTool(tool.id);
                      setDone(false);
                    }}
                    className={`group flex w-[68px] flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <Icon
                      size={19}
                      className={
                        active
                          ? "text-white"
                          : tool.color
                      }
                    />

                    <span className="text-[10px] font-bold leading-none">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* CENTER WORKSPACE */}
        <section className="flex min-w-0 flex-1 flex-col bg-[#171717]">

          {/* TOP BAR */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <ToolIcon
                size={17}
                className={selectedTool.color}
              />

              <span className="text-sm font-bold text-white">
                {selectedTool.name}
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              <button
                type="button"
                onClick={() =>
                  setPreviewZoom((value) =>
                    Math.max(
                      0.5,
                      Number(
                        (value - 0.1).toFixed(1),
                      ),
                    ),
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Minus size={14} />
              </button>

              <button
                type="button"
                onClick={() => setPreviewZoom(1)}
                className="min-w-[46px] text-[11px] font-bold text-white/80"
              >
                {Math.round(
                  previewZoom * 100,
                )}
                %
              </button>

              <button
                type="button"
                onClick={() =>
                  setPreviewZoom((value) =>
                    Math.min(
                      1.8,
                      Number(
                        (value + 0.1).toFixed(1),
                      ),
                    ),
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="relative min-h-0 flex-1 overflow-hidden p-4 sm:p-6">

            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#4d4d4d 25%,transparent 25%),linear-gradient(-45deg,#4d4d4d 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#4d4d4d 75%),linear-gradient(-45deg,transparent 75%,#4d4d4d 75%)",
                backgroundSize: "28px 28px",
                backgroundPosition:
                  "0 0,0 14px,14px -14px,-14px 0",
              }}
            />

            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden"
            >
              {imageUrl && activeTool === "crop" ? (
                <div className="relative h-full w-full">
                  <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={cropZoom}
                    aspect={cropAspect || undefined}
                    cropShape="rect"
                    showGrid
                    objectFit="contain"
                    onCropChange={setCrop}
                    onCropComplete={(
                      _,
                      pixels,
                    ) =>
                      setCroppedAreaPixels(
                        pixels,
                      )
                    }
                    onZoomChange={setCropZoom}
                  />
                </div>
              ) : imageUrl ? (
                <div
                  className="relative flex items-center justify-center transition-all duration-200"
                  style={{
                    width: "min(92%, 980px)",
                    maxHeight: "90%",
                    transform: `scale(${previewZoom})`,
                  }}
                >
                  <div
                    className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg"
                    style={{
                      aspectRatio: `${Math.max(
                        1,
                        outputDimensions.width,
                      )} / ${Math.max(
                        1,
                        outputDimensions.height,
                      )}`,
                    }}
                  >
                    <div
                      ref={stageRef}
                      className="relative flex max-h-full max-w-full items-center justify-center"
                    >
                      <img
                        src={previewImageUrl || imageUrl}
                        alt="Editor preview"
                        className="block max-h-[78vh] max-w-[78vw] object-contain shadow-2xl"
                        draggable="false"
                      />

                      {watermarkText.trim() ||
                      watermarkImageUrl ? (
                        <div
                          onPointerDown={
                            startWatermarkDrag
                          }
                          className="absolute z-20 cursor-move select-none rounded-md border border-dashed border-white/0 px-2 py-1 hover:border-white/60"
                          style={
                            watermarkPositionStyle
                          }
                        >
                          {watermarkType ===
                            "image" &&
                          watermarkImageUrl ? (
                            <img
                              src={
                                watermarkImageUrl
                              }
                              alt="Watermark"
                              className="block max-w-[30vw] object-contain"
                              style={{
                                width: `${Math.max(
                                  30,
                                  imageWidth *
                                    (watermarkSize /
                                      100),
                                )}px`,
                              }}
                              draggable="false"
                            />
                          ) : (
                            <span
                              style={{
                                color:
                                  watermarkColor,
                                fontSize: `${Math.max(
                                  14,
                                  Math.min(
                                    80,
                                    imageWidth *
                                      (watermarkSize /
                                        100) *
                                      0.12,
                                  ),
                                )}px`,
                                fontWeight: 700,
                                whiteSpace:
                                  "nowrap",
                                textShadow:
                                  "0 2px 8px rgba(0,0,0,.35)",
                              }}
                            >
                              {watermarkText}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* STATUS BAR */}
          <div className="shrink-0 border-t border-white/10 bg-[#202020] px-4 py-3">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">

              <div className="flex items-center gap-2">
                <span className="text-white/40">
                  Size
                </span>
                <span className="font-bold text-white">
                  {outputDimensions.width} ×{" "}
                  {outputDimensions.height}
                </span>
              </div>

              <span className="text-white/15">
                |
              </span>

              <div className="flex items-center gap-2">
                <span className="text-white/40">
                  File
                </span>
                <span className="font-bold text-white">
                  {liveSize
                    ? formatBytes(liveSize)
                    : formatBytes(
                        originalSize,
                      )}
                </span>
              </div>

              <span className="text-white/15">
                |
              </span>

              <div className="flex items-center gap-2">
                <span className="text-white/40">
                  Format
                </span>
                <span className="font-bold text-white">
                  {FORMATS[format].label}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CONTROL PANEL */}
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-[#f8fafc]">

          {/* PANEL HEADER */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                {selectedTool.name}
              </p>

              <p className="text-[10px] font-medium text-slate-400">
                {file?.name || "Image"}
              </p>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
            >
              <RefreshCcw size={15} />
            </button>
          </div>

          {/* PANEL CONTENT */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">

            {/* CROP */}
            {activeTool === "crop" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<Crop size={15} />}
                  title="Aspect"
                />

                <div className="grid grid-cols-4 gap-2">
                  {ASPECTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() =>
                        setCropAspect(
                          item.value,
                        )
                      }
                      className={`rounded-lg border py-2.5 text-xs font-bold ${
                        cropAspect ===
                        item.value
                          ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <ControlRow
                  label="Zoom"
                  value={`${cropZoom.toFixed(1)}×`}
                >
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={cropZoom}
                    onChange={(e) =>
                      setCropZoom(
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-fuchsia-500"
                  />
                </ControlRow>
              </div>
            )}

            {/* RESIZE */}
            {activeTool === "resize" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<Maximize2 size={15} />}
                  title="Dimensions"
                />

                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <ValueInput
                    label="Width"
                    value={resizeWidth}
                    onChange={handleResizeWidth}
                  />

                  <span className="pb-3 text-slate-300">
                    ×
                  </span>

                  <ValueInput
                    label="Height"
                    value={resizeHeight}
                    onChange={handleResizeHeight}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLockRatio(
                      (value) => !value,
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-xs font-bold ${
                    lockRatio
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span>Keep Aspect Ratio</span>

                  <span>
                    {lockRatio ? "ON" : "OFF"}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    [1080, 1080],
                    [1920, 1080],
                    [1080, 1350],
                    [1080, 1920],
                  ].map(
                    ([w, h]) => (
                      <button
                        key={`${w}-${h}`}
                        type="button"
                        onClick={() => {
                          setResizeWidth(w);
                          setResizeHeight(h);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-orange-300 hover:bg-orange-50"
                      >
                        <p className="text-xs font-bold text-slate-700">
                          {w} × {h}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* COMPRESS */}
            {activeTool === "compress" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<FileDown size={15} />}
                  title="Compression"
                />

                <ControlRow
                  label="Quality"
                  value={`${compression}%`}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={compression}
                    onChange={(e) => {
                      setCompression(
                        Number(
                          e.target.value,
                        ),
                      );
                      setDone(false);
                    }}
                    className="w-full accent-amber-500"
                  />

                  <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </ControlRow>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">
                      Original
                    </span>

                    <span className="text-xs font-bold text-slate-700">
                      {formatBytes(
                        originalSize,
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between">
                    <span className="text-xs text-slate-400">
                      Live
                    </span>

                    <span className="text-xs font-bold text-emerald-600">
                      {liveSize
                        ? formatBytes(
                            liveSize,
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CONVERT */}
            {activeTool === "convert" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<FileImage size={15} />}
                  title="Format"
                />

                <div className="space-y-2">
                  {Object.entries(
                    FORMATS,
                  ).map(
                    ([value, item]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setFormat(value);
                          setDone(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 ${
                          format === value
                            ? "border-violet-300 bg-violet-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-black ${
                              format ===
                              value
                                ? "bg-violet-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.label}
                          </div>

                          <span
                            className={`text-xs font-bold ${
                              format ===
                              value
                                ? "text-violet-700"
                                : "text-slate-700"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>

                        {format ===
                          value && (
                          <Check
                            size={15}
                            className="text-violet-600"
                          />
                        )}
                      </button>
                    ),
                  )}
                </div>

                {format !==
                  "png" && (
                  <ControlRow
                    label="Quality"
                    value={`${formatQuality}%`}
                  >
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={
                        formatQuality
                      }
                      onChange={(e) => {
                        setFormatQuality(
                          Number(
                            e.target.value,
                          ),
                        );
                        setDone(false);
                      }}
                      className="w-full accent-violet-500"
                    />
                  </ControlRow>
                )}
              </div>
            )}

            {/* ROTATE */}
            {activeTool === "rotate" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<RotateCw size={15} />}
                  title="Rotation"
                />

                <ControlRow
                  label="Angle"
                  value={`${rotation}°`}
                >
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={rotation}
                    onChange={(e) => {
                      setRotation(
                        Number(
                          e.target.value,
                        ),
                      );
                      setDone(false);
                    }}
                    className="w-full accent-rose-500"
                  />
                </ControlRow>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRotation(
                        (value) =>
                          value - 90,
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600"
                  >
                    <RotateCcw size={15} />
                    -90°
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRotation(0)
                    }
                    className="rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRotation(
                        (value) =>
                          value + 90,
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600"
                  >
                    +90°
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* EDIT */}
            {activeTool === "edit" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<Pencil size={15} />}
                  title="Adjust"
                />

                <AdjustRow
                  label="Brightness"
                  value={brightness}
                  min={0}
                  max={200}
                  onChange={setBrightness}
                  accent="accent-emerald-500"
                />

                <AdjustRow
                  label="Contrast"
                  value={contrast}
                  min={0}
                  max={200}
                  onChange={setContrast}
                  accent="accent-emerald-500"
                />

                <AdjustRow
                  label="Saturation"
                  value={saturation}
                  min={0}
                  max={200}
                  onChange={setSaturation}
                  accent="accent-emerald-500"
                />

                <AdjustRow
                  label="Grayscale"
                  value={grayscale}
                  min={0}
                  max={100}
                  onChange={setGrayscale}
                  accent="accent-slate-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSaturation(100);
                    setGrayscale(0);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600"
                >
                  <RefreshCcw size={14} />
                  Reset Adjustments
                </button>
              </div>
            )}

            {/* WATERMARK */}
            {activeTool ===
              "watermark" && (
              <div className="space-y-5">

                <ControlTitle
                  icon={<Droplets size={15} />}
                  title="Watermark"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                          onClick={() =>
                      {
                        setWatermarkType("text");
                        setDone(false);
                      }
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold ${
                      watermarkType ===
                      "text"
                        ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <Type size={15} />
                    Text
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      {
                        setWatermarkType("image");
                        setDone(false);
                      }
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold ${
                      watermarkType ===
                      "image"
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <ImagePlus
                      size={15}
                    />
                    Image
                  </button>
                </div>

                {watermarkType ===
                  "text" && (
                  <>
                    <ControlRow
                      label="Text"
                      value={
                        watermarkText.length
                      }
                    >
                      <input
                        type="text"
                        value={
                          watermarkText
                        }
                        onChange={(e) => {
                          setWatermarkText(
                            e.target
                              .value,
                          );
                          setDone(false);
                        }}
                        placeholder="Your watermark"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400"
                      />
                    </ControlRow>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-2 text-xs font-bold text-slate-500">
                          Color
                        </p>

                        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3">
                          <input
                            type="color"
                            value={
                              watermarkColor
                            }
                            onChange={(e) => {
                              setWatermarkColor(
                                e.target
                                  .value,
                              );
                              setDone(
                                false,
                              );
                            }}
                            className="h-7 w-full cursor-pointer border-0 bg-transparent p-0"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-bold text-slate-500">
                          Size
                        </p>

                        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3">
                          <input
                            type="number"
                            min="2"
                            max="15"
                            value={
                              watermarkSize
                            }
                            onChange={(e) =>
                              setWatermarkSize(
                                Math.min(
                                  15,
                                  Math.max(
                                    2,
                                    Number(
                                      e
                                        .target
                                        .value,
                                    ) ||
                                      2,
                                  ),
                                ),
                              )
                            }
                            className="w-full bg-transparent text-sm font-bold outline-none"
                          />
                          <span className="text-xs text-slate-400">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {watermarkType ===
                  "image" && (
                  <div>
                    {!watermarkImageUrl ? (
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-7 text-center hover:border-violet-400">
                        <Upload
                          size={20}
                          className="text-violet-500"
                        />

                        <span className="mt-2 text-xs font-bold text-slate-700">
                          Upload watermark
                        </span>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={
                            handleWatermarkImage
                          }
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <img
                          src={
                            watermarkImageUrl
                          }
                          alt="Watermark"
                          className="h-12 w-12 rounded-lg object-contain"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700">
                            Image watermark
                          </p>

                          <p className="mt-1 text-[11px] text-slate-400">
                            Drag on preview
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(
                              watermarkImageUrl,
                            );

                            watermarkImageUrlRef.current =
                              "";

                            setWatermarkImageUrl(
                              "",
                            );
                            setDone(false);
                          }}
                          className="text-xs font-bold text-rose-500"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {watermarkType ===
                  "image" &&
                  watermarkImageUrl && (
                    <ControlRow
                      label="Size"
                      value={`${watermarkSize}%`}
                    >
                      <input
                        type="range"
                        min="5"
                        max="40"
                        value={
                          watermarkSize
                        }
                        onChange={(e) =>
                          setWatermarkSize(
                            Number(
                              e.target
                                .value,
                            ),
                          )
                        }
                        className="w-full accent-violet-500"
                      />
                    </ControlRow>
                  )}

                <AdjustRow
                  label="Opacity"
                  value={watermarkOpacity}
                  min={0}
                  max={100}
                  onChange={
                    setWatermarkOpacity
                  }
                  accent="accent-amber-500"
                  suffix="%"
                />

                <AdjustRow
                  label="Rotation"
                  value={watermarkRotation}
                  min={-45}
                  max={45}
                  onChange={
                    setWatermarkRotation
                  }
                  accent="accent-rose-500"
                  suffix="°"
                />

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlipHorizontal
                        size={15}
                        className="text-cyan-500"
                      />

                      <span className="text-xs font-bold text-slate-700">
                        Position
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400">
                      Drag
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* OUTPUT */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Output
                </span>

                <span className="text-xs font-extrabold text-slate-700">
                  {outputDimensions.width} ×{" "}
                  {outputDimensions.height}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Format
                </span>

                <span className="text-xs font-extrabold text-violet-600">
                  {FORMATS[format].label}
                </span>
              </div>
            </div>
          </div>

          {/* ACTION */}
          <div className="border-t border-slate-200 bg-white p-3">
            {!done ? (
              <button
                type="button"
                onClick={applyChanges}
                disabled={
                  processing ||
                  !imageUrl
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <RefreshCcw
                      size={17}
                      className="animate-spin"
                    />
                    Processing
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    Apply
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadResult}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-emerald-600"
              >
                <Download size={17} />
                Download
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ControlTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
        {icon}
      </div>

      <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-700">
        {title}
      </h3>
    </div>
  );
}

function ControlRow({
  label,
  value,
  children,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">
          {label}
        </span>

        <span className="text-xs font-extrabold text-slate-800">
          {value}
        </span>
      </div>

      {children}
    </div>
  );
}

function ValueInput({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </label>

      <input
        type="number"
        min="1"
        value={value || ""}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
      />
    </div>
  );
}

function AdjustRow({
  label,
  value,
  min,
  max,
  onChange,
  accent,
  suffix = "%",
}) {
  return (
    <ControlRow
      label={label}
      value={`${value}${suffix}`}
    >
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(
            Number(e.target.value),
          )
        }
        className={`w-full ${accent}`}
      />

      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </ControlRow>
  );
}
