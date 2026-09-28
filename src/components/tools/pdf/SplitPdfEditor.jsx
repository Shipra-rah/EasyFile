import {
  Check,
  FileDown,
  FileText,
  RefreshCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function SplitPdfEditor({
  file,
  onResult,
}) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [pageCount, setPageCount] = useState(0);

  const [pages, setPages] = useState([]);

  const [selectedPages, setSelectedPages] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==================================================
  // FILE -> BLOB URL
  // ==================================================

  useEffect(() => {
    if (!file) {
      setPdfUrl("");
      setPageCount(0);
      setPages([]);
      setSelectedPages([]);
      return;
    }

    const url = URL.createObjectURL(file);

    setPdfUrl(url);
    setPageCount(0);
    setPages([]);
    setSelectedPages([]);
    setDone(false);
    setError("");

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // ==================================================
  // LOAD PDF PAGES
  // ==================================================

  useEffect(() => {
    if (!pdfUrl) return;

    let cancelled = false;
    let loadingTask = null;

    const loadPages = async () => {
      try {
        setLoading(true);
        setError("");

        /*
         * Use URL instead of reusing an ArrayBuffer.
         * This avoids detached ArrayBuffer problems.
         */
        loadingTask =
          pdfjsLib.getDocument({
            url: pdfUrl,
          });

        const pdf =
          await loadingTask.promise;

        if (cancelled) return;

        setPageCount(pdf.numPages);

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
              "Canvas context unavailable.",
            );
          }

          canvas.width = Math.ceil(
            viewport.width,
          );

          canvas.height = Math.ceil(
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
            canvasContext: context,
            viewport,
          }).promise;

          if (cancelled) return;

          const blob =
            await canvasToJpeg(
              canvas,
              0.85,
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
          "PDF page loading error:",
          err,
        );

        if (!cancelled) {
          setError(
            "Could not load the PDF pages.",
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
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfUrl]);

  // ==================================================
  // SELECT / UNSELECT PAGE
  // ==================================================

  const togglePage = (pageNumber) => {
    setSelectedPages((current) => {
      if (current.includes(pageNumber)) {
        return current.filter(
          (page) =>
            page !== pageNumber,
        );
      }

      return [
        ...current,
        pageNumber,
      ].sort((a, b) => a - b);
    });

    setDone(false);
    setError("");
  };

  // ==================================================
  // SELECT ALL
  // ==================================================

  const selectAll = () => {
    const allPages = Array.from(
      { length: pageCount },
      (_, index) => index + 1,
    );

    setSelectedPages(allPages);
    setDone(false);
    setError("");
  };

  // ==================================================
  // CLEAR SELECTION
  // ==================================================

  const clearSelection = () => {
    setSelectedPages([]);
    setDone(false);
    setError("");
  };

  // ==================================================
  // SELECTED PAGE TEXT
  // ==================================================

  const selectedPageText =
    useMemo(() => {
      if (
        selectedPages.length === 0
      ) {
        return "No pages selected";
      }

      return selectedPages
        .map((page) => page)
        .join(", ");
    }, [selectedPages]);

  // ==================================================
  // CREATE NEW PDF
  // ==================================================

  const splitPdf = async () => {
    if (!file) {
      setError(
        "No PDF selected.",
      );
      return;
    }

    if (
      selectedPages.length === 0
    ) {
      setError(
        "Select at least one page.",
      );
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setDone(false);

      /*
       * Fresh ArrayBuffer.
       * It is used only once in this operation.
       */
      const buffer =
        await file.arrayBuffer();

      const sourcePdf =
        await PDFDocument.load(
          new Uint8Array(buffer),
          {
            updateMetadata: false,
          },
        );

      const outputPdf =
        await PDFDocument.create();

      const pageIndexes =
        selectedPages.map(
          (pageNumber) =>
            pageNumber - 1,
        );

      const copiedPages =
        await outputPdf.copyPages(
          sourcePdf,
          pageIndexes,
        );

      copiedPages.forEach(
        (page) => {
          outputPdf.addPage(page);
        },
      );

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

      const resultUrl =
        URL.createObjectURL(blob);

      setDone(true);

      onResult(
        resultUrl,
        "pdf",
      );
    } catch (err) {
      console.error(
        "Split PDF error:",
        err,
      );

      setError(
        "Could not create the selected PDF.",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==================================================
  // RESET
  // ==================================================

  const resetEditor = () => {
    setSelectedPages([]);
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
                Split PDF
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
            {/* LEFT — PAGE VIEWER */}
            {/* ==================================== */}

            <section className="min-h-0 overflow-y-auto bg-slate-100 p-4 sm:p-6">

              {loading &&
              pages.length === 0 ? (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />

                    <p className="mt-3 text-xs font-medium text-slate-500">
                      Loading PDF pages...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto grid max-w-[850px] grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">

                  {pages.map(
                    (page) => {
                      const selected =
                        selectedPages.includes(
                          page.pageNumber,
                        );

                      return (
                        <button
                          key={
                            page.pageNumber
                          }
                          type="button"
                          onClick={() =>
                            togglePage(
                              page.pageNumber,
                            )
                          }
                          className={`group relative bg-white text-left transition ${
                            selected
                              ? "border-2 border-slate-900"
                              : "border border-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {/* Thumbnail */}

                          <div className="overflow-hidden bg-white">

                            <img
                              src={
                                page.url
                              }
                              alt={`Page ${page.pageNumber}`}
                              className="block h-auto w-full"
                            />
                          </div>

                          {/* Selection mark */}

                          <div
                            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-transparent"
                            }`}
                          >
                            {selected
                              ? "✓"
                              : ""}
                          </div>

                          {/* Page number */}

                          <div className="border-t border-slate-200 bg-white px-3 py-2">
                            <p className="text-xs font-semibold text-slate-600">
                              Page{" "}
                              {
                                page.pageNumber
                              }
                            </p>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              {/* Error */}

              {error && (
                <div className="mx-auto mt-4 max-w-[850px] border border-slate-300 bg-white px-4 py-3">
                  <p className="text-xs font-semibold leading-5 text-slate-600">
                    {error}
                  </p>
                </div>
              )}
            </section>

            {/* ==================================== */}
            {/* RIGHT — SELECTION PANEL */}
            {/* ==================================== */}

            <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">

              {/* Scrollable info */}

              <div className="min-h-0 flex-1 overflow-y-auto">

                {/* Selection */}

                <section className="border-b border-slate-300 p-5">

                  <div className="flex items-center justify-between">

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Select Pages
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Click pages on the left.
                      </p>
                    </div>

                    <FileText
                      size={20}
                      className="text-slate-400"
                    />
                  </div>

                  {/* Selected count */}

                  <div className="mt-5 border border-slate-300 bg-slate-50 px-4 py-4 text-center">

                    <p className="text-2xl font-bold text-slate-900">
                      {
                        selectedPages.length
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      pages selected
                    </p>
                  </div>

                  {/* Quick actions */}

                  <div className="mt-4 grid grid-cols-2 gap-2">

                    <button
                      type="button"
                      onClick={selectAll}
                      className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={
                        clearSelection
                      }
                      disabled={
                        selectedPages.length ===
                        0
                      }
                      className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </section>

                {/* Selected pages */}

                <section className="p-5">

                  <h3 className="text-sm font-bold text-slate-900">
                    Selected Pages
                  </h3>

                  {selectedPages.length ===
                  0 ? (
                    <div className="mt-3 border border-dashed border-slate-300 px-4 py-8 text-center">
                      <p className="text-xs text-slate-400">
                        No pages selected
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex max-h-[220px] flex-wrap gap-2 overflow-y-auto">
                      {selectedPages.map(
                        (pageNumber) => (
                          <button
                            key={
                              pageNumber
                            }
                            type="button"
                            onClick={() =>
                              togglePage(
                                pageNumber,
                              )
                            }
                            className="flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            {pageNumber}

                            <X
                              size={12}
                            />
                          </button>
                        ),
                      )}
                    </div>
                  )}

                  <div className="mt-5 space-y-2">

                    <InfoRow
                      label="Total pages"
                      value={
                        pageCount ||
                        "—"
                      }
                    />

                    <InfoRow
                      label="Selected"
                      value={
                        selectedPages.length
                      }
                    />

                    <InfoRow
                      label="Output"
                      value="PDF"
                    />
                  </div>

                  {selectedPages.length >
                    0 && (
                    <p className="mt-4 break-words text-[10px] leading-4 text-slate-400">
                      Pages:{" "}
                      {selectedPageText}
                    </p>
                  )}

                  {done && (
                    <div className="mt-4 flex items-center gap-3 border border-slate-300 bg-slate-50 p-3">

                      <Check
                        size={17}
                        className="text-slate-800"
                      />

                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          PDF created
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Selected pages are ready to download.
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
                  onClick={splitPdf}
                  disabled={
                    processing ||
                    selectedPages.length ===
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

                <p className="mt-2 text-center text-[10px] text-slate-400">
                  The selected pages will become one new PDF.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================= */
/* CANVAS -> JPEG */
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
                "Could not create page preview.",
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

      <span className="max-w-[160px] truncate text-xs font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}