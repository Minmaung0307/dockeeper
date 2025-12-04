// --- FIREBASE CONFIGURATION (REPLACE WITH YOUR OWN KEYS) ---
const firebaseConfig = {
  apiKey: "AIzaSyBArptg97-fCtChYurieBYb29c7B6jo_EU",
  authDomain: "dockeeper-mm.firebaseapp.com",
  projectId: "dockeeper-mm",
  storageBucket: "dockeeper-mm.firebasestorage.app",
  messagingSenderId: "143383847530",
  appId: "1:143383847530:web:b210a1a04b9b0a6eb36013",
  measurementId: "G-5XN06T0TJN",
};

// --- CLOUDINARY CONFIG (ဒီနေရာမှာ ဖြည့်ပါ) ---
const CLOUD_NAME = "dymzzbrl9"; // Cloudinary Dashboard မှ Cloud Name
const UPLOAD_PRESET = "lbyxjwla"; // Settings > Upload > Preset Name (Unsigned ဖြစ်ရမည်)

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentCategory = "all";
let currentFolder = null;
let isEditMode = false;
let allDocsCache = [];

// --- PWA SERVICE WORKER REGISTRATION (NEW) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => console.log("Service Worker registered", reg))
      .catch((err) => console.log("Service Worker failed", err));
  });
}

// --- AUTH ---
function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => alert(err.message));
}
function logout() {
  auth.signOut();
  location.reload();
}

// --- AUTH STATE LISTENER (MODIFIED FOR WHITELIST) ---
auth.onAuthStateChanged((user) => {
  if (user) {
    // Login ဝင်လာရင် Whitelist ထဲမှာ ရှိမရှိ အရင်စစ်မယ်
    const userEmail = user.email; // Google Login Email

    db.collection("whitelist")
      .doc(userEmail)
      .get()
      .then((doc) => {
        if (doc.exists) {
          // ရှိတယ်ဆိုမှ App ကို ပေးသုံးမယ်
          currentUser = user;
          document.getElementById("loginScreen").style.display = "none";
          document.getElementById("appContainer").style.display = "flex";
          document.getElementById("userPhoto").src = user.photoURL;
          document.getElementById("userName").textContent = user.displayName;
          loadDocuments();
        } else {
          // မရှိရင် ပြန်ကန်ထုတ်မယ်
          alert(
            "Access Denied!\nAdmin ခွင့်ပြုချက်မရသေးပါ။\n(Email: " +
              userEmail +
              ")"
          );
          auth.signOut();
        }
      })
      .catch((error) => {
        console.error("Error checking whitelist:", error);
        // Rule ကြောင့် error တက်ရင်လည်း ပိတ်ပင်မယ်
        alert("Access Denied! (Permission Error)");
        auth.signOut();
      });
  } else {
    // Logout ဖြစ်သွားရင် Login screen ပြမယ်
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("appContainer").style.display = "none";
    currentUser = null;
  }
});

// --- NAVIGATION ---
function filterCategory(category) {
  currentCategory = category;
  currentFolder = null;
  document
    .querySelectorAll(".nav-links li")
    .forEach((li) => li.classList.remove("active"));
  document.getElementById(`nav-${category}`)?.classList.add("active");

  const titles = {
    all: "All Documents",
    housing: "Housing",
    business: "Business Documents",
    education: "Education & School",
    travel: "Travel",
    id: "ID & Legal",
    tax: "Tax",
    medical: "Medical",
    auto: "Auto",
    media: "Photo / Media",
    other: "Others",
  };
  document.getElementById("pageTitle").textContent =
    titles[category] || "Documents";
  renderView();
}

function openFolder(folderName) {
  currentFolder = folderName;
  renderView();
}

function exitFolder() {
  currentFolder = null;
  renderView();
}

