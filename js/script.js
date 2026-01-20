/**
 * Main application script to handle UI interactions
 */

document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const fileInput = document.getElementById("fileInput");
  const fileDropZone = document.getElementById("fileDropZone");
  const browseBtn = document.querySelector(".browse-btn");
  const fileList = document.getElementById("fileList");
  const fileItems = document.getElementById("fileItems");
  const processPairsBtn = document.getElementById("processPairsBtn");
  const processSinglesBtn = document.getElementById("processSinglesBtn");
  const downloadSection = document.getElementById("downloadSection");
  const clearFilesBtn = document.getElementById("clearFilesBtn");

  let selectedFiles = [];

  // Constants
  const MAX_FILES = 10;

  // Initialize
  // Initialize
  function init() {
    // Set up event listeners
    setupEventListeners();

    // Update initial UI state
    updateProcessButtons();
    updateDropZoneLimitState();

    // Clean up blob URLs when page closes
    window.addEventListener("beforeunload", () => {
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
    });
  }
  function setupEventListeners() {
    // File input change
    fileInput.addEventListener("change", handleFileSelect);

    // Browse button click
    browseBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Force a user gesture recognition
      if (e.isTrusted) {
        // Use a promise-based approach
        await new Promise((resolve) => setTimeout(resolve, 50));
        fileInput.click();
      }
    });

    // Clear files button
    if (clearFilesBtn) {
      clearFilesBtn.addEventListener("click", clearFiles);
    }

    // Drop zone events
    fileDropZone.addEventListener("click", () => fileInput.click());
    fileDropZone.addEventListener("dragover", handleDragOver);
    fileDropZone.addEventListener("dragleave", handleDragLeave);
    fileDropZone.addEventListener("drop", handleDrop);

    // Process buttons
    processPairsBtn.addEventListener("click", () => processFiles("pairs"));
    processSinglesBtn.addEventListener("click", () => processFiles("singles"));
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    // Reset file input to allow selecting same files again
    fileInput.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.add("dragover");

    // Show limit warning if already at max
    if (selectedFiles.length >= MAX_FILES) {
      fileDropZone.classList.add("limit-reached");
    }
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.remove("dragover");
    fileDropZone.classList.remove("limit-reached");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.remove("dragover");
    fileDropZone.classList.remove("limit-reached");

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  function validatePDF(file) {
    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf")) {
      return {
        valid: false,
        reason: "El archivo tiene que ser .pdf",
      };
    }

    // Check file size (1MB limit)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      return {
        valid: false,
        reason: "El archivo es muy pesado (máximo 1MB)",
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        reason: "Archivo vacío",
      };
    }

    return {
      valid: true,
      reason: "Archivo PDF válido",
    };
  }

  async function checkPDFPages(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return {
        pageCount: pdf.numPages,
        isValid: pdf.numPages === Config.EXPECTED_PAGES_COUNT,
        reason:
          pdf.numPages === Config.EXPECTED_PAGES_COUNT
            ? "Válido (2 páginas)"
            : `Se esperaban 2 páginas, se encontraron ${pdf.numPages}`,
      };
    } catch (error) {
      return {
        pageCount: 0,
        isValid: false,
        reason: "Formato PDF inválido o archivo corrupto",
      };
    }
  }

  async function addFiles(files) {
    if (files.length === 0) return;

    // Check total file count
    const totalAfterAdd = selectedFiles.length + files.length;
    if (totalAfterAdd > MAX_FILES) {
      const exceso = totalAfterAdd - MAX_FILES;
      pdfProcessor.updateStatus(
        `No se pueden agregar ${
          files.length
        } archivos. Máximo ${MAX_FILES} permitidos. Excedés por ${exceso} archivo${
          exceso > 1 ? "s" : ""
        }.`,
        "error"
      );
      return;
    }

    // Show checking status
    pdfProcessor.updateStatus(
      `Verificando ${files.length} archivo${files.length > 1 ? "s" : ""}...`,
      "processing"
    );

    // Filter and validate files
    const validFiles = [];
    const invalidFiles = [];

    // Basic validation first
    for (const file of files) {
      const basicValidation = validatePDF(file);
      if (!basicValidation.valid) {
        invalidFiles.push({
          file: file,
          reason: basicValidation.reason,
        });
        continue;
      }

      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      const errorMsg =
        `${invalidFiles.length} archivo${
          invalidFiles.length > 1 ? "s" : ""
        } no válido${invalidFiles.length > 1 ? "s" : ""} omitido${
          invalidFiles.length > 1 ? "s" : ""
        }: ` +
        invalidFiles.map((f) => `${f.file.name} (${f.reason})`).join(", ");
      pdfProcessor.updateStatus(errorMsg, "error");
    }

    if (validFiles.length === 0) {
      if (files.length > 0) {
        pdfProcessor.updateStatus(
          "No se encontraron archivos PDF válidos",
          "error"
        );
      }
      return;
    }

    // Update status for page checking
    pdfProcessor.updateStatus(
      `Verificando que cada PDF tenga exactamente 2 páginas...`,
      "processing"
    );

    // Check each valid file for 2-page requirement
    const filesWithPageInfo = [];
    const invalidPageFiles = [];

    for (const file of validFiles) {
      const pageInfo = await checkPDFPages(file);

      if (pageInfo.isValid) {
        filesWithPageInfo.push({
          file: file,
          pageCount: pageInfo.pageCount,
          status: "valid",
        });
      } else {
        invalidPageFiles.push({
          file: file,
          reason: pageInfo.reason,
        });
      }
    }

    // Add valid files to selection
    filesWithPageInfo.forEach((fileInfo) => {
      // Check if file already exists (by name, size, and last modified)
      const existingIndex = selectedFiles.findIndex(
        (f) =>
          f.name === fileInfo.file.name &&
          f.size === fileInfo.file.size &&
          f.lastModified === fileInfo.file.lastModified
      );

      if (existingIndex === -1) {
        selectedFiles.push(fileInfo.file);
      }
    });

    // Show results
    updateFileList();
    updateProcessButtons();
    updateDropZoneLimitState();

    let statusMessage = "";
    if (filesWithPageInfo.length > 0) {
      const cantidad = filesWithPageInfo.length;
      statusMessage += `✅ ${cantidad} archivo${
        cantidad > 1 ? "s" : ""
      } PDF válido${cantidad > 1 ? "s" : ""} con exactamente 2 páginas. `;
    }

    if (invalidPageFiles.length > 0) {
      const cantidad = invalidPageFiles.length;
      statusMessage +=
        `⚠️ ${cantidad} archivo${
          cantidad > 1 ? "s" : ""
        } sin exactamente 2 páginas: ` +
        invalidPageFiles.map((f) => `${f.file.name} (${f.reason})`).join(", ");
    }

    if (statusMessage) {
      const statusType = invalidPageFiles.length > 0 ? "error" : "success";
      pdfProcessor.updateStatus(statusMessage, statusType);
    }

    // Show warning if approaching limit
    if (
      selectedFiles.length >= MAX_FILES - 2 &&
      selectedFiles.length < MAX_FILES
    ) {
      const remaining = MAX_FILES - selectedFiles.length;
      const warningMsg = `Podés agregar ${remaining} archivo${
        remaining > 1 ? "s" : ""
      } más (máximo ${MAX_FILES})`;
      pdfProcessor.updateStatus(warningMsg, "processing");
    } else if (selectedFiles.length >= MAX_FILES) {
      pdfProcessor.updateStatus(
        `Límite máximo de ${MAX_FILES} archivos alcanzado`,
        "processing"
      );
    }
  }

  function updateDropZoneLimitState() {
    if (selectedFiles.length >= MAX_FILES) {
      fileDropZone.classList.add("limit-reached");
      fileDropZone.querySelector("h3").textContent = "Límite máximo alcanzado";
      fileDropZone.querySelector("p").textContent =
        "Limpiá archivos para agregar más";
    } else {
      fileDropZone.classList.remove("limit-reached");
      fileDropZone.querySelector("h3").textContent =
        "Arrastrá archivos PDF acá";
      fileDropZone.querySelector("p").textContent =
        "o hacé clic para buscar tus archivos";
    }
  }

  function updateFileList() {
    if (selectedFiles.length === 0) {
      fileList.style.display = "none";
      return;
    }

    fileList.style.display = "block";
    fileItems.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "file-item";

      // File info
      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";
      fileInfo.innerHTML = `
            <div>📄</div>
            <div class="file-details">
                <div class="file-name" title="${escapeHTML(
                  file.name
                )}">${escapeHTML(file.name)}</div>
                <div class="file-status status-valid">${(
                  file.size / 1024
                ).toFixed(1)} KB • 2 páginas</div>
             </div>
            `;

      // Remove button
      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "×";
      removeBtn.title = "Eliminar archivo";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeFile(index);
      });

      item.appendChild(fileInfo);
      item.appendChild(removeBtn);
      fileItems.appendChild(item);
    });

    // Add file count display
    const fileCount = document.createElement("div");
    fileCount.className = "file-count";
    const cantidad = selectedFiles.length;
    fileCount.textContent = `${cantidad} archivo${
      cantidad > 1 ? "s" : ""
    } seleccionado${cantidad > 1 ? "s" : ""} (máximo ${MAX_FILES})`;
    fileItems.appendChild(fileCount);
  }

  function removeFile(index) {
    const removedFile = selectedFiles[index];
    selectedFiles.splice(index, 1);
    updateFileList();
    updateProcessButtons();
    updateDropZoneLimitState();

    if (selectedFiles.length === 0) {
      pdfProcessor.updateStatus(
        "Por favor, seleccioná archivos PDF para comenzar",
        "info"
      );
    } else {
      const cantidad = selectedFiles.length;
      pdfProcessor.updateStatus(
        `Eliminado: ${removedFile.name}. ${cantidad} archivo${
          cantidad > 1 ? "s" : ""
        } restante${cantidad > 1 ? "s" : ""}`,
        "info"
      );
    }
  }

  function updateProcessButtons() {
    const hasFiles = selectedFiles.length > 0;
    processPairsBtn.disabled = !hasFiles;
    processSinglesBtn.disabled = !hasFiles;

    // Update button text to show count
    if (hasFiles) {
      const pairCount = Math.ceil(selectedFiles.length / 2);
      const pairText =
        selectedFiles.length === 1
          ? "Procesar como archivo individual"
          : `Procesar como Parejas (${pairCount} salida${
              pairCount > 1 ? "s" : ""
            })`;

      const singleText = `Procesar como Individuales (${
        selectedFiles.length
      } salida${selectedFiles.length > 1 ? "s" : ""})`;

      processPairsBtn.textContent = pairText;
      processSinglesBtn.textContent = singleText;
    } else {
      processPairsBtn.textContent = "Procesar como Parejas";
      processSinglesBtn.textContent = "Procesar como Individuales";
    }
  }

  async function processFiles(mode) {
    if (selectedFiles.length === 0) {
      pdfProcessor.updateStatus("No hay archivos seleccionados", "error");
      return;
    }

    // Disable UI during processing
    disableUI(true);

    try {
      // Double-check all files have exactly 2 pages before processing
      pdfProcessor.updateStatus(
        "Verificación final de 2 páginas por archivo...",
        "processing"
      );

      const invalidFiles = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const pageInfo = await checkPDFPages(file);
        if (!pageInfo.isValid) {
          invalidFiles.push({
            file: file,
            reason: pageInfo.reason,
          });
        }

        // Update progress during verification
        const progress = (i / selectedFiles.length) * 30;
        pdfProcessor.updateProgress(progress);
      }

      if (invalidFiles.length > 0) {
        const cantidad = invalidFiles.length;
        const errorMsg =
          `No se puede procesar: ${cantidad} archivo${
            cantidad > 1 ? "s" : ""
          } no tienen exactamente 2 páginas: ` +
          invalidFiles.map((f) => `${f.file.name} (${f.reason})`).join(", ");
        pdfProcessor.updateStatus(errorMsg, "error");
        pdfProcessor.updateProgress(0);
        disableUI(false);
        return;
      }

      // Hide download section and reset progress
      downloadSection.style.display = "none";
      pdfProcessor.updateProgress(30);
      pdfProcessor.updateStatus("Iniciando procesamiento...", "processing");

      // Process files
      const results = await pdfProcessor.processFiles(selectedFiles, mode);

      if (results.length > 0) {
        pdfProcessor.displayResults(results);

        // Add clear button to status
        const statusDiv = document.getElementById("status");
        const existingClearBtn = statusDiv.querySelector(
          ".clear-after-process"
        );
        if (!existingClearBtn) {
          const clearBtn = document.createElement("button");
          clearBtn.textContent = "Limpiar archivos y empezar de nuevo";
          clearBtn.className = "browse-btn clear-after-process";
          clearBtn.style.marginTop = "10px";
          clearBtn.onclick = clearFiles;
          statusDiv.appendChild(document.createElement("br"));
          statusDiv.appendChild(clearBtn);
        }
      }
    } catch (error) {
      console.error("Error de procesamiento:", error);
      pdfProcessor.updateStatus(
        "Error en el procesamiento: " + error.message,
        "error"
      );
    } finally {
      // Re-enable UI
      disableUI(false);
    }
  }

  function disableUI(disabled) {
    processPairsBtn.disabled = disabled;
    processSinglesBtn.disabled = disabled;
    fileInput.disabled = disabled;
    browseBtn.disabled = disabled;

    if (clearFilesBtn) {
      clearFilesBtn.disabled = disabled;
    }

    if (disabled) {
      fileDropZone.style.opacity = "0.5";
      fileDropZone.style.pointerEvents = "none";
    } else {
      fileDropZone.style.opacity = "1";
      fileDropZone.style.pointerEvents = "auto";
      updateProcessButtons();
    }
  }

  // Clear all files
  function clearFiles() {
    selectedFiles = [];
    fileInput.value = "";
    updateFileList();
    updateProcessButtons();
    updateDropZoneLimitState();
    downloadSection.style.display = "none";
    pdfProcessor.updateStatus(
      "Por favor, seleccioná archivos PDF para comenzar",
      "info"
    );
    pdfProcessor.updateProgress(0);

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

    // Remove clear button from status
    const statusDiv = document.getElementById("status");
    const clearBtn = statusDiv.querySelector(".clear-after-process");
    if (clearBtn) {
      clearBtn.remove();
    }
  }

  // Initialize the app
  init();

  // Add keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + O to open file dialog
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      fileInput.click();
    }

    // Escape to clear files
    if (e.key === "Escape" && !fileInput.disabled) {
      clearFiles();
    }
  });

  // Prevent drag and drop on entire document
  document.addEventListener("dragover", (e) => {
    if (e.target !== fileDropZone) {
      e.preventDefault();
    }
  });

  document.addEventListener("drop", (e) => {
    if (e.target !== fileDropZone) {
      e.preventDefault();
    }
  });
});
