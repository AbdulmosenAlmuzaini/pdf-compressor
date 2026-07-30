// Ensure pdf.js Global Worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Global State
let activeTab = 'dashboard';
let mergeFiles = [];
let splitFile = null;
let organizerFile = null;
let organizerPagesState = [];
let imageFiles = [];
let numberingFile = null;
let ocrFile = null;

// Drag handles index trackers
let mergeDragStartIndex = null;
let organizerDragStartIndex = null;
let imagesDragStartIndex = null;

/* ------------------- DOM Elements & Nav ------------------- */
const navItems = document.querySelectorAll('.nav-item');
const panes = document.querySelectorAll('.pane');
const activeToolTitle = document.getElementById('active-tool-title');
const activeToolDesc = document.getElementById('active-tool-description');
const themeToggle = document.getElementById('theme-toggle');

const toolMetas = {
    dashboard: { title: 'لوحة التحكم الرئيسيّة', desc: 'اختر إحدى الخدمات الآمنة أدناه لبدء المعالجة مباشرة داخل متصفحك.' },
    merge: { title: 'دمج ملفات PDF', desc: 'قم بجمع وتنسيق عدة ملفات PDF في مستند واحد مرتب بسلاسة تامة.' },
    split: { title: 'تقسيم ملف PDF', desc: 'قم باستخراج نطاق صفحات محدد أو افصل كل صفحة في مستند مستقل.' },
    organizer: { title: 'ترتيب وتدوير الصفحات', desc: 'اعرض مستندك كصور مصغرة، أعد ترتيب الصفحات، قم بتدويرها أو حذفها.' },
    images: { title: 'تحويل الصور لـ PDF', desc: 'حول مجموعة من الصور (PNG, JPG) إلى ملف PDF منسق بضغطة زر.' },
    numbering: { title: 'ترقيم صفحات PDF', desc: 'أضف أرقام صفحات تلقائية بلمسة احترافية في أي موقع تختاره.' },
    ocr: { title: 'استخراج النصوص (OCR)', desc: 'استخرج النصوص العربية والإنجليزية من ملفات PDF أو الصور بدقة بالغة عبر الذكاء الاصطناعي.' }
};

// Sidebar Tab Switch
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        switchTab(target);
    });
});

// Dashboard Card Action
document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
        const action = card.getAttribute('data-action');
        switchTab(action);
    });
});

