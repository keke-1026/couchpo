import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyBss3X4TU521AXPLgWSA_lB6Un1yhO4oRg",
    authDomain: "couchpotato-hp.firebaseapp.com",
    projectId: "couchpotato-hp"
});
const db = getFirestore(app);

window.switchTab = function(tabId) {
    ['tab-post', 'tab-manage', 'tab-profile', 'tab-settings'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

let draggedItem = null;
function handleDragStart(e) { draggedItem = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.style.opacity = '0.5'; }
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
function handleDragEnter(e) { this.classList.add('over'); }
function handleDragLeave(e) { this.classList.remove('over'); }
function handleDrop(e) {
    e.stopPropagation();
    if (draggedItem !== this) {
        const targetContainer = this.parentElement;
        let siblings = Array.from(targetContainer.children);
        if (siblings.indexOf(draggedItem) < siblings.indexOf(this)) targetContainer.insertBefore(draggedItem, this.nextSibling);
        else targetContainer.insertBefore(draggedItem, this);
    }
    return false;
}
function handleDragEnd(e) { this.style.opacity = '1'; this.parentElement.querySelectorAll('.editor-block').forEach(item => item.classList.remove('over')); }

window.moveBlockUp = function(btn) {
    const block = btn.closest('.editor-block');
    if (block.previousElementSibling) {
        block.parentNode.insertBefore(block, block.previousElementSibling);
    }
}
window.moveBlockDown = function(btn) {
    const block = btn.closest('.editor-block');
    if (block.nextElementSibling) {
        block.parentNode.insertBefore(block.nextElementSibling, block);
    }
}

window.addBlock = function(type, content = "", targetId = 'blocks-container') {
    const container = document.getElementById(targetId);
    const div = document.createElement('div');
    div.className = 'editor-block'; div.dataset.type = type; div.setAttribute('draggable', true);
    div.addEventListener('dragstart', handleDragStart, false); div.addEventListener('dragenter', handleDragEnter, false);
    div.addEventListener('dragover', handleDragOver, false); div.addEventListener('dragleave', handleDragLeave, false);
    div.addEventListener('drop', handleDrop, false); div.addEventListener('dragend', handleDragEnd, false);
    
    let inner = `<span class="drag-handle">≡</span>
                 <div class="block-controls">
                    <button type="button" onclick="moveBlockUp(this)" title="上へ移動">↑</button>
                    <button type="button" onclick="moveBlockDown(this)" title="下へ移動">↓</button>
                    <button type="button" onclick="this.parentElement.parentElement.remove()" style="color:#cc3333; text-decoration:underline;">削除</button>
                 </div>`;
    
    if (type === 'text') { inner += `<span style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">[文章]</span><textarea placeholder="ここに文章を書きます...">${content}</textarea>`; div.innerHTML = inner; container.appendChild(div); } 
    else if (type === 'youtube') { inner += `<span style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">[YouTube]</span><input type="text" placeholder="URL、またはアカウントID" value="${content}">`; div.innerHTML = inner; container.appendChild(div); } 
    else if (type === 'twitter') { inner += `<span style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">[X (Twitter)]</span><input type="text" placeholder="ポストのURL、またはアカウントID" value="${content}">`; div.innerHTML = inner; container.appendChild(div); } 
    else if (type === 'image') {
        if (content) {
            div.dataset.url = content; inner += `<span style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">[画像]</span><img src="${content}">`; div.innerHTML = inner; container.appendChild(div);
        } else {
            document.getElementById('loading-overlay').style.display = 'flex';
            cloudinary.openUploadWidget({ cloudName: 'dcgytcnqu', uploadPreset: 'couchpotato', cropping: true, language: "ja" }, (error, result) => {
                if (!error && result && result.event === "display-changed") document.getElementById('loading-overlay').style.display = 'none';
                if (!error && result && result.event === "success") { div.dataset.url = result.info.secure_url; inner += `<span style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">[画像]</span><img src="${result.info.secure_url}">`; div.innerHTML = inner; container.appendChild(div); }
            });
            setTimeout(() => { document.getElementById('loading-overlay').style.display = 'none'; }, 3000);
        }
    }
}

let submitAction = "published";
const draftBtn = document.getElementById("draft-post-btn");
const submitBtn = document.getElementById("submit-post-btn");

if (draftBtn) draftBtn.addEventListener("click", () => submitAction = "draft");
if (submitBtn) submitBtn.addEventListener("click", () => submitAction = "published");

function getFormattedDate(dateObj = new Date()) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${dateObj.getFullYear()}.${pad(dateObj.getMonth()+1)}.${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;
}

const newsForm = document.getElementById("news-form");
if (newsForm) {
    newsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const editId = document.getElementById("edit-post-id").value;
        const title = document.getElementById("news-title").value;
        const tags = document.getElementById("news-tags").value.split(',').map(t => t.trim()).filter(t => t !== "");
        const categories = [];
        if(document.getElementById("cat-news").checked) categories.push("news");
        if(document.getElementById("cat-live").checked) categories.push("live");
        
        const isDraft = (submitAction === "draft");
        const isVisible = document.getElementById("news-visible").checked;
        const password = document.getElementById("news-password").value.trim();

        const dateInput = document.getElementById("news-date").value;
        let finalDateStr = "";
        let finalCreatedAt = new Date();

        if (dateInput) {
            finalCreatedAt = new Date(dateInput);
            finalDateStr = getFormattedDate(finalCreatedAt);
        } else {
            finalDateStr = getFormattedDate();
            finalCreatedAt = new Date();
        }

        const blocks = [];
        for (let el of document.getElementById('blocks-container').children) {
            const type = el.dataset.type;
            if (type === 'text') blocks.push({ type: 'text', content: el.querySelector('textarea').value });
            else if (type === 'image') blocks.push({ type: 'image', url: el.dataset.url });
            else if (type === 'youtube' || type === 'twitter') blocks.push({ type: type, url: el.querySelector('input').value });
        }

        try {
            const statusMsg = document.getElementById("post-status");
            const postData = { title, tags, categories, blocks, isDraft, isVisible, password, date: finalDateStr, createdAt: finalCreatedAt };

            if (editId) {
                await setDoc(doc(db, "news", editId), postData, { merge: true });
                statusMsg.textContent = isDraft ? "下書きとして保存しました！" : "編集を完了し公開しました！";
            } else {
                await addDoc(collection(db, "news"), postData);
                statusMsg.textContent = isDraft ? "下書きとして保存しました！" : "新しく公開しました！";
                document.getElementById("news-form").reset(); document.getElementById('blocks-container').innerHTML = "";
            }
            statusMsg.style.display = "block"; setTimeout(() => { statusMsg.style.display = "none"; }, 3000);
        } catch (error) { alert("エラーが発生しました。"); }
    });
}

