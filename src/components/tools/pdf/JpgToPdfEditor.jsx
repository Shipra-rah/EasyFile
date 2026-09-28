import {
  ArrowDown,
  ArrowUp,
  Check,
  FileDown,
  ImagePlus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";

export default function JpgToPdfEditor({
  file,
  files,
  onResult,
}) {
  // ---------------------------------------------
  // Initial images
  // ---------------------------------------------

  const initialFiles = useMemo(() => {
    if (
      Array.isArray(files) &&
      files.length > 0
    ) {
      return files.filter(isSupportedImage);
    }

    if (file && isSupportedImage(file)) {
      return [file];
    }

    return [];
  }, [file, files]);

  const [imageFiles, setImageFiles] =
    useState(initialFiles);

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const [error, setError] =
    useState("");

  // ---------------------------------------------
  // Sync files
  // ---------------------------------------------

  useEffect(() => {
    setImageFiles(initialFiles);
    setDone(false);
    setError("");
  }, [initialFiles]);

  // ---------------------------------------------
  // Add images
  // ---------------------------------------------

  const addImages = (event) => {
    const selectedFiles = Array.from(
      event.target.files || [],
    );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    const validFiles =
      selectedFiles.filter(
        isSupportedImage,
      );

    if (
      validFiles.length === 0
    ) {
      setError(
        "Please select JPG or PNG images only.",
      );

      event.target.value = "";
      return;
    }

    setImageFiles((current) => [
      ...current,
      ...validFiles,
    ]);

    setDone(false);
    setError("");

    event.target.value = "";
  };

  // ---------------------------------------------
  // Remove image
  // ---------------------------------------------

  const removeImage = (index) => {
    setImageFiles((current) =>
      current.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      ),
    );

    setDone(false);
  };

  // ---------------------------------------------
  // Move image up
  // ---------------------------------------------

  const moveUp = (index) => {
    if (index === 0) {
      return;
    }

    setImageFiles((current) => {
      const next = [...current];

      [
        next[index - 1],
        next[index],
      ] = [
        next[index],
        next[index - 1],
      ];

      return next;
    });

    setDone(false);
  };

  // ---------------------------------------------
  // Move image down
  // ---------------------------------------------

  const moveDown = (index) => {
    if (
      index ===
      imageFiles.length - 1
    ) {
      return;
    }

    setImageFiles((current) => {
      const next = [...current];

      [
        next[index],
        next[index + 1],
      ] = [
        next[index + 1],
        next[index],
      ];

      return next;
    });

    setDone(false);
  };

  // ---------------------------------------------
  // Create PDF
  // ---------------------------------------------

  const createPdf = async () => {
    if (imageFiles.length === 0) {
      setError(
        "Please add at least one image.",
      );
      return;
    }

    try {
      setProcessing(true);
      setDone(false);
      setError("");

      const pdfDoc =
        await PDFDocument.create();

      for (
        const imageFile of imageFiles
      ) {
        const imageBytes =
          await imageFile.arrayBuffer();

        const isPng =
          imageFile.type ===
            "image/png" ||
          imageFile.name
            .toLowerCase()
            .endsWith(".png");

        let image;

        if (isPng) {
          image =
            await pdfDoc.embedPng(
              imageBytes,
            );
        } else {
          image =
            await pdfDoc.embedJpg(
              imageBytes,
            );
        }

        /*
         * Use image dimensions as the PDF page
         * dimensions so the image is not cropped.
         */
        const page =
          pdfDoc.addPage([
            image.width,
            image.height,
          ]);

        /*
         * White page background.
         */
        page.drawRectangle({
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
          color: rgb(1, 1, 1),
        });

        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes =
        await pdfDoc.save({
          useObjectStreams: true,
        });

      const blob = new Blob(
        [pdfBytes],
        {
          type: "application/pdf",
        },
      );

      const resultUrl =
        URL.createObjectURL(blob);

      setDone(true);

      /*
       * ToolWork.jsx handles the download.
       */
      onResult(
        resultUrl,
        "pdf",
      );
    } catch (err) {
      console.error(
        "JPG to PDF error:",
        err,
      );

      setError(
        "Could not create the PDF. Please check the images and try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ---------------------------------------------
  // Reset
  // ---------------------------------------------

  const resetEditor = () => {
    setImageFiles(initialFiles);
    setDone(false);
    setError("");
  };

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1100px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">

        {/* ====================================== */}
        {/* HEADER */}
        {/* ====================================== */}

        <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3">

          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">
              JPG to PDF
            </h2>

            <p className="max-w-[450px] truncate text-xs text-slate-500">
              Convert one or more images into a PDF
            </p>
          </div>

          <button
            type="button"
            onClick={resetEditor}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-50"
            title="Reset"
          >
            <RefreshCcw size={16} />
          </button>
        </header>

        {/* ====================================== */}
        {/* WORKSPACE */}
        {/* ====================================== */}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* ==================================== */}
          {/* LEFT — IMAGE LIST */}
          {/* ==================================== */}

          <section className="min-h-0 overflow-y-auto bg-slate-100 p-4 sm:p-5">

            {imageFiles.length === 0 ? (
              <EmptyState
                onSelect={addImages}
              />
            ) : (
              <div className="mx-auto max-w-[800px]">

                {/* Top row */}

                <div className="mb-4 flex items-center justify-between">

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {imageFiles.length}{" "}
                      {imageFiles.length ===
                      1
                        ? "image"
                        : "images"}
                    </p>

                    <p className="text-xs text-slate-500">
                      Each image becomes one PDF page.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                    <Upload size={15} />
                    Add Images

                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      multiple
                      onChange={addImages}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Images */}

                <div className="space-y-2">

                  {imageFiles.map(
                    (
                      imageFile,
                      index,
                    ) => (
                      <ImageRow
                        key={`${imageFile.name}-${imageFile.size}-${imageFile.lastModified}-${index}`}
                        file={imageFile}
                        index={index}
                        total={
                          imageFiles.length
                        }
                        onUp={() =>
                          moveUp(
                            index,
                          )
                        }
                        onDown={() =>
                          moveDown(
                            index,
                          )
                        }
                        onRemove={() =>
                          removeImage(
                            index,
                          )
                        }
                      />
                    ),
                  )}
                </div>

                {/* Add more */}

                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-slate-300 bg-white px-4 py-4 text-xs font-semibold text-slate-500 transition hover:bg-slate-50">
                  <ImagePlus size={16} />
                  Add More Images

                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={addImages}
                    className="hidden"
                  />
                </label>

                {/* Error */}

                {error && (
                  <div className="mt-3 border border-slate-300 bg-white px-4 py-3">
                    <p className="text-xs font-semibold leading-5 text-slate-600">
                      {error}
                    </p>
                  </div>
                )}

                {/* Done */}

                {done && (
                  <div className="mt-3 flex items-center gap-3 border border-slate-300 bg-white px-4 py-3">

                    <Check
                      size={17}
                      className="text-slate-800"
                    />

                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        PDF created successfully
                      </p>

                      <p className="text-[11px] text-slate-500">
                        {imageFiles.length}{" "}
                        {imageFiles.length ===
                        1
                          ? "image"
                          : "images"}{" "}
                        converted.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ==================================== */}
          {/* RIGHT — INFORMATION */}
          {/* ==================================== */}

          <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">

            {/* Info */}

            <div className="min-h-0 flex-1 overflow-y-auto p-5">

              <h3 className="text-sm font-bold text-slate-900">
                PDF
              </h3>

              <div className="mt-4 space-y-2">

                <InfoRow
                  label="Images"
                  value={
                    imageFiles.length
                  }
                />

                <InfoRow
                  label="Pages"
                  value={
                    imageFiles.length
                  }
                />

                <InfoRow
                  label="Output"
                  value="PDF"
                />
              </div>

              <p className="mt-4 text-[10px] leading-4 text-slate-400">
                Images are added to the PDF in the
                order shown on the left.
              </p>
            </div>

            {/* Fixed action */}

            <div className="shrink-0 border-t border-slate-300 bg-white p-5">

              <button
                type="button"
                onClick={createPdf}
                disabled={
                  processing ||
                  imageFiles.length ===
                    0
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileDown size={17} />
                    Create PDF
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ================================================= */
/* IMAGE ROW */
/* ================================================= */

function ImageRow({
  file,
  index,
  total,
  onUp,
  onDown,
  onRemove,
}) {
  const [previewUrl, setPreviewUrl] =
    useState("");

  useEffect(() => {
    const url =
      URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="flex items-center gap-3 border border-slate-300 bg-white p-3">

      {/* Number */}

      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 text-xs font-bold text-slate-600">
        {index + 1}
      </div>

      {/* Thumbnail */}

      <div className="h-16 w-16 shrink-0 overflow-hidden border border-slate-200 bg-slate-50">

        {previewUrl && (
          <img
            src={previewUrl}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* File details */}

      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-semibold text-slate-800">
          {file.name}
        </p>

        <p className="mt-0.5 text-[11px] text-slate-400">
          {formatBytes(file.size)}
        </p>
      </div>

      {/* Reorder */}

      <div className="hidden items-center gap-1 sm:flex">

        <button
          type="button"
          onClick={onUp}
          disabled={index === 0}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
          title="Move up"
        >
          <ArrowUp size={14} />
        </button>

        <button
          type="button"
          onClick={onDown}
          disabled={
            index === total - 1
          }
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
          title="Move down"
        >
          <ArrowDown size={14} />
        </button>
      </div>

      {/* Remove */}

      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        title="Remove"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/* ================================================= */
/* EMPTY STATE */
/* ================================================= */

function EmptyState({
  onSelect,
}) {
  return (
    <label className="flex min-h-[500px] cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-white">

      <div className="flex h-14 w-14 items-center justify-center border border-slate-300 text-slate-500">
        <ImagePlus size={27} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        Add images
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Select one or more JPG or PNG images
      </p>

      <input
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={onSelect}
        className="hidden"
      />
    </label>
  );
}

/* ================================================= */
/* INFO ROW */
/* ================================================= */

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between border border-slate-200 px-3 py-2.5">

      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>

      <span className="text-xs font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}

/* ================================================= */
/* IMAGE VALIDATION */
/* ================================================= */

function isSupportedImage(file) {
  return (
    file?.type === "image/jpeg" ||
    file?.type === "image/png" ||
    file?.name
      ?.toLowerCase()
      .endsWith(".jpg") ||
    file?.name
      ?.toLowerCase()
      .endsWith(".jpeg") ||
    file?.name
      ?.toLowerCase()
      .endsWith(".png")
  );
}

/* ================================================= */
/* FILE SIZE */
/* ================================================= */

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 KB";
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}