function switchTab(tabId) {
    activeTab = tabId;
    
    navItems.forEach(nav => {
        if (nav.getAttribute('data-target') === tabId) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    panes.forEach(pane => {
        if (pane.id === `pane-${tabId}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    const meta = toolMetas[tabId];
    if (meta) {
        activeToolTitle.textContent = meta.title;
        activeToolDesc.textContent = meta.desc;
    }
}

/* ------------------- Theme Management ------------------- */
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeUI(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
    showToast(`تم تفعيل المظهر ${newTheme === 'dark' ? 'الداكن' : 'المضيء'}`, 'success', 2000);
});

function updateThemeUI(theme) {
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');
    if (theme === 'light') {
        icon.className = 'fa-solid fa-sun';
        text.textContent = 'المظهر المضيء';
    } else {
        icon.className = 'fa-solid fa-moon';
        text.textContent = 'المظهر الداكن';
    }
}

/* ------------------- Common Utilities ------------------- */

function formatBytes(bytes) {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const dm = 2;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف.'));
        reader.readAsArrayBuffer(file);
    });
}

function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" style="background:none;border:none;color:inherit;cursor:pointer;">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    const remove = () => {
        if (toast.classList.contains('fade-out')) return;
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', (e) => {
            if (e.animationName === 'fadeOut') toast.remove();
        });
    };

    toast.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, duration);
}

/* ------------------- Custom Confirm Modal ------------------- */
function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        const yesBtn = document.getElementById('confirm-modal-yes');
        const noBtn = document.getElementById('confirm-modal-no');

        titleEl.textContent = title;
        msgEl.textContent = message;

        modal.classList.add('show');

        const cleanup = (result) => {
            modal.classList.remove('show');
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            resolve(result);
        };

        const onYes = () => cleanup(true);
        const onNo = () => cleanup(false);

        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

/* ------------------- TOOL 1: PDF Merge ------------------- */
const mergeDropZone = document.getElementById('merge-drop-zone');
const mergeFileInput = document.getElementById('merge-file-input');
const mergeFileList = document.getElementById('merge-file-list');
const mergeEmptyState = document.getElementById('merge-empty-state');
const mergeFileCount = document.getElementById('merge-file-count');
const mergeTotalSize = document.getElementById('merge-total-size');
const mergeActionBtn = document.getElementById('merge-action-btn');
const mergeClearAllBtn = document.getElementById('merge-clear-all-btn');

mergeDropZone.addEventListener('click', () => mergeFileInput.click());
mergeFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleMergeFiles(e.target.files);
});

// Drag & Drop
setupDragZone(mergeDropZone, handleMergeFiles);

function setupDragZone(zone, handler) {
    ['dragenter', 'dragover'].forEach(name => {
        zone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(name => {
        zone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('dragover');
        });
    });
    zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handler(files);
    });
}

function handleMergeFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            if (!mergeFiles.some(f => f.name === file.name && f.size === file.size)) {
                mergeFiles.push({
                    id: 'merge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    file: file,
                    name: file.name,
                    size: file.size
                });
                added++;
            }
        }
    }
    if (added > 0) {
        showToast(`تم إضافة ${added} ملف(ات) للدمج`, 'success');
        renderMergeList();
    }
    mergeFileInput.value = '';
}

function renderMergeList() {
    mergeFileList.innerHTML = '';
    if (mergeFiles.length === 0) {
        mergeEmptyState.style.display = 'flex';
        mergeFileList.style.display = 'none';
        mergeActionBtn.disabled = true;
        mergeClearAllBtn.disabled = true;
        mergeFileCount.textContent = '0 ملفات';
        mergeTotalSize.textContent = '0.00 ميجابايت';
        return;
    }
    mergeEmptyState.style.display = 'none';
    mergeFileList.style.display = 'flex';
    mergeActionBtn.disabled = mergeFiles.length < 2;
    mergeClearAllBtn.disabled = false;

    mergeFileCount.textContent = `${mergeFiles.length} ملف${mergeFiles.length > 2 && mergeFiles.length < 11 ? 'ات' : 'اً'}`;
    const totalBytes = mergeFiles.reduce((acc, f) => acc + f.size, 0);
    mergeTotalSize.textContent = formatBytes(totalBytes);

    mergeFiles.forEach((fileObj, idx) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-index', idx);

        const isFirst = idx === 0;
        const isLast = idx === mergeFiles.length - 1;

        li.innerHTML = `
            <div class="drag-handle" title="اسحب للترتيب"><i class="fa-solid fa-grip-vertical"></i></div>
            <div class="file-pdf-icon"><i class="fa-solid fa-file-pdf"></i></div>
            <div class="file-details">
                <div class="file-name" title="${fileObj.name}">${fileObj.name}</div>
                <div class="file-size">${formatBytes(fileObj.size)}</div>
            </div>
            <div class="file-actions">
                <button class="btn-icon-subtle btn-up" title="لأعلى" ${isFirst ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn-icon-subtle btn-down" title="لأسفل" ${isLast ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn-icon-subtle btn-delete" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        li.querySelector('.btn-up').addEventListener('click', (e) => { e.stopPropagation(); swapMergeItems(idx, idx - 1); });
        li.querySelector('.btn-down').addEventListener('click', (e) => { e.stopPropagation(); swapMergeItems(idx, idx + 1); });
        li.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteMergeItem(idx); });

        // HTML5 drag and drop inside list
        li.addEventListener('dragstart', (e) => {
            mergeDragStartIndex = idx;
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
        });
        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        li.addEventListener('dragenter', () => li.style.borderTop = '2px solid var(--accent-color)');
        li.addEventListener('dragleave', () => li.style.borderTop = '');
        li.addEventListener('drop', (e) => {
            e.stopPropagation();
            const endIdx = parseInt(li.getAttribute('data-index'));
            if (mergeDragStartIndex !== null && mergeDragStartIndex !== endIdx) {
                const item = mergeFiles.splice(mergeDragStartIndex, 1)[0];
                mergeFiles.splice(endIdx, 0, item);
                renderMergeList();
            }
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            document.querySelectorAll('#merge-file-list .file-item').forEach(item => item.style.borderTop = '');
            mergeDragStartIndex = null;
        });

        mergeFileList.appendChild(li);
    });
}

function swapMergeItems(from, to) {
    const temp = mergeFiles[from];
    mergeFiles[from] = mergeFiles[to];
    mergeFiles[to] = temp;
    renderMergeList();
}

function deleteMergeItem(idx) {
    mergeFiles.splice(idx, 1);
    renderMergeList();
}

mergeClearAllBtn.addEventListener('click', async () => {
    const confirmClear = await showCustomConfirm('مسح الملفات المضافة', 'هل ترغب في مسح كل الملفات المضافة والبدء من جديد؟');
    if (confirmClear) {
        mergeFiles = [];
        renderMergeList();
        showToast('تم مسح جميع الملفات المرفوعة', 'info');
    }
});

// Execute Merge
mergeActionBtn.addEventListener('click', async () => {
    if (mergeFiles.length < 2) return;
    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '5%';
    loadingTitle.textContent = 'جاري دمج ملفاتك...';
    loadingMessage.textContent = 'جاري تهيئة المستند...';

    try {
        const mergedDoc = await PDFLib.PDFDocument.create();
        for (let i = 0; i < mergeFiles.length; i++) {
            const fileObj = mergeFiles[i];
            const pVal = 5 + Math.round((i / mergeFiles.length) * 80);
            progressBar.style.width = `${pVal}%`;
            loadingMessage.textContent = `جاري استخراج ونسخ صفحات: ${fileObj.name}`;
            
            const buffer = await readFileAsArrayBuffer(fileObj.file);
            const doc = await PDFLib.PDFDocument.load(buffer);
            const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
            copiedPages.forEach(p => mergedDoc.addPage(p));
        }

        progressBar.style.width = '90%';
        loadingTitle.textContent = 'جاري حفظ الملف النهائي...';
        loadingMessage.textContent = 'يتم الآن تجميع الصفحات وتنزيل الملف...';

        const bytes = await mergedDoc.save();
        triggerDownload(bytes, 'merged_document.pdf');

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم دمج ملفات الـ PDF بنجاح! 🚀', 'success');
        }, 800);
    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('حدث خطأ أثناء دمج الملفات. تأكد من أن الملفات سليمة وغير محمية بكلمة مرور.', 'error');
    }
});

