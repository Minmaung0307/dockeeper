// --- FIREBASE CONFIGURATION (REPLACE WITH YOUR OWN KEYS) ---
const firebaseConfig = {
    apiKey: "AIzaSyBArptg97-fCtChYurieBYb29c7B6jo_EU",
  authDomain: "dockeeper-mm.firebaseapp.com",
  projectId: "dockeeper-mm",
  storageBucket: "dockeeper-mm.firebasestorage.app",
  messagingSenderId: "143383847530",
  appId: "1:143383847530:web:b210a1a04b9b0a6eb36013",
  measurementId: "G-5XN06T0TJN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- STATE MANAGEMENT ---
let currentUser = null;
let currentCategory = 'all';
let isEditMode = false;

// --- AUTHENTICATION ---
function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => alert(error.message));
}

function logout() {
    auth.signOut();
    location.reload();
}

// Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('userPhoto').src = user.photoURL;
        document.getElementById('userName').textContent = user.displayName;
        loadDocuments();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
});

// --- UI LOGIC ---
function filterCategory(category) {
    currentCategory = category;
    
    // Update active class
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(`nav-${category}`).classList.add('active');
    
    // Update Title
    const titles = { 'all': 'All Documents', 'id': 'ID & Legal', 'tax': 'Tax & W2', 'medical': 'Medical', 'auto': 'Automobile', 'media': 'Photos & Videos', 'other': 'Others' };
    document.getElementById('pageTitle').textContent = titles[category];

    loadDocuments();
}

// --- CRUD OPERATIONS ---

// 1. READ (Load Docs)
function loadDocuments() {
    if (!currentUser) return;
    
    const grid = document.getElementById('fileGrid');
    const spinner = document.getElementById('loading');
    grid.innerHTML = '';
    spinner.style.display = 'block';

    let query = db.collection('documents').where('uid', '==', currentUser.uid);
    
    if (currentCategory !== 'all') {
        query = query.where('category', '==', currentCategory);
    }

    // Order by date (requires index in firestore, keeping simple for now)
    query.get().then((snapshot) => {
        spinner.style.display = 'none';
        if (snapshot.empty) {
            grid.innerHTML = '<p style="color:#888;">No documents found.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const card = createFileCard(doc.id, data);
            grid.appendChild(card);
        });
    });
}

// Helper: Create HTML Card
function createFileCard(id, data) {
    const div = document.createElement('div');
    div.className = 'file-card';
    
    // Determine Preview Icon/Image
    let previewHtml = '';
    const fileType = data.fileType || '';
    
    if (fileType.startsWith('image/')) {
        previewHtml = `<img src="${data.url}" loading="lazy">`;
    } else if (fileType.startsWith('video/')) {
        previewHtml = `<video src="${data.url}" muted></video>`; // Thumb only
    } else if (fileType.includes('pdf')) {
        previewHtml = `<i class="fas fa-file-pdf" style="color: #ff4d4d;"></i>`;
    } else if (fileType.includes('word') || fileType.includes('document')) {
        previewHtml = `<i class="fas fa-file-word" style="color: #2b579a;"></i>`;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
        previewHtml = `<i class="fas fa-file-powerpoint" style="color: #d24726;"></i>`;
    } else {
        previewHtml = `<i class="fas fa-file-alt"></i>`;
    }

    div.innerHTML = `
        <div class="card-actions">
            <button class="action-btn btn-edit" onclick="openEditModal('${id}', '${data.title}', '${data.category}')">
                <i class="fas fa-pen"></i>
            </button>
            <button class="action-btn btn-delete" onclick="deleteDocument('${id}', '${data.storagePath}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <a href="${data.url}" target="_blank" style="text-decoration:none;">
            <div class="preview-box">${previewHtml}</div>
            <div class="card-info">
                <div class="card-title">${data.title}</div>
                <div class="card-meta">
                    <span>${data.date}</span>
                    <span style="text-transform:uppercase; font-size:0.7rem; background:#eee; padding:2px 6px; border-radius:4px;">${data.category}</span>
                </div>
            </div>
        </a>
    `;
    return div;
}

