import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({ apiKey: "AIzaSyBss3X4TU521AXPLgWSA_lB6Un1yhO4oRg", authDomain: "couchpotato-hp.firebaseapp.com", projectId: "couchpotato-hp" });
const db = getFirestore(app);

async function applySiteSettings() {
    try {
        const snap = await getDoc(doc(db, "settings", "global"));
        if (snap.exists()) {
            const data = snap.data();
            if (data.favicon) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
                link.href = data.favicon;
            }
            if (data.topImage) {
                const topImg = document.getElementById("site-top-image-img");
                if (topImg) {
                    topImg.src = data.topImage;
                    topImg.style.display = "block";
                }
            }
            if (data.headerLogo) {
                const logoImg = document.getElementById("header-logo-img");
                if (logoImg) logoImg.src = data.headerLogo;
            }
        }
    } catch (e) { console.error(e); }
}

function setupScrollToTop() {
    const topBtn = document.getElementById("scroll-to-top");
    if (topBtn) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 300) topBtn.classList.add("show");
            else topBtn.classList.remove("show");
        });
        topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
}

const youtubeSvg = `<svg viewBox="0 0 24 24"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"/></svg>`;
function parseYouTube(input) {
    const vidMatch = input.match(/(?:youtu\.be\/|watch\?v=|\&v=)([^#\&\?]*)/);
    if (vidMatch && vidMatch[1].length === 11) return { type: 'embed', id: vidMatch[1] };
    let id = input.startsWith('@') ? input : '@' + input;
    return { type: 'channel', url: `https://www.youtube.com/${id}` };
}

const xSvg = `<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`;
function parseTwitter(input) {
    const postMatch = input.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (postMatch) return { type: 'embed', url: input };
    let id = input.startsWith('@') ? input.substring(1) : input;
    return { type: 'profile', url: `https://x.com/${id}` };
}

function renderBlocks(blocks) {
    let html = ''; let hasTwitterEmbed = false;
    if (!blocks) return { html, hasTwitterEmbed };

    blocks.forEach(block => {
        if (block.type === 'text') {
            html += `<div style="line-height: 1.8; margin-bottom:20px;">${block.content.replace(/\n/g, "<br>")}</div>`;
        } else if (block.type === 'image') {
            html += `<div style="margin-bottom:20px;"><img src="${block.url}" style="max-width:100%; border-radius:4px;"></div>`;
        } else if (block.type === 'youtube') {
            const yt = parseYouTube(block.url);
            if (yt.type === 'embed') html += `<div style="margin-bottom:20px;"><iframe width="100%" height="400" src="https://www.youtube.com/embed/${yt.id}" frameborder="0" allowfullscreen style="border-radius: 8px;"></iframe></div>`;
            else html += `<div style="margin-bottom:20px;"><a href="${yt.url}" target="_blank" class="sns-btn">${youtubeSvg} YouTubeを見る</a></div>`;
        } else if (block.type === 'twitter') {
            const tw = parseTwitter(block.url);
            if (tw.type === 'embed') { hasTwitterEmbed = true; html += `<div style="margin-bottom:20px;"><blockquote class="twitter-tweet" data-theme="light"><a href="${tw.url}"></a></blockquote></div>`; } 
            else { html += `<div style="margin-bottom:20px;"><a href="${tw.url}" target="_blank" class="sns-btn">${xSvg} X (Twitter)を見る</a></div>`; }
        }
    });
    return { html, hasTwitterEmbed };
}

document.addEventListener("DOMContentLoaded", () => {
    applySiteSettings(); setupScrollToTop();

    const hamburgerBtn = document.getElementById('hamburger-btn'); const closeMenuBtn = document.getElementById('close-menu-btn'); const mobileMenu = document.getElementById('mobile-menu');
    if (hamburgerBtn && closeMenuBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', () => { mobileMenu.classList.add('active'); });
        closeMenuBtn.addEventListener('click', () => { mobileMenu.classList.remove('active'); });
    }

    const newsContainer = document.getElementById("news-container");
    const liveContainer = document.getElementById("live-container");
    const postContainer = document.getElementById("post-container");
    const searchContainer = document.getElementById("search-container");
    const profileContainer = document.getElementById("profile-container");

    if (newsContainer) {
        async function fetchNewsList() {
            const snapshot = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
            const filteredDocs = snapshot.docs.filter(d => {
                const data = d.data();
                if(data.isDraft) return false;
                if(data.isVisible === false) return false; // 非表示フラグの除外
                const cats = data.categories || [];
                return cats.includes("news") || cats.length === 0;
            });

            newsContainer.innerHTML = filteredDocs.length === 0 ? "<p>お知らせはありません。</p>" : "";
            filteredDocs.forEach((docSnap) => {
                const data = docSnap.data();
                newsContainer.insertAdjacentHTML('beforeend', `<div class="news-item"><div class="news-date">${data.date}</div><div class="news-title"><a href="post.html?id=${docSnap.id}">${data.title}</a></div></div>`);
            });
        }
        fetchNewsList();
    }

    if (liveContainer) {
        async function fetchLiveList() {
            const snapshot = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
            const filteredDocs = snapshot.docs.filter(d => {
                const data = d.data();
                if(data.isDraft) return false;
                if(data.isVisible === false) return false; // 非表示フラグの除外
                return (data.categories || []).includes("live");
            });

            liveContainer.innerHTML = filteredDocs.length === 0 ? "<p>ライブの予定はまだありません。</p>" : "";
            let loadTwitterWidget = false;
            filteredDocs.forEach((docSnap) => {
                const data = docSnap.data(); const rendered = renderBlocks(data.blocks);
                if (rendered.hasTwitterEmbed) loadTwitterWidget = true;
                liveContainer.insertAdjacentHTML('beforeend', `<div class="live-item"><div class="post-header"><span class="news-date">${data.date}</span><h2 class="post-title"><a href="post.html?id=${docSnap.id}">${data.title}</a></h2></div><div class="post-content">${rendered.html}</div></div>`);
            });
            if (loadTwitterWidget) { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; document.body.appendChild(s); }
        }
        fetchLiveList();
    }

    if (profileContainer) {
        async function fetchProfile() {
            const docSnap = await getDoc(doc(db, "pages", "profile"));
            if (docSnap.exists()) {
                const rendered = renderBlocks(docSnap.data().blocks);
                profileContainer.innerHTML = rendered.html || "<p>プロフィールがまだ設定されていません。</p>";
                if (rendered.hasTwitterEmbed) { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; document.body.appendChild(s); }
            } else profileContainer.innerHTML = "<p>プロフィールがまだ設定されていません。</p>";
        }
        fetchProfile();
    }

    if (postContainer) {
        async function fetchPost() {
            const postId = new URLSearchParams(window.location.search).get('id'); if (!postId) return;
            const docSnap = await getDoc(doc(db, "news", postId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById("page-title").textContent = `${data.title} | カウチポテト`; 
                document.getElementById("post-title").textContent = data.title; 
                document.getElementById("post-date").textContent = data.date;
                const contentArea = document.getElementById("post-content"); 
                
                // 記事本文を描画する関数
                const renderPostContent = async () => {
                    const rendered = renderBlocks(data.blocks);
                    contentArea.innerHTML = rendered.html || `<div style="line-height: 1.8;">${(data.content||"").replace(/\n/g, "<br>")}</div>`;
                    if (rendered.hasTwitterEmbed) { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; document.body.appendChild(s); }

                    if (data.tags && data.tags.length > 0) {
                        let tagsHtml = '<div class="tags-list">'; data.tags.forEach(tag => { tagsHtml += `<a href="search.html?tagsearch=${encodeURIComponent(tag)}"># ${tag}</a>`; });
                        contentArea.insertAdjacentHTML('beforeend', tagsHtml + '</div>');
                        
                        const allDocs = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
                        // 非表示記事は関連記事からも除外
                        const related = allDocs.docs.filter(d => !d.data().isDraft && d.data().isVisible !== false && d.id !== postId && (d.data().tags || []).includes(data.tags[0])).slice(0, 4);
                        if (related.length > 0) {
                            let relatedHtml = '<div class="related-posts"><h3>関連記事</h3><ul>'; related.forEach(rDoc => { relatedHtml += `<li><a href="post.html?id=${rDoc.id}">・ ${rDoc.data().title}</a></li>`; });
                            contentArea.insertAdjacentHTML('beforeend', relatedHtml + '</ul></div>');
                        }
                    }
                };

                // パスワードの判定と表示の出し分け
                const hasPassword = data.password && data.password.trim() !== "";
                const urlPassword = new URLSearchParams(window.location.search).get('password');

                if (hasPassword && urlPassword !== data.password) {
                    // パスワード入力画面の表示
                    contentArea.innerHTML = `
                        <div class="password-auth-container">
                            <h3>この記事はパスワードで保護されています</h3>
                            <p class="password-error" id="pw-error">パスワードが違います</p>
                            <input type="password" id="pw-input" placeholder="パスワードを入力">
                            <button type="button" id="pw-submit">閲覧する</button>
                        </div>
                    `;
                    document.getElementById('pw-submit').addEventListener('click', () => {
                        const inputVal = document.getElementById('pw-input').value;
                        if (inputVal === data.password) {
                            renderPostContent();
                        } else {
                            document.getElementById('pw-error').style.display = 'block';
                        }
                    });
                } else {
                    // パスワードがない、またはURLパラメータで一致した場合は通常表示
                    renderPostContent();
                }
            }
        }
        fetchPost();
    }

    if (searchContainer) {
        async function performSearch() {
            const urlParams = new URLSearchParams(window.location.search);
            const tagQuery = urlParams.get('tagsearch'); const textQuery = urlParams.get('search');
            const titleLabel = document.getElementById("search-title"); searchContainer.innerHTML = "";
            const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
            
            // 非表示記事は検索結果からも除外
            const visibleDocs = snap.docs.filter(d => !d.data().isDraft && d.data().isVisible !== false);

            if (tagQuery) {
                titleLabel.innerHTML = `タグ: #${tagQuery}`;
                displaySearch(visibleDocs.filter(d => (d.data().tags || []).includes(tagQuery)));
            } else if (textQuery) {
                titleLabel.innerHTML = `検索: ${textQuery}`;
                displaySearch(visibleDocs.filter(d => (d.data().title || "").includes(textQuery)));
            }
        }
        function displaySearch(docs) {
            if (docs.length === 0) { searchContainer.innerHTML = "<p>見つかりませんでした。</p>"; return; }
            docs.forEach(docSnap => {
                const data = docSnap.data(); const linkUrl = `post.html?id=${docSnap.id}`;
                searchContainer.insertAdjacentHTML('beforeend', `<div class="news-item"><div class="news-date">${data.date}</div><div class="news-title"><a href="${linkUrl}">${data.title}</a></div></div>`);
            });
        }
        performSearch();
    }
});