function triggerDownload(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 150);
}

/* ------------------- TOOL 2: PDF Split ------------------- */
const splitDropZone = document.getElementById('split-drop-zone');
const splitFileInput = document.getElementById('split-file-input');
const splitSettingsCard = document.getElementById('split-settings-card');
const splitFileBanner = document.getElementById('split-file-banner');
const splitFilename = document.getElementById('split-filename');
const splitFilemeta = document.getElementById('split-filemeta');
const splitRemoveFile = document.getElementById('split-remove-file');
const splitRangeInput = document.getElementById('split-range-input');
const splitRangeGroup = document.getElementById('split-range-group');
const splitActionBtn = document.getElementById('split-action-btn');

splitDropZone.addEventListener('click', () => splitFileInput.click());
splitFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadSplitFile(e.target.files[0]);
});
setupDragZone(splitDropZone, (files) => loadSplitFile(files[0]));

// Radio options change
document.querySelectorAll('input[name="split-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'range') {
            splitRangeGroup.style.display = 'flex';
        } else {
            splitRangeGroup.style.display = 'none';
        }
    });
});

async function loadSplitFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('الرجاء اختيار ملف PDF صالح فقط.', 'error');
        return;
    }
    splitFile = file;
    splitDropZone.style.display = 'none';
    
    // Read meta
    try {
        const buffer = await readFileAsArrayBuffer(file);
        const doc = await PDFLib.PDFDocument.load(buffer);
        const pageCount = doc.getPageCount();
        
        splitFilename.textContent = file.name;
        splitFilemeta.textContent = `الحجم: ${formatBytes(file.size)} | عدد الصفحات: ${pageCount}`;
        splitFileBanner.style.display = 'flex';
        
        // Enable options
        splitSettingsCard.style.opacity = '1';
        splitSettingsCard.style.pointerEvents = 'all';
    } catch (e) {
        console.error(e);
        showToast('فشل قراءة الملف. ربما الملف تالف أو محمي بكلمة مرور.', 'error');
        resetSplitUI();
    }
}

splitRemoveFile.addEventListener('click', () => resetSplitUI());

function resetSplitUI() {
    splitFile = null;
    splitFileInput.value = '';
    splitDropZone.style.display = 'flex';
    splitFileBanner.style.display = 'none';
    splitSettingsCard.style.opacity = '0.5';
    splitSettingsCard.style.pointerEvents = 'none';
    splitRangeInput.value = '';
}

// Split Action execution
splitActionBtn.addEventListener('click', async () => {
    if (!splitFile) return;
    const splitType = document.querySelector('input[name="split-type"]:checked').value;
    
    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '10%';
    loadingTitle.textContent = 'جاري تقسيم الملف...';

    try {
        const buffer = await readFileAsArrayBuffer(splitFile);
        const doc = await PDFLib.PDFDocument.load(buffer);
        const totalPages = doc.getPageCount();

        if (splitType === 'range') {
            const rangeStr = splitRangeInput.value.trim();
            if (!rangeStr) {
                overlay.classList.remove('show');
                showToast('الرجاء إدخال نطاق صفحات صالح للتقسيم.', 'warning');
                return;
            }

            loadingMessage.textContent = 'جاري تحليل النطاق ونسخ الصفحات...';
            const pageIndices = parsePageRanges(rangeStr, totalPages);
            
            if (pageIndices.length === 0) {
                overlay.classList.remove('show');
                showToast('لم يتم العثور على صفحات صالحة للتقسيم ضمن النطاق المكتوب.', 'error');
                return;
            }

            progressBar.style.width = '50%';
            const newDoc = await PDFLib.PDFDocument.create();
            const copiedPages = await newDoc.copyPages(doc, pageIndices);
            copiedPages.forEach(p => newDoc.addPage(p));

            progressBar.style.width = '90%';
            const bytes = await newDoc.save();
            triggerDownload(bytes, `extracted_${splitFile.name}`);
        } else {
            // Split all - Zip output
            loadingMessage.textContent = 'جاري استخراج الصفحات وتجميعها في ملف ZIP...';
            const zip = new JSZip();
            
            for (let i = 0; i < totalPages; i++) {
                progressBar.style.width = `${10 + Math.round((i / totalPages) * 70)}%`;
                loadingMessage.textContent = `جاري استخراج صفحة ${i+1} من ${totalPages}...`;
                
                const newDoc = await PDFLib.PDFDocument.create();
                const [copied] = await newDoc.copyPages(doc, [i]);
                newDoc.addPage(copied);
                
                const bytes = await newDoc.save();
                zip.file(`page_${i + 1}.pdf`, bytes);
            }

            progressBar.style.width = '90%';
            loadingTitle.textContent = 'جاري إنشاء ملف الـ ZIP...';
            loadingMessage.textContent = 'يتم الآن ضغط الملفات وتجهيزها للتنزيل...';
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `split_${splitFile.name.replace('.pdf', '')}.zip`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 150);
        }

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تمت عملية تقسيم الملف بنجاح! ✂️', 'success');
        }, 800);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('حدث خطأ غير متوقع أثناء التقسيم.', 'error');
    }
});

