import {
  ArrowDown,
  ArrowUp,
  Check,
  FilePlus2,
  FileText,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { PDFDocument } from "pdf-lib";

export default function MergePdfEditor({
  file,
  files,
  onResult,
}) {
  /*
   * --------------------------------------------------
   * INITIAL FILES
   * --------------------------------------------------
   *
   * Supports both:
   *
   * files = [file1, file2, file3]
   *
   * and:
   *
   * file = file1
   */

  const initialFiles = useMemo(() => {
    if (
      Array.isArray(files) &&
      files.length > 0
    ) {
      return files;
    }

    if (file) {
      return [file];
    }

    return [];
  }, [file, files]);

  const [pdfFiles, setPdfFiles] =
    useState(initialFiles);

  const [pdfInfo, setPdfInfo] =
    useState({});

  const [processing, setProcessing] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * --------------------------------------------------
   * SYNC INITIAL FILES
   * --------------------------------------------------
   */

  useEffect(() => {
    setPdfFiles(initialFiles);
    setDone(false);
    setError("");
  }, [initialFiles]);

  /*
   * --------------------------------------------------
   * READ PAGE COUNT FOR EVERY PDF
   * --------------------------------------------------
   */

  useEffect(() => {
    if (pdfFiles.length === 0) {
      setPdfInfo({});
      return;
    }

    let cancelled = false;

    const readPdfInfo = async () => {
      const nextInfo = {};

      for (
        let index = 0;
        index < pdfFiles.length;
        index += 1
      ) {
        const pdfFile =
          pdfFiles[index];

        try {
          /*
           * Fresh ArrayBuffer for this file.
           */
          const buffer =
            await pdfFile.arrayBuffer();

          const pdf =
            await PDFDocument.load(
              new Uint8Array(buffer),
              {
                updateMetadata: false,
              },
            );

          nextInfo[
            getFileKey(pdfFile, index)
          ] = {
            pages: pdf.getPageCount(),
            size: pdfFile.size,
          };
        } catch (err) {
          console.error(
            `Could not read ${pdfFile.name}`,
            err,
          );

          nextInfo[
            getFileKey(pdfFile, index)
          ] = {
            pages: 0,
            size: pdfFile.size,
            error: true,
          };
        }
      }

      if (!cancelled) {
        setPdfInfo(nextInfo);
      }
    };

    readPdfInfo();

    return () => {
      cancelled = true;
    };
  }, [pdfFiles]);

  /*
   * --------------------------------------------------
   * ADD FILES
   * --------------------------------------------------
   */

  const addFiles = (event) => {
    const selectedFiles =
      Array.from(
        event.target.files || [],
      );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    const validFiles =
      selectedFiles.filter(
        (item) =>
          item.type ===
            "application/pdf" ||
          item.name
            .toLowerCase()
            .endsWith(".pdf"),
      );

    if (
      validFiles.length === 0
    ) {
      setError(
        "Please select PDF files only.",
      );

      event.target.value = "";
      return;
    }

    setPdfFiles((current) => [
      ...current,
      ...validFiles,
    ]);

    setError("");
    setDone(false);

    /*
     * Allow selecting the same file again.
     */
    event.target.value = "";
  };

  /*
   * --------------------------------------------------
   * REMOVE
   * --------------------------------------------------
   */

  const removeFile = (index) => {
    setPdfFiles((current) =>
      current.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      ),
    );

    setDone(false);
    setError("");
  };

  /*
   * --------------------------------------------------
   * MOVE UP
   * --------------------------------------------------
   */

  const moveUp = (index) => {
    if (index === 0) return;

    setPdfFiles((current) => {
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

  /*
   * --------------------------------------------------
   * MOVE DOWN
   * --------------------------------------------------
   */

  const moveDown = (index) => {
    if (
      index ===
      pdfFiles.length - 1
    ) {
      return;
    }

    setPdfFiles((current) => {
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

  /*
   * --------------------------------------------------
   * MERGE ALL PDFs
   * --------------------------------------------------
   */

  const mergePdfs = async () => {
    if (pdfFiles.length < 2) {
      setError(
        "Please add at least 2 PDF files.",
      );

      return;
    }

    try {
      setProcessing(true);
      setDone(false);
      setError("");

      /*
       * Create a completely new PDF.
       */
      const mergedPdf =
        await PDFDocument.create();

      /*
       * Process every PDF in the
       * exact order shown in the UI.
       */
      for (
        let index = 0;
        index < pdfFiles.length;
        index += 1
      ) {
        const pdfFile =
          pdfFiles[index];

        /*
         * IMPORTANT:
         *
         * Fresh ArrayBuffer for every PDF.
         *
         * Never reuse a buffer after PDF.js/pdf-lib
         * has received it.
         */
        const buffer =
          await pdfFile.arrayBuffer();

        const sourcePdf =
          await PDFDocument.load(
            new Uint8Array(buffer),
            {
              updateMetadata: false,
            },
          );

        const pageIndexes =
          sourcePdf.getPageIndices();

        const copiedPages =
          await mergedPdf.copyPages(
            sourcePdf,
            pageIndexes,
          );

        copiedPages.forEach(
          (page) => {
            mergedPdf.addPage(page);
          },
        );
      }

      /*
       * Save final merged document.
       */
      const outputBytes =
        await mergedPdf.save({
          useObjectStreams: true,
        });

      const blob = new Blob(
        [outputBytes],
        {
          type: "application/pdf",
        },
      );

      const resultUrl =
        URL.createObjectURL(
          blob,
        );

      setDone(true);

      /*
       * ToolWork.jsx receives:
       *
       * resultUrl
       * extension = pdf
       */
      onResult(
        resultUrl,
        "pdf",
      );
    } catch (err) {
      console.error(
        "Merge PDF error:",
        err,
      );

      setError(
        "Could not merge these PDF files. Please check the files and try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  /*
   * --------------------------------------------------
   * RESET
   * --------------------------------------------------
   */

  const resetEditor = () => {
    setPdfFiles(initialFiles);
    setDone(false);
    setError("");
  };

  /*
   * --------------------------------------------------
   * TOTAL PAGES
   * --------------------------------------------------
   */

  const totalPages =
    pdfFiles.reduce(
      (total, pdfFile, index) => {
        const info =
          pdfInfo[
            getFileKey(
              pdfFile,
              index,
            )
          ];

        return (
          total +
          (info?.pages || 0)
        );
      },
      0,
    );

  /*
   * --------------------------------------------------
   * TOTAL SIZE
   * --------------------------------------------------
   */

  const totalSize =
    pdfFiles.reduce(
      (total, pdfFile) =>
        total + pdfFile.size,
      0,
    );

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1100px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">

        {/* ========================================= */}
        {/* HEADER */}
        {/* ========================================= */}

        <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3">

          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">
              Merge PDF
            </h2>

            <p className="text-xs text-slate-500">
              Combine PDF files into one document
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

        {/* ========================================= */}
        {/* MAIN */}
        {/* ========================================= */}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_310px]">

          {/* ======================================= */}
          {/* LEFT — FILE LIST */}
          {/* ======================================= */}

          <section className="min-h-0 overflow-y-auto bg-slate-100 p-4 sm:p-5">

            {pdfFiles.length === 0 ? (
              <EmptyState
                onSelect={addFiles}
              />
            ) : (
              <div className="mx-auto max-w-[760px]">

                {/* Summary */}

                <div className="mb-4 flex items-center justify-between">

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {pdfFiles.length}{" "}
                      {pdfFiles.length ===
                      1
                        ? "PDF"
                        : "PDFs"}
                    </p>

                    <p className="text-xs text-slate-500">
                      Arrange files in merge order
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                    <Upload size={15} />
                    Add PDFs

                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={addFiles}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* File list */}

                <div className="space-y-2">

                  {pdfFiles.map(
                    (
                      pdfFile,
                      index,
                    ) => {
                      const info =
                        pdfInfo[
                          getFileKey(
                            pdfFile,
                            index,
                          )
                        ];

                      return (
                        <PdfFileRow
                          key={getFileKey(
                            pdfFile,
                            index,
                          )}
                          file={pdfFile}
                          index={
                            index
                          }
                          total={
                            pdfFiles.length
                          }
                          info={info}
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
                            removeFile(
                              index,
                            )
                          }
                        />
                      );
                    },
                  )}
                </div>

                {/* Add more */}

                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-slate-300 bg-white px-4 py-4 text-xs font-semibold text-slate-500 transition hover:bg-slate-50">
                  <Upload size={15} />
                  Add more PDF files

                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={addFiles}
                    className="hidden"
                  />
                </label>

                {/* Error */}

                {error && (
                  <div className="mt-3 border border-slate-300 bg-white px-3 py-3">
                    <p className="text-xs leading-5 text-slate-600">
                      {error}
                    </p>
                  </div>
                )}

                {/* Success */}

                {done && (
                  <div className="mt-3 flex items-center gap-3 border border-slate-300 bg-white px-3 py-3">
                    <Check
                      size={17}
                      className="text-slate-800"
                    />

                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        PDFs merged successfully
                      </p>

                      <p className="text-[11px] text-slate-500">
                        Your merged PDF is ready to download.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ======================================= */}
          {/* RIGHT — INFORMATION */}
          {/* ======================================= */}

          <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">

            {/* Scrollable info */}

            <div className="min-h-0 flex-1 overflow-y-auto">

              {/* Files */}

              <section className="border-b border-slate-300 p-5">

                <h3 className="text-sm font-bold text-slate-900">
                  Files
                </h3>

                <div className="mt-3 space-y-2">

                  <InfoRow
                    label="PDF files"
                    value={
                      pdfFiles.length
                    }
                  />

                  <InfoRow
                    label="Total pages"
                    value={
                      totalPages ||
                      "Reading..."
                    }
                  />

                  <InfoRow
                    label="Total size"
                    value={formatBytes(
                      totalSize,
                    )}
                  />
                </div>
              </section>

              {/* Output */}

              <section className="p-5">

                <h3 className="text-sm font-bold text-slate-900">
                  Output
                </h3>

                <div className="mt-3 space-y-2">

                  <InfoRow
                    label="Format"
                    value="PDF"
                  />

                  <InfoRow
                    label="Order"
                    value="Current list order"
                  />
                </div>

                <p className="mt-3 text-[10px] leading-4 text-slate-400">
                  All pages from each PDF will be copied
                  into one new PDF in the order shown.
                </p>
              </section>
            </div>

            {/* ===================================== */}
            {/* FIXED BUTTON */}
            {/* ===================================== */}

            <div className="shrink-0 border-t border-slate-300 bg-white p-5">

              <button
                type="button"
                onClick={mergePdfs}
                disabled={
                  processing ||
                  pdfFiles.length <
                    2
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Merging...
                  </>
                ) : (
                  <>
                    <FilePlus2
                      size={17}
                    />
                    Merge PDFs
                  </>
                )}
              </button>

              {pdfFiles.length <
                2 && (
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Add at least 2 PDFs.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ================================================= */
/* PDF FILE ROW */
/* ================================================= */

function PdfFileRow({
  file,
  index,
  total,
  info,
  onUp,
  onDown,
  onRemove,
}) {
  return (
    <div className="flex items-center gap-3 border border-slate-300 bg-white p-3">

      {/* Number */}

      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 text-xs font-bold text-slate-600">
        {index + 1}
      </div>

      {/* PDF icon */}

      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
        <FileText size={19} />
      </div>

      {/* File info */}

      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-semibold text-slate-800">
          {file.name}
        </p>

        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">

          <span>
            {formatBytes(
              file.size,
            )}
          </span>

          <span>
            {info?.error
              ? "Invalid PDF"
              : info?.pages
                ? `${info.pages} ${
                    info.pages ===
                    1
                      ? "page"
                      : "pages"
                  }`
                : "Reading..."}
          </span>
        </div>
      </div>

      {/* Order */}

      <div className="hidden items-center gap-1 sm:flex">

        <button
          type="button"
          onClick={onUp}
          disabled={index === 0}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
          title="Move up"
        >
          <ArrowUp size={14} />
        </button>

        <button
          type="button"
          onClick={onDown}
          disabled={
            index ===
            total - 1
          }
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
          title="Move down"
        >
          <ArrowDown size={14} />
        </button>
      </div>

      {/* Remove */}

      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
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
        <FilePlus2 size={26} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        Add PDF files
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Select two or more PDFs to merge
      </p>

      <input
        type="file"
        accept="application/pdf"
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
    <div className="flex items-center justify-between gap-3 border border-slate-200 px-3 py-2.5">

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
/* FILE KEY */
/* ================================================= */

function getFileKey(
  file,
  index,
) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

/* ================================================= */
/* FORMAT SIZE */
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