// --- SEARCH LOGIC (NEW) ---
document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  const grid = document.getElementById("fileGrid");
  const folderStatus = document.getElementById("folderStatus");
  const backBtn = document.getElementById("btnBack");

  // 1. If search is empty, go back to normal view
  if (!term) {
    renderView();
    return;
  }

  // 2. Hide Folder UI elements while searching
  folderStatus.style.display = "none";
  backBtn.style.display = "none";
  grid.innerHTML = "";

  // 3. Filter from ALL docs (Global Search)
  // ရှာတဲ့အခါ Category မရွေးဘဲ အကုန်လုံးထဲက ရှာပေးပါမယ်
  const results = allDocsCache.filter((doc) => {
    const titleMatch = doc.title.toLowerCase().includes(term);
    const folderMatch = doc.folder && doc.folder.toLowerCase().includes(term);
    const categoryMatch = doc.category.toLowerCase().includes(term);
    return titleMatch || folderMatch || categoryMatch;
  });

  // 4. Render Results
  if (results.length === 0) {
    grid.innerHTML = `
            <div style="text-align:center; width:100%; grid-column: 1 / -1; color:#888; margin-top:20px;">
                <i class="fas fa-search" style="font-size:30px; margin-bottom:10px;"></i><br>
                No documents found for "${term}"
            </div>`;
  } else {
    results.forEach((doc) => {
      grid.appendChild(createFileCard(doc));
    });
  }
});

// --- HELP MODAL (NEW) ---
function openHelpModal() {
  document.getElementById("helpModal").style.display = "flex";
}

// --- DATA LOGIC ---
function loadDocuments() {
  if (!currentUser) return;
  document.getElementById("loading").style.display = "block";

  db.collection("documents")
    .where("uid", "==", currentUser.uid)
    .onSnapshot((snapshot) => {
      allDocsCache = [];
      snapshot.forEach((doc) => {
        allDocsCache.push({ id: doc.id, ...doc.data() });
      });
      document.getElementById("loading").style.display = "none";
      renderView();
      updateFolderList();
    });
}

function renderView() {
  const grid = document.getElementById("fileGrid");
  const backBtn = document.getElementById("btnBack");
  const folderStatus = document.getElementById("folderStatus");
  grid.innerHTML = "";

  let docs =
    currentCategory === "all"
      ? allDocsCache
      : allDocsCache.filter((d) => d.category === currentCategory);

  if (currentFolder) {
    backBtn.style.display = "flex";
    folderStatus.style.display = "block";
    document.getElementById("catName").textContent =
      currentCategory.toUpperCase();
    document.getElementById("folderNameDisplay").textContent = currentFolder;

    const folderDocs = docs.filter((d) => d.folder === currentFolder);
    if (folderDocs.length === 0)
      grid.innerHTML = '<p style="color:#888;">Empty folder.</p>';
    else folderDocs.forEach((d) => grid.appendChild(createFileCard(d)));
  } else {
    backBtn.style.display = "none";
    folderStatus.style.display = "none";

    const folders = [...new Set(docs.map((d) => d.folder).filter((f) => f))];

    folders.forEach((folderName) => {
      const fCard = document.createElement("div");
      fCard.className = "folder-card";
      fCard.onclick = () => openFolder(folderName);
      fCard.innerHTML = `
                <i class="fas fa-folder folder-icon"></i>
                <div class="folder-name">${folderName}</div>
                <small style="color:#888;">${
                  docs.filter((d) => d.folder === folderName).length
                } files</small>
            `;
      grid.appendChild(fCard);
    });

    const looseFiles = docs.filter((d) => !d.folder);
    looseFiles.forEach((d) => grid.appendChild(createFileCard(d)));

    if (folders.length === 0 && looseFiles.length === 0) {
      grid.innerHTML = '<p style="color:#888;">No documents found.</p>';
    }
  }
}