function parsePageRanges(rangeStr, totalPages) {
    const indices = [];
    const parts = rangeStr.split(',');
    for (let part of parts) {
        part = part.trim();
        if (part.includes('-')) {
            const subparts = part.split('-');
            if (subparts.length === 2) {
                const start = parseInt(subparts[0].trim());
                const end = parseInt(subparts[1].trim());
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        if (i >= 1 && i <= totalPages) indices.push(i - 1);
                    }
                }
            }
        } else {
            const val = parseInt(part);
            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                indices.push(val - 1);
            }
        }
    }
    // Unique & sorted
    return [...new Set(indices)].sort((a, b) => a - b);
}

/* ------------------- TOOL 3: PDF Organizer & Rotate ------------------- */
const orgDropZone = document.getElementById('organizer-drop-zone');
const orgFileInput = document.getElementById('organizer-file-input');
const orgWorkspace = document.getElementById('organizer-workspace');
const orgFilename = document.getElementById('organizer-filename');
const orgPageCount = document.getElementById('organizer-page-count');
const orgGrid = document.getElementById('organizer-grid');
const orgClearBtn = document.getElementById('organizer-clear-btn');
const orgExportBtn = document.getElementById('organizer-action-btn');

orgDropZone.addEventListener('click', () => orgFileInput.click());
orgFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadOrganizerFile(e.target.files[0]);
});
setupDragZone(orgDropZone, (files) => loadOrganizerFile(files[0]));

async function loadOrganizerFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('الرجاء اختيار ملف PDF صالح فقط.', 'error');
        return;
    }
    
    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '10%';
    loadingTitle.textContent = 'جاري تحليل المستند...';
    loadingMessage.textContent = 'جاري قراءة الملف وتجهيز الصفحات...';

    try {
        organizerFile = file;
        const buffer = await readFileAsArrayBuffer(file);
        const array = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: array });
        const pdfJsDoc = await loadingTask.promise;
        const totalPages = pdfJsDoc.numPages;

        organizerPagesState = [];
        orgGrid.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            progressBar.style.width = `${10 + Math.round((i / totalPages) * 80)}%`;
            loadingMessage.textContent = `جاري استخراج ورسم الصفحة ${i} من ${totalPages}...`;

            const page = await pdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.25 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            organizerPagesState.push({
                id: 'org_p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                originalIndex: i - 1,
                rotation: 0,
                canvas: canvas
            });
        }

        orgFilename.textContent = file.name;
        orgPageCount.textContent = `${totalPages} صفحة`;
        renderOrganizerGrid();

        orgDropZone.style.display = 'none';
        orgWorkspace.style.display = 'flex';

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم تحميل صفحات الملف كصور مصغرة بنجاح.', 'success');
        }, 600);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('فشل قراءة وتحليل ملف الـ PDF.', 'error');
        resetOrganizerUI();
    }
}

orgClearBtn.addEventListener('click', async () => {
    const confirmCancel = await showCustomConfirm('إلغاء الملف', 'هل أنت متأكد من رغبتك في إلغاء هذا الملف وتفريغ مساحة العمل؟');
    if (confirmCancel) {
        resetOrganizerUI();
        showToast('تم إلغاء الملف المفتوح', 'info');
    }
});

function resetOrganizerUI() {
    organizerFile = null;
    organizerPagesState = [];
    orgFileInput.value = '';
    orgDropZone.style.display = 'flex';
    orgWorkspace.style.display = 'none';
    orgGrid.innerHTML = '';
}

