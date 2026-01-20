/**
 * PDF Processor - Processes PDF pairs and singles
 * Layout: Document A full on left, left 50% of Document B on right
 * Page 2 is cropped, scaled, and positioned at bottom left
 * Includes ZIP download functionality
 */

// ========== CONFIGURATION ==========
const Config = {
  // Page dimensions (A4 at 300 DPI)
  DPI: 300,
  A4_LANDSCAPE_WIDTH: 3508,
  A4_LANDSCAPE_HEIGHT: 2480,

  // Page 2: Keep top 20% only
  CROP_TOP_PERCENT: 0.2,

  // Page 2: Scale to 60% for bottom placement
  PAGE2_SCALE_FACTOR: 0.6,

  // Page 2: Bottom left positioning
  PAGE2_BOTTOM_MARGIN: 50,
  PAGE2_LEFT_MARGIN: 50,

  // Validation
  EXPECTED_PAGES_COUNT: 2,

  // Output naming
  PAIR_PREFIX: "pair",
  SINGLE_PREFIX: "single",

  // Image quality
  IMAGE_QUALITY: 1.0,
  IMAGE_FORMAT: "png",
};

class PDFProcessor {
  constructor() {
    this.processedFiles = new Map();
    this.isProcessing = false;

    // Initialize PDF.js worker
    if (typeof pdfjsLib !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }

  // Memory management to prevent leaks
  clearMemory() {
    this.processedFiles.clear();

    // Remove temporary canvases
    const tempCanvases = document.querySelectorAll("canvas.temp-canvas");
    tempCanvases.forEach((canvas) => {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    });

    // Clean up blob URLs
    if (window.pdfBlobUrls) {
      window.pdfBlobUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // Ignore errors
        }
      });
      window.pdfBlobUrls = [];
    }
  }

  // Check required libraries
  async checkDependencies() {
    const errors = [];

    if (typeof pdfjsLib === "undefined") {
      errors.push("PDF.js library not loaded");
    }

    if (typeof window.jspdf === "undefined") {
      errors.push("jsPDF library not loaded");
    }

    if (errors.length > 0) {
      throw new Error(
        `Missing dependencies: ${errors.join(", ")}. Please refresh the page.`,
      );
    }
  }

  /**
   * Load PDF file and render pages to canvas
   */
  async loadPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Validate page count
      if (pdf.numPages !== Config.EXPECTED_PAGES_COUNT) {
        throw new Error(
          `Se esperaban ${Config.EXPECTED_PAGES_COUNT} páginas, se encontraron ${pdf.numPages}`,
        );
      }

      const pages = [];

      // Render each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: Config.DPI / 72 });

        const canvas = document.createElement("canvas");
        canvas.className = "temp-canvas";
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        pages.push(canvas);
      }

      return pages;
    } catch (error) {
      console.error(`Error al cargar el PDF ${file.name}:`, error);
      throw error;
    }
  }

  /**
   * Crop top portion of page 2
   */
  cropPage2TopOnly(canvas) {
    const ctx = canvas.getContext("2d");
    const cropHeight = Math.floor(canvas.height * Config.CROP_TOP_PERCENT);

    const imageData = ctx.getImageData(0, 0, canvas.width, cropHeight);

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.className = "temp-canvas";
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCtx.putImageData(imageData, 0, 0);

    return croppedCanvas;
  }

  /**
   * Resize page 2 for bottom placement
   */
  resizePage2(canvas) {
    const availableWidth = Config.A4_LANDSCAPE_WIDTH / 2;
    const availableHeight = Config.A4_LANDSCAPE_HEIGHT / 3;

    const maxWidth = availableWidth * Config.PAGE2_SCALE_FACTOR;
    const maxHeight = availableHeight * Config.PAGE2_SCALE_FACTOR;

    const originalRatio = canvas.width / canvas.height;

    let newWidth, newHeight;

    // Maintain aspect ratio
    if (originalRatio > maxWidth / maxHeight) {
      newWidth = maxWidth;
      newHeight = newWidth / originalRatio;
    } else {
      newHeight = maxHeight;
      newWidth = newHeight * originalRatio;
    }

    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);

    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.className = "temp-canvas";
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    const resizedCtx = resizedCanvas.getContext("2d");

    resizedCtx.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      newWidth,
      newHeight,
    );

    return resizedCanvas;
  }

  /**
   * Process page 2: crop and resize
   */
  processPage2(canvas) {
    const cropped = this.cropPage2TopOnly(canvas);
    return this.resizePage2(cropped);
  }

  /**
   * Calculate position for page 2 at bottom left
   */
  calculatePage2Position(page2Canvas) {
    const x = Config.PAGE2_LEFT_MARGIN;
    const y =
      Config.A4_LANDSCAPE_HEIGHT -
      page2Canvas.height -
      Config.PAGE2_BOTTOM_MARGIN;
    return { x, y };
  }

  /**
   * Create A4 layout for individual PDF
   */
  async createIndividualLayout(pdfPages) {
    try {
      if (pdfPages.length !== Config.EXPECTED_PAGES_COUNT) {
        throw new Error(
          `Se esperaban ${Config.EXPECTED_PAGES_COUNT} páginas, se encontraron ${pdfPages.length}`,
        );
      }

      const canvas = document.createElement("canvas");
      canvas.className = "temp-canvas";
      canvas.width = Config.A4_LANDSCAPE_WIDTH;
      canvas.height = Config.A4_LANDSCAPE_HEIGHT;
      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Page 1: Full size
      ctx.drawImage(pdfPages[0], 0, 0);

      // Page 2: Processed and positioned at bottom left
      const page2Processed = this.processPage2(pdfPages[1]);
      const { x, y } = this.calculatePage2Position(page2Processed);
      ctx.drawImage(page2Processed, x, y);

      return canvas;
    } catch (error) {
      console.error("Error al crear el diseño individual:", error);
      throw error;
    }
  }

  /**
   * Process PDF pair: A full on left, B left 50% on right
   */
  async processPDFPair(pdfAFile, pdfBFile) {
    try {
      const pdfAPages = await this.loadPDF(pdfAFile);
      const pdfBPages = await this.loadPDF(pdfBFile);

      const docAImage = await this.createIndividualLayout(pdfAPages);
      const docBImage = await this.createIndividualLayout(pdfBPages);

      const finalCanvas = document.createElement("canvas");
      finalCanvas.className = "temp-canvas";
      finalCanvas.width = Config.A4_LANDSCAPE_WIDTH;
      finalCanvas.height = Config.A4_LANDSCAPE_HEIGHT;
      const finalCtx = finalCanvas.getContext("2d");

      finalCtx.fillStyle = "white";
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Document A: Full on left
      finalCtx.drawImage(docAImage, 0, 0);

      // Document B: Left 50% on right
      const halfWidth = Config.A4_LANDSCAPE_WIDTH / 2;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.className = "temp-canvas";
      tempCanvas.width = halfWidth;
      tempCanvas.height = Config.A4_LANDSCAPE_HEIGHT;
      const tempCtx = tempCanvas.getContext("2d");

      // Take only left half of Document B
      tempCtx.drawImage(
        docBImage,
        0,
        0,
        halfWidth,
        Config.A4_LANDSCAPE_HEIGHT,
        0,
        0,
        halfWidth,
        Config.A4_LANDSCAPE_HEIGHT,
      );

      // Place on right side
      finalCtx.drawImage(tempCanvas, halfWidth, 0);

      // Generate PDF with jsPDF
      if (typeof window.jspdf === "undefined") {
        throw new Error(
          "jsPDF library not loaded. Please include it in your HTML.",
        );
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [Config.A4_LANDSCAPE_WIDTH, Config.A4_LANDSCAPE_HEIGHT],
        compress: true,
      });

      const imgData = finalCanvas.toDataURL("image/png");
      pdf.addImage(
        imgData,
        Config.IMAGE_FORMAT.toUpperCase(),
        0,
        0,
        Config.A4_LANDSCAPE_WIDTH,
        Config.A4_LANDSCAPE_HEIGHT,
      );

      return pdf.output("blob");
    } catch (error) {
      console.error("Error al procesar el par de PDFs:", error);
      throw error;
    }
  }

  /**
   * Process single PDF with individual layout
   */
  async processSinglePDF(pdfFile) {
    try {
      const pdfPages = await this.loadPDF(pdfFile);
      const singleImage = await this.createIndividualLayout(pdfPages);

      if (typeof window.jspdf === "undefined") {
        throw new Error(
          "jsPDF library not loaded. Please include it in your HTML.",
        );
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [Config.A4_LANDSCAPE_WIDTH, Config.A4_LANDSCAPE_HEIGHT],
        compress: true,
      });

      const imgData = singleImage.toDataURL("image/png");
      pdf.addImage(
        imgData,
        Config.IMAGE_FORMAT.toUpperCase(),
        0,
        0,
        Config.A4_LANDSCAPE_WIDTH,
        Config.A4_LANDSCAPE_HEIGHT,
      );

      return pdf.output("blob");
    } catch (error) {
      console.error("Error al procesar el PDF individual:", error);
      throw error;
    }
  }

  /**
   * Main processing function
   */
  async processFiles(files, mode) {
    await this.checkDependencies();
    if (this.isProcessing) {
      throw new Error("Ya se están procesando archivos");
    }

    this.isProcessing = true;
    const results = [];

    try {
      if (mode === "pairs") {
        // Process files in pairs
        for (let i = 0; i < files.length; i += 2) {
          if (i + 1 < files.length) {
            const progress = (i / files.length) * 100;
            this.updateProgress(progress);
            this.updateStatus(
              `Procesando par ${Math.floor(i / 2) + 1} de ${Math.ceil(
                files.length / 2,
              )}...`,
              "processing",
            );

            const pdfA = files[i];
            const pdfB = files[i + 1];

            try {
              const blob = await this.processPDFPair(pdfA, pdfB);
              const timestamp = Date.now();
              const pairNumber = Math.floor(i / 2) + 1;
              const filename = `${Config.PAIR_PREFIX}_${pairNumber
                .toString()
                .padStart(2, "0")}_${timestamp}.pdf`;

              results.push({
                filename: filename,
                blob: blob,
                files: [pdfA.name, pdfB.name],
                type: "pair",
                pairNumber: pairNumber,
                size: blob.size,
              });
            } catch (error) {
              console.error(
                `Error al procesar el par ${Math.floor(i / 2) + 1}:`,
                error,
              );
              this.updateStatus(
                `Error al procesar el par ${Math.floor(i / 2) + 1}: ${
                  error.message
                }`,
                "error",
              );
            }
          } else {
            // Handle single leftover file
            const progress = (i / files.length) * 100;
            this.updateProgress(progress);
            this.updateStatus(`Procesando archivo restante...`, "processing");

            const pdf = files[i];
            try {
              const blob = await this.processSinglePDF(pdf);
              const timestamp = Date.now();
              const filename = `${Config.SINGLE_PREFIX}_restante_${timestamp}.pdf`;

              results.push({
                filename: filename,
                blob: blob,
                files: [pdf.name],
                type: "single",
                isLeftover: true,
                size: blob.size,
              });
            } catch (error) {
              console.error(`Error al procesar archivo individual:`, error);
              this.updateStatus(
                `Error al procesar archivo individual: ${error.message}`,
                "error",
              );
            }
          }
        }
      } else if (mode === "singles") {
        // Process all as individual files
        for (let i = 0; i < files.length; i++) {
          const progress = (i / files.length) * 100;
          this.updateProgress(progress);
          this.updateStatus(
            `Procesando archivo ${i + 1} de ${files.length}...`,
            "processing",
          );

          const pdf = files[i];
          try {
            const blob = await this.processSinglePDF(pdf);
            const timestamp = Date.now();
            const filename = `${Config.SINGLE_PREFIX}_${(i + 1)
              .toString()
              .padStart(2, "0")}_${timestamp}.pdf`;

            results.push({
              filename: filename,
              blob: blob,
              files: [pdf.name],
              type: "single",
              fileNumber: i + 1,
              size: blob.size,
            });
          } catch (error) {
            console.error(`Error al procesar el archivo ${pdf.name}:`, error);
            this.updateStatus(
              `Error al procesar ${pdf.name}: ${error.message}`,
              "error",
            );
          }
        }
      }

      this.updateProgress(100);

      if (results.length > 0) {
        const totalSizeMB = (
          results.reduce((sum, r) => sum + r.size, 0) /
          (1024 * 1024)
        ).toFixed(2);
        this.updateStatus(
          `¡Proceso completado! ${results.length} archivo(s) PDF generados (${totalSizeMB} MB)`,
          "success",
        );
      } else {
        this.updateStatus(
          "No se procesó ningún archivo correctamente",
          "error",
        );
      }

      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  // UI update methods
  updateStatus(message, type = "info") {
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status status-${type}`;
    }
  }

  updateProgress(percentage) {
    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
  }

  /**
   * Create download link for a PDF blob
   */
  createDownloadLink(filename, blob) {
    const url = URL.createObjectURL(blob);

    // Track for cleanup
    if (!window.pdfBlobUrls) window.pdfBlobUrls = [];
    window.pdfBlobUrls.push(url);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.textContent = "Descargar PDF";
    link.className = "download-link";
    link.title = `${filename} (${(blob.size / 1024).toFixed(0)} KB)`;

    let isDownloading = false;

    link.onclick = (e) => {
      if (isDownloading) {
        e.preventDefault();
        return false;
      }

      isDownloading = true;
      link.textContent = "⏳ Descargando...";
      link.style.opacity = "0.7";
      link.style.cursor = "wait";

      setTimeout(() => {
        link.textContent = "✓ Descargado (click para otra copia)";
        link.style.opacity = "0.8";
        link.style.cursor = "pointer";
        isDownloading = false;
      }, 1000);

      return true;
    };

    return link;
  }

  /**
   * Display download results with ZIP option
   */
  displayResults(results) {
    const downloadSection = document.getElementById("downloadSection");
    const downloadList = document.getElementById("downloadList");

    if (!downloadSection || !downloadList) return;

    downloadSection.style.display = "block";
    downloadList.innerHTML = "";

    // Add ZIP option for multiple files
    if (results.length > 1) {
      const zipItem = document.createElement("div");
      zipItem.className = "download-item download-all-item";

      const infoDiv = document.createElement("div");
      infoDiv.className = "download-item-info";

      const totalSizeMB = (
        results.reduce((sum, r) => sum + r.size, 0) /
        (1024 * 1024)
      ).toFixed(2);

      infoDiv.innerHTML = `
                <div class="zip-header">
                    <span class="zip-icon">📦</span>
                    <strong>Descargar todos los archivos</strong>
                </div>
                <small>${results.length} archivo(s) PDF • ${totalSizeMB} MB total</small>
            `;

      const downloadDiv = document.createElement("div");
      const zipButton = document.createElement("button");
      zipButton.textContent = "Descargar todo (.ZIP)";
      zipButton.className = "download-zip-btn";
      zipButton.onclick = () => this.downloadAllAsZip(results);

      downloadDiv.appendChild(zipButton);
      zipItem.appendChild(infoDiv);
      zipItem.appendChild(downloadDiv);
      downloadList.appendChild(zipItem);

      const separator = document.createElement("hr");
      separator.className = "download-separator";
      downloadList.appendChild(separator);
    }

    // Sort: pairs first, then singles
    results.sort((a, b) => {
      if (a.type === "pair" && b.type !== "pair") return -1;
      if (a.type !== "pair" && b.type === "pair") return 1;
      if (a.type === "pair" && b.type === "pair") {
        return (a.pairNumber || 0) - (b.pairNumber || 0);
      }
      return (a.fileNumber || 0) - (b.fileNumber || 0);
    });

    // Add individual download items
    results.forEach((result, index) => {
      const item = document.createElement("div");
      item.className = "download-item";

      const infoDiv = document.createElement("div");
      infoDiv.className = "download-item-info";

      let typeLabel = "";
      let icon = "📄";

      if (result.type === "pair") {
        typeLabel = `Par ${result.pairNumber}`;
        icon = "🔄";
      } else if (result.isLeftover) {
        typeLabel = "Archivo restante";
      } else {
        typeLabel = `Individual ${result.fileNumber}`;
      }

      const fileSizeKB = Math.round(result.size / 1024);

      infoDiv.innerHTML = `
                <strong>${icon} ${escapeHTML(result.filename)}</strong>
                <small>${escapeHTML(typeLabel)} | ${
                  result.files.length
                } archivo(s) fuente | ${fileSizeKB} KB</small>
                <div class="file-list">${result.files
                  .map((f) => escapeHTML(f))
                  .join(", ")}</div>
            `;

      const downloadDiv = document.createElement("div");
      const link = this.createDownloadLink(result.filename, result.blob);
      downloadDiv.appendChild(link);

      item.appendChild(infoDiv);
      item.appendChild(downloadDiv);
      downloadList.appendChild(item);
    });

    // Scroll to results
    downloadSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Create and download ZIP archive
   */
  async downloadAllAsZip(results) {
    try {
      this.updateStatus("Creando archivo ZIP...", "processing");

      // Load JSZip dynamically
      await this.loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
      );

      if (typeof JSZip === "undefined") {
        throw new Error("No se pudo cargar la biblioteca ZIP");
      }

      const zip = new JSZip();
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");

      // Add all PDFs
      results.forEach((result, index) => {
        zip.file(result.filename, result.blob);
      });

      // Generate ZIP
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdfs-procesados-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        this.updateStatus(
          `¡ZIP descargado con ${results.length} archivos!`,
          "success",
        );
      }, 100);
    } catch (error) {
      console.error("Error al crear ZIP:", error);
      this.updateStatus("Error al crear archivo ZIP", "error");

      // Fallback to individual downloads
      this.fallbackIndividualDownload(results);
    }
  }

  /**
   * Fallback: Download files individually
   */
  fallbackIndividualDownload(results) {
    this.updateStatus("Descargando archivos uno por uno...", "info");

    results.forEach((result, index) => {
      setTimeout(() => {
        const link = this.createDownloadLink(result.filename, result.blob);
        link.click();

        if (index === results.length - 1) {
          setTimeout(() => {
            this.updateStatus(
              `Descargados ${results.length} archivos individualmente`,
              "success",
            );
          }, 1000);
        }
      }, index * 1000);
    });
  }

  /**
   * Load external script dynamically
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }
}

// Global instance
window.pdfProcessor = new PDFProcessor();