// --- 1. CREATE FILE CARD (Updated with Download Btn) ---
function createFileCard(data) {
  const div = document.createElement("div");
  div.className = "file-card";

  let previewHtml = "";
  const fileType = data.fileType || "";

  // Cloudinary Trick: PDF Preview
  let thumbUrl = data.url;
  if (fileType.includes("pdf") && data.url.includes("cloudinary.com")) {
    thumbUrl = data.url.substr(0, data.url.lastIndexOf(".")) + ".jpg";
    previewHtml = `<img src="${thumbUrl}" loading="lazy" style="object-fit: cover; object-position: top;">`;
  } else if (fileType.startsWith("image/")) {
    previewHtml = `<img src="${data.url}" loading="lazy">`;
  } else if (fileType.startsWith("video/")) {
    previewHtml = `<i class="fas fa-video" style="color: #4F46E5;"></i>`;
  } else {
    previewHtml = `<i class="fas fa-file-alt"></i>`;
  }

  div.innerHTML = `
    <div class="card-actions">
        <!-- Download Button (Title ပါ ထည့်ပေးလိုက်သည်) -->
        <button class="action-btn btn-download" title="Download" onclick="event.stopPropagation(); downloadFile('${
          data.url
        }', '${data.title.replace(/'/g, "\\'")}')">
            <i class="fas fa-download"></i>
        </button>
        
        <!-- Edit & Delete buttons remain same... -->
        <button class="action-btn btn-edit" title="Edit" onclick="event.stopPropagation(); openEditModal('${
          data.id
        }', '${data.title}', '${data.category}', '${data.folder || ""}')">
            <i class="fas fa-pen"></i>
        </button>
        <button class="action-btn btn-delete" title="Delete" onclick="event.stopPropagation(); deleteDocument('${
          data.id
        }')">
            <i class="fas fa-trash"></i>
        </button>
    </div>
    
    <!-- View Click Area remains same... -->
    <div onclick="viewFile('${data.url}', '${fileType}', '${data.title.replace(
    /'/g,
    "\\'"
  )}')" style="cursor: pointer;">
        <div class="preview-box">${previewHtml}</div>
        <div class="card-info">
            <div class="card-title">${data.title}</div>
            <div class="card-meta">
                <span>${data.date}</span>
                <span style="font-size:0.7rem; background:#eee; padding:2px 6px; border-radius:4px;">${
                  data.category
                }</span>
            </div>
        </div>
    </div>
`;
  return div;
}

// --- DOWNLOAD FUNCTION (Final Fix - Clean URL) ---
function downloadFile(url, filename) {
    // 1. URL ကို သန့်ရှင်းရေးလုပ်မယ် (Error တက်စေတဲ့ fl_attachment ကို ဖယ်မယ်)
    let cleanUrl = url.replace('/fl_attachment', '');

    // 2. Debugging (စစ်ဆေးရန်)
    console.log("Opening URL:", cleanUrl);

    // 3. Tab အသစ်မှာ ဖွင့်မယ် (ဒါဆိုရင် Browser က Download လုပ်မလား View မလား ဆုံးဖြတ်ပါလိမ့်မယ်)
    // Cloudinary 401 Error မတက်တော့ပါဘူး
    window.open(cleanUrl, '_blank');
}

// --- VIEW FILE FUNCTION (Cloudinary Image Mode) ---
let currentPdfPage = 1;
let currentPdfUrl = "";

function viewFile(url, type, title) {
    const modal = document.getElementById('viewModal');
    const contentDiv = document.getElementById('viewContent');
    const titleEl = document.getElementById('viewTitle'); // Ensure this ID exists in HTML

    // Reset
    contentDiv.innerHTML = '';
    // If you don't have viewTitle in HTML, remove the next line
    if(document.getElementById('viewTitle')) document.getElementById('viewTitle').textContent = title || "Document Viewer";
    
    modal.style.display = 'flex';
    
    // Store global vars for pagination
    currentPdfPage = 1;
    currentPdfUrl = url;

    // --- 1. IMAGE ---
    if (type.startsWith('image/')) {
        contentDiv.innerHTML = `<img src="${url}" style="max-width: 100%; height: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">`;
        return;
    }

    // --- 2. PDF (Cloudinary Page-by-Page View) ---
    if (type.includes('pdf')) {
        // Check if it's Cloudinary
        if (!url.includes('cloudinary.com')) {
            // Fallback for non-cloudinary
            contentDiv.innerHTML = `<div style="padding:20px; text-align:center;"><p>Preview not available for this PDF type.</p><button onclick="downloadFile('${url}')" style="background:#4F46E5; color:white; padding:10px; border:none; border-radius:5px;">Download PDF</button></div>`;
            return;
        }

        renderPdfPage();
        return;
    }

    // --- 3. VIDEO ---
    if (type.startsWith('video/')) {
        contentDiv.innerHTML = `
            <video controls style="max-width: 100%; max-height: 100%;">
                <source src="${url}" type="${type}">
                Your browser does not support video.
            </video>`;
        return;
    }

    // --- 4. OTHER ---
    contentDiv.innerHTML = `
        <div style="color:#333; padding:20px; text-align:center;">
            <i class="fas fa-file-download fa-3x"></i><br><br>
            <button onclick="downloadFile('${url}', '${title.replace(/'/g, "\\'")}')" style="background:#4F46E5; color:white; padding:10px 20px; text-decoration:none; border:none; border-radius:5px; cursor:pointer;">
                Download File
            </button>
        </div>`;
}