window.loadAdminPosts = async function() {
    const listArea = document.getElementById('admin-posts-list');
    listArea.innerHTML = "読み込み中...";
    const snapshot = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
    if(snapshot.empty) { listArea.innerHTML = "記事がありません。"; return; }
    listArea.innerHTML = "";
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const catStr = (data.categories || []).join(' / ') || 'news';
        let statusMark = "";
        if (data.isDraft) statusMark += '<span style="color:#cc3333; font-weight:bold; margin-right:5px;">[下書き]</span>';
        if (data.isVisible === false) statusMark += '<span style="color:#909f78; font-weight:bold; margin-right:5px;">[非表示]</span>';
        if (data.password) statusMark += '<span style="color:#a79d8a; font-weight:bold; margin-right:5px;">[ロック]</span>';

        const postUrl = `${window.location.origin}/post.html?id=${docSnap.id}`;

        listArea.insertAdjacentHTML('beforeend', `
            <div class="manage-list-item">
                <div>
                    <span>${statusMark}${data.title}</span><br>
                    <small style="color:var(--accent-color);">${data.date} [${catStr}]</small><br>
                    <small style="color:var(--accent-color);">URL: <a href="${postUrl}" target="_blank" style="color:var(--link-color); text-decoration:underline; word-break:break-all;">${postUrl}</a></small>
                </div>
                <div class="manage-actions">
                    <button type="button" class="btn-edit" onclick="editPost('${docSnap.id}')">編集</button>
                    <button type="button" class="btn-delete" onclick="deletePost('${docSnap.id}', '${data.title}')">削除</button>
                </div>
            </div>
        `);
    });
}

