import {
  Check,
  Loader2,
  RotateCw,
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

async function rotateImage(file, angle) {
  const url = URL.createObjectURL(file);

  try {
    const image = await createImage(url);

    const radians = (angle * Math.PI) / 180;

    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    const width = Math.round(
      image.width * cos +
        image.height * sin,
    );

    const height = Math.round(
      image.width * sin +
        image.height * cos,
    );

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    context.translate(
      width / 2,
      height / 2,
    );

    context.rotate(radians);

    context.drawImage(
      image,
      -image.width / 2,
      -image.height / 2,
    );

    return await new Promise(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error("Rotation failed"),
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

export default function RotateEditor({
  file,
  onResult,
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [angle, setAngle] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);

    setImageUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleRotate = async () => {
    if (processing || angle === 0) return;

    try {
      setProcessing(true);
      setDone(false);

      const blob = await rotateImage(
        file,
        angle,
      );

      const resultUrl = URL.createObjectURL(blob);

      onResult(resultUrl, "png");
      setDone(true);
    } catch (error) {
      console.error(
        "Rotation failed:",
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
              transform: `rotate(${angle}deg)`,
            }}
            className="max-h-full max-w-full rounded-xl object-contain transition-transform duration-300"
          />
        )}
      </section>

      <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <RotateCw size={21} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Rotate Image
            </h2>

            <p className="text-xs text-slate-500">
              Rotate your image
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2">
          {[90, 180, 270, 360].map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAngle(value);
                  setDone(false);
                }}
                className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                  angle === value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {value}°
              </button>
            ),
          )}
        </div>

        <div className="mt-auto">
          <button
            type="button"
            onClick={handleRotate}
            disabled={
              processing ||
              done ||
              angle === 0
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Rotating...
              </>
            ) : done ? (
              <>
                <Check size={18} />
                Rotated
              </>
            ) : (
              "Rotate Image"
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}