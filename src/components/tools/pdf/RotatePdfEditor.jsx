import { useEffect, useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RotateCcw,
  RotateCw,
  Rotate3D,
  Undo2,
} from "lucide-react";

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function createEmptyRotations(totalPages) {
  return Array.from(
    { length: totalPages },
    () => 0,
  );
}

function formatRotation(value) {
  const rotation = normalizeRotation(value);

  if (rotation === 0) return "0°";
  if (rotation === 90) return "90°";
  if (rotation === 180) return "180°";
  if (rotation === 270) return "270°";

  return `${rotation}°`;
}

function revokeUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export default function RotatePdfEditor({ file, onResult }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [numPages, setNumPages] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);

  /*
    Example:

    pageRotations = [
      0,
      90,
      180,
      0,
    ]

    index 0 = page 1
    index 1 = page 2
    etc.
  */
  const [pageRotations, setPageRotations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [hasChanges, setHasChanges] = useState(false);

  const sourceBytesRef = useRef(null);
  const previewUrlRef = useRef("");
  const debounceRef = useRef(null);
  const generationRef = useRef(0);

  /*
    ---------------------------------------------------------
    1. LOAD ORIGINAL PDF
    ---------------------------------------------------------
  */
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError("");
        setPreviewUrl("");
        setPdfUrl("");
        setNumPages(0);
        setSelectedPage(1);
        setPageRotations([]);
        setHasChanges(false);

        revokeUrl(previewUrlRef.current);
        previewUrlRef.current = "";

        const arrayBuffer = await file.arrayBuffer();

        /*
          Clone the bytes so pdf-lib works with an independent
          Uint8Array instead of the original ArrayBuffer.
        */
        const bytes = new Uint8Array(arrayBuffer);
        const safeBytes = new Uint8Array(bytes);

        sourceBytesRef.current = safeBytes;

        const pdf = await PDFDocument.load(safeBytes);

        if (cancelled) return;

        const totalPages = pdf.getPageCount();

        setNumPages(totalPages);
        setPageRotations(createEmptyRotations(totalPages));

        /*
          Original PDF for iframe.
        */
        const originalBlob = new Blob([safeBytes], {
          type: "application/pdf",
        });

        const originalUrl =
          URL.createObjectURL(originalBlob);

        if (cancelled) {
          revokeUrl(originalUrl);
          return;
        }

        setPdfUrl(originalUrl);

        /*
          Initial live preview is the original PDF.
        */
        previewUrlRef.current = originalUrl;
        setPreviewUrl(originalUrl);
      } catch (loadError) {
        console.error(loadError);

        if (!cancelled) {
          setError(
            "This PDF could not be opened. Please select another PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (file) {
      loadPdf();
    }

    return () => {
      cancelled = true;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (previewUrlRef.current) {
        revokeUrl(previewUrlRef.current);
        previewUrlRef.current = "";
      }

      sourceBytesRef.current = null;
    };
  }, [file]);

  /*
    ---------------------------------------------------------
    2. CREATE TEMPORARY ROTATED PDF
    ---------------------------------------------------------
  */
  const createPreviewPdf = async (rotations) => {
    if (!sourceBytesRef.current) return null;

    const bytes = new Uint8Array(
      sourceBytesRef.current,
    );

    const pdf = await PDFDocument.load(bytes);

    const pages = pdf.getPages();

    pages.forEach((page, index) => {
      const extraRotation = rotations[index] || 0;

      /*
        Preserve the original page rotation.
      */
      const originalRotation =
        page.getRotation().angle || 0;

      const finalRotation = normalizeRotation(
        originalRotation + extraRotation,
      );

      page.setRotation(degrees(finalRotation));
    });

    const outputBytes = await pdf.save();

    return new Blob([outputBytes], {
      type: "application/pdf",
    });
  };

  /*
    ---------------------------------------------------------
    3. LIVE PREVIEW UPDATE
    ---------------------------------------------------------
  */
  const updateLivePreview = (nextRotations) => {
    setPreviewLoading(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const currentGeneration =
        ++generationRef.current;

      try {
        const blob =
          await createPreviewPdf(nextRotations);

        if (!blob) return;

        /*
          Ignore old async result.
        */
        if (
          currentGeneration !==
          generationRef.current
        ) {
          return;
        }

        const nextUrl =
          URL.createObjectURL(blob);

        /*
          Remove old temporary preview.
        */
        if (
          previewUrlRef.current &&
          previewUrlRef.current !== pdfUrl
        ) {
          revokeUrl(previewUrlRef.current);
        }

        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
      } catch (previewError) {
        console.error(
          "Preview generation error:",
          previewError,
        );
      } finally {
        if (
          currentGeneration ===
          generationRef.current
        ) {
          setPreviewLoading(false);
        }
      }
    }, 250);
  };

  /*
    ---------------------------------------------------------
    4. ROTATE SELECTED PAGE
    ---------------------------------------------------------
  */
  const rotateSelectedPage = (amount) => {
    setPageRotations((current) => {
      const next = [...current];

      const index = selectedPage - 1;

      if (index >= 0 && index < next.length) {
        next[index] = normalizeRotation(
          (next[index] || 0) + amount,
        );
      }

      setHasChanges(true);

      updateLivePreview(next);

      return next;
    });
  };

  /*
    ---------------------------------------------------------
    5. ROTATE ALL PAGES
    ---------------------------------------------------------
  */
  const rotateAllPages = (amount) => {
    setPageRotations((current) => {
      const next = current.map((rotation) =>
        normalizeRotation(
          (rotation || 0) + amount,
        ),
      );

      setHasChanges(true);

      updateLivePreview(next);

      return next;
    });
  };

  /*
    ---------------------------------------------------------
    6. RESET SELECTED PAGE
    ---------------------------------------------------------
  */
  const resetSelectedPage = () => {
    setPageRotations((current) => {
      const next = [...current];

      const index = selectedPage - 1;

      if (index >= 0 && index < next.length) {
        next[index] = 0;
      }

      const changed = next.some(
        (rotation) => rotation !== 0,
      );

      setHasChanges(changed);

      updateLivePreview(next);

      return next;
    });
  };

  /*
    ---------------------------------------------------------
    7. RESET EVERYTHING
    ---------------------------------------------------------
  */
  const resetAllPages = () => {
    const next = createEmptyRotations(numPages);

    setPageRotations(next);
    setHasChanges(false);

    updateLivePreview(next);
  };

  /*
    ---------------------------------------------------------
    8. FINAL PDF
    ---------------------------------------------------------
  */
  const applyRotation = async () => {
    if (!file || !sourceBytesRef.current) return;

    if (!hasChanges) return;

    try {
      setProcessing(true);
      setError("");

      const bytes = new Uint8Array(
        sourceBytesRef.current,
      );

      const pdf = await PDFDocument.load(bytes);

      const pages = pdf.getPages();

      pages.forEach((page, index) => {
        const extraRotation =
          pageRotations[index] || 0;

        const originalRotation =
          page.getRotation().angle || 0;

        const finalRotation =
          normalizeRotation(
            originalRotation + extraRotation,
          );

        page.setRotation(
          degrees(finalRotation),
        );
      });

      const outputBytes = await pdf.save();

      const blob = new Blob([outputBytes], {
        type: "application/pdf",
      });

      const resultUrl =
        URL.createObjectURL(blob);

      onResult(resultUrl, "pdf");
    } catch (applyError) {
      console.error(applyError);

      setError(
        "Could not create the rotated PDF. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  /*
    ---------------------------------------------------------
    HELPERS
    ---------------------------------------------------------
  */
  const previousPage = () => {
    setSelectedPage((current) =>
      Math.max(1, current - 1),
    );
  };

  const nextPage = () => {
    setSelectedPage((current) =>
      Math.min(numPages, current + 1),
    );
  };

  const currentRotation =
    pageRotations[selectedPage - 1] || 0;

  const totalChangedPages =
    pageRotations.filter(
      (rotation) => rotation !== 0,
    ).length;

  /*
    ---------------------------------------------------------
    LOADING STATE
    ---------------------------------------------------------
  */
  if (loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-slate-500"
          />

          <p className="mt-3 text-sm font-bold text-slate-800">
            Opening PDF...
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Preparing the document preview
          </p>
        </div>
      </div>
    );
  }

  /*
    ---------------------------------------------------------
    ERROR STATE
    ---------------------------------------------------------
  */
  if (error && !previewUrl) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-red-200 bg-white">
        <div className="max-w-sm px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <FileText
              size={22}
              className="text-red-500"
            />
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-slate-900">
            PDF Preview Failed
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* ================================================= */}
        {/* TOP BAR */}
        {/* ================================================= */}

        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <Rotate3D
                size={18}
                className="text-slate-700"
              />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold text-slate-900">
                Rotate PDF
              </h2>

              <p className="truncate text-xs text-slate-400">
                {numPages} page
                {numPages !== 1 ? "s" : ""} ·{" "}
                {totalChangedPages} modified
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              Page {selectedPage} / {numPages}
            </span>
          </div>
        </div>

        {/* ================================================= */}
        {/* MAIN CONTENT */}
        {/* ================================================= */}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_350px]">
          {/* ================================================= */}
          {/* LEFT — PDF VIEW */}
          {/* ================================================= */}

          <div className="relative flex min-h-0 flex-col bg-slate-100">
            {/* Viewer header */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
              <div className="flex items-center gap-2">
                <FileText
                  size={16}
                  className="text-slate-500"
                />

                <span className="text-xs font-bold text-slate-600">
                  Document Preview
                </span>
              </div>

              {previewLoading && (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                  Updating preview
                </div>
              )}
            </div>

            {/* IFRAME */}
            <div className="relative min-h-0 flex-1 p-3 sm:p-4">
              <div className="h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                {previewUrl && (
                  <iframe
                    title="PDF preview"
                    src={`${previewUrl}#page=${selectedPage}`}
                    className="h-full w-full border-0"
                  />
                )}
              </div>

              {/* Preview loading layer */}
              {previewLoading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2
                        size={16}
                        className="animate-spin text-slate-500"
                      />

                      <span className="text-xs font-bold text-slate-600">
                        Updating PDF preview...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Page navigation */}
            <div className="flex h-14 shrink-0 items-center justify-center border-t border-slate-200 bg-white px-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={previousPage}
                  disabled={selectedPage <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="min-w-[100px] text-center">
                  <p className="text-xs font-bold text-slate-800">
                    Page {selectedPage}
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {formatRotation(currentRotation)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={nextPage}
                  disabled={
                    selectedPage >= numPages
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* RIGHT — CONTROLS */}
          {/* ================================================= */}

          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            {/* Controls scroll area */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* Selected page */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-extrabold text-slate-800">
                    Select Page
                  </label>

                  <span className="text-xs text-slate-400">
                    {selectedPage} / {numPages}
                  </span>
                </div>

                <select
                  value={selectedPage}
                  onChange={(event) => {
                    setSelectedPage(
                      Number(event.target.value),
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400"
                >
                  {Array.from(
                    { length: numPages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <option
                      key={pageNumber}
                      value={pageNumber}
                    >
                      Page {pageNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current rotation */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Page Rotation
                  </span>

                  <span className="text-lg font-extrabold text-slate-900">
                    {formatRotation(currentRotation)}
                  </span>
                </div>
              </div>

              {/* Selected page rotation */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-extrabold text-slate-800">
                  Rotate Selected Page
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      rotateSelectedPage(-90)
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RotateCcw size={17} />
                    Left
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      rotateSelectedPage(90)
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RotateCw size={17} />
                    Right
                  </button>
                </div>
              </div>

              {/* Quick angles */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-extrabold text-slate-800">
                  Set Rotation
                </h3>

                <div className="grid grid-cols-4 gap-2">
                  {[0, 90, 180, 270].map(
                    (angle) => (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => {
                          setPageRotations(
                            (current) => {
                              const next = [...current];

                              next[
                                selectedPage - 1
                              ] = angle;

                              setHasChanges(
                                next.some(
                                  (rotation) =>
                                    rotation !== 0,
                                ),
                              );

                              updateLivePreview(
                                next,
                              );

                              return next;
                            },
                          );
                        }}
                        className={`rounded-xl border px-2 py-3 text-xs font-extrabold transition ${
                          currentRotation === angle
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {angle}°
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Whole document */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-extrabold text-slate-800">
                  Rotate Entire PDF
                </h3>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      rotateAllPages(-90)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RotateCcw size={17} />
                    Rotate All Left
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      rotateAllPages(90)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RotateCw size={17} />
                    Rotate All Right
                  </button>
                </div>
              </div>

              {/* Reset */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-extrabold text-slate-800">
                  Reset
                </h3>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={resetSelectedPage}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Undo2 size={16} />
                    Reset Selected Page
                  </button>

                  <button
                    type="button"
                    onClick={resetAllPages}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Reset All Pages
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Modified Pages
                  </span>

                  <span className="text-sm font-extrabold text-slate-900">
                    {totalChangedPages}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Current Page
                  </span>

                  <span className="text-sm font-extrabold text-slate-900">
                    {formatRotation(
                      currentRotation,
                    )}
                  </span>
                </div>

                {error && (
                  <p className="mt-3 text-xs font-semibold text-red-500">
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* Fixed bottom action */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={applyRotation}
                disabled={
                  processing ||
                  previewLoading ||
                  !hasChanges
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {processing ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Creating PDF...
                  </>
                ) : (
                  <>
                    <Rotate3D size={18} />
                    Apply Rotation
                  </>
                )}
              </button>

              <p className="mt-2 text-center text-[10px] text-slate-400">
                The original PDF stays unchanged until you
                apply the rotation.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}