import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Minus,
  Plus,
  RefreshCcw,
  Scissors,
} from "lucide-react";

import "react-easy-crop/react-easy-crop.css";

/*
  PDF.js worker for Vite.
  This file does not use React-PDF.
*/
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const ASPECT_OPTIONS = [
  {
    label: "Free",
    value: null,
  },
  {
    label: "1:1",
    value: 1,
  },
  {
    label: "4:5",
    value: 4 / 5,
  },
  {
    label: "16:9",
    value: 16 / 9,
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

/*
  Render a PDF page as a PNG data URL.

  This is only used for the crop editor preview.
*/
async function renderPdfPageToImage(page, maxDimension = 1800) {
  const baseViewport = page.getViewport({
    scale: 1,
  });

  const largestSide = Math.max(
    baseViewport.width,
    baseViewport.height,
  );

  const scale = Math.max(
    0.8,
    Math.min(
      2,
      maxDimension / largestSide,
    ),
  );

  const viewport = page.getViewport({
    scale,
  });

  const canvas = document.createElement("canvas");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    throw new Error("Could not create canvas context.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const renderTask = page.render({
    canvasContext: context,
    viewport,
  });

  await renderTask.promise;

  const dataUrl = canvas.toDataURL(
    "image/png",
    1,
  );

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    pageWidth: baseViewport.width,
    pageHeight: baseViewport.height,
  };
}

/*
  Render small page thumbnails.
*/
async function renderThumbnail(page, width = 90) {
  const viewport = page.getViewport({
    scale: 1,
  });

  const scale = width / viewport.width;

  const thumbnailViewport =
    page.getViewport({
      scale,
    });

  const canvas = document.createElement("canvas");

  canvas.width = Math.ceil(
    thumbnailViewport.width,
  );

  canvas.height = Math.ceil(
    thumbnailViewport.height,
  );

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    throw new Error(
      "Could not create thumbnail canvas.",
    );
  }

  context.fillStyle = "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const renderTask = page.render({
    canvasContext: context,
    viewport: thumbnailViewport,
  });

  await renderTask.promise;

  return canvas.toDataURL(
    "image/jpeg",
    0.82,
  );
}

/*
  Convert the react-easy-crop rectangle into
  PDF CropBox coordinates.

  croppedAreaPixels:
  {
    x,
    y,
    width,
    height
  }

  x/y start from the TOP-LEFT of the rendered page.

  PDF coordinates start from the BOTTOM-LEFT.
*/
function getPdfCropBox(
  croppedAreaPixels,
  imageWidth,
  imageHeight,
  baseCropBox,
  pageRotation,
) {
  const normalizedLeft =
    clamp(
      croppedAreaPixels.x / imageWidth,
      0,
      1,
    );

  const normalizedTop =
    clamp(
      croppedAreaPixels.y / imageHeight,
      0,
      1,
    );

  const normalizedRight =
    clamp(
      (croppedAreaPixels.x +
        croppedAreaPixels.width) /
        imageWidth,
      0,
      1,
    );

  const normalizedBottom =
    clamp(
      (croppedAreaPixels.y +
        croppedAreaPixels.height) /
        imageHeight,
      0,
      1,
    );

  /*
    These coordinates describe the rectangle
    in the VISUAL rotated page.

    We transform the four corners back into
    the original PDF page coordinate orientation.
  */
  const corners = [
    {
      x: normalizedLeft,
      y: normalizedTop,
    },
    {
      x: normalizedRight,
      y: normalizedTop,
    },
    {
      x: normalizedRight,
      y: normalizedBottom,
    },
    {
      x: normalizedLeft,
      y: normalizedBottom,
    },
  ];

  const normalizedRotation =
    ((pageRotation % 360) + 360) % 360;

  const transformed = corners.map(
    (point) => {
      let x;
      let y;

      if (normalizedRotation === 0) {
        x = point.x;
        y = point.y;
      } else if (
        normalizedRotation === 90
      ) {
        /*
          Visual clockwise 90° rotation.
        */
        x = point.y;
        y = 1 - point.x;
      } else if (
        normalizedRotation === 180
      ) {
        x = 1 - point.x;
        y = 1 - point.y;
      } else {
        /*
          270°
        */
        x = 1 - point.y;
        y = point.x;
      }

      return {
        x,
        y,
      };
    },
  );

  const minX = Math.min(
    ...transformed.map(
      (point) => point.x,
    ),
  );

  const maxX = Math.max(
    ...transformed.map(
      (point) => point.x,
    ),
  );

  const minY = Math.min(
    ...transformed.map(
      (point) => point.y,
    ),
  );

  const maxY = Math.max(
    ...transformed.map(
      (point) => point.y,
    ),
  );

  const boxX =
    baseCropBox.x +
    minX * baseCropBox.width;

  const boxY =
    baseCropBox.y +
    (1 - maxY) *
      baseCropBox.height;

  const boxWidth =
    (maxX - minX) *
    baseCropBox.width;

  const boxHeight =
    (maxY - minY) *
    baseCropBox.height;

  return {
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
  };
}