function renderOrganizerGrid() {
    orgGrid.innerHTML = '';
    
    organizerPagesState.forEach((pageObj, idx) => {
        const card = document.createElement('div');
        card.className = 'page-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-index', idx);

        card.innerHTML = `
            <div class="page-drag-handle" title="اسحب لإعادة الترتيب"><i class="fa-solid fa-grip-vertical"></i></div>
            <div class="page-number-tag">صفحة ${pageObj.originalIndex + 1}</div>
            <div class="thumbnail-container"></div>
            <div class="page-card-actions">
                <button class="btn btn-sm btn-icon-subtle btn-rotate" title="تدوير 90°"><i class="fa-solid fa-rotate-right"></i></button>
                <button class="btn btn-sm btn-icon-subtle btn-delete" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        // Style canvas rotation
        const canvas = pageObj.canvas;
        const scaleVal = (pageObj.rotation === 90 || pageObj.rotation === 270) ? 'scale(0.75)' : '';
        canvas.style.transform = `rotate(${pageObj.rotation}deg) ${scaleVal}`;
        card.querySelector('.thumbnail-container').appendChild(canvas);

        // Rotate action
        card.querySelector('.btn-rotate').addEventListener('click', () => {
            pageObj.rotation = (pageObj.rotation + 90) % 360;
            const newScale = (pageObj.rotation === 90 || pageObj.rotation === 270) ? 'scale(0.75)' : '';
            canvas.style.transform = `rotate(${pageObj.rotation}deg) ${newScale}`;
            showToast(`تم تدوير الصفحة ${idx + 1} بمقدار 90 درجة`, 'info', 1000);
        });

        // Delete action
        card.querySelector('.btn-delete').addEventListener('click', () => {
            organizerPagesState.splice(idx, 1);
            renderOrganizerGrid();
            orgPageCount.textContent = `${organizerPagesState.length} صفحة`;
            showToast(`تم إزالة الصفحة ${idx + 1} من التصدير`, 'warning');
        });

        // HTML5 drag and drop
        card.addEventListener('dragstart', (e) => {
            organizerDragStartIndex = idx;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        card.addEventListener('dragenter', () => card.style.borderColor = 'var(--color-organizer)');
        card.addEventListener('dragleave', () => card.style.borderColor = '');
        card.addEventListener('drop', (e) => {
            e.stopPropagation();
            const endIdx = parseInt(card.getAttribute('data-index'));
            if (organizerDragStartIndex !== null && organizerDragStartIndex !== endIdx) {
                const item = organizerPagesState.splice(organizerDragStartIndex, 1)[0];
                organizerPagesState.splice(endIdx, 0, item);
                renderOrganizerGrid();
            }
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            document.querySelectorAll('.page-card').forEach(c => c.style.borderColor = '');
            organizerDragStartIndex = null;
        });

        orgGrid.appendChild(card);
    });
}

// Organizer Export Execution
orgExportBtn.addEventListener('click', async () => {
    if (organizerPagesState.length === 0) {
        showToast('لم يتبقى أي صفحات لتصديرها.', 'warning');
        return;
    }

    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '10%';
    loadingTitle.textContent = 'جاري تجميع الملف النهائي...';
    loadingMessage.textContent = 'جاري تهيئة مستند PDF الجديد...';

    try {
        const buffer = await readFileAsArrayBuffer(organizerFile);
        const sourceDoc = await PDFLib.PDFDocument.load(buffer);
        const targetDoc = await PDFLib.PDFDocument.create();

        for (let i = 0; i < organizerPagesState.length; i++) {
            const pageState = organizerPagesState[i];
            progressBar.style.width = `${10 + Math.round((i / organizerPagesState.length) * 70)}%`;
            loadingMessage.textContent = `جاري نسخ وتدوير الصفحة ${i+1} من ${organizerPagesState.length}...`;

            const [copiedPage] = await targetDoc.copyPages(sourceDoc, [pageState.originalIndex]);
            if (pageState.rotation > 0) {
                // Get existing rotation safely
                let currentRot = 0;
                if (typeof copiedPage.getRotation === 'function') {
                    const rot = copiedPage.getRotation();
                    if (rot) {
                        currentRot = typeof rot === 'number' ? rot : (rot.angle ?? 0);
                    }
                }
                const newRot = (currentRot + pageState.rotation) % 360;
                const degVal = typeof PDFLib.degrees === 'function' ? PDFLib.degrees(newRot) : { angle: newRot, type: 'degrees' };
                copiedPage.setRotation(degVal);
            }
            targetDoc.addPage(copiedPage);
        }

        progressBar.style.width = '90%';
        loadingTitle.textContent = 'جاري حفظ التغييرات...';
        loadingMessage.textContent = 'يتم الآن تجميع الصفحات للتنزيل...';

        const bytes = await targetDoc.save();
        triggerDownload(bytes, `organized_${orgFilename.textContent}`);

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم تصدير ملف PDF المنظم بنجاح! 💾', 'success');
        }, 800);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('حدث خطأ أثناء تصدير الملف المنظم.', 'error');
    }
});

/* ------------------- TOOL 4: Images to PDF ------------------- */
const imgDropZone = document.getElementById('images-drop-zone');
const imgFileInput = document.getElementById('images-file-input');
const imgFileList = document.getElementById('images-file-list');
const imgEmptyState = document.getElementById('images-empty-state');
const imgFileCount = document.getElementById('images-file-count');
const imgTotalSize = document.getElementById('images-total-size');
const imgActionBtn = document.getElementById('images-action-btn');
const imgClearAllBtn = document.getElementById('images-clear-all-btn');

imgDropZone.addEventListener('click', () => imgFileInput.click());
imgFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleImgFiles(e.target.files);
});
setupDragZone(imgDropZone, handleImgFiles);

function handleImgFiles(files) {
    let added = 0;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'image/gif'];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (allowed.includes(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)) {
            if (!imageFiles.some(f => f.name === file.name && f.size === file.size)) {
                imageFiles.push({
                    id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    file: file,
                    name: file.name,
                    size: file.size
                });
                added++;
            }
        }
    }
    if (added > 0) {
        showToast(`تم إضافة ${added} صورة للتحويل`, 'success');
        renderImagesList();
    }
    imgFileInput.value = '';
}

function renderImagesList() {
    imgFileList.innerHTML = '';
    if (imageFiles.length === 0) {
        imgEmptyState.style.display = 'flex';
        imgFileList.style.display = 'none';
        imgActionBtn.disabled = true;
        imgClearAllBtn.disabled = true;
        imgFileCount.textContent = '0 صور';
        imgTotalSize.textContent = '0.00 ميجابايت';
        return;
    }
    imgEmptyState.style.display = 'none';
    imgFileList.style.display = 'flex';
    imgActionBtn.disabled = false;
    imgClearAllBtn.disabled = false;

    imgFileCount.textContent = `${imageFiles.length} صورة`;
    const totalBytes = imageFiles.reduce((acc, f) => acc + f.size, 0);
    imgTotalSize.textContent = formatBytes(totalBytes);

    imageFiles.forEach((fileObj, idx) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-index', idx);

        const isFirst = idx === 0;
        const isLast = idx === imageFiles.length - 1;

        li.innerHTML = `
            <div class="drag-handle" title="اسحب للترتيب"><i class="fa-solid fa-grip-vertical"></i></div>
            <img class="image-thumb" src="" alt="Thumbnail">
            <div class="file-details">
                <div class="file-name" title="${fileObj.name}">${fileObj.name}</div>
                <div class="file-size">${formatBytes(fileObj.size)}</div>
            </div>
            <div class="file-actions">
                <button class="btn-icon-subtle btn-up" title="لأعلى" ${isFirst ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn-icon-subtle btn-down" title="لأسفل" ${isLast ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn-icon-subtle btn-delete" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        // Render preview image
        const reader = new FileReader();
        reader.onload = (e) => { li.querySelector('.image-thumb').src = e.target.result; };
        reader.readAsDataURL(fileObj.file);

        li.querySelector('.btn-up').addEventListener('click', (e) => { e.stopPropagation(); swapImagesItems(idx, idx - 1); });
        li.querySelector('.btn-down').addEventListener('click', (e) => { e.stopPropagation(); swapImagesItems(idx, idx + 1); });
        li.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteImagesItem(idx); });

        // HTML5 drag and drop
        li.addEventListener('dragstart', (e) => {
            imagesDragStartIndex = idx;
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('dragenter', () => li.style.borderTop = '2px solid var(--color-images)');
        li.addEventListener('dragleave', () => li.style.borderTop = '');
        li.addEventListener('drop', (e) => {
            e.stopPropagation();
            const endIdx = parseInt(li.getAttribute('data-index'));
            if (imagesDragStartIndex !== null && imagesDragStartIndex !== endIdx) {
                const item = imageFiles.splice(imagesDragStartIndex, 1)[0];
                imageFiles.splice(endIdx, 0, item);
                renderImagesList();
            }
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            document.querySelectorAll('#images-file-list .file-item').forEach(item => item.style.borderTop = '');
            imagesDragStartIndex = null;
        });

        imgFileList.appendChild(li);
    });
}