// 2. CREATE / UPLOAD
// --- CLOUDINARY CONFIG (ဒီနေရာမှာ ဖြည့်ပါ) ---
const CLOUD_NAME = "dymzzbrl9"; // Cloudinary Dashboard မှ Cloud Name
const UPLOAD_PRESET = "lbyxjwla"; // Settings > Upload > Preset Name (Unsigned ဖြစ်ရမည်)

// 2. CREATE / UPLOAD (Modified for Cloudinary)
function saveDocument() {
    const title = document.getElementById('docTitle').value;
    const category = document.getElementById('docCategory').value;
    const fileInput = document.getElementById('docFile');
    const saveBtn = document.getElementById('btnSave');
    const progressBar = document.getElementById('uploadProgress');
    const bar = document.getElementById('progressBar');

    if (!title) return alert("Title is required!");
    if (fileInput.files.length === 0 && !isEditMode) {
        return alert("Please select a file!");
    }

    saveBtn.disabled = true;

    // UPDATE EXISTING (Edit Mode) - No file change logic simplified for now
    if (isEditMode) {
        const docId = document.getElementById('editDocId').value;
        db.collection('documents').doc(docId).update({
            title: title,
            category: category
        }).then(() => {
            closeModal();
            loadDocuments();
            saveBtn.disabled = false;
        });
        return;
    }

    // UPLOAD TO CLOUDINARY
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Optional: Keep files organized by user folder in Cloudinary
    formData.append('folder', `dockeeper/${currentUser.uid}`); 

    progressBar.style.display = 'block';
    bar.style.width = '30%'; // Fake progress start

    // Determine resource type (image, video, raw)
    let resourceType = 'auto'; // Auto detect is best usually
    
    // Cloudinary API Endpoint
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error.message);
        }

        bar.style.width = '100%';

        // Upload Success -> Save Metadata to Firebase Firestore
        // Note: Cloudinary returns 'secure_url'
        db.collection('documents').add({
            uid: currentUser.uid,
            title: title,
            category: category,
            url: data.secure_url, 
            storagePath: data.public_id, // Save ID to delete later if needed
            fileType: file.type, // MIME type from browser
            date: new Date().toLocaleDateString()
        }).then(() => {
            closeModal();
            loadDocuments();
            saveBtn.disabled = false;
            progressBar.style.display = 'none';
        });
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Upload failed: " + error.message);
        saveBtn.disabled = false;
        progressBar.style.display = 'none';
    });
}

// 3. EDIT (Setup Modal)
function openEditModal(id, title, category) {
    isEditMode = true;
    document.getElementById('modalTitle').textContent = "Edit Document Info";
    document.getElementById('editDocId').value = id;
    document.getElementById('docTitle').value = title;
    document.getElementById('docCategory').value = category;
    
    // Hide file input in edit mode (simplification)
    document.getElementById('fileInputGroup').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'flex';
}

// 4. DELETE
// function deleteDocument(id, storagePath) {
//     if (!confirm("Are you sure you want to delete this file permanently?")) return;

//     // Delete from Firestore
//     db.collection('documents').doc(id).delete().then(() => {
//         // Delete from Storage
//         if (storagePath) {
//             storage.ref(storagePath).delete().catch(err => console.log("Storage delete error (might be okay):", err));
//         }
//         loadDocuments();
//     }).catch(error => alert("Error removing document: " + error.message));
// }
// 4. DELETE (Updated for Firestore only - Cloudinary delete requires backend usually)
function deleteDocument(id, storagePath) {
    if (!confirm("Are you sure you want to delete this file info?")) return;

    // Note: Deleting from Cloudinary directly from frontend is risky/blocked by default without signature.
    // For this free version, we will just delete the Reference from Firebase.
    // The file stays in Cloudinary (You can clean it manually later or setup a backend).
    
    db.collection('documents').doc(id).delete().then(() => {
        loadDocuments();
    }).catch(error => alert("Error removing document: " + error.message));
}

// --- MODAL HELPERS ---
function openModal(mode) {
    if (mode === 'add') {
        isEditMode = false;
        document.getElementById('modalTitle').textContent = "Add New File";
        document.getElementById('docTitle').value = '';
        document.getElementById('docFile').value = '';
        document.getElementById('fileInputGroup').style.display = 'block';
    }
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}