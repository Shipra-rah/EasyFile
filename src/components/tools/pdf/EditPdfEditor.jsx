import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  FilePenLine,
  Highlighter,
  Italic,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function EditPdfEditor({ file, onResult }) {
  /* =========================================================
     1. TOOL DEFINITIONS
  ========================================================= */

  const TOOLS = {
    SELECT: "select",
    TEXT: "text",
    HIGHLIGHT: "highlight",
    WHITEOUT: "whiteout",
    RECTANGLE: "rectangle",
    LINE: "line",
    PEN: "pen",
    SIGNATURE: "signature",
  };

  const TOOL_ITEMS = [
    { id: TOOLS.SELECT, label: "Select", icon: MousePointer2 },
    { id: TOOLS.TEXT, label: "Text", icon: Type },
    { id: TOOLS.HIGHLIGHT, label: "Highlight", icon: Highlighter },
    { id: TOOLS.WHITEOUT, label: "Whiteout", icon: Eraser },
    { id: TOOLS.RECTANGLE, label: "Box", icon: Square },
    { id: TOOLS.LINE, label: "Line", icon: Minus },
    { id: TOOLS.PEN, label: "Pen", icon: PenLine },
    { id: TOOLS.SIGNATURE, label: "Signature", icon: FilePenLine },
  ];

  const RESIZE_HANDLES = [
    "nw",
    "n",
    "ne",
    "w",
    "e",
    "sw",
    "s",
    "se",
  ];

  /* =========================================================
     2. REACT STATE
  ========================================================= */

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [numPages, setNumPages] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);

  const [pageMetrics, setPageMetrics] = useState({});
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [objectsByPage, setObjectsByPage] = useState({});
  const objectsRef = useRef({});

  const [selectedId, setSelectedId] = useState(null);

  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);

  const [fontSize, setFontSize] = useState(20);
  const [textColor, setTextColor] = useState("#111827");
  const [fontBold, setFontBold] = useState(false);
  const [fontItalic, setFontItalic] = useState(false);

  const [drawColor, setDrawColor] = useState("#111827");
  const [drawWidth, setDrawWidth] = useState(2);

  const [editingTextId, setEditingTextId] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState("");

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  /* =========================================================
     3. DOM / ENGINE REFS
  ========================================================= */

  const pdfRef = useRef(null);
  const pdfBytesRef = useRef(null);

  const pageAreaRef = useRef(null);
  const pageShellRef = useRef(null);
  const canvasRef = useRef(null);
  const annotationLayerRef = useRef(null);

  const renderTaskRef = useRef(null);
  const renderGenerationRef = useRef(0);

  const interactionRef = useRef(null);
  const frameRef = useRef(null);

  /* =========================================================
     4. PURE HELPERS
  ========================================================= */

  function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function hexToRgb(hex) {
    const raw = String(hex || "#111827").replace("#", "");
    const value = raw.length === 3
      ? raw.split("").map((item) => item + item).join("")
      : raw;

    return {
      r: parseInt(value.slice(0, 2), 16) / 255,
      g: parseInt(value.slice(2, 4), 16) / 255,
      b: parseInt(value.slice(4, 6), 16) / 255,
    };
  }

  function pdfColor(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgb(r, g, b);
  }

  function getScale() {
    return Math.max(0.001, fitScale * zoom);
  }

  /* =========================================================
     5. CURRENT PAGE / CURRENT OBJECT
  ========================================================= */

  const currentObjects = objectsByPage[selectedPage] || [];

  const selectedObject = useMemo(
    () => currentObjects.find((item) => item.id === selectedId) || null,
    [currentObjects, selectedId],
  );

  /* =========================================================
     6. DOCUMENT STATE SYNC
  ========================================================= */

  useEffect(() => {
    objectsRef.current = objectsByPage;
  }, [objectsByPage]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  /* =========================================================
     7. HISTORY ENGINE
  ========================================================= */

  function commitHistory(nextState) {
    const snapshot = JSON.stringify(nextState);
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const currentSnapshot = currentHistory[currentIndex]?.snapshot || "";

    if (snapshot === currentSnapshot) {
      objectsRef.current = nextState;
      setObjectsByPage(nextState);
      return;
    }

    const nextHistory = [
      ...currentHistory.slice(0, currentIndex + 1),
      {
        snapshot,
        state: clone(nextState),
      },
    ].slice(-50);

    const nextIndex = nextHistory.length - 1;

    historyRef.current = nextHistory;
    historyIndexRef.current = nextIndex;
    objectsRef.current = nextState;

    setHistory(nextHistory);
    setHistoryIndex(nextIndex);
    setObjectsByPage(nextState);
  }

  function updateLive(nextState) {
    objectsRef.current = nextState;
    setObjectsByPage(nextState);
  }

  function undo() {
    const index = historyIndexRef.current;

    if (index <= 0) return;

    const nextIndex = index - 1;
    const nextState = clone(historyRef.current[nextIndex].state);

    historyIndexRef.current = nextIndex;
    objectsRef.current = nextState;

    setHistoryIndex(nextIndex);
    setObjectsByPage(nextState);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function redo() {
    const index = historyIndexRef.current;
    const list = historyRef.current;

    if (index >= list.length - 1) return;

    const nextIndex = index + 1;
    const nextState = clone(list[nextIndex].state);

    historyIndexRef.current = nextIndex;
    objectsRef.current = nextState;

    setHistoryIndex(nextIndex);
    setObjectsByPage(nextState);
    setSelectedId(null);
    setEditingTextId(null);
  }

  /* =========================================================
     8. PDF LOADING
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError("");
      setNumPages(0);
      setSelectedPage(1);
      setObjectsByPage({});
      objectsRef.current = {};
      setHistory([]);
      setHistoryIndex(-1);
      historyRef.current = [];
      historyIndexRef.current = -1;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        pdfBytesRef.current = bytes;

        const loadingTask = pdfjsLib.getDocument({
          data: bytes.slice(),
        });

        const pdf = await loadingTask.promise;

        if (cancelled) {
          try {
            await pdf.destroy();
          } catch {
            // ignore cleanup error
          }
          return;
        }

        pdfRef.current = pdf;

        const metrics = {};
        const initialObjects = {};

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1, rotation: 0 });

          metrics[pageNumber] = {
            width: viewport.width,
            height: viewport.height,
            rotation: 0,
          };

          initialObjects[pageNumber] = [];
          page.cleanup();
        }

        if (cancelled) return;

        setNumPages(pdf.numPages);
        setPageMetrics(metrics);
        setObjectsByPage(initialObjects);
        objectsRef.current = initialObjects;

        const initialHistory = [
          {
            snapshot: JSON.stringify(initialObjects),
            state: clone(initialObjects),
          },
        ];

        historyRef.current = initialHistory;
        historyIndexRef.current = 0;

        setHistory(initialHistory);
        setHistoryIndex(0);
      } catch (loadError) {
        console.error("PDF load error:", loadError);

        if (!cancelled) {
          setError("Could not open this PDF.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      renderGenerationRef.current += 1;

      try {
        renderTaskRef.current?.cancel();
      } catch {
        // ignore
      }

      try {
        pdfRef.current?.destroy();
      } catch {
        // ignore
      }

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [file]);

  /* =========================================================
     9. PDF RENDERING
  ========================================================= */

  async function renderPage() {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const pageArea = pageAreaRef.current;

    if (!pdf || !canvas || !pageArea) return;

    const metrics = pageMetrics[selectedPage];
    if (!metrics) return;

    const generation = ++renderGenerationRef.current;

    try {
      try {
        renderTaskRef.current?.cancel();
      } catch {
        // ignore
      }

      renderTaskRef.current = null;

      const page = await pdf.getPage(selectedPage);

      if (generation !== renderGenerationRef.current) {
        page.cleanup();
        return;
      }

      const availableWidth = Math.max(120, pageArea.clientWidth - 48);
      const availableHeight = Math.max(120, pageArea.clientHeight - 48);

      const fit = Math.max(
        0.2,
        Math.min(
          availableWidth / metrics.width,
          availableHeight / metrics.height,
        ),
      );

      const displayScale = fit * zoom;

      const viewport = page.getViewport({
        scale: displayScale,
        rotation: 0,
      });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      setFitScale(fit);

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("Canvas context is unavailable.");
      }

      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();

      const task = page.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = task;
      await task.promise;

      if (generation !== renderGenerationRef.current) {
        page.cleanup();
        return;
      }

      renderTaskRef.current = null;
      page.cleanup();
    } catch (renderError) {
      if (
        renderError?.name === "RenderingCancelledException" ||
        String(renderError?.message || "").toLowerCase().includes("cancel")
      ) {
        return;
      }

      console.error("PDF render error:", renderError);
      setError("Could not render this PDF page.");
    }
  }

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      renderPage();
    }, 20);

    return () => clearTimeout(timer);
  }, [loading, selectedPage, zoom, pageMetrics]);

  useEffect(() => {
    const pageArea = pageAreaRef.current;
    if (!pageArea) return undefined;

    const observer = new ResizeObserver(() => {
      renderPage();
    });

    observer.observe(pageArea);

    return () => observer.disconnect();
  }, [loading, selectedPage, zoom, pageMetrics]);

  /* =========================================================
     10. COORDINATE ENGINE
  ========================================================= */

  function screenToPage(clientX, clientY) {
    const layer = annotationLayerRef.current;
    const metrics = pageMetrics[selectedPage];

    if (!layer || !metrics) {
      return { x: 0, y: 0 };
    }

    const rect = layer.getBoundingClientRect();
    const scale = getScale();

    return {
      x: clamp(
        (clientX - rect.left) / scale,
        0,
        metrics.width,
      ),
      y: clamp(
        (clientY - rect.top) / scale,
        0,
        metrics.height,
      ),
    };
  }

  /* =========================================================
     11. OBJECT FACTORY
  ========================================================= */

  function createObject(type, x, y) {
    const base = {
      id: createId(),
      type,
      x,
      y,
      width: 180,
      height: 50,
      rotation: 0,
      style: {},
      data: {},
    };

    switch (type) {
      case TOOLS.TEXT:
        return {
          ...base,
          width: 240,
          height: 60,
          style: {
            color: textColor,
            fontSize,
            bold: fontBold,
            italic: fontItalic,
          },
          data: {
            text: "Double click to edit",
          },
        };

      case TOOLS.SIGNATURE:
        return {
          ...base,
          width: 240,
          height: 65,
          style: {
            color: textColor,
            fontSize: Math.max(26, fontSize),
            bold: false,
            italic: true,
          },
          data: {
            text: "Your Signature",
          },
        };

      case TOOLS.HIGHLIGHT:
        return {
          ...base,
          width: 220,
          height: 28,
          style: {
            color: "#facc15",
            opacity: 0.35,
          },
        };

      case TOOLS.WHITEOUT:
        return {
          ...base,
          width: 220,
          height: 55,
          style: {
            color: "#ffffff",
            opacity: 1,
          },
        };

      case TOOLS.RECTANGLE:
        return {
          ...base,
          width: 220,
          height: 120,
          style: {
            color: drawColor,
            borderWidth: drawWidth,
            fill: false,
          },
        };

      case TOOLS.LINE:
        return {
          ...base,
          width: 220,
          height: 4,
          style: {
            color: drawColor,
            borderWidth: drawWidth,
          },
          data: {
            start: [0, 2],
            end: [220, 2],
          },
        };

      case TOOLS.PEN:
        return {
          ...base,
          width: 2,
          height: 2,
          style: {
            color: drawColor,
            borderWidth: drawWidth,
          },
          data: {
            points: [[0, 0]],
          },
        };

      default:
        return base;
    }
  }

  /* =========================================================
     12. OBJECT OPERATIONS
  ========================================================= */

  function addObjectAt(type, x, y) {
    const metrics = pageMetrics[selectedPage];
    if (!metrics) return;

    const object = createObject(type, x, y);

    object.x = clamp(
      object.x,
      0,
      Math.max(0, metrics.width - object.width),
    );

    object.y = clamp(
      object.y,
      0,
      Math.max(0, metrics.height - object.height),
    );

    const current = objectsRef.current;

    const next = {
      ...current,
      [selectedPage]: [
        ...(current[selectedPage] || []),
        object,
      ],
    };

    commitHistory(next);
    setSelectedId(object.id);
    setActiveTool(TOOLS.SELECT);

    if (
      type === TOOLS.TEXT ||
      type === TOOLS.SIGNATURE
    ) {
      setEditingTextId(object.id);
      setEditingTextValue(object.data.text);
    }
  }

  function updateObject(id, changes, shouldCommit = true) {
    const current = objectsRef.current;
    const objects = current[selectedPage] || [];

    const nextPageObjects = objects.map((object) => {
      if (object.id !== id) return object;
      return { ...object, ...changes };
    });

    const next = {
      ...current,
      [selectedPage]: nextPageObjects,
    };

    if (shouldCommit) {
      commitHistory(next);
    } else {
      updateLive(next);
    }
  }

  function updateSelectedStyle(changes, shouldCommit = true) {
    if (!selectedId || !selectedObject) return;

    updateObject(
      selectedId,
      {
        style: {
          ...selectedObject.style,
          ...changes,
        },
      },
      shouldCommit,
    );
  }

  function updateSelectedGeometry(changes) {
    if (!selectedId || !selectedObject) return;

    updateObject(selectedId, changes, true);
  }

  function deleteSelected() {
    if (!selectedId) return;

    const current = objectsRef.current;

    const next = {
      ...current,
      [selectedPage]: (current[selectedPage] || []).filter(
        (object) => object.id !== selectedId,
      ),
    };

    commitHistory(next);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function duplicateSelected() {
    if (!selectedObject) return;

    const metrics = pageMetrics[selectedPage];
    const duplicate = clone(selectedObject);

    duplicate.id = createId();
    duplicate.x += 20;
    duplicate.y += 20;

    duplicate.x = clamp(
      duplicate.x,
      0,
      Math.max(0, metrics.width - duplicate.width),
    );

    duplicate.y = clamp(
      duplicate.y,
      0,
      Math.max(0, metrics.height - duplicate.height),
    );

    const current = objectsRef.current;

    const next = {
      ...current,
      [selectedPage]: [
        ...(current[selectedPage] || []),
        duplicate,
      ],
    };

    commitHistory(next);
    setSelectedId(duplicate.id);
    setEditingTextId(null);
  }

  /* =========================================================
     13. INTERACTION UTILITIES
  ========================================================= */

  function stopWindowInteractionListeners() {
    const interaction = interactionRef.current;

    if (!interaction) return;

    if (interaction.moveHandler) {
      window.removeEventListener(
        "pointermove",
        interaction.moveHandler,
      );
    }

    if (interaction.upHandler) {
      window.removeEventListener(
        "pointerup",
        interaction.upHandler,
      );
    }

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  function finishInteraction() {
    stopWindowInteractionListeners();
    interactionRef.current = null;
  }

  function queueLiveUpdate(callback) {
    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      callback();
    });
  }

  /* =========================================================
     14. MOVE OBJECT
     Existing objects ALWAYS MOVE, regardless of active tool.
  ========================================================= */

  function startMove(event, object) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedId(object.id);

    const metrics = pageMetrics[selectedPage];
    const scale = getScale();

    const interaction = {
      type: "move",
      objectId: object.id,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: object.x,
      startY: object.y,
      width: object.width,
      height: object.height,
      scale,
      beforeState: clone(objectsRef.current),
    };

    interactionRef.current = interaction;

    const moveHandler = (moveEvent) => {
      const active = interactionRef.current;
      if (!active || active.type !== "move") return;

      queueLiveUpdate(() => {
        const dx =
          (moveEvent.clientX - active.startMouseX) /
          active.scale;

        const dy =
          (moveEvent.clientY - active.startMouseY) /
          active.scale;

        const nextX = clamp(
          active.startX + dx,
          0,
          Math.max(0, metrics.width - active.width),
        );

        const nextY = clamp(
          active.startY + dy,
          0,
          Math.max(0, metrics.height - active.height),
        );

        const current = objectsRef.current;
        const nextPageObjects = (current[selectedPage] || []).map(
          (item) =>
            item.id === active.objectId
              ? { ...item, x: nextX, y: nextY }
              : item,
        );

        updateLive({
          ...current,
          [selectedPage]: nextPageObjects,
        });
      });
    };

    const upHandler = () => {
      const finalState = objectsRef.current;

      finishInteraction();
      commitHistory(finalState);
    };

    interaction.moveHandler = moveHandler;
    interaction.upHandler = upHandler;

    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
  }

  /* =========================================================
     15. RESIZE OBJECT
  ========================================================= */

  function startResize(event, object, direction) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedId(object.id);

    const metrics = pageMetrics[selectedPage];
    const scale = getScale();

    const minWidth = object.type === TOOLS.LINE ? 12 : 20;
    const minHeight =
      object.type === TOOLS.LINE || object.type === TOOLS.PEN
        ? 4
        : 20;

    const interaction = {
      type: "resize",
      objectId: object.id,
      direction,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: object.x,
      startY: object.y,
      startWidth: object.width,
      startHeight: object.height,
      minWidth,
      minHeight,
      scale,
      beforeState: clone(objectsRef.current),
    };

    interactionRef.current = interaction;

    function calculateBounds(active, moveEvent) {
      const dx =
        (moveEvent.clientX - active.startMouseX) /
        active.scale;

      const dy =
        (moveEvent.clientY - active.startMouseY) /
        active.scale;

      const originalLeft = active.startX;
      const originalTop = active.startY;
      const originalRight =
        active.startX + active.startWidth;
      const originalBottom =
        active.startY + active.startHeight;

      let left = originalLeft;
      let right = originalRight;
      let top = originalTop;
      let bottom = originalBottom;

      if (active.direction.includes("w")) {
        left = clamp(
          originalLeft + dx,
          0,
          originalRight - active.minWidth,
        );
      }

      if (active.direction.includes("e")) {
        right = clamp(
          originalRight + dx,
          originalLeft + active.minWidth,
          metrics.width,
        );
      }

      if (active.direction.includes("n")) {
        top = clamp(
          originalTop + dy,
          0,
          originalBottom - active.minHeight,
        );
      }

      if (active.direction.includes("s")) {
        bottom = clamp(
          originalBottom + dy,
          originalTop + active.minHeight,
          metrics.height,
        );
      }

      return {
        x: left,
        y: top,
        width: Math.max(active.minWidth, right - left),
        height: Math.max(active.minHeight, bottom - top),
      };
    }

    const moveHandler = (moveEvent) => {
      const active = interactionRef.current;
      if (!active || active.type !== "resize") return;

      queueLiveUpdate(() => {
        const bounds = calculateBounds(active, moveEvent);
        const current = objectsRef.current;

        const nextPageObjects = (current[selectedPage] || []).map(
          (item) => {
            if (item.id !== active.objectId) return item;

            const updated = {
              ...item,
              ...bounds,
            };

            if (item.type === TOOLS.LINE) {
              const sourceWidth = Math.max(1, active.startWidth);
              const sourceHeight = Math.max(1, active.startHeight);

              updated.data = {
                ...item.data,
                start: [
                  (item.data?.start?.[0] || 0) *
                    (bounds.width / sourceWidth),
                  (item.data?.start?.[1] || 0) *
                    (bounds.height / sourceHeight),
                ],
                end: [
                  (item.data?.end?.[0] || 0) *
                    (bounds.width / sourceWidth),
                  (item.data?.end?.[1] || 0) *
                    (bounds.height / sourceHeight),
                ],
              };
            }

            if (item.type === TOOLS.PEN) {
              const sourceWidth = Math.max(1, active.startWidth);
              const sourceHeight = Math.max(1, active.startHeight);
              const scaleX = bounds.width / sourceWidth;
              const scaleY = bounds.height / sourceHeight;

              updated.data = {
                ...item.data,
                points: (item.data?.points || []).map(
                  ([pointX, pointY]) => [
                    pointX * scaleX,
                    pointY * scaleY,
                  ],
                ),
              };
            }

            return updated;
          },
        );

        updateLive({
          ...current,
          [selectedPage]: nextPageObjects,
        });
      });
    };

    const upHandler = () => {
      const finalState = objectsRef.current;

      finishInteraction();
      commitHistory(finalState);
    };

    interaction.moveHandler = moveHandler;
    interaction.upHandler = upHandler;

    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
  }

  /* =========================================================
     16. SHAPE CREATION
  ========================================================= */

  function startShapeCreation(event, type) {
    event.preventDefault();
    event.stopPropagation();

    const start = screenToPage(
      event.clientX,
      event.clientY,
    );

    const object = createObject(type, start.x, start.y);

    object.width = 1;
    object.height = type === TOOLS.LINE ? 2 : 1;

    if (type === TOOLS.LINE) {
      object.data = {
        start: [0, 1],
        end: [0, 1],
      };
    }

    const current = objectsRef.current;

    updateLive({
      ...current,
      [selectedPage]: [
        ...(current[selectedPage] || []),
        object,
      ],
    });

    setSelectedId(object.id);

    interactionRef.current = {
      type: "create-shape",
      objectId: object.id,
      tool: type,
      startX: start.x,
      startY: start.y,
      scale: getScale(),
    };

    const moveHandler = (moveEvent) => {
      const active = interactionRef.current;
      if (!active || active.type !== "create-shape") return;

      queueLiveUpdate(() => {
        const currentPoint = screenToPage(
          moveEvent.clientX,
          moveEvent.clientY,
        );

        const x1 = active.startX;
        const y1 = active.startY;
        const x2 = currentPoint.x;
        const y2 = currentPoint.y;

        const rect = normalizeRect(x1, y1, x2, y2);
        const currentState = objectsRef.current;

        const nextPageObjects = (
          currentState[selectedPage] || []
        ).map((item) => {
          if (item.id !== active.objectId) return item;

          if (active.tool === TOOLS.LINE) {
            return {
              ...item,
              x: rect.x,
              y: rect.y,
              width: Math.max(2, rect.width),
              height: Math.max(2, rect.height),
              data: {
                ...item.data,
                start: [
                  x1 - rect.x,
                  y1 - rect.y,
                ],
                end: [
                  x2 - rect.x,
                  y2 - rect.y,
                ],
              },
            };
          }

          return {
            ...item,
            x: rect.x,
            y: rect.y,
            width: Math.max(2, rect.width),
            height: Math.max(2, rect.height),
          };
        });

        updateLive({
          ...currentState,
          [selectedPage]: nextPageObjects,
        });
      });
    };

    const upHandler = () => {
      const finalState = objectsRef.current;
      const object = (
        finalState[selectedPage] || []
      ).find((item) => item.id === interactionRef.current?.objectId);

      finishInteraction();

      if (!object) return;

      if (object.width < 5 && object.height < 5) {
        const cleaned = {
          ...finalState,
          [selectedPage]: (
            finalState[selectedPage] || []
          ).filter((item) => item.id !== object.id),
        };

        updateLive(cleaned);
        setSelectedId(null);
        setActiveTool(TOOLS.SELECT);
        return;
      }

      commitHistory(finalState);
      setSelectedId(object.id);
      setActiveTool(TOOLS.SELECT);
    };

    interactionRef.current.moveHandler = moveHandler;
    interactionRef.current.upHandler = upHandler;

    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
  }

  /* =========================================================
     17. PEN DRAWING
  ========================================================= */

  function startPen(event) {
    event.preventDefault();
    event.stopPropagation();

    const start = screenToPage(
      event.clientX,
      event.clientY,
    );

    const object = createObject(
      TOOLS.PEN,
      start.x,
      start.y,
    );

    const current = objectsRef.current;

    updateLive({
      ...current,
      [selectedPage]: [
        ...(current[selectedPage] || []),
        object,
      ],
    });

    setSelectedId(object.id);

    interactionRef.current = {
      type: "pen",
      objectId: object.id,
      startX: start.x,
      startY: start.y,
      pointsPage: [[start.x, start.y]],
    };

    const moveHandler = (moveEvent) => {
      const active = interactionRef.current;
      if (!active || active.type !== "pen") return;

      queueLiveUpdate(() => {
        const point = screenToPage(
          moveEvent.clientX,
          moveEvent.clientY,
        );

        const points = active.pointsPage;
        const last = points[points.length - 1];

        const distance = Math.hypot(
          point.x - last[0],
          point.y - last[1],
        );

        if (distance < 1) return;

        const nextPoints = [...points, [point.x, point.y]];
        active.pointsPage = nextPoints;

        const xs = nextPoints.map(([pointX]) => pointX);
        const ys = nextPoints.map(([, pointY]) => pointY);

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const localPoints = nextPoints.map(
          ([pointX, pointY]) => [
            pointX - minX,
            pointY - minY,
          ],
        );

        const currentState = objectsRef.current;

        const nextPageObjects = (
          currentState[selectedPage] || []
        ).map((item) => {
          if (item.id !== active.objectId) return item;

          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(2, maxX - minX),
            height: Math.max(2, maxY - minY),
            data: {
              ...item.data,
              points: localPoints,
            },
          };
        });

        updateLive({
          ...currentState,
          [selectedPage]: nextPageObjects,
        });
      });
    };

    const upHandler = () => {
      const finalState = objectsRef.current;
      const object = (
        finalState[selectedPage] || []
      ).find((item) => item.id === activeId());

      finishInteraction();

      if (!object) return;

      if (object.width < 3 && object.height < 3) {
        const cleaned = {
          ...finalState,
          [selectedPage]: (
            finalState[selectedPage] || []
          ).filter((item) => item.id !== object.id),
        };

        updateLive(cleaned);
        setSelectedId(null);
        setActiveTool(TOOLS.SELECT);
        return;
      }

      commitHistory(finalState);
      setSelectedId(object.id);
      setActiveTool(TOOLS.SELECT);
    };

    function activeId() {
      return interactionRef.current?.objectId;
    }

    interactionRef.current.moveHandler = moveHandler;
    interactionRef.current.upHandler = upHandler;

    window.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
  }

  /* =========================================================
     18. BACKGROUND PAGE POINTER
  ========================================================= */

  function handlePagePointerDown(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (editingTextId) {
      finishTextEdit();
    }

    const point = screenToPage(
      event.clientX,
      event.clientY,
    );

    if (activeTool === TOOLS.SELECT) {
      setSelectedId(null);
      return;
    }

    if (
      activeTool === TOOLS.TEXT ||
      activeTool === TOOLS.SIGNATURE
    ) {
      addObjectAt(
        activeTool,
        point.x,
        point.y,
      );
      return;
    }

    if (activeTool === TOOLS.PEN) {
      startPen(event);
      return;
    }

    if (
      activeTool === TOOLS.HIGHLIGHT ||
      activeTool === TOOLS.WHITEOUT ||
      activeTool === TOOLS.RECTANGLE ||
      activeTool === TOOLS.LINE
    ) {
      startShapeCreation(
        event,
        activeTool,
      );
    }
  }

  /* =========================================================
     19. TEXT EDITING
  ========================================================= */

  function startTextEdit(object) {
    if (
      object.type !== TOOLS.TEXT &&
      object.type !== TOOLS.SIGNATURE
    ) {
      return;
    }

    setSelectedId(object.id);
    setEditingTextId(object.id);
    setEditingTextValue(object.data?.text || "");
  }

  function finishTextEdit() {
    if (!editingTextId) return;

    const current = objectsRef.current;
    const objects = current[selectedPage] || [];

    const nextPageObjects = objects.map((object) => {
      if (object.id !== editingTextId) return object;

      return {
        ...object,
        data: {
          ...object.data,
          text: editingTextValue,
        },
      };
    });

    const next = {
      ...current,
      [selectedPage]: nextPageObjects,
    };

    commitHistory(next);
    setEditingTextId(null);
  }

  /* =========================================================
     20. CANCEL INTERACTION
  ========================================================= */

  function cancelInteraction() {
    const interaction = interactionRef.current;

    if (!interaction) {
      setEditingTextId(null);
      setSelectedId(null);
      setActiveTool(TOOLS.SELECT);
      return;
    }

    stopWindowInteractionListeners();

    if (
      interaction.type === "create-shape" ||
      interaction.type === "pen"
    ) {
      const current = objectsRef.current;

      const cleaned = {
        ...current,
        [selectedPage]: (
          current[selectedPage] || []
        ).filter((item) => item.id !== interaction.objectId),
      };

      objectsRef.current = cleaned;
      setObjectsByPage(cleaned);
    } else if (
      interaction.type === "move" ||
      interaction.type === "resize"
    ) {
      const restored = clone(interaction.beforeState);
      objectsRef.current = restored;
      setObjectsByPage(restored);
    }

    interactionRef.current = null;
    setEditingTextId(null);
    setSelectedId(null);
    setActiveTool(TOOLS.SELECT);
  }

  /* =========================================================
     21. KEYBOARD SHORTCUTS
  ========================================================= */

  useEffect(() => {
    function onKeyDown(event) {
      const element = document.activeElement;
      const isTyping =
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.isContentEditable;

      if (isTyping) {
        if (event.key === "Escape") {
          setEditingTextId(null);
        }
        return;
      }

      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }

        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Escape") {
        cancelInteraction();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  /* =========================================================
     22. PAGE NAVIGATION
  ========================================================= */

  function previousPage() {
    finishInteraction();
    setSelectedPage((page) => Math.max(1, page - 1));
    setSelectedId(null);
    setEditingTextId(null);
  }

  function nextPage() {
    finishInteraction();
    setSelectedPage((page) => Math.min(numPages, page + 1));
    setSelectedId(null);
    setEditingTextId(null);
  }

  function choosePage(page) {
    finishInteraction();
    setSelectedPage(page);
    setSelectedId(null);
    setEditingTextId(null);
  }

  /* =========================================================
     23. TOOL SELECTION
  ========================================================= */

  function selectTool(tool) {
    if (interactionRef.current) {
      cancelInteraction();
    }

    setActiveTool(tool);

    if (tool !== TOOLS.TEXT && tool !== TOOLS.SIGNATURE) {
      setEditingTextId(null);
    }
  }

  /* =========================================================
     24. RESIZE HANDLE STYLE
  ========================================================= */

  function getHandleStyle(direction) {
    const base = {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 3,
      border: "1px solid #4f46e5",
      background: "#ffffff",
      zIndex: 20,
    };

    const position = {
      nw: {
        left: -5,
        top: -5,
        cursor: "nwse-resize",
      },
      n: {
        left: "50%",
        top: -5,
        transform: "translateX(-50%)",
        cursor: "ns-resize",
      },
      ne: {
        right: -5,
        top: -5,
        cursor: "nesw-resize",
      },
      w: {
        left: -5,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "ew-resize",
      },
      e: {
        right: -5,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "ew-resize",
      },
      sw: {
        left: -5,
        bottom: -5,
        cursor: "nesw-resize",
      },
      s: {
        left: "50%",
        bottom: -5,
        transform: "translateX(-50%)",
        cursor: "ns-resize",
      },
      se: {
        right: -5,
        bottom: -5,
        cursor: "nwse-resize",
      },
    };

    return {
      ...base,
      ...position[direction],
    };
  }

  /* =========================================================
     25. OBJECT RENDERING
  ========================================================= */

  function renderObject(object) {
    const scale = getScale();

    const left = object.x * scale;
    const top = object.y * scale;
    const width = Math.max(1, object.width) * scale;
    const height = Math.max(1, object.height) * scale;

    const isSelected = object.id === selectedId;

    const hitPadding =
      object.type === TOOLS.LINE || object.type === TOOLS.PEN
        ? Math.max(8, 10 / scale)
        : 0;

    const wrapperStyle = {
      position: "absolute",
      left: left - hitPadding * scale,
      top: top - hitPadding * scale,
      width: width + hitPadding * 2 * scale,
      height: Math.max(height, 10) + hitPadding * 2 * scale,
      zIndex: isSelected ? 30 : 10,
      pointerEvents: "auto",
      userSelect: "none",
      touchAction: "none",
      cursor: "move",
    };

    const visualStyle = {
      position: "absolute",
      left: hitPadding * scale,
      top: hitPadding * scale,
      width,
      height,
    };

    let visual = null;

    if (object.type === TOOLS.TEXT) {
      visual = (
        <div
          style={{
            ...visualStyle,
            padding: 2,
            color: object.style?.color || "#111827",
            fontSize: (object.style?.fontSize || 20) * scale,
            fontWeight: object.style?.bold ? 700 : 400,
            fontStyle: object.style?.italic ? "italic" : "normal",
            lineHeight: 1.2,
            whiteSpace: "pre-wrap",
            overflow: "visible",
          }}
        >
          {object.data?.text || "Text"}
        </div>
      );
    }

    if (object.type === TOOLS.SIGNATURE) {
      visual = (
        <div
          style={{
            ...visualStyle,
            padding: 2,
            color: object.style?.color || "#111827",
            fontSize: (object.style?.fontSize || 28) * scale,
            fontStyle: "italic",
            fontFamily: "cursive",
            whiteSpace: "pre-wrap",
            overflow: "visible",
          }}
        >
          {object.data?.text || "Your Signature"}
        </div>
      );
    }

    if (object.type === TOOLS.HIGHLIGHT) {
      visual = (
        <div
          style={{
            ...visualStyle,
            background: object.style?.color || "#facc15",
            opacity: object.style?.opacity ?? 0.35,
            borderRadius: 2,
          }}
        />
      );
    }

    if (object.type === TOOLS.WHITEOUT) {
      visual = (
        <div
          style={{
            ...visualStyle,
            background: "#ffffff",
            opacity: object.style?.opacity ?? 1,
          }}
        />
      );
    }

    if (object.type === TOOLS.RECTANGLE) {
      visual = (
        <div
          style={{
            ...visualStyle,
            boxSizing: "border-box",
            border: `${Math.max(
              1,
              (object.style?.borderWidth || 2) * scale,
            )}px solid ${object.style?.color || "#2563eb"}`,
            background: object.style?.fill
              ? `${object.style?.color || "#2563eb"}22`
              : "transparent",
          }}
        />
      );
    }

    if (object.type === TOOLS.LINE) {
      const start = object.data?.start || [0, object.height / 2];
      const end = object.data?.end || [object.width, object.height / 2];

      visual = (
        <svg
          style={{
            ...visualStyle,
            overflow: "visible",
          }}
          width={width}
          height={Math.max(height, 8)}
          viewBox={`0 0 ${Math.max(object.width, 1)} ${Math.max(object.height, 8)}`}
        >
          <line
            x1={start[0]}
            y1={start[1]}
            x2={end[0]}
            y2={end[1]}
            stroke={object.style?.color || "#111827"}
            strokeWidth={object.style?.borderWidth || 2}
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (object.type === TOOLS.PEN) {
      const points = object.data?.points || [];
      const pointsString = points
        .map(([pointX, pointY]) => `${pointX},${pointY}`)
        .join(" ");

      visual = (
        <svg
          style={{
            ...visualStyle,
            overflow: "visible",
          }}
          width={Math.max(width, 8)}
          height={Math.max(height, 8)}
          viewBox={`0 0 ${Math.max(object.width, 1)} ${Math.max(object.height, 1)}`}
        >
          {points.length > 1 ? (
            <polyline
              points={pointsString}
              fill="none"
              stroke={object.style?.color || "#111827"}
              strokeWidth={object.style?.borderWidth || 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle
              cx={points[0]?.[0] || 0}
              cy={points[0]?.[1] || 0}
              r={object.style?.borderWidth || 2}
              fill={object.style?.color || "#111827"}
            />
          )}
        </svg>
      );
    }

    return (
      <div
        key={object.id}
        style={wrapperStyle}
        onPointerDown={(event) => {
          startMove(event, object);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          startTextEdit(object);
        }}
      >
        {visual}
      </div>
    );
  }

  /* =========================================================
     26. SELECTION OVERLAY
  ========================================================= */

  function renderSelection(object) {
    if (!object) return null;

    const scale = getScale();

    return (
      <div
        key={`selection-${object.id}`}
        style={{
          position: "absolute",
          left: object.x * scale,
          top: object.y * scale,
          width: Math.max(object.width, 1) * scale,
          height: Math.max(object.height, 1) * scale,
          border: "1px solid #4f46e5",
          pointerEvents: "none",
          zIndex: 100,
          boxSizing: "border-box",
        }}
      >
        {RESIZE_HANDLES.map((direction) => (
          <div
            key={direction}
            style={getHandleStyle(direction)}
            onPointerDown={(event) => {
              startResize(
                event,
                object,
                direction,
              );
            }}
          />
        ))}
      </div>
    );
  }

  /* =========================================================
     27. TEXT EDITOR OVERLAY
  ========================================================= */

  function renderTextEditor() {
    if (!editingTextId) return null;

    const object = currentObjects.find(
      (item) => item.id === editingTextId,
    );

    if (!object) return null;

    const scale = getScale();

    return (
      <textarea
        autoFocus
        value={editingTextValue}
        onChange={(event) => {
          setEditingTextValue(event.target.value);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onBlur={finishTextEdit}
        className="absolute outline-none"
        style={{
          left: object.x * scale,
          top: object.y * scale,
          width: Math.max(120, object.width * scale),
          minHeight: Math.max(50, object.height * scale),
          zIndex: 200,
          padding: 6,
          resize: "both",
          border: "1px solid #4f46e5",
          background: "#ffffff",
          color: object.style?.color || "#111827",
          fontSize: (object.style?.fontSize || 20) * scale,
          fontWeight: object.style?.bold ? 700 : 400,
          fontStyle: object.style?.italic ? "italic" : "normal",
          fontFamily:
            object.type === TOOLS.SIGNATURE
              ? "cursive"
              : "inherit",
          boxSizing: "border-box",
        }}
      />
    );
  }

  /* =========================================================
     28. PDF EXPORT HELPERS
  ========================================================= */

  function editorYToPdfY(pageHeight, y, height = 0) {
    return pageHeight - y - height;
  }

  async function embedFont(pdfDoc, object) {
    const bold = !!object.style?.bold;
    const italic =
      !!object.style?.italic ||
      object.type === TOOLS.SIGNATURE;

    let fontName = StandardFonts.Helvetica;

    if (bold && italic) {
      fontName = StandardFonts.HelveticaBoldOblique;
    } else if (bold) {
      fontName = StandardFonts.HelveticaBold;
    } else if (italic) {
      fontName = StandardFonts.HelveticaOblique;
    }

    return pdfDoc.embedFont(fontName);
  }

  async function exportTextObject(pdfDoc, pdfPage, object) {
    const pageHeight = pdfPage.getSize().height;
    const font = await embedFont(pdfDoc, object);

    const size = Number(object.style?.fontSize) || 20;
    const color = pdfColor(object.style?.color || "#111827");
    const lines = String(object.data?.text || "").split(/\r?\n/);
    const lineHeight = size * 1.2;

    lines.forEach((line, index) => {
      pdfPage.drawText(line || " ", {
        x: object.x,
        y: pageHeight - object.y - size - index * lineHeight,
        size,
        font,
        color,
      });
    });
  }

  function exportHighlight(pdfPage, object) {
    const pageHeight = pdfPage.getSize().height;

    pdfPage.drawRectangle({
      x: object.x,
      y: editorYToPdfY(
        pageHeight,
        object.y,
        object.height,
      ),
      width: object.width,
      height: object.height,
      color: pdfColor(object.style?.color || "#facc15"),
      opacity: Number(object.style?.opacity ?? 0.35),
      borderWidth: 0,
    });
  }

  function exportWhiteout(pdfPage, object) {
    const pageHeight = pdfPage.getSize().height;

    pdfPage.drawRectangle({
      x: object.x,
      y: editorYToPdfY(
        pageHeight,
        object.y,
        object.height,
      ),
      width: object.width,
      height: object.height,
      color: rgb(1, 1, 1),
      opacity: 1,
      borderWidth: 0,
    });
  }

  function exportRectangle(pdfPage, object) {
    const pageHeight = pdfPage.getSize().height;
    const color = pdfColor(
      object.style?.color || "#2563eb",
    );

    const options = {
      x: object.x,
      y: editorYToPdfY(
        pageHeight,
        object.y,
        object.height,
      ),
      width: object.width,
      height: object.height,
      borderColor: color,
      borderWidth: Math.max(
        1,
        Number(object.style?.borderWidth ?? 2),
      ),
    };

    if (object.style?.fill) {
      options.color = color;
      options.opacity = 0.12;
    }

    pdfPage.drawRectangle(options);
  }

  function exportLine(pdfPage, object) {
    const pageHeight = pdfPage.getSize().height;
    const start = object.data?.start || [0, object.height / 2];
    const end = object.data?.end || [object.width, object.height / 2];

    pdfPage.drawLine({
      start: {
        x: object.x + Number(start[0] || 0),
        y: pageHeight - object.y - Number(start[1] || 0),
      },
      end: {
        x: object.x + Number(end[0] || 0),
        y: pageHeight - object.y - Number(end[1] || 0),
      },
      color: pdfColor(object.style?.color || "#111827"),
      thickness: Math.max(
        1,
        Number(object.style?.borderWidth ?? 2),
      ),
    });
  }

  function exportPen(pdfPage, object) {
    const points = object.data?.points || [];

    if (points.length < 2) return;

    const pageHeight = pdfPage.getSize().height;
    const color = pdfColor(object.style?.color || "#111827");
    const thickness = Math.max(
      1,
      Number(object.style?.borderWidth ?? 2),
    );

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];

      pdfPage.drawLine({
        start: {
          x: object.x + Number(previous[0] || 0),
          y:
            pageHeight -
            object.y -
            Number(previous[1] || 0),
        },
        end: {
          x: object.x + Number(current[0] || 0),
          y:
            pageHeight -
            object.y -
            Number(current[1] || 0),
        },
        color,
        thickness,
      });
    }
  }

  /* =========================================================
     29. FINAL PDF EXPORT
  ========================================================= */

  async function exportPdf() {
    if (!pdfBytesRef.current) {
      setError("PDF data is not available.");
      return;
    }

    if (processing) return;

    setProcessing(true);
    setError("");

    try {
      const pdfDoc = await PDFDocument.load(
        pdfBytesRef.current.slice(),
      );

      const pages = pdfDoc.getPages();

      for (
        let pageIndex = 0;
        pageIndex < pages.length;
        pageIndex += 1
      ) {
        const pdfPage = pages[pageIndex];
        const pageNumber = pageIndex + 1;
        const objects =
          objectsRef.current[pageNumber] || [];

        for (const object of objects) {
          switch (object.type) {
            case TOOLS.TEXT:
            case TOOLS.SIGNATURE:
              await exportTextObject(
                pdfDoc,
                pdfPage,
                object,
              );
              break;

            case TOOLS.HIGHLIGHT:
              exportHighlight(
                pdfPage,
                object,
              );
              break;

            case TOOLS.WHITEOUT:
              exportWhiteout(
                pdfPage,
                object,
              );
              break;

            case TOOLS.RECTANGLE:
              exportRectangle(
                pdfPage,
                object,
              );
              break;

            case TOOLS.LINE:
              exportLine(
                pdfPage,
                object,
              );
              break;

            case TOOLS.PEN:
              exportPen(
                pdfPage,
                object,
              );
              break;

            default:
              break;
          }
        }
      }

      const outputBytes = await pdfDoc.save();

      const blob = new Blob(
        [outputBytes],
        { type: "application/pdf" },
      );

      const url = URL.createObjectURL(blob);

      // Send the result to ToolWork as well.
      onResult(url, "pdf");

      // Also make the Export PDF button itself download immediately.
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${
        file?.name?.replace(/\.pdf$/i, "") || "edited-document"
      }-edited.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (exportError) {
      console.error("PDF export error:", exportError);
      setError(
        exportError?.message ||
          "Could not export the PDF.",
      );
    } finally {
      setProcessing(false);
    }
  }

  /* =========================================================
     30. INSPECTOR
  ========================================================= */

  function renderInspector() {
    if (!selectedObject) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">
              PDF editor
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Choose a tool and draw on the page. Existing objects are always movable, regardless of the selected tool.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Quick add
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addObjectAt(TOOLS.TEXT, 50, 50)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                Text
              </button>

              <button
                type="button"
                onClick={() => addObjectAt(TOOLS.SIGNATURE, 50, 120)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                Signature
              </button>

              <button
                type="button"
                onClick={() => setActiveTool(TOOLS.HIGHLIGHT)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                Highlight
              </button>

              <button
                type="button"
                onClick={() => setActiveTool(TOOLS.RECTANGLE)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                Box
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-700">
              Shortcuts
            </p>
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Delete</span>
                <span>Delete</span>
              </div>
              <div className="flex justify-between">
                <span>Undo</span>
                <span>Ctrl + Z</span>
              </div>
              <div className="flex justify-between">
                <span>Redo</span>
                <span>Ctrl + Y</span>
              </div>
              <div className="flex justify-between">
                <span>Cancel</span>
                <span>Esc</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const objectIsText =
      selectedObject.type === TOOLS.TEXT ||
      selectedObject.type === TOOLS.SIGNATURE;

    const objectIsShape =
      selectedObject.type === TOOLS.RECTANGLE ||
      selectedObject.type === TOOLS.HIGHLIGHT ||
      selectedObject.type === TOOLS.WHITEOUT ||
      selectedObject.type === TOOLS.LINE ||
      selectedObject.type === TOOLS.PEN;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Selected object
            </p>
            <p className="text-sm font-extrabold capitalize text-slate-900">
              {selectedObject.type}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>

        {objectIsText && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-700">
              Text
            </p>

            <textarea
              value={
                editingTextId === selectedObject.id
                  ? editingTextValue
                  : selectedObject.data?.text || ""
              }
              onFocus={() => {
                setEditingTextId(selectedObject.id);
                setEditingTextValue(
                  selectedObject.data?.text || "",
                );
              }}
              onChange={(event) => {
                setEditingTextValue(event.target.value);
              }}
              onBlur={finishTextEdit}
              className="min-h-[90px] w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-indigo-400"
            />

            <div>
              <label className="text-xs font-semibold text-slate-500">
                Font size
              </label>
              <input
                type="number"
                min="6"
                max="120"
                value={selectedObject.style?.fontSize || 20}
                onChange={(event) =>
                  updateSelectedStyle({
                    fontSize: Math.max(
                      6,
                      Number(event.target.value) || 20,
                    ),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  updateSelectedStyle({
                    bold: !selectedObject.style?.bold,
                  })
                }
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  selectedObject.style?.bold
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                <Bold size={16} />
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedStyle({
                    italic: !selectedObject.style?.italic,
                  })
                }
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  selectedObject.style?.italic
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                <Italic size={16} />
              </button>

              <input
                type="color"
                value={selectedObject.style?.color || "#111827"}
                onChange={(event) =>
                  updateSelectedStyle({
                    color: event.target.value,
                  })
                }
                className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
            </div>
          </div>
        )}

        {objectIsShape && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-700">
              Appearance
            </p>

            {(selectedObject.type === TOOLS.RECTANGLE ||
              selectedObject.type === TOOLS.HIGHLIGHT ||
              selectedObject.type === TOOLS.LINE ||
              selectedObject.type === TOOLS.PEN) && (
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Color
                </label>
                <input
                  type="color"
                  value={selectedObject.style?.color || "#111827"}
                  onChange={(event) =>
                    updateSelectedStyle({
                      color: event.target.value,
                    })
                  }
                  className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
              </div>
            )}

            {selectedObject.type === TOOLS.RECTANGLE && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={!!selectedObject.style?.fill}
                  onChange={(event) =>
                    updateSelectedStyle({
                      fill: event.target.checked,
                    })
                  }
                />
                Fill box
              </label>
            )}

            {selectedObject.type === TOOLS.HIGHLIGHT && (
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Opacity
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={selectedObject.style?.opacity ?? 0.35}
                  onChange={(event) =>
                    updateSelectedStyle({
                      opacity: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full"
                />
              </div>
            )}

            {(selectedObject.type === TOOLS.LINE ||
              selectedObject.type === TOOLS.PEN ||
              selectedObject.type === TOOLS.RECTANGLE) && (
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Stroke width
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={selectedObject.style?.borderWidth || 2}
                  onChange={(event) =>
                    updateSelectedStyle({
                      borderWidth: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full"
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-700">
            Geometry
          </p>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={Math.round(selectedObject.x)}
              onChange={(event) =>
                updateSelectedGeometry({
                  x: Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              placeholder="X"
            />

            <input
              type="number"
              value={Math.round(selectedObject.y)}
              onChange={(event) =>
                updateSelectedGeometry({
                  y: Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              placeholder="Y"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="2"
              value={Math.round(selectedObject.width)}
              onChange={(event) =>
                updateSelectedGeometry({
                  width: Math.max(
                    2,
                    Number(event.target.value) || 2,
                  ),
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              placeholder="Width"
            />

            <input
              type="number"
              min="2"
              value={Math.round(selectedObject.height)}
              onChange={(event) =>
                updateSelectedGeometry({
                  height: Math.max(
                    2,
                    Number(event.target.value) || 2,
                  ),
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              placeholder="Height"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={duplicateSelected}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
          >
            <Copy size={14} />
            Duplicate
          </button>

          <button
            type="button"
            onClick={deleteSelected}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     31. LOADING SCREEN
  ========================================================= */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Opening PDF...
          </p>
        </div>
      </div>
    );
  }

  if (!pdfRef.current) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-red-200 bg-white p-6">
        <div className="text-center">
          <p className="text-sm font-bold text-red-600">
            {error || "Could not open the PDF."}
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     32. DISPLAY METRICS
  ========================================================= */

  const metrics = pageMetrics[selectedPage];
  const displayWidth = metrics
    ? metrics.width * getScale()
    : 0;
  const displayHeight = metrics
    ? metrics.height * getScale()
    : 0;

  /* =========================================================
     33. MAIN EDITOR PAGE
  ========================================================= */

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* LEFT: PAGES */}
      <aside className="hidden w-20 shrink-0 border-r border-slate-200 bg-slate-50 lg:flex lg:flex-col">
        <div className="flex h-11 shrink-0 items-center justify-center border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Pages
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;
            const active = pageNumber === selectedPage;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => choosePage(pageNumber)}
                className={`mb-2 flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-xs font-bold transition ${
                  active
                    ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className="flex h-12 w-9 items-center justify-center rounded border border-slate-200 bg-white text-[10px]">
                  {pageNumber}
                </span>
                <span>{pageNumber}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* TOOLBAR */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-2">
          <div className="flex items-center gap-1">
            {TOOL_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = activeTool === id;

              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => selectTool(id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  <Icon size={17} />
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {(activeTool === TOOLS.TEXT ||
            activeTool === TOOLS.SIGNATURE ||
            selectedObject?.type === TOOLS.TEXT ||
            selectedObject?.type === TOOLS.SIGNATURE) && (
            <>
              <input
                type="number"
                min="6"
                max="120"
                value={
                  selectedObject?.style?.fontSize ?? fontSize
                }
                onChange={(event) => {
                  const value = Math.max(
                    6,
                    Number(event.target.value) || 20,
                  );

                  setFontSize(value);

                  if (selectedObject) {
                    updateSelectedStyle({
                      fontSize: value,
                    });
                  }
                }}
                className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-xs outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  const value = selectedObject
                    ? !selectedObject.style?.bold
                    : !fontBold;

                  setFontBold(value);

                  if (selectedObject) {
                    updateSelectedStyle({
                      bold: value,
                    });
                  }
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  selectedObject?.style?.bold || fontBold
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                <Bold size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const value = selectedObject
                    ? !selectedObject.style?.italic
                    : !fontItalic;

                  setFontItalic(value);

                  if (selectedObject) {
                    updateSelectedStyle({
                      italic: value,
                    });
                  }
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  selectedObject?.style?.italic || fontItalic
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                <Italic size={16} />
              </button>

              <input
                type="color"
                value={
                  selectedObject?.style?.color ?? textColor
                }
                onChange={(event) => {
                  setTextColor(event.target.value);

                  if (selectedObject) {
                    updateSelectedStyle({
                      color: event.target.value,
                    });
                  }
                }}
                className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />

              <div className="h-6 w-px bg-slate-200" />
            </>
          )}

          {(activeTool === TOOLS.PEN ||
            activeTool === TOOLS.LINE ||
            selectedObject?.type === TOOLS.PEN ||
            selectedObject?.type === TOOLS.LINE) && (
            <>
              <input
                type="color"
                value={
                  selectedObject?.style?.color ?? drawColor
                }
                onChange={(event) => {
                  setDrawColor(event.target.value);

                  if (
                    selectedObject?.type === TOOLS.PEN ||
                    selectedObject?.type === TOOLS.LINE
                  ) {
                    updateSelectedStyle({
                      color: event.target.value,
                    });
                  }
                }}
                className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />

              <input
                type="number"
                min="1"
                max="12"
                value={
                  selectedObject?.style?.borderWidth ?? drawWidth
                }
                onChange={(event) => {
                  const value = clamp(
                    Number(event.target.value) || 2,
                    1,
                    12,
                  );

                  setDrawWidth(value);

                  if (
                    selectedObject?.type === TOOLS.PEN ||
                    selectedObject?.type === TOOLS.LINE
                  ) {
                    updateSelectedStyle({
                      borderWidth: value,
                    });
                  }
                }}
                className="h-9 w-14 rounded-lg border border-slate-200 px-2 text-xs outline-none"
              />

              <div className="h-6 w-px bg-slate-200" />
            </>
          )}

          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2 size={17} />
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2 size={17} />
          </button>

          <button
            type="button"
            onClick={() => setZoom((value) => clamp(value - 0.1, 0.5, 3))}
            title="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
          >
            <Minus size={16} />
          </button>

          <span className="min-w-[48px] text-center text-xs font-bold text-slate-500">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom((value) => clamp(value + 0.1, 0.5, 3))}
            title="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
          >
            <Plus size={16} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={previousPage}
              disabled={selectedPage <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
            >
              <ChevronLeft size={17} />
            </button>

            <span className="text-xs font-bold text-slate-600">
              {selectedPage} / {numPages}
            </span>

            <button
              type="button"
              onClick={nextPage}
              disabled={selectedPage >= numPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
            >
              <ChevronRight size={17} />
            </button>

            <button
              type="button"
              onClick={exportPdf}
              disabled={processing}
              className="min-w-[108px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {processing ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded p-1 hover:bg-red-100"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* PAGE WORKSPACE */}
        <div
          ref={pageAreaRef}
          className="relative min-h-0 flex-1 overflow-auto bg-slate-100"
        >
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            <div
              ref={pageShellRef}
              className="relative shrink-0 bg-white shadow-xl"
              style={{
                width: displayWidth,
                height: displayHeight,
              }}
            >
              <canvas
                ref={canvasRef}
                className="absolute left-0 top-0 block"
              />

              <div
                ref={annotationLayerRef}
                onPointerDown={handlePagePointerDown}
                className="absolute left-0 top-0"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  pointerEvents: "auto",
                  touchAction: "none",
                }}
              >
                {currentObjects.map(renderObject)}

                {selectedObject &&
                  renderSelection(selectedObject)}

                {renderTextEditor()}
              </div>
            </div>
          </div>

          {activeTool !== TOOLS.SELECT && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white shadow-lg">
              {activeTool === TOOLS.PEN
                ? "Draw freely on the page"
                : activeTool === TOOLS.TEXT ||
                    activeTool === TOOLS.SIGNATURE
                  ? "Click the page to add text"
                  : "Drag on the page to create"}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: INSPECTOR */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
        <div className="flex h-11 shrink-0 items-center border-b border-slate-200 px-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Inspector
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {renderInspector()}
        </div>
      </aside>
    </div>
  );
}
