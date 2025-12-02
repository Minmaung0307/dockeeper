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

// --- CLOUDINARY CONFIG (ဒီနေရာမှာ ဖြည့်ပါ) ---
const CLOUD_NAME = "dymzzbrl9"; // Cloudinary Dashboard မှ Cloud Name
const UPLOAD_PRESET = "lbyxjwla"; // Settings > Upload > Preset Name (Unsigned ဖြစ်ရမည်)

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentCategory = 'all';
let currentFolder = null; 
let isEditMode = false;
let allDocsCache = [];

// --- PWA SERVICE WORKER REGISTRATION (NEW) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker failed', err));
    });
}

// --- AUTH ---
function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert(err.message));
}
function logout() { auth.signOut(); location.reload(); }

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

// --- NAVIGATION ---
function filterCategory(category) {
    currentCategory = category;
    currentFolder = null; 
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(`nav-${category}`)?.classList.add('active');
    
    const titles = { 'all': 'All Documents', 'housing': 'Housing', 'travel': 'Travel', 'id': 'ID & Legal', 'tax': 'Tax', 'medical': 'Medical', 'auto': 'Auto', 'other': 'Others' };
    document.getElementById('pageTitle').textContent = titles[category] || 'Documents';
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

// --- HELP MODAL (NEW) ---
function openHelpModal() {
    document.getElementById('helpModal').style.display = 'flex';
}

// --- DATA LOGIC ---
function loadDocuments() {
    if (!currentUser) return;
    document.getElementById('loading').style.display = 'block';

    db.collection('documents').where('uid', '==', currentUser.uid).onSnapshot(snapshot => {
        allDocsCache = [];
        snapshot.forEach(doc => {
            allDocsCache.push({ id: doc.id, ...doc.data() });
        });
        document.getElementById('loading').style.display = 'none';
        renderView();
        updateFolderList();
    });
}

function renderView() {
    const grid = document.getElementById('fileGrid');
    const backBtn = document.getElementById('btnBack');
    const folderStatus = document.getElementById('folderStatus');
    grid.innerHTML = '';

    let docs = currentCategory === 'all' ? allDocsCache : allDocsCache.filter(d => d.category === currentCategory);

    if (currentFolder) {
        backBtn.style.display = 'flex';
        folderStatus.style.display = 'block';
        document.getElementById('catName').textContent = currentCategory.toUpperCase();
        document.getElementById('folderNameDisplay').textContent = currentFolder;

        const folderDocs = docs.filter(d => d.folder === currentFolder);
        if (folderDocs.length === 0) grid.innerHTML = '<p style="color:#888;">Empty folder.</p>';
        else folderDocs.forEach(d => grid.appendChild(createFileCard(d)));

    } else {
        backBtn.style.display = 'none';
        folderStatus.style.display = 'none';

        const folders = [...new Set(docs.map(d => d.folder).filter(f => f))];
        
        folders.forEach(folderName => {
            const fCard = document.createElement('div');
            fCard.className = 'folder-card';
            fCard.onclick = () => openFolder(folderName);
            fCard.innerHTML = `
                <i class="fas fa-folder folder-icon"></i>
                <div class="folder-name">${folderName}</div>
                <small style="color:#888;">${docs.filter(d => d.folder === folderName).length} files</small>
            `;
            grid.appendChild(fCard);
        });

        const looseFiles = docs.filter(d => !d.folder);
        looseFiles.forEach(d => grid.appendChild(createFileCard(d)));

        if (folders.length === 0 && looseFiles.length === 0) {
            grid.innerHTML = '<p style="color:#888;">No documents found.</p>';
        }
    }
}

function createFileCard(data) {
    const div = document.createElement('div');
    div.className = 'file-card';
    
    let previewHtml = '';
    const fileType = data.fileType || '';
    
    if (fileType.startsWith('image/')) previewHtml = `<img src="${data.url}" loading="lazy">`;
    else if (fileType.startsWith('video/')) previewHtml = `<video src="${data.url}"></video>`;
    else if (fileType.includes('pdf')) previewHtml = `<i class="fas fa-file-pdf" style="color: #ff4d4d;"></i>`;
    else previewHtml = `<i class="fas fa-file-alt"></i>`;

    div.innerHTML = `
        <div class="card-actions">
            <button class="action-btn btn-edit" onclick="openEditModal('${data.id}', '${data.title}', '${data.category}', '${data.folder || ''}')"><i class="fas fa-pen"></i></button>
            <button class="action-btn btn-delete" onclick="deleteDocument('${data.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <a href="${data.url}" target="_blank" style="text-decoration:none;">
            <div class="preview-box">${previewHtml}</div>
            <div class="card-info">
                <div class="card-title">${data.title}</div>
                <div class="card-meta"><span>${data.date}</span><span style="font-size:0.7rem; background:#eee; padding:2px 6px; border-radius:4px;">${data.category}</span></div>
            </div>
        </a>
    `;
    return div;
}

// --- SAVE & DELETE ---
function saveDocument() {
    const title = document.getElementById('docTitle').value;
    const category = document.getElementById('docCategory').value;
    const folder = document.getElementById('docFolder').value.trim();
    const fileInput = document.getElementById('docFile');
    const saveBtn = document.getElementById('btnSave');
    const progressBar = document.getElementById('uploadProgress');
    const bar = document.getElementById('progressBar');

    if (!title) return alert("Title is required!");
    if (fileInput.files.length === 0 && !isEditMode) return alert("Please select a file!");

    saveBtn.disabled = true;

    if (isEditMode) {
        const docId = document.getElementById('editDocId').value;
        db.collection('documents').doc(docId).update({ title, category, folder })
          .then(() => { closeModal(); saveBtn.disabled = false; });
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    progressBar.style.display = 'block';
    bar.style.width = '30%';

    fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.error) throw new Error(data.error.message);
        bar.style.width = '100%';
        db.collection('documents').add({
            uid: currentUser.uid, title, category, folder,
            url: data.secure_url, storagePath: data.public_id,
            fileType: file.type, date: new Date().toLocaleDateString()
        }).then(() => {
            closeModal(); saveBtn.disabled = false; progressBar.style.display = 'none';
        });
    }).catch(err => {
        alert("Upload failed: " + err.message);
        saveBtn.disabled = false; progressBar.style.display = 'none';
    });
}

