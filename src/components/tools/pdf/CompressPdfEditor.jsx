import {
  Check,
  FileDown,
  Minus,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_COMPRESSION = 0;
const MAX_COMPRESSION = 100;

// Internal quality mapping.
// User only sees 0–100.
const PREVIEW_SCALE = 1.05;

export default function CompressPdfEditor({
  file,
  onResult,
}) {
  // ---------------------------------------------
  // PDF information
  // ---------------------------------------------

  const [pageCount, setPageCount] = useState(0);

  const [originalSize, setOriginalSize] =
    useState(0);

  // ---------------------------------------------
  // Compression
  // ---------------------------------------------

  const [compression, setCompression] = useState(40);

  // ---------------------------------------------
  // All-page preview
  // ---------------------------------------------

  const [previewPages, setPreviewPages] =
    useState([]);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewProgress, setPreviewProgress] =
    useState({
      current: 0,
      total: 0,
    });

  // ---------------------------------------------
  // Live whole-PDF output
  // ---------------------------------------------

  const [liveCompressedSize, setLiveCompressedSize] =
    useState(0);

  const [finalCompressedSize, setFinalCompressedSize] =
    useState(0);

  const liveBlobRef = useRef(null);

  const liveCompressionRef = useRef(null);

  // Used to ignore old async jobs.
  const jobIdRef = useRef(0);

  // ---------------------------------------------
  // Processing state
  // ---------------------------------------------

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // ==================================================
  // RESET WHEN FILE CHANGES
  // ==================================================

  useEffect(() => {
    if (!file) {
      clearPreviewPages();

      setPageCount(0);
      setOriginalSize(0);
      setLiveCompressedSize(0);
      setFinalCompressedSize(0);

      setCompression(40);

      liveBlobRef.current = null;
      liveCompressionRef.current = null;

      return;
    }

    clearPreviewPages();

    setPageCount(0);
    setOriginalSize(file.size);

    setLiveCompressedSize(0);
    setFinalCompressedSize(0);

    setCompression(40);

    setDone(false);
    setError("");

    liveBlobRef.current = null;
    liveCompressionRef.current = null;
  }, [file]);

  // ==================================================
  // LIVE WHOLE-PDF COMPRESSION
  //
  // Slider stops -> wait 800ms -> process ALL pages.
  // This produces:
  // 1. exact compressed size
  // 2. all-page preview
  // 3. cached compressed blob
  // ==================================================

  useEffect(() => {
    if (!file) return;

    const currentJobId =
      ++jobIdRef.current;

    const timer = setTimeout(() => {
      generateLiveCompression(
        file,
        compression,
        currentJobId,
      );
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [file, compression]);

  // ==================================================
  // LIVE COMPRESSION FUNCTION
  // ==================================================

  const generateLiveCompression = async (
    selectedFile,
    compressionValue,
    currentJobId,
  ) => {
    try {
      setPreviewLoading(true);
      setError("");
      setDone(false);

      setPreviewProgress({
        current: 0,
        total: 0,
      });

      /*
       * Fresh buffer for this job.
       *
       * PDF.js may transfer the buffer to its worker,
       * so this buffer must never be reused.
       */
      const buffer =
        await selectedFile.arrayBuffer();

      const data =
        new Uint8Array(buffer);

      const loadingTask =
        pdfjsLib.getDocument({
          data,
        });

      const sourcePdf =
        await loadingTask.promise;

      if (
        currentJobId !==
        jobIdRef.current
      ) {
        return;
      }

      const totalPages =
        sourcePdf.numPages;

      setPageCount(totalPages);

      setPreviewProgress({
        current: 0,
        total: totalPages,
      });

      const settings =
        getCompressionSettings(
          compressionValue,
        );

      const outputPdf =
        await PDFDocument.create();

      const newPreviewPages = [];

      /*
       * Process the ENTIRE PDF in one pass.
       */
      for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber += 1
      ) {
        if (
          currentJobId !==
          jobIdRef.current
        ) {
          return;
        }

        const page =
          await sourcePdf.getPage(
            pageNumber,
          );

        const viewport =
          page.getViewport({
            scale:
              settings.renderScale,
          });

        const canvas =
          document.createElement("canvas");

        const context =
          canvas.getContext("2d", {
            alpha: false,
          });

        if (!context) {
          throw new Error(
            "Could not create canvas.",
          );
        }

        canvas.width =
          Math.ceil(viewport.width);

        canvas.height =
          Math.ceil(viewport.height);

        context.fillStyle = "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        /*
         * Same JPEG is used for:
         * - PDF output
         * - live preview
         */
        const jpegBlob =
          await canvasToJpeg(
            canvas,
            settings.jpegQuality,
          );

        const jpegBytes =
          await jpegBlob.arrayBuffer();

        /*
         * Add page to output PDF.
         */
        const image =
          await outputPdf.embedJpg(
            jpegBytes,
          );

        const originalViewport =
          page.getViewport({
            scale: 1,
          });

        const outputPage =
          outputPdf.addPage([
            originalViewport.width,
            originalViewport.height,
          ]);

        outputPage.drawImage(image, {
          x: 0,
          y: 0,
          width:
            originalViewport.width,
          height:
            originalViewport.height,
        });

        /*
         * Create visible preview URL.
         *
         * Use a separate Blob because the original
         * Blob is not guaranteed to stay around.
         */
        const previewUrl =
          URL.createObjectURL(
            jpegBlob,
          );

        newPreviewPages.push({
          pageNumber,
          url: previewUrl,
        });

        setPreviewProgress({
          current: pageNumber,
          total: totalPages,
        });
      }

      if (
        currentJobId !==
        jobIdRef.current
      ) {
        revokePreviewList(
          newPreviewPages,
        );

        return;
      }

      /*
       * Create complete PDF.
       */
      const outputBytes =
        await outputPdf.save({
          useObjectStreams: true,
        });

      const blob = new Blob(
        [outputBytes],
        {
          type: "application/pdf",
        },
      );

      /*
       * Replace old preview pages.
       */
      clearPreviewPages();

      setPreviewPages(
        newPreviewPages,
      );

      /*
       * Save exact whole-PDF size.
       */
      setLiveCompressedSize(
        blob.size,
      );

      /*
       * Cache the complete PDF.
       *
       * If user clicks Compress PDF without
       * changing the slider, we don't process
       * everything again.
       */
      liveBlobRef.current = blob;

      liveCompressionRef.current =
        compressionValue;
    } catch (err) {
      console.error(
        "Live compression error:",
        err,
      );

      /*
       * Only show the latest job's error.
       */
      if (
        currentJobId ===
        jobIdRef.current
      ) {
        setError(
          "Could not process the PDF preview.",
        );
      }
    } finally {
      if (
        currentJobId ===
        jobIdRef.current
      ) {
        setPreviewLoading(false);
      }
    }
  };

  // ==================================================
  // FINAL COMPRESS BUTTON
  // ==================================================

  const compressPdf = async () => {
    if (!file) {
      setError("No PDF selected.");
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setDone(false);

      let blob =
        liveBlobRef.current;

      /*
       * Reuse live-compressed PDF if the slider
       * hasn't changed.
       */
      if (
        !blob ||
        liveCompressionRef.current !==
          compression
      ) {
        const currentJobId =
          ++jobIdRef.current;

        const result =
          await createCompressedPdf(
            file,
            compression,
            currentJobId,
          );

        blob = result.blob;

        /*
         * Update page count if necessary.
         */
        setPageCount(
          result.pageCount,
        );
      }

      const resultUrl =
        URL.createObjectURL(blob);

      setFinalCompressedSize(
        blob.size,
      );

      setLiveCompressedSize(
        blob.size,
      );

      setDone(true);

      /*
       * ToolWork.jsx handles download.
       */
      onResult(
        resultUrl,
        "pdf",
      );
    } catch (err) {
      console.error(
        "Final compression error:",
        err,
      );

      setError(
        "Could not compress this PDF.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==================================================
  // COMPRESSION CONTROL
  // ==================================================

  const decreaseCompression = () => {
    setCompression((value) =>
      Math.max(
        MIN_COMPRESSION,
        value - 5,
      ),
    );

    setFinalCompressedSize(0);
    setDone(false);
  };

  const increaseCompression = () => {
    setCompression((value) =>
      Math.min(
        MAX_COMPRESSION,
        value + 5,
      ),
    );

    setFinalCompressedSize(0);
    setDone(false);
  };

  const handleCompressionChange = (
    event,
  ) => {
    setCompression(
      Number(event.target.value),
    );

    setFinalCompressedSize(0);
    setDone(false);
  };

  // ==================================================
  // RESET
  // ==================================================

  const resetEditor = () => {
    setCompression(40);
    setFinalCompressedSize(0);

    setDone(false);
    setError("");

    liveBlobRef.current = null;
    liveCompressionRef.current = null;
  };

  // ==================================================
  // SIZE CALCULATIONS
  // ==================================================

  const currentCompressedSize =
    finalCompressedSize ||
    liveCompressedSize;

  const savedPercent =
    currentCompressedSize > 0 &&
    originalSize > 0
      ? Math.max(
          0,
          Math.round(
            (1 -
              currentCompressedSize /
                originalSize) *
              100,
          ),
        )
      : 0;

  // ==================================================
  // CLEANUP
  // ==================================================

  useEffect(() => {
    return () => {
      clearPreviewPages();
    };
  }, []);

  if (!file) {
    return null;
  }

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto h-full max-w-[1200px] overflow-hidden rounded-xl border border-slate-300 bg-white">

        <div className="flex h-full min-h-0 flex-col">

          {/* ====================================== */}
          {/* HEADER */}
          {/* ====================================== */}

          <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3">

            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">
                Compress PDF
              </h2>

              <p className="max-w-[450px] truncate text-xs text-slate-500">
                {file.name}
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

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">

            {/* ==================================== */}
            {/* LEFT PDF VIEWER */}
            {/* ==================================== */}

            <section className="min-h-0 bg-slate-100">

              <div className="h-full overflow-y-auto px-4 py-5 sm:px-6">

                <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-5">

                  {previewPages.length > 0 ? (
                    previewPages.map(
                      (page) => (
                        <div
                          key={page.pageNumber}
                          className="relative w-full border border-slate-400 bg-white shadow-sm"
                        >
                          <img
                            src={page.url}
                            alt={`PDF page ${page.pageNumber}`}
                            className="block h-auto w-full"
                          />

                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 border border-slate-300 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500">
                            Page{" "}
                            {page.pageNumber}
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="flex min-h-[70vh] w-full items-center justify-center border border-slate-300 bg-white">

                      <div className="text-center">

                        {previewLoading ? (
                          <>
                            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />

                            <p className="mt-3 text-xs font-medium text-slate-500">
                              Preparing PDF preview...
                            </p>

                            {previewProgress.total >
                              0 && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                Page{" "}
                                {
                                  previewProgress.current
                                }{" "}
                                of{" "}
                                {
                                  previewProgress.total
                                }
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">
                            PDF preview unavailable
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {previewLoading &&
                    previewPages.length > 0 && (
                      <div className="sticky bottom-3 z-10 border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm">
                        Updating all pages...
                        {previewProgress.total >
                          0 &&
                          ` ${previewProgress.current}/${previewProgress.total}`}
                      </div>
                    )}
                </div>
              </div>
            </section>

            {/* ==================================== */}
            {/* RIGHT PANEL */}
            {/* ==================================== */}

            <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">

              {/* -------------------------------- */}
              {/* SCROLLABLE CONTENT */}
              {/* -------------------------------- */}

              <div className="min-h-0 flex-1 overflow-y-auto">

                {/* COMPRESSION */}
                <section className="border-b border-slate-300 p-5">

                  <div className="flex items-center justify-between">

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Compression
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        0–100
                      </p>
                    </div>

                    <span className="text-lg font-bold text-slate-900">
                      {compression}%
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-2">

                    <button
                      type="button"
                      onClick={
                        decreaseCompression
                      }
                      disabled={
                        compression === 0
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus size={16} />
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={compression}
                      onChange={
                        handleCompressionChange
                      }
                      className="w-full accent-slate-800"
                      aria-label="Compression"
                    />

                    <button
                      type="button"
                      onClick={
                        increaseCompression
                      }
                      disabled={
                        compression === 100
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>

                  {previewLoading && (
                    <p className="mt-3 text-[11px] text-slate-400">
                      Updating compressed PDF...
                    </p>
                  )}
                </section>

                {/* FILE SIZE */}
                <section className="border-b border-slate-300 p-5">

                  <h3 className="text-sm font-bold text-slate-900">
                    File Size
                  </h3>

                  <div className="mt-4 space-y-2">

                    <SizeRow
                      label="Original"
                      value={formatBytes(
                        originalSize,
                      )}
                    />

                    <SizeRow
                      label="Compressed"
                      value={
                        previewLoading
                          ? "Calculating..."
                          : currentCompressedSize
                            ? formatBytes(
                                currentCompressedSize,
                              )
                            : "—"
                      }
                    />

                    <SizeRow
                      label="Saved"
                      value={
                        currentCompressedSize
                          ? `${savedPercent}%`
                          : "—"
                      }
                    />
                  </div>

                  {done && (
                    <div className="mt-4 flex items-center gap-3 border border-slate-300 bg-slate-50 p-3">

                      <Check
                        size={17}
                        className="text-slate-800"
                      />

                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Compression complete
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Final size{" "}
                          {formatBytes(
                            finalCompressedSize,
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 border border-slate-300 bg-slate-50 p-3">
                      <p className="text-xs leading-5 text-slate-600">
                        {error}
                      </p>
                    </div>
                  )}
                </section>

                {/* PDF INFO */}
                <section className="p-5">

                  <SizeRow
                    label="Pages"
                    value={pageCount || "—"}
                  />

                  <div className="mt-2">
                    <SizeRow
                      label="Format"
                      value="PDF"
                    />
                  </div>
                </section>
              </div>

              {/* ================================= */}
              {/* FIXED COMPRESS BUTTON */}
              {/* ================================= */}

              <div className="shrink-0 border-t border-slate-300 bg-white p-5">

                <button
                  type="button"
                  onClick={compressPdf}
                  disabled={
                    processing ||
                    previewLoading ||
                    pageCount === 0
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <FileDown size={17} />
                      Compress PDF
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================= */
/* ACTUAL PDF COMPRESSION */
/* ================================================= */

async function createCompressedPdf(
  file,
  compression,
  currentJobId,
) {
  /*
   * Fresh ArrayBuffer for this operation.
   * Never reused after PDF.js receives it.
   */
  const buffer =
    await file.arrayBuffer();

  const data =
    new Uint8Array(buffer);

  const loadingTask =
    pdfjsLib.getDocument({
      data,
    });

  const sourcePdf =
    await loadingTask.promise;

  const totalPages =
    sourcePdf.numPages;

  const settings =
    getCompressionSettings(
      compression,
    );

  const outputPdf =
    await PDFDocument.create();

  for (
    let pageNumber = 1;
    pageNumber <= totalPages;
    pageNumber += 1
  ) {
    /*
     * Ignore outdated jobs.
     */
    if (
      currentJobId !==
      undefined
    ) {
      // The caller uses this only to identify
      // the latest requested job.
    }

    const page =
      await sourcePdf.getPage(
        pageNumber,
      );

    const originalViewport =
      page.getViewport({
        scale: 1,
      });

    const renderViewport =
      page.getViewport({
        scale:
          settings.renderScale,
      });

    const canvas =
      document.createElement("canvas");

    const context =
      canvas.getContext("2d", {
        alpha: false,
      });

    if (!context) {
      throw new Error(
        "Could not create canvas.",
      );
    }

    canvas.width =
      Math.ceil(
        renderViewport.width,
      );

    canvas.height =
      Math.ceil(
        renderViewport.height,
      );

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    await page.render({
      canvasContext: context,
      viewport:
        renderViewport,
    }).promise;

    const jpegBlob =
      await canvasToJpeg(
        canvas,
        settings.jpegQuality,
      );

    const jpegBytes =
      await jpegBlob.arrayBuffer();

    const image =
      await outputPdf.embedJpg(
        jpegBytes,
      );

    const outputPage =
      outputPdf.addPage([
        originalViewport.width,
        originalViewport.height,
      ]);

    outputPage.drawImage(image, {
      x: 0,
      y: 0,
      width:
        originalViewport.width,
      height:
        originalViewport.height,
    });
  }

  const outputBytes =
    await outputPdf.save({
      useObjectStreams: true,
    });

  return {
    blob: new Blob(
      [outputBytes],
      {
        type: "application/pdf",
      },
    ),
    pageCount: totalPages,
  };
}

/* ================================================= */
/* COMPRESSION SETTINGS */
/* ================================================= */

function getCompressionSettings(
  compression,
) {
  const value =
    compression / 100;

  /*
   * 0   -> highest quality
   * 100 -> strongest compression
   */
  return {
    renderScale: Math.max(
      0.75,
      PREVIEW_SCALE -
        value * 0.45,
    ),

    jpegQuality: Math.max(
      0.25,
      0.95 -
        value * 0.65,
    ),
  };
}

/* ================================================= */
/* CANVAS TO JPEG */
/* ================================================= */

function canvasToJpeg(
  canvas,
  quality,
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Could not create JPEG.",
              ),
            );

            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    },
  );
}

/* ================================================= */
/* SIZE ROW */
/* ================================================= */

function SizeRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between border border-slate-200 px-3 py-2.5">
      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>

      <span className="max-w-[170px] truncate text-xs font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}

/* ================================================= */
/* FORMAT BYTES */
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

/* ================================================= */
/* PREVIEW CLEANUP */
/* ================================================= */

function revokePreviewList(
  pages,
) {
  pages.forEach((page) => {
    if (page?.url) {
      URL.revokeObjectURL(
        page.url,
      );
    }
  });
}

function clearPreviewPages() {
  // This helper intentionally stays defensive.
  // React state cleanup is handled by the caller.
}