window.deletePost = async function(id, title) { if (confirm(`本当に「${title}」を削除しますか？`)) { await deleteDoc(doc(db, "news", id)); loadAdminPosts(); } }
window.editPost = async function(id) {
    const docSnap = await getDoc(doc(db, "news", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById("edit-post-id").value = id;
        document.getElementById("news-title").value = data.title;
        document.getElementById("news-tags").value = data.tags ? data.tags.join(', ') : "";
        document.getElementById("cat-news").checked = data.categories ? data.categories.includes("news") : true;
        document.getElementById("cat-live").checked = data.categories ? data.categories.includes("live") : false;
        
        document.getElementById("news-visible").checked = data.isVisible !== false;
        document.getElementById("news-password").value = data.password || "";

        if (data.date) {
            document.getElementById("news-date").value = data.date.replace(/\./g, '-').replace(' ', 'T').substring(0, 16);
        } else {
            document.getElementById("news-date").value = "";
        }

        document.getElementById('blocks-container').innerHTML = "";
        if (data.blocks) data.blocks.forEach(b => addBlock(b.type, b.content || b.url, 'blocks-container'));
        document.getElementById("submit-post-btn").textContent = "編集を完了し公開"; document.getElementById("cancel-edit-btn").style.display = "inline-block"; document.getElementById("tab-btn-post").textContent = "記事の編集"; switchTab('tab-post');
    }
}
window.cancelEdit = function() {
    document.getElementById("edit-post-id").value = ""; 
    document.getElementById("news-form").reset(); 
    document.getElementById("news-date").value = ""; 
    document.getElementById("news-visible").checked = true;
    document.getElementById("news-password").value = "";
    document.getElementById('blocks-container').innerHTML = ""; 
    document.getElementById("submit-post-btn").textContent = "サイトに公開する"; 
    document.getElementById("cancel-edit-btn").style.display = "none"; 
    document.getElementById("tab-btn-post").textContent = "記事を書く";
}

window.loadProfile = async function() {
    const container = document.getElementById('blocks-container-profile'); container.innerHTML = "";
    const snap = await getDoc(doc(db, "pages", "profile"));
    if(snap.exists() && snap.data().blocks) snap.data().blocks.forEach(b => addBlock(b.type, b.content || b.url, 'blocks-container-profile'));
}
window.saveProfile = async function() {
    const blocks = [];
    for (let el of document.getElementById('blocks-container-profile').children) {
        const type = el.dataset.type;
        if (type === 'text') blocks.push({ type: 'text', content: el.querySelector('textarea').value });
        else if (type === 'image') blocks.push({ type: 'image', url: el.dataset.url });
        else if (type === 'youtube' || type === 'twitter') blocks.push({ type: type, url: el.querySelector('input').value });
    }
    await setDoc(doc(db, "pages", "profile"), { blocks: blocks, updatedAt: new Date() }, { merge: true });
    const s = document.getElementById("profile-status"); s.style.display = "block"; setTimeout(() => { s.style.display = "none"; }, 3000);
}

async function loadSettings() {
    const snap = await getDoc(doc(db, "settings", "global"));
    if(snap.exists()){
        const data = snap.data();
        ['topImage', 'headerLogo', 'favicon'].forEach(key => { if(data[key]) { document.getElementById(`preview-${key}`).src = data[key]; document.getElementById(`input-${key}`).value = data[key]; } });
    }
}
loadSettings();
window.uploadSettingImage = function(key) {
    document.getElementById('loading-overlay').style.display = 'flex';
    cloudinary.openUploadWidget({ cloudName: 'dcgytcnqu', uploadPreset: 'couchpotato', cropping: true, language: "ja" }, (error, result) => {
        if (!error && result && result.event === "display-changed") document.getElementById('loading-overlay').style.display = 'none';
        if (!error && result && result.event === "success") { document.getElementById(`input-${key}`).value = result.info.secure_url; document.getElementById(`preview-${key}`).src = result.info.secure_url; }
    });
    setTimeout(() => { document.getElementById('loading-overlay').style.display = 'none'; }, 3000);
}
window.saveSettings = async function() {
    const topImage = document.getElementById('input-topImage').value; const headerLogo = document.getElementById('input-headerLogo').value; const favicon = document.getElementById('input-favicon').value;
    await setDoc(doc(db, "settings", "global"), { topImage, headerLogo, favicon }, { merge: true });
    const s = document.getElementById("setting-status"); s.style.display = "block"; setTimeout(() => { s.style.display = "none"; }, 3000);
}