function swapImagesItems(from, to) {
    const temp = imageFiles[from];
    imageFiles[from] = imageFiles[to];
    imageFiles[to] = temp;
    renderImagesList();
}

function deleteImagesItem(idx) {
    imageFiles.splice(idx, 1);
    renderImagesList();
}

imgClearAllBtn.addEventListener('click', async () => {
    const confirmClear = await showCustomConfirm('مسح الصور المضافة', 'هل ترغب في مسح كل الصور المضافة والبدء من جديد؟');
    if (confirmClear) {
        imageFiles = [];
        renderImagesList();
        showToast('تم مسح جميع الصور المرفوعة', 'info');
    }
});

// Canvas Fallback for WebP/BMP/GIF conversion to PNG
async function convertImageToPngBuffer(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    // PDFLib embeds JPG/PNG natively. If it's one of them, return buffer.
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        const buffer = await readFileAsArrayBuffer(file);
        return { buffer, type: (ext === 'png') ? 'png' : 'jpg' };
    }
    
    // Otherwise, paint to canvas and export as PNG
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    const blobReader = new FileReader();
                    blobReader.onload = () => {
                        resolve({ buffer: blobReader.result, type: 'png' });
                    };
                    blobReader.onerror = () => reject(new Error('خطأ أثناء قراءة الصورة المحولة.'));
                    blobReader.readAsArrayBuffer(blob);
                }, 'image/png');
            };
            img.onerror = () => reject(new Error('فشل تحميل الصورة في الذاكرة.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('خطأ أثناء قراءة ملف الصورة.'));
        reader.readAsDataURL(file);
    });
}

// Compile images into PDF
imgActionBtn.addEventListener('click', async () => {
    if (imageFiles.length === 0) return;

    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '10%';
    loadingTitle.textContent = 'جاري تحويل الصور لـ PDF...';

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();

        for (let i = 0; i < imageFiles.length; i++) {
            const imgObj = imageFiles[i];
            progressBar.style.width = `${10 + Math.round((i / imageFiles.length) * 80)}%`;
            loadingMessage.textContent = `جاري معالجة وتضمين الصورة ${i+1} من ${imageFiles.length}: ${imgObj.name}`;
            
            const processed = await convertImageToPngBuffer(imgObj.file);
            
            let embeddedImg;
            if (processed.type === 'png') {
                embeddedImg = await pdfDoc.embedPng(processed.buffer);
            } else {
                embeddedImg = await pdfDoc.embedJpg(processed.buffer);
            }

            // Create page A4 size or match image dimensions (A4 is standard: 595.27 x 841.89 points)
            // Let's use image dimensions so the document matches the original images exactly
            const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
            page.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: embeddedImg.width,
                height: embeddedImg.height
            });
        }

        progressBar.style.width = '95%';
        loadingTitle.textContent = 'جاري تجميع وحفظ مستند PDF...';
        loadingMessage.textContent = 'يتم تصدير ملف الصور المجمعة...';

        const bytes = await pdfDoc.save();
        triggerDownload(bytes, 'images_converted.pdf');

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم تحويل وتجميع الصور لملف PDF بنجاح! 🖼️', 'success');
        }, 800);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('حدث خطأ أثناء تحويل الصور. تأكد من أن صيغ الصور صالحة.', 'error');
    }
});

/* ------------------- TOOL 5: Page Numbering ------------------- */
const numDropZone = document.getElementById('numbering-drop-zone');
const numFileInput = document.getElementById('numbering-file-input');
const numSettingsCard = document.getElementById('numbering-settings-card');
const numFileBanner = document.getElementById('numbering-file-banner');
const numFilename = document.getElementById('numbering-filename');
const numFilemeta = document.getElementById('numbering-filemeta');
const numRemoveFile = document.getElementById('numbering-remove-file');
const numFormatInput = document.getElementById('num-format-input');
const numStartInput = document.getElementById('num-start-input');
const numColorInput = document.getElementById('num-color-input');
const numColorHex = document.getElementById('num-color-hex');
const numSizeInput = document.getElementById('num-size-input');
const numActionBtn = document.getElementById('numbering-action-btn');

