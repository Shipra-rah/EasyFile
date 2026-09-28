import {
  Check,
  Download,
  FileImage,
  Minus,
  Plus,
  RefreshCcw,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfjsWorker;

const MIN_QUALITY = 0;
const MAX_QUALITY = 100;

export default function PdfToJpgEditor({
  file,
  onResult,
}) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [pageCount, setPageCount] =
    useState(0);

  const [pages, setPages] = useState(
    [],
  );

  const [selectedPage, setSelectedPage] =
    useState(1);

  const [quality, setQuality] =
    useState(85);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const previewUrlRef =
    useRef("");

  const [previewSize, setPreviewSize] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==================================================
  // CREATE PDF URL
  // ==================================================

  useEffect(() => {
    if (!file) {
      setPdfUrl("");
      setPages([]);
      setPageCount(0);
      return;
    }

    const url =
      URL.createObjectURL(file);

    setPdfUrl(url);
    setPages([]);
    setPageCount(0);
    setSelectedPage(1);
    setPreviewUrl("");
    setPreviewSize(0);
    setQuality(85);
    setDone(false);
    setError("");

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // ==================================================
  // LOAD ALL PDF PAGE THUMBNAILS
  // ==================================================

  useEffect(() => {
    if (!pdfUrl) return;

    let cancelled = false;
    let loadingTask = null;

    const loadPages = async () => {
      try {
        setLoading(true);
        setError("");

        loadingTask =
          pdfjsLib.getDocument({
            url: pdfUrl,
          });

        const pdf =
          await loadingTask.promise;

        if (cancelled) return;

        setPageCount(
          pdf.numPages,
        );

        const loadedPages = [];

        for (
          let pageNumber = 1;
          pageNumber <= pdf.numPages;
          pageNumber += 1
        ) {
          if (cancelled) return;

          const page =
            await pdf.getPage(
              pageNumber,
            );

          const viewport =
            page.getViewport({
              scale: 0.45,
            });

          const canvas =
            document.createElement(
              "canvas",
            );

          const context =
            canvas.getContext(
              "2d",
              {
                alpha: false,
              },
            );

          if (!context) {
            throw new Error(
              "Could not create canvas.",
            );
          }

          canvas.width =
            Math.ceil(
              viewport.width,
            );

          canvas.height =
            Math.ceil(
              viewport.height,
            );

          context.fillStyle =
            "#ffffff";

          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          await page.render({
            canvasContext:
              context,
            viewport,
          }).promise;

          if (cancelled) return;

          const blob =
            await canvasToJpeg(
              canvas,
              0.8,
            );

          const thumbnailUrl =
            URL.createObjectURL(
              blob,
            );

          loadedPages.push({
            pageNumber,
            url: thumbnailUrl,
          });

          setPages([
            ...loadedPages,
          ]);
        }
      } catch (err) {
        console.error(
          "PDF thumbnail error:",
          err,
        );

        if (!cancelled) {
          setError(
            "Could not load PDF pages.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPages();

    return () => {
      cancelled = true;

      if (loadingTask) {
        loadingTask
          .destroy()
          .catch(() => {});
      }
    };
  }, [pdfUrl]);

  // ==================================================
  // LIVE SELECTED PAGE PREVIEW
  // ==================================================

  useEffect(() => {
    if (
      !pdfUrl ||
      !pageCount ||
      selectedPage < 1
    ) {
      return;
    }

    let cancelled = false;
    let loadingTask = null;

    const renderSelectedPage =
      async () => {
        try {
          const buffer =
            await file.arrayBuffer();

          const data =
            new Uint8Array(
              buffer,
            );

          loadingTask =
            pdfjsLib.getDocument({
              data,
            });

          const pdf =
            await loadingTask.promise;

          if (cancelled) return;

          const page =
            await pdf.getPage(
              selectedPage,
            );

          const viewport =
            page.getViewport({
              scale: 1.4,
            });

          const canvas =
            document.createElement(
              "canvas",
            );

          const context =
            canvas.getContext(
              "2d",
              {
                alpha: false,
              },
            );

          if (!context) {
            throw new Error(
              "Could not create canvas.",
            );
          }

          canvas.width =
            Math.ceil(
              viewport.width,
            );

          canvas.height =
            Math.ceil(
              viewport.height,
            );

          context.fillStyle =
            "#ffffff";

          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          await page.render({
            canvasContext:
              context,
            viewport,
          }).promise;

          if (cancelled) return;

          const blob =
            await canvasToJpeg(
              canvas,
              quality / 100,
            );

          if (cancelled) return;

          const url =
            URL.createObjectURL(
              blob,
            );

          if (
            previewUrlRef.current
          ) {
            URL.revokeObjectURL(
              previewUrlRef.current,
            );
          }

          previewUrlRef.current = url;

          setPreviewUrl(url);
          setPreviewSize(
            blob.size,
          );
        } catch (err) {
          console.error(
            "JPG preview error:",
            err,
          );
        }
      };

    renderSelectedPage();

    return () => {
      cancelled = true;

      if (loadingTask) {
        loadingTask
          .destroy()
          .catch(() => {});
      }
    };
  }, [
    pdfUrl,
    selectedPage,
    quality,
    pageCount,
    file,
  ]);

  // ==================================================
  // QUALITY
  // ==================================================

  const decreaseQuality = () => {
    setQuality((value) =>
      Math.max(
        MIN_QUALITY,
        value - 5,
      ),
    );

    setDone(false);
  };

  const increaseQuality = () => {
    setQuality((value) =>
      Math.min(
        MAX_QUALITY,
        value + 5,
      ),
    );

    setDone(false);
  };

  const changeQuality = (
    event,
  ) => {
    setQuality(
      Number(event.target.value),
    );

    setDone(false);
  };

  // ==================================================
  // CONVERT SELECTED PAGE
  // ==================================================

  const convertToJpg = async () => {
    if (!file) {
      setError(
        "No PDF selected.",
      );
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setDone(false);

      /*
       * Fresh buffer for this operation.
       * It is never reused after PDF.js receives it.
       */
      const buffer =
        await file.arrayBuffer();

      const data =
        new Uint8Array(buffer);

      const loadingTask =
        pdfjsLib.getDocument({
          data,
        });

      const pdf =
        await loadingTask.promise;

      const page =
        await pdf.getPage(
          selectedPage,
        );

      /*
       * Render page at a fixed,
       * readable resolution.
       */
      const viewport =
        page.getViewport({
          scale: 1.5,
        });

      const canvas =
        document.createElement(
          "canvas",
        );

      const context =
        canvas.getContext(
          "2d",
          {
            alpha: false,
          },
        );

      if (!context) {
        throw new Error(
          "Could not create canvas.",
        );
      }

      canvas.width =
        Math.ceil(
          viewport.width,
        );

      canvas.height =
        Math.ceil(
          viewport.height,
        );

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      await page.render({
        canvasContext:
          context,
        viewport,
      }).promise;

      const blob =
        await canvasToJpeg(
          canvas,
          quality / 100,
        );

      const resultUrl =
        URL.createObjectURL(
          blob,
        );

      setPreviewSize(
        blob.size,
      );

      setDone(true);

      /*
       * ToolWork handles final download.
       */
      onResult(
        resultUrl,
        "jpg",
      );
    } catch (err) {
      console.error(
        "PDF to JPG error:",
        err,
      );

      setError(
        "Could not convert this page to JPG.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==================================================
  // RESET
  // ==================================================

  const resetEditor = () => {
    setSelectedPage(1);
    setQuality(85);
    setDone(false);
    setError("");
  };

  // ==================================================
  // CLEANUP THUMBNAILS
  // ==================================================

  useEffect(() => {
    return () => {
      pages.forEach((page) => {
        if (page.url) {
          URL.revokeObjectURL(
            page.url,
          );
        }
      });

      if (
        previewUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        );

        previewUrlRef.current =
          "";
      }
    };
  }, [pages]);

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
                PDF to JPG
              </h2>

              <p className="max-w-[450px] truncate text-xs text-slate-500">
                {file.name}
              </p>
            </div>

            <button
              type="button"
              onClick={resetEditor}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50"
              title="Reset"
            >
              <RefreshCcw size={16} />
            </button>
          </header>

          {/* ====================================== */}
          {/* CONTENT */}
          {/* ====================================== */}

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">

            {/* ==================================== */}
            {/* LEFT PAGE LIST */}
            {/* ==================================== */}

            <section className="min-h-0 overflow-y-auto bg-slate-100 p-4 sm:p-5">

              {loading &&
              pages.length === 0 ? (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />

                    <p className="mt-3 text-xs text-slate-500">
                      Loading PDF pages...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto grid max-w-[850px] grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">

                  {pages.map(
                    (page) => {
                      const selected =
                        selectedPage ===
                        page.pageNumber;

                      return (
                        <button
                          key={
                            page.pageNumber
                          }
                          type="button"
                          onClick={() => {
                            setSelectedPage(
                              page.pageNumber,
                            );
                            setDone(false);
                            setError("");
                          }}
                          className={`relative overflow-hidden bg-white text-left ${
                            selected
                              ? "border-2 border-slate-900"
                              : "border border-slate-300"
                          }`}
                        >
                          <img
                            src={
                              page.url
                            }
                            alt={`Page ${page.pageNumber}`}
                            className="block h-auto w-full"
                          />

                          <div className="border-t border-slate-200 bg-white px-3 py-2">
                            <span className="text-xs font-semibold text-slate-600">
                              Page{" "}
                              {
                                page.pageNumber
                              }
                            </span>
                          </div>

                          {selected && (
                            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              {error && (
                <div className="mx-auto mt-4 max-w-[850px] border border-slate-300 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-slate-600">
                    {error}
                  </p>
                </div>
              )}
            </section>

            {/* ==================================== */}
            {/* RIGHT PANEL */}
            {/* ==================================== */}

            <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">

              {/* Scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto">

                {/* Selected page */}
                <section className="border-b border-slate-300 p-5">

                  <h3 className="text-sm font-bold text-slate-900">
                    Selected Page
                  </h3>

                  <div className="mt-3 border border-slate-300 bg-slate-50 px-4 py-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {selectedPage}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      of {pageCount} pages
                    </p>
                  </div>
                </section>

                {/* Quality */}
                <section className="border-b border-slate-300 p-5">

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        JPG Quality
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        0–100
                      </p>
                    </div>

                    <span className="text-lg font-bold text-slate-900">
                      {quality}%
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-2">

                    <button
                      type="button"
                      onClick={
                        decreaseQuality
                      }
                      disabled={
                        quality ===
                        MIN_QUALITY
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus size={16} />
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={quality}
                      onChange={
                        changeQuality
                      }
                      className="w-full accent-slate-800"
                      aria-label="JPG quality"
                    />

                    <button
                      type="button"
                      onClick={
                        increaseQuality
                      }
                      disabled={
                        quality ===
                        MAX_QUALITY
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </section>

                {/* Preview */}
                <section className="p-5">

                  <h3 className="text-sm font-bold text-slate-900">
                    JPG Preview
                  </h3>

                  <div className="mt-3 border border-slate-300 bg-slate-100 p-2">

                    <div className="overflow-hidden border border-slate-300 bg-white">
                      {previewUrl ? (
                        <img
                          src={
                            previewUrl
                          }
                          alt="JPG preview"
                          className="block h-auto w-full"
                        />
                      ) : (
                        <div className="flex h-[280px] items-center justify-center">
                          <p className="text-xs text-slate-400">
                            Preview unavailable
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">

                    <InfoRow
                      label="Preview size"
                      value={
                        previewSize
                          ? formatBytes(
                              previewSize,
                            )
                          : "—"
                      }
                    />

                    <InfoRow
                      label="Format"
                      value="JPG"
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
                          JPG created
                        </p>

                        <p className="text-[11px] text-slate-500">
                          Ready to download.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* ================================= */}
              {/* FIXED ACTION */}
              {/* ================================= */}

              <div className="shrink-0 border-t border-slate-300 bg-white p-5">

                <button
                  type="button"
                  onClick={
                    convertToJpg
                  }
                  disabled={
                    processing ||
                    !file ||
                    !pageCount
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FileImage
                        size={17}
                      />
                      Convert to JPG
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
/* CANVAS -> JPG */
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
                "Could not create JPG.",
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