// Helper to render PDF pages as Images
function renderPdfPage() {
    const contentDiv = document.getElementById('viewContent');
    
    // Construct Current Page URL
    let pageUrl = currentPdfUrl;
    if (pageUrl.includes('/upload/')) {
        pageUrl = pageUrl.replace('/upload/', `/upload/pg_${currentPdfPage}/`);
    }
    if (pageUrl.toLowerCase().endsWith('.pdf')) {
        pageUrl = pageUrl.substr(0, pageUrl.lastIndexOf(".")) + ".jpg";
    }

    contentDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; height:100%; background:#f0f0f0;">
            
            <!-- Controls (Top) -->
            <div style="background:#333; width:100%; padding:10px; display:flex; justify-content:center; gap:20px; align-items:center; color:white; flex-shrink:0;">
                
                <!-- Prev Button -->
                <button onclick="changePage(-1)" id="btnPrev" 
                    style="background:#555; color:white; border:none; width:40px; height:30px; border-radius:5px; cursor:pointer; font-size:18px; opacity: ${currentPdfPage === 1 ? '0.5' : '1'};" 
                    ${currentPdfPage === 1 ? 'disabled' : ''}>❮</button>
                
                <span style="font-weight:bold;">Page ${currentPdfPage}</span>
                
                <!-- Next Button (Initially Disabled, checked by JS) -->
                <button onclick="changePage(1)" id="btnNext" 
                    style="background:#555; color:white; border:none; width:40px; height:30px; border-radius:5px; cursor:not-allowed; font-size:18px; opacity: 0.5;" 
                    disabled>❯</button>
            </div>

            <!-- Image Display -->
            <div style="flex:1; overflow:auto; width:100%; display:flex; justify-content:center; padding:10px;">
                <img id="pdfPageImg" src="${pageUrl}" style="max-width:100%; height:auto; object-fit:contain; box-shadow:0 4px 10px rgba(0,0,0,0.2);" 
                     onerror="handlePdfError(this)">
            </div>
            
            <!-- Download Original -->
            <div style="padding:10px; text-align:center;">
                 <a href="javascript:void(0)" onclick="downloadFile('${currentPdfUrl}')" style="color:#4F46E5; text-decoration:none; font-size:14px; font-weight:bold;">
                    <i class="fas fa-download"></i> Download Full PDF
                </a>
            </div>
        </div>
    `;

    // *** MAGIC TRICK: Check if next page exists ***
    checkNextPageExists(currentPdfPage + 1);
}

function checkNextPageExists(nextPageNum) {
    let testUrl = currentPdfUrl;
    if (testUrl.includes('/upload/')) {
        testUrl = testUrl.replace('/upload/', `/upload/pg_${nextPageNum}/`);
    }
    if (testUrl.toLowerCase().endsWith('.pdf')) {
        testUrl = testUrl.substr(0, testUrl.lastIndexOf(".")) + ".jpg";
    }

    // နောက်ကွယ်မှာ Image ကို လှမ်းဆွဲကြည့်တယ်
    const img = new Image();
    img.onload = function() {
        // ပုံရှိတယ်ဆိုရင် Next Button ကို ဖွင့်ပေးမယ်
        const btnNext = document.getElementById('btnNext');
        if (btnNext) {
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.style.cursor = 'pointer';
            btnNext.style.background = '#2563EB'; // Blue color to indicate active
        }
    };
    img.onerror = function() {
        // ပုံမရှိဘူး (စာမျက်နှာကုန်ပြီ) ဆိုရင် Next Button ပိတ်ထားမြဲ ပိတ်ထားမယ်
        // ဘာမှလုပ်စရာမလို (Already disabled in HTML)
    };
    img.src = testUrl;
}

function changePage(delta) {
    if (currentPdfPage + delta < 1) return;
    currentPdfPage += delta;
    renderPdfPage();
}

function handlePdfError(img) {
    // ပုံမှန်အားဖြင့် ဒီ Error က မတက်တော့ပါဘူး (Next button ပိတ်ထားလို့)
    // ဒါပေမယ့် တက်ခဲ့ရင်တောင် Alert မပြတော့ဘဲ စာတန်းပဲ ပြပါမယ်
    img.parentNode.innerHTML = `<div style="text-align:center; padding:20px; color:red;">Cannot load page.<br><br> <button onclick="downloadFile('${currentPdfUrl}')">Download PDF</button></div>`;
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
    document.getElementById('viewContent').innerHTML = '';
}

// --- SAVE & UPLOAD (Multiple Files Supported) ---
async function saveDocument() {
  const titleBase = document.getElementById("docTitle").value;
  const category = document.getElementById("docCategory").value;
  const folder = document.getElementById("docFolder").value.trim();
  const fileInput = document.getElementById("docFile");
  const saveBtn = document.getElementById("btnSave");
  const progressDiv = document.getElementById("uploadProgress");
  const bar = document.getElementById("progressBar");
  const progressText = progressDiv.querySelector("small"); // To update text

  if (!titleBase) return alert("Title is required!");

  // --- CASE 1: EDIT MODE (Update single doc info) ---
  if (isEditMode) {
    saveBtn.disabled = true;
    const docId = document.getElementById("editDocId").value;
    db.collection("documents")
      .doc(docId)
      .update({
        title: titleBase,
        category: category,
        folder: folder,
      })
      .then(() => {
        closeModal();
        saveBtn.disabled = false;
      });
    return;
  }

  // --- CASE 2: NEW UPLOAD (Multiple Files) ---
  if (fileInput.files.length === 0)
    return alert("Please select at least one file!");

  saveBtn.disabled = true;
  progressDiv.style.display = "block";
  bar.style.width = "0%";

  const files = Array.from(fileInput.files);
  let completedCount = 0;
  const totalFiles = files.length;

  // Helper function to upload ONE file
  const uploadOneFile = async (file, index) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      // Upload to Cloudinary
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      // Save Metadata to Firestore
      // If multiple files, append index to title (e.g., "Trip Photo (1)", "Trip Photo (2)")
      const finalTitle =
        totalFiles > 1 ? `${titleBase} (${index + 1})` : titleBase;

      await db.collection("documents").add({
        uid: currentUser.uid,
        title: finalTitle,
        category: category,
        folder: folder,
        url: data.secure_url,
        storagePath: data.public_id,
        fileType: file.type,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(), // For sorting
      });

      // Update Progress UI
      completedCount++;
      const percentage = (completedCount / totalFiles) * 100;
      bar.style.width = percentage + "%";
      progressText.textContent = `Uploading ${completedCount} of ${totalFiles} files...`;
    } catch (err) {
      console.error(err);
      alert(`Failed to upload ${file.name}: ${err.message}`);
    }
  };

  // Run all uploads
  // We map all files to promises and wait for all to finish
  try {
    await Promise.all(files.map((file, index) => uploadOneFile(file, index)));

    // All done
    closeModal();
    saveBtn.disabled = false;
    progressDiv.style.display = "none";
    progressText.textContent = "Uploading..."; // Reset text

    // Clear input
    document.getElementById("docTitle").value = "";
    document.getElementById("docFile").value = "";
  } catch (error) {
    console.error("Batch upload error:", error);
    saveBtn.disabled = false;
  }
}

function deleteDocument(id) {
  if (confirm("Delete this document?"))
    db.collection("documents").doc(id).delete();
}

function openModal(mode) {
  if (mode === "add") {
    isEditMode = false;
    document.getElementById("modalTitle").textContent = "Add New File";
    document.getElementById("docTitle").value = "";
    document.getElementById("docCategory").value =
      currentCategory === "all" ? "housing" : currentCategory;
    document.getElementById("docFolder").value = currentFolder || "";
    document.getElementById("docFile").value = "";
    document.getElementById("fileInputGroup").style.display = "block";
  }
  updateFolderList();
  document.getElementById("modalOverlay").style.display = "flex";
}

function openEditModal(id, title, category, folder) {
  isEditMode = true;
  document.getElementById("modalTitle").textContent = "Edit Info";
  document.getElementById("editDocId").value = id;
  document.getElementById("docTitle").value = title;
  document.getElementById("docCategory").value = category;
  document.getElementById("docFolder").value = folder;
  document.getElementById("fileInputGroup").style.display = "none";
  updateFolderList();
  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

function updateFolderList() {
  const cat = document.getElementById("docCategory").value;
  const list = document.getElementById("folderSuggestions");
  list.innerHTML = "";
  const existingFolders = [
    ...new Set(
      allDocsCache
        .filter((d) => d.category === cat)
        .map((d) => d.folder)
        .filter((f) => f)
    ),
  ];
  existingFolders.forEach((f) => {
    const option = document.createElement("option");
    option.value = f;
    list.appendChild(option);
  });
}