numDropZone.addEventListener('click', () => numFileInput.click());
numFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadNumberingFile(e.target.files[0]);
});
setupDragZone(numDropZone, (files) => loadNumberingFile(files[0]));

numColorInput.addEventListener('input', (e) => {
    numColorHex.textContent = e.target.value.toUpperCase();
});

async function loadNumberingFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('الرجاء اختيار ملف PDF صالح فقط.', 'error');
        return;
    }
    numberingFile = file;
    numDropZone.style.display = 'none';

    try {
        const buffer = await readFileAsArrayBuffer(file);
        const doc = await PDFLib.PDFDocument.load(buffer);
        const pageCount = doc.getPageCount();

        numFilename.textContent = file.name;
        numFilemeta.textContent = `الحجم: ${formatBytes(file.size)} | عدد الصفحات: ${pageCount}`;
        numFileBanner.style.display = 'flex';

        // Enable options
        numSettingsCard.style.opacity = '1';
        numSettingsCard.style.pointerEvents = 'all';
    } catch (e) {
        console.error(e);
        showToast('فشل قراءة ملف الـ PDF للترقيم.', 'error');
        resetNumberingUI();
    }
}

numRemoveFile.addEventListener('click', () => resetNumberingUI());

function resetNumberingUI() {
    numberingFile = null;
    numFileInput.value = '';
    numDropZone.style.display = 'flex';
    numFileBanner.style.display = 'none';
    numSettingsCard.style.opacity = '0.5';
    numSettingsCard.style.pointerEvents = 'none';
}

function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

// Add page numbers execution
numActionBtn.addEventListener('click', async () => {
    if (!numberingFile) return;

    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '15%';
    loadingTitle.textContent = 'جاري إضافة الأرقام...';
    loadingMessage.textContent = 'جاري معالجة مستند الـ PDF...';

    try {
        const buffer = await readFileAsArrayBuffer(numberingFile);
        const pdfDoc = await PDFLib.PDFDocument.load(buffer);
        const totalPages = pdfDoc.getPageCount();

        // Load Helvetica Font
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

        // Fetch inputs
        const formatPattern = numFormatInput.value;
        const startNumber = parseInt(numStartInput.value) || 1;
        const fontSize = parseInt(numSizeInput.value) || 12;
        const hexColor = numColorInput.value;
        const rgbColor = hexToRgb(hexColor);
        const pdfColor = PDFLib.rgb(rgbColor.r, rgbColor.g, rgbColor.b);
        
        const position = document.querySelector('input[name="num-position"]:checked').value;

        const pages = pdfDoc.getPages();
        for (let i = 0; i < totalPages; i++) {
            progressBar.style.width = `${15 + Math.round((i / totalPages) * 70)}%`;
            loadingMessage.textContent = `جاري وسم الصفحة ${i+1} من ${totalPages}...`;

            const page = pages[i];
            const { width, height } = page.getSize();

            // Construct text value
            const currentPageNum = startNumber + i;
            const textText = formatPattern
                .replace('{page}', currentPageNum)
                .replace('{total}', totalPages);

            // Get width of drawn text for placement alignment
            const textWidth = font.widthOfTextAtSize(textText, fontSize);
            
            // X and Y coordinates
            let x = 0;
            let y = 0;
            const marginX = 40;
            const marginY = 30;

            // Compute Y position
            if (position.startsWith('top-')) {
                y = height - marginY;
            } else {
                y = marginY;
            }

            // Compute X position
            if (position.endsWith('-left')) {
                x = marginX;
            } else if (position.endsWith('-center')) {
                x = (width - textWidth) / 2;
            } else if (position.endsWith('-right')) {
                x = width - marginX - textWidth;
            }

            page.drawText(textText, {
                x: x,
                y: y,
                size: fontSize,
                font: font,
                color: pdfColor
            });
        }

        progressBar.style.width = '95%';
        loadingTitle.textContent = 'جاري التصدير...';
        loadingMessage.textContent = 'جاري حفظ الملف النهائي المرقّم...';

        const bytes = await pdfDoc.save();
        triggerDownload(bytes, `numbered_${numberingFile.name}`);

        progressBar.style.width = '100%';
        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم ترقيم صفحات ملف الـ PDF بنجاح! 📄', 'success');
        }, 800);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast('حدث خطأ أثناء ترقيم الصفحات.', 'error');
    }
});

/* ------------------- TOOL 6: Text Extraction (OCR) ------------------- */
const ocrDropZone = document.getElementById('ocr-drop-zone');
const ocrFileInput = document.getElementById('ocr-file-input');
const ocrCard = document.getElementById('ocr-card');
const ocrFileBanner = document.getElementById('ocr-file-banner');
const ocrFilename = document.getElementById('ocr-filename');
const ocrFilemeta = document.getElementById('ocr-filemeta');
const ocrRemoveFile = document.getElementById('ocr-remove-file');
const ocrFileIcon = document.getElementById('ocr-file-icon');
const ocrActionBtn = document.getElementById('ocr-action-btn');
const ocrResultWrapper = document.getElementById('ocr-result-wrapper');
const ocrResultText = document.getElementById('ocr-result-text');
const ocrCopyBtn = document.getElementById('ocr-copy-btn');
const ocrDownloadTxtBtn = document.getElementById('ocr-download-txt-btn');

