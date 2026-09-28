import {
  Check,
  Loader2,
  Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function editImage(
  file,
  brightness,
  contrast,
  saturation,
  grayscale,
) {
  const url = URL.createObjectURL(file);

  try {
    const image = await createImage(url);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;

    context.filter = `
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
      grayscale(${grayscale}%)
    `;

    context.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
    );

    return await new Promise(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error("Edit failed"),
              );
              return;
            }

            resolve(blob);
          },
          "image/png",
          1,
        );
      },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EditEditor({
  file,
  onResult,
}) {
  const [imageUrl, setImageUrl] = useState("");

  const [brightness, setBrightness] =
    useState(100);

  const [contrast, setContrast] =
    useState(100);

  const [saturation, setSaturation] =
    useState(100);

  const [grayscale, setGrayscale] =
    useState(0);

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);

    setImageUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setDone(false);
  };

  const handleEdit = async () => {
    if (processing) return;

    try {
      setProcessing(true);
      setDone(false);

      const blob = await editImage(
        file,
        brightness,
        contrast,
        saturation,
        grayscale,
      );

      const resultUrl = URL.createObjectURL(blob);

      onResult(resultUrl, "png");
      setDone(true);
    } catch (error) {
      console.error(
        "Edit failed:",
        error,
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[1fr_250px]">
      <section className="flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            style={{
              filter: `
                brightness(${brightness}%)
                contrast(${contrast}%)
                saturate(${saturation}%)
                grayscale(${grayscale}%)
              `,
            }}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        )}
      </section>

      <aside className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Pencil size={21} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Edit Image
            </h2>

            <p className="text-xs text-slate-500">
              Adjust your image
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Brightness */}
          <div>
            <div className="flex justify-between">
              <label className="text-xs font-bold text-slate-700">
                Brightness
              </label>

              <span className="text-xs text-slate-500">
                {brightness}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="200"
              value={brightness}
              onChange={(event) => {
                setBrightness(
                  Number(event.target.value),
                );
                setDone(false);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between">
              <label className="text-xs font-bold text-slate-700">
                Contrast
              </label>

              <span className="text-xs text-slate-500">
                {contrast}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="200"
              value={contrast}
              onChange={(event) => {
                setContrast(
                  Number(event.target.value),
                );
                setDone(false);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex justify-between">
              <label className="text-xs font-bold text-slate-700">
                Saturation
              </label>

              <span className="text-xs text-slate-500">
                {saturation}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="200"
              value={saturation}
              onChange={(event) => {
                setSaturation(
                  Number(event.target.value),
                );
                setDone(false);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>

          {/* Grayscale */}
          <div>
            <div className="flex justify-between">
              <label className="text-xs font-bold text-slate-700">
                Grayscale
              </label>

              <span className="text-xs text-slate-500">
                {grayscale}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={grayscale}
              onChange={(event) => {
                setGrayscale(
                  Number(event.target.value),
                );
                setDone(false);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>
        </div>

        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={reset}
            className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleEdit}
            disabled={processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Applying...
              </>
            ) : done ? (
              <>
                <Check size={18} />
                Applied
              </>
            ) : (
              "Apply Changes"
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}