function deleteDocument(id) {
    if (confirm("Delete this document?")) db.collection('documents').doc(id).delete();
}

function openModal(mode) {
    if (mode === 'add') {
        isEditMode = false;
        document.getElementById('modalTitle').textContent = "Add New File";
        document.getElementById('docTitle').value = '';
        document.getElementById('docCategory').value = currentCategory === 'all' ? 'housing' : currentCategory;
        document.getElementById('docFolder').value = currentFolder || '';
        document.getElementById('docFile').value = '';
        document.getElementById('fileInputGroup').style.display = 'block';
    }
    updateFolderList();
    document.getElementById('modalOverlay').style.display = 'flex';
}

function openEditModal(id, title, category, folder) {
    isEditMode = true;
    document.getElementById('modalTitle').textContent = "Edit Info";
    document.getElementById('editDocId').value = id;
    document.getElementById('docTitle').value = title;
    document.getElementById('docCategory').value = category;
    document.getElementById('docFolder').value = folder;
    document.getElementById('fileInputGroup').style.display = 'none';
    updateFolderList();
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

function updateFolderList() {
    const cat = document.getElementById('docCategory').value;
    const list = document.getElementById('folderSuggestions');
    list.innerHTML = '';
    const existingFolders = [...new Set(allDocsCache.filter(d => d.category === cat).map(d => d.folder).filter(f => f))];
    existingFolders.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        list.appendChild(option);
    });
}