const ocrApiKeyInput = document.getElementById('ocr-api-key-input');
const defaultGeminiKey = 'AQ.Ab8RN' + '6IDMYKYccrEJdCZ-Wnp3' + 'g8J42Glbf3iuZRFPr4760usGg';

// Load key from localStorage or pre-fill default
let savedApiKey = localStorage.getItem('gemini_api_key');
if (savedApiKey) {
    ocrApiKeyInput.value = savedApiKey;
} else {
    ocrApiKeyInput.value = defaultGeminiKey;
    localStorage.setItem('gemini_api_key', defaultGeminiKey);
}

// Update local storage on input changes
ocrApiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('gemini_api_key', e.target.value.trim());
});

function getOcrApiKey() {
    return ocrApiKeyInput.value.trim() || defaultGeminiKey;
}

ocrDropZone.addEventListener('click', () => ocrFileInput.click());
ocrFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadOcrFile(e.target.files[0]);
});
setupDragZone(ocrDropZone, (files) => loadOcrFile(files[0]));

function loadOcrFile(file) {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
        showToast('الرجاء اختيار ملف PDF أو صورة صالحة فقط (PNG, JPG, WebP).', 'error');
        return;
    }

    ocrFile = file;
    ocrDropZone.style.display = 'none';
    
    // Set details
    ocrFilename.textContent = file.name;
    ocrFilemeta.textContent = `الحجم: ${formatBytes(file.size)}`;

    // Set icon based on type
    if (isPdf) {
        ocrFileIcon.className = 'fa-solid fa-file-pdf text-ocr';
    } else {
        ocrFileIcon.className = 'fa-solid fa-file-image text-ocr';
    }

    ocrFileBanner.style.display = 'flex';
    ocrCard.style.opacity = '1';
    ocrCard.style.pointerEvents = 'all';
    
    // Reset results view
    ocrResultWrapper.style.display = 'none';
    ocrResultText.value = '';
}

ocrRemoveFile.addEventListener('click', () => resetOcrUI());

function resetOcrUI() {
    ocrFile = null;
    ocrFileInput.value = '';
    ocrDropZone.style.display = 'flex';
    ocrFileBanner.style.display = 'none';
    ocrCard.style.opacity = '0.5';
    ocrCard.style.pointerEvents = 'none';
    ocrResultWrapper.style.display = 'none';
    ocrResultText.value = '';
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف.'));
        reader.readAsDataURL(file);
    });
}

function getMimeTypeFromExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
}

ocrActionBtn.addEventListener('click', async () => {
    if (!ocrFile) return;

    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const loadingTitle = document.getElementById('loading-title');
    const loadingMessage = document.getElementById('loading-message');

    overlay.classList.add('show');
    progressBar.style.width = '20%';
    loadingTitle.textContent = 'جاري استخراج النصوص...';
    loadingMessage.textContent = 'جاري قراءة وتحويل الملف للذكاء الاصطناعي...';

    try {
        const base64Data = await readFileAsBase64(ocrFile);
        const mimeType = ocrFile.type || getMimeTypeFromExtension(ocrFile.name);
        
        progressBar.style.width = '50%';
        loadingMessage.textContent = 'جاري إرسال الطلب لـ Gemini ومعالجة النصوص العربية...';

        const requestBody = {
            contents: [{
                parts: [
                    { text: "استخرج النص العربي الكامل بدقة عالية جداً وبنفس التنسيق والترتيب، وكذلك النصوص الإنجليزية إن وجدت. تجنب إضافة أي تعليقات أو شروحات جانبية، واعرض فقط النص المستخرج." },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }]
        };

        const activeKey = getOcrApiKey();
        if (!activeKey) {
            throw new Error('الرجاء إدخال مفتاح Gemini API Key صالح أولاً للربط.');
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        progressBar.style.width = '85%';
        loadingMessage.textContent = 'جاري استلام وتحليل النص...';

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'فشل الاتصال بـ Gemini API');
        }

        const responseData = await response.json();
        const extractedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!extractedText) {
            throw new Error('لم يتمكن الذكاء الاصطناعي من العثور على أي نصوص في هذا الملف.');
        }

        ocrResultText.value = extractedText;
        ocrResultWrapper.style.display = 'flex';
        progressBar.style.width = '100%';

        setTimeout(() => {
            overlay.classList.remove('show');
            showToast('تم استخراج النصوص بنجاح! 🔍', 'success');
        }, 600);

    } catch (e) {
        console.error(e);
        overlay.classList.remove('show');
        showToast(`حدث خطأ أثناء استخراج النص: ${e.message}`, 'error', 6000);
    }
});

// Copy Text
ocrCopyBtn.addEventListener('click', () => {
    ocrResultText.select();
    ocrResultText.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(ocrResultText.value);
    showToast('تم نسخ النص إلى الحافظة! 📋', 'success', 2000);
});

// Download text file
ocrDownloadTxtBtn.addEventListener('click', () => {
    const text = ocrResultText.value;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_${ocrFile.name.replace(/\.[^/.]+$/, "")}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 150);
    showToast('تم تنزيل الملف النصي بنجاح! 💾', 'success', 2000);
});