export default function CropPdfEditor({
  file,
  onResult,
}) {
  /*
    ------------------------------------------------------
    PDF STATE
    ------------------------------------------------------
  */

  const [pdfUrl, setPdfUrl] = useState("");

  const [numPages, setNumPages] =
    useState(0);

  const [selectedPage, setSelectedPage] =
    useState(1);

  const [thumbnails, setThumbnails] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingThumbnails, setLoadingThumbnails] =
    useState(false);

  const [pageImageUrl, setPageImageUrl] =
    useState("");

  const [pageImageSize, setPageImageSize] =
    useState({
      width: 0,
      height: 0,
    });

  const [pageRotation, setPageRotation] =
    useState(0);

  /*
    ------------------------------------------------------
    CROP EDITOR STATE
    ------------------------------------------------------
  */

  const [crop, setCrop] =
    useState({
      x: 0,
      y: 0,
    });

  const [zoom, setZoom] =
    useState(1);

  const [aspect, setAspect] =
    useState(null);

  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState(null);

  const [processing, setProcessing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [step, setStep] =
    useState("select");

  /*
    ------------------------------------------------------
    REFS
    ------------------------------------------------------
  */

  const pdfDocumentRef = useRef(null);

  const loadingTaskRef = useRef(null);

  const renderTaskRef = useRef(null);

  const pdfBytesRef = useRef(null);

  const sourceUrlRef = useRef("");

  const pageImageUrlRef = useRef("");

  const renderGenerationRef = useRef(0);

  /*
    ------------------------------------------------------
    LOAD PDF
    ------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError("");

        setStep("select");

        setSelectedPage(1);
        setNumPages(0);

        setThumbnails([]);

        setPageImageUrl("");

        pdfDocumentRef.current = null;

        /*
          Clean old URLs.
        */
        revokeObjectUrl(
          pageImageUrlRef.current,
        );

        pageImageUrlRef.current = "";

        revokeObjectUrl(
          sourceUrlRef.current,
        );

        sourceUrlRef.current = "";

        /*
          Cancel any previous task.
        */
        if (
          renderTaskRef.current
        ) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancellation errors.
          }

          renderTaskRef.current =
            null;
        }

        if (
          loadingTaskRef.current
        ) {
          try {
            await loadingTaskRef.current.destroy();
          } catch {
            // Ignore old loading task errors.
          }

          loadingTaskRef.current =
            null;
        }

        /*
          Load bytes once.
        */
        const arrayBuffer =
          await file.arrayBuffer();

        const originalBytes =
          new Uint8Array(
            arrayBuffer,
          );

        /*
          Keep our own independent copy.
        */
        const safeBytes =
          new Uint8Array(
            originalBytes,
          );

        pdfBytesRef.current =
          safeBytes;

        /*
          PDF.js reads from a Blob URL.
          This avoids passing the ArrayBuffer
          into the PDF.js worker directly.
        */
        const sourceBlob =
          new Blob(
            [safeBytes],
            {
              type: "application/pdf",
            },
          );

        const sourceUrl =
          URL.createObjectURL(
            sourceBlob,
          );

        if (cancelled) {
          revokeObjectUrl(
            sourceUrl,
          );
          return;
        }

        sourceUrlRef.current =
          sourceUrl;

        setPdfUrl(sourceUrl);

        const loadingTask =
          pdfjsLib.getDocument({
            url: sourceUrl,
          });

        loadingTaskRef.current =
          loadingTask;

        const pdf =
          await loadingTask.promise;

        if (cancelled) {
          try {
            await pdf.destroy();
          } catch {
            // Ignore.
          }

          return;
        }

        pdfDocumentRef.current =
          pdf;

        setNumPages(
          pdf.numPages,
        );

        /*
          Generate thumbnails sequentially.
          This is much safer than rendering all pages
          at the same time.
        */
        setLoadingThumbnails(true);

        const generatedThumbnails =
          [];

        for (
          let pageNumber = 1;
          pageNumber <= pdf.numPages;
          pageNumber += 1
        ) {
          if (cancelled) {
            break;
          }

          try {
            const page =
              await pdf.getPage(
                pageNumber,
              );

            const image =
              await renderThumbnail(
                page,
                86,
              );

            generatedThumbnails.push({
              pageNumber,
              image,
            });

            setThumbnails(
              [...generatedThumbnails],
            );

            page.cleanup();
          } catch (thumbnailError) {
            console.error(
              `Thumbnail ${pageNumber} error:`,
              thumbnailError,
            );

            generatedThumbnails.push({
              pageNumber,
              image: "",
            });

            setThumbnails(
              [...generatedThumbnails],
            );
          }
        }

        if (!cancelled) {
          setLoadingThumbnails(
            false,
          );
        }
      } catch (loadError) {
        console.error(
          "Crop PDF load error:",
          loadError,
        );

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

      renderGenerationRef.current +=
        1;

      if (
        renderTaskRef.current
      ) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore.
        }

        renderTaskRef.current =
          null;
      }

      if (
        loadingTaskRef.current
      ) {
        try {
          loadingTaskRef.current.destroy();
        } catch {
          // Ignore.
        }

        loadingTaskRef.current =
          null;
      }

      if (
        pdfDocumentRef.current
      ) {
        try {
          pdfDocumentRef.current.destroy();
        } catch {
          // Ignore.
        }

        pdfDocumentRef.current =
          null;
      }

      revokeObjectUrl(
        pageImageUrlRef.current,
      );

      pageImageUrlRef.current = "";

      revokeObjectUrl(
        sourceUrlRef.current,
      );

      sourceUrlRef.current = "";

      pdfBytesRef.current =
        null;
    };
  }, [file]);

  /*
    ------------------------------------------------------
    RESET CROP WHEN PAGE CHANGES
    ------------------------------------------------------
  */

  const resetCropState = () => {
    setCrop({
      x: 0,
      y: 0,
    });

    setZoom(1);

    setAspect(null);

    setCroppedAreaPixels(
      null,
    );
  };

  /*
    ------------------------------------------------------
    RENDER SELECTED PAGE
    ------------------------------------------------------
  */

  useEffect(() => {
    if (
      step !== "crop" ||
      !pdfDocumentRef.current
    ) {
      return;
    }

    let cancelled = false;

    async function renderSelectedPage() {
      const generation =
        ++renderGenerationRef.current;

      try {
        setError("");

        /*
          Cancel old rendering task.
        */
        if (
          renderTaskRef.current
        ) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore.
          }

          renderTaskRef.current =
            null;
        }

        revokeObjectUrl(
          pageImageUrlRef.current,
        );

        pageImageUrlRef.current =
          "";

        setPageImageUrl("");

        resetCropState();

        const pdf =
          pdfDocumentRef.current;

        const page =
          await pdf.getPage(
            selectedPage,
          );

        if (
          cancelled ||
          generation !==
            renderGenerationRef.current
        ) {
          page.cleanup();
          return;
        }

        setPageRotation(
          page.rotate || 0,
        );

        /*
          Render to a canvas at a controlled resolution.
        */
        const baseViewport =
          page.getViewport({
            scale: 1,
          });

        const largestSide =
          Math.max(
            baseViewport.width,
            baseViewport.height,
          );

        const scale =
          Math.max(
            0.8,
            Math.min(
              2,
              1800 / largestSide,
            ),
          );

        const viewport =
          page.getViewport({
            scale,
          });

        const canvas =
          document.createElement(
            "canvas",
          );

        canvas.width =
          Math.ceil(
            viewport.width,
          );

        canvas.height =
          Math.ceil(
            viewport.height,
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

        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const renderTask =
          page.render({
            canvasContext:
              context,
            viewport,
          });

        renderTaskRef.current =
          renderTask;

        await renderTask.promise;

        if (
          cancelled ||
          generation !==
            renderGenerationRef.current
        ) {
          page.cleanup();
          return;
        }

        const blob =
          await new Promise(
            (
              resolve,
              reject,
            ) => {
              canvas.toBlob(
                (result) => {
                  if (!result) {
                    reject(
                      new Error(
                        "Could not create page image.",
                      ),
                    );
                    return;
                  }

                  resolve(result);
                },
                "image/png",
              );
            },
          );

        const imageUrl =
          URL.createObjectURL(
            blob,
          );

        if (
          cancelled ||
          generation !==
            renderGenerationRef.current
        ) {
          revokeObjectUrl(
            imageUrl,
          );

          page.cleanup();
          return;
        }

        pageImageUrlRef.current =
          imageUrl;

        setPageImageUrl(
          imageUrl,
        );

        setPageImageSize({
          width: canvas.width,
          height: canvas.height,
        });

        page.cleanup();
      } catch (renderError) {
        /*
          PDF.js throws a special error when
          a previous rendering task gets cancelled.
        */
        if (
          renderError?.name ===
            "RenderingCancelledException" ||
          renderError?.message?.toLowerCase().includes(
            "cancel",
          )
        ) {
          return;
        }

        console.error(
          "Selected page render error:",
          renderError,
        );

        if (!cancelled) {
          setError(
            "Could not render this PDF page.",
          );
        }
      } finally {
        if (
          !cancelled &&
          generation ===
            renderGenerationRef.current
        ) {
          renderTaskRef.current =
            null;
        }
      }
    }

    renderSelectedPage();

    return () => {
      cancelled = true;

      renderGenerationRef.current +=
        1;

      if (
        renderTaskRef.current
      ) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore.
        }

        renderTaskRef.current =
          null;
      }
    };
  }, [selectedPage, step]);

  /*
    ------------------------------------------------------
    PAGE SELECT
    ------------------------------------------------------
  */

  function choosePage(pageNumber) {
    setSelectedPage(
      pageNumber,
    );

    setStep("crop");
    setError("");
  }

  /*
    ------------------------------------------------------
    CROP COMPLETE
    ------------------------------------------------------
  */

  function handleCropComplete(
    _,
    croppedPixels,
  ) {
    setCroppedAreaPixels(
      croppedPixels,
    );
  }

  /*
    ------------------------------------------------------
    ZOOM
    ------------------------------------------------------
  */

  function decreaseZoom() {
    setZoom((value) =>
      Math.max(
        1,
        Number(
          (value - 0.1).toFixed(1),
        ),
      ),
    );
  }

  function increaseZoom() {
    setZoom((value) =>
      Math.min(
        3,
        Number(
          (value + 0.1).toFixed(1),
        ),
      ),
    );
  }

  /*
    ------------------------------------------------------
    RESET
    ------------------------------------------------------
  */

  function resetEditor() {
    resetCropState();
    setError("");
  }

  /*
    ------------------------------------------------------
    APPLY FINAL CROP
    ------------------------------------------------------
  */

  async function handleApply() {
    if (
      !pdfBytesRef.current ||
      !croppedAreaPixels ||
      !pageImageSize.width ||
      !pageImageSize.height
    ) {
      return;
    }

    try {
      setProcessing(true);
      setError("");

      /*
        Independent copy.
      */
      const sourceBytes =
        new Uint8Array(
          pdfBytesRef.current,
        );

      const pdf =
        await PDFDocument.load(
          sourceBytes,
        );

      const pages =
        pdf.getPages();

      const page =
        pages[selectedPage - 1];

      if (!page) {
        throw new Error(
          "Selected PDF page was not found.",
        );
      }

      /*
        Existing CropBox.
        This allows cropping an already-cropped page.
      */
      const existingCropBox =
        typeof page.getCropBox ===
        "function"
          ? page.getCropBox()
          : {
              x: 0,
              y: 0,
              width: page.getWidth(),
              height: page.getHeight(),
            };

      const newCropBox =
        getPdfCropBox(
          croppedAreaPixels,
          pageImageSize.width,
          pageImageSize.height,
          existingCropBox,
          pageRotation,
        );

      /*
        Safety protection.
      */
      const safeWidth =
        Math.max(
          1,
          newCropBox.width,
        );

      const safeHeight =
        Math.max(
          1,
          newCropBox.height,
        );

      page.setCropBox(
        newCropBox.x,
        newCropBox.y,
        safeWidth,
        safeHeight,
      );

      const outputBytes =
        await pdf.save();

      const outputBlob =
        new Blob(
          [outputBytes],
          {
            type: "application/pdf",
          },
        );

      const resultUrl =
        URL.createObjectURL(
          outputBlob,
        );

      onResult(
        resultUrl,
        "pdf",
      );
    } catch (applyError) {
      console.error(
        "Crop PDF error:",
        applyError,
      );

      setError(
        "Could not create the cropped PDF. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  }

  /*
    ------------------------------------------------------
    BACK TO PAGE SELECTION
    ------------------------------------------------------
  */

  function backToPages() {
    setStep("select");
    setError("");
  }

  /*
    ------------------------------------------------------
    PAGE NAVIGATION
    ------------------------------------------------------
  */

  function previousPage() {
    setSelectedPage((current) =>
      Math.max(
        1,
        current - 1,
      ),
    );
  }

  function nextPage() {
    setSelectedPage((current) =>
      Math.min(
        numPages,
        current + 1,
      ),
    );
  }

  /*
    ------------------------------------------------------
    CROP DIMENSIONS
    ------------------------------------------------------
  */

  const cropWidth =
    croppedAreaPixels?.width || 0;

  const cropHeight =
    croppedAreaPixels?.height || 0;

  /*
    ------------------------------------------------------
    LOADING SCREEN
    ------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2
            size={30}
            className="mx-auto animate-spin text-slate-500"
          />

          <p className="mt-3 text-sm font-extrabold text-slate-800">
            Opening PDF...
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Preparing your pages
          </p>
        </div>
      </div>
    );
  }

  /*
    ======================================================
    PAGE SELECTION SCREEN
    ======================================================
  */

  if (step === "select") {
    return (
      <div className="h-full min-h-0">
        <div className="mx-auto flex h-full min-h-0 max-w-[1350px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Scissors
                  size={19}
                  className="text-slate-700"
                />
              </div>

              <div>
                <h1 className="text-base font-extrabold text-slate-900">
                  Crop PDF
                </h1>

                <p className="text-xs text-slate-400">
                  Step 1 · Select the page
                  you want to crop
                </p>
              </div>
            </div>

            <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 sm:block">
              {numPages} page
              {numPages !== 1
                ? "s"
                : ""}
            </div>
          </div>

          {/* Page selection */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <div className="mx-auto max-w-[1100px]">
              <div className="mb-6">
                <h2 className="text-xl font-extrabold text-slate-900">
                  Select a page to crop
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Click any page below to open the image-style crop editor.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold text-red-600">
                    {error}
                  </p>
                </div>
              )}

              {loadingThumbnails &&
                thumbnails.length === 0 && (
                  <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                    <div className="text-center">
                      <Loader2
                        size={26}
                        className="mx-auto animate-spin text-slate-500"
                      />

                      <p className="mt-3 text-sm font-bold text-slate-700">
                        Creating page previews...
                      </p>
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {thumbnails.map(
                  ({
                    pageNumber,
                    image,
                  }) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() =>
                        choosePage(
                          pageNumber,
                        )
                      }
                      className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:shadow-md"
                    >
                      <div className="flex h-[230px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {image ? (
                          <img
                            src={image}
                            alt={`Page ${pageNumber}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <FileText
                            size={34}
                            className="text-slate-300"
                          />
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-800">
                          Page{" "}
                          {pageNumber}
                        </span>

                        <span className="text-xs font-bold text-slate-400 group-hover:text-slate-700">
                          Crop →
                        </span>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
    ======================================================
    CROP EDITOR SCREEN
    ======================================================
  */

  return (
    <div className="h-full min-h-0">
      <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* ================================================= */}
        {/* TOP BAR */}
        {/* ================================================= */}

        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={backToPages}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="Back to pages"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Step 2 · Crop Page
              </p>

              <h1 className="truncate text-sm font-extrabold text-slate-900">
                Page {selectedPage}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              {selectedPage} /{" "}
              {numPages}
            </span>

            <button
              type="button"
              onClick={resetEditor}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              title="Reset crop"
            >
              <RefreshCcw
                size={16}
              />
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* MAIN */}
        {/* ================================================= */}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_350px]">
          {/* ================================================= */}
          {/* LEFT — IMAGE CROP */}
          {/* ================================================= */}

          <div className="relative flex min-h-0 flex-col bg-[#191919]">
            {/* Editor header */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#191919] px-4">
              <div className="flex items-center gap-2 text-white">
                <Scissors size={15} />

                <span className="text-xs font-bold">
                  Crop Preview
                </span>
              </div>

              <span className="text-[10px] font-semibold text-white/50">
                Drag corners or move the image
              </span>
            </div>

            {/* Cropper */}
            <div className="relative min-h-0 flex-1">
              {pageImageUrl ? (
                <Cropper
                  image={pageImageUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect || undefined}
                  cropShape="rect"
                  showGrid
                  restrictPosition
                  objectFit="contain"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={
                    handleCropComplete
                  }
                  classes={{
                    containerClassName:
                      "bg-[#191919]",
                    mediaClassName:
                      "select-none",
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2
                      size={28}
                      className="mx-auto animate-spin text-white/60"
                    />

                    <p className="mt-3 text-sm font-bold">
                      Rendering page...
                    </p>
                  </div>
                </div>
              )}

              {/* Page number badge */}
              <div className="pointer-events-none absolute left-4 top-4 z-20">
                <div className="rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white">
                  Page{" "}
                  {selectedPage}
                </div>
              </div>

              {/* Dimensions badge */}
              {cropWidth > 0 &&
                cropHeight > 0 && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                    <div className="rounded-full bg-black/75 px-4 py-2 text-xs font-bold text-white">
                      {Math.round(
                        cropWidth,
                      )}{" "}
                      ×{" "}
                      {Math.round(
                        cropHeight,
                      )}{" "}
                      px
                    </div>
                  </div>
                )}
            </div>

            {/* Page navigation */}
            <div className="flex h-14 shrink-0 items-center justify-center border-t border-white/10 bg-[#191919]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={
                    previousPage
                  }
                  disabled={
                    selectedPage <= 1
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft
                    size={18}
                  />
                </button>

                <button
                  type="button"
                  onClick={
                    backToPages
                  }
                  className="min-w-[100px] text-center"
                >
                  <p className="text-xs font-bold text-white">
                    Page{" "}
                    {selectedPage}{" "}
                    of{" "}
                    {numPages}
                  </p>

                  <p className="mt-0.5 text-[10px] text-white/40">
                    Select another
                  </p>
                </button>

                <button
                  type="button"
                  onClick={
                    nextPage
                  }
                  disabled={
                    selectedPage >=
                    numPages
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight
                    size={18}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* RIGHT CONTROLS */}
          {/* ================================================= */}

          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            {/* Scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* Heading */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  PDF Crop Editor
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Crop Page{" "}
                  {selectedPage}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Select the area you want to keep, just like the image crop tool.
                </p>
              </div>

              {/* Aspect Ratio */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Aspect Ratio
                  </h3>

                  <span className="text-xs text-slate-400">
                    Optional
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_OPTIONS.map(
                    (option) => {
                      const active =
                        aspect ===
                        option.value;

                      return (
                        <button
                          key={
                            option.label
                          }
                          type="button"
                          onClick={() =>
                            setAspect(
                              option.value,
                            )
                          }
                          className={`rounded-xl border px-2 py-3 text-xs font-extrabold transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {
                            option.label
                          }
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Zoom */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Zoom
                  </h3>

                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700">
                    {zoom.toFixed(
                      1,
                    )}
                    x
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      decreaseZoom
                    }
                    disabled={
                      zoom <= 1
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus
                      size={17}
                    />
                  </button>

                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(
                      event,
                    ) =>
                      setZoom(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                    className="w-full accent-slate-900"
                  />

                  <button
                    type="button"
                    onClick={
                      increaseZoom
                    }
                    disabled={
                      zoom >= 3
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus
                      size={17}
                    />
                  </button>
                </div>

                <p className="mt-2 text-[11px] leading-4 text-slate-400">
                  Zoom only changes the editor view. It does not change PDF quality.
                </p>
              </div>

              {/* Crop information */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-extrabold text-slate-800">
                  Crop Information
                </h3>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Page
                    </span>

                    <span className="text-xs font-extrabold text-slate-900">
                      {selectedPage}{" "}
                      /{" "}
                      {numPages}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Crop Width
                    </span>

                    <span className="text-xs font-extrabold text-slate-900">
                      {cropWidth
                        ? Math.round(
                            cropWidth,
                          )
                        : "—"}{" "}
                      px
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Crop Height
                    </span>

                    <span className="text-xs font-extrabold text-slate-900">
                      {cropHeight
                        ? Math.round(
                            cropHeight,
                          )
                        : "—"}{" "}
                      px
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-[11px] leading-4 text-slate-400">
                      Only this selected page will be cropped.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={
                  resetEditor
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCcw
                  size={16}
                />
                Reset Crop
              </button>

              {/* Error */}
              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold leading-5 text-red-600">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* ================================================= */}
            {/* APPLY */}
            {/* ================================================= */}

            <div className="shrink-0 border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={
                  handleApply
                }
                disabled={
                  processing ||
                  !croppedAreaPixels
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
                    <Check
                      size={18}
                    />
                    Apply Crop
                  </>
                )}
              </button>

              <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">
                The cropped PDF will contain the original PDF content inside the new CropBox.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}