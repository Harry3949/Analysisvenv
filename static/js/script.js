let audioCtx;
let analyser;
let source;
let isPlaying = false;
let animationId;
let currentAnalysis = null;
let authMode = "login"; // "login" or "signup"

// --- 🌐 基本機能 ---

async function loadSamples() {
    try {
        const res = await fetch('/samples');
        if (!res.ok) throw new Error("サンプル取得失敗");

        const data = await res.json();
        const select = document.getElementById('songSelect');
        select.innerHTML = "";

        data.samples.forEach(song => {
            const option = document.createElement('option');
            option.value = song;
            option.textContent = song;
            select.appendChild(option);
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadRanking() {
    try {
        const res = await fetch('/ranking');
        const data = await res.json();
        const list = document.getElementById('ranking-list');
        list.innerHTML = "";

        data.ranking.forEach(item => {
            const card = document.createElement('div');
            card.className = "rank-card";
            card.innerHTML = `
                <img src="${item.icon_url}" class="rank-user-icon">
                <div class="rank-info">
                    <div class="rank-song">${item.song_name}</div>
                    <div class="rank-meta">by ${item.username} • ${item.created_at}</div>
                    <div class="rank-details">BPM: ${item.bpm} • Key: ${item.key}</div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        console.error("Ranking load failed", e);
    }
}

// 🎧 分析
async function analyze() {
    const song = document.getElementById('songSelect').value;
    const btn = document.getElementById('analyzeBtn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const hexDisplay = document.getElementById('scan-hex');

    if (!song) return alert("分析する曲を選択してください");

    btn.disabled = true;
    loadingOverlay.classList.remove('hidden');

    // 0%から99%まで進む進捗アニメーション
    let progress = 0;
    const progressDisplay = document.getElementById('scan-progress');
    const progressInterval = setInterval(() => {
        if (progress < 99) {
            progress += Math.random() * 5;
            if (progress > 99) progress = 99;
            progressDisplay.textContent = Math.floor(progress) + "%";
        }
    }, 100);

    try {
        const formData = new FormData();
        formData.append("song_name", song);

        const res = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error("分析失敗");
        const data = await res.json();
        
        // 完了時に100%にする
        clearInterval(progressInterval);
        progressDisplay.textContent = "100%";
        
        currentAnalysis = data.analysis;

        // 100%を見せるために少しだけ待機
        setTimeout(() => {
            showResultScreen(song, data.analysis);
            loadRanking();
            loadingOverlay.classList.add('hidden');
        }, 500);

    } catch (e) {
        console.error(e);
        alert("分析に失敗しました。ログインしているか確認してください。");
        clearInterval(progressInterval);
        loadingOverlay.classList.add('hidden');
    } finally {
        btn.disabled = false;
    }
}

// 📤 アップロード
async function handleUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error("Upload failed");
        
        alert("アップロード完了！リストに追加しました。");
        await loadSamples();
        document.getElementById('songSelect').value = file.filename;
    } catch (e) {
        alert("アップロードに失敗しました。ログインが必要です。");
    }
}

// 🔑 認証関連
function openAuth() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuth() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('authActionBtn');
    const toggle = document.getElementById('auth-toggle');
    const lang = document.body.dataset.lang;
    
    if (authMode === "login") {
        authMode = "signup";
        title.textContent = (lang === "ja") ? "新規登録" : "SIGNUP";
        btn.textContent = (lang === "ja") ? "アカウント作成" : "CREATE ACCOUNT";
        toggle.textContent = toggle.dataset.login;
    } else {
        authMode = "login";
        title.textContent = (lang === "ja") ? "ログイン" : "LOGIN";
        btn.textContent = (lang === "ja") ? "ログイン" : "LOGIN";
        toggle.textContent = toggle.dataset.signup;
    }
}

async function handleAuth() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    if (!user || !pass) return alert("入力してください");

    const formData = new FormData();
    formData.append("username", user);
    formData.append("password", pass);

    const endpoint = authMode === "login" ? "/login" : "/signup";
    
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "認証失敗");
        }
        
        if (authMode === "signup") {
            alert("アカウント作成完了！ログインしてください。");
            toggleAuthMode();
        } else {
            location.reload(); // ログイン後はリロードして状態更新
        }
    } catch (e) {
        alert(e.message);
    }
}

// --- 🎨 ビジュアライザ・画面遷移 ---

function showResultScreen(songName, analysis) {
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('setup-screen').classList.add('hidden');
    
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-screen').classList.add('active');

    const player = document.getElementById('player');
    player.src = "/songs/" + songName;
    player.load();
    isPlaying = false;
    document.querySelector('.play-icon').textContent = "▶";

    // 翻訳ラベルの取得 (HTMLのdata属性から)
    const leftPanel = document.getElementById('panel-left');
    const rightPanel = document.getElementById('panel-right');
    const l = leftPanel.dataset;
    const r = rightPanel.dataset;

    leftPanel.innerHTML = `
        <div class="stat-box">
            <div class="stat-label">${l.track}</div>
            <div class="stat-value" style="font-size: 1.1rem;">${songName}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">${l.bpm}</div>
            <div class="stat-value">${analysis.bpm}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">${l.key}</div>
            <div class="stat-value">${analysis.key}</div>
        </div>
    `;

    rightPanel.innerHTML = `
        <div class="stat-box">
            <div class="stat-label">${r.mood}</div>
            <div class="stat-value" style="font-size: 1.1rem;">${analysis.mood}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">${r.freq}</div>
            <div class="stat-value" style="font-size: 0.9rem; color: #8892b0;">${analysis.frequency_balance}</div>
        </div>
        <div class="comment-box">
            "${analysis.comment}"
        </div>
    `;

    if (analyser) drawVisualizer();
}

function applyMoodTheme(mood) {
    // 常にデフォルトのミク・シアンを維持
    document.documentElement.style.setProperty('--primary-color', "#00e5ff");
}

function resetScreen() {
    document.getElementById('player').pause();
    isPlaying = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    document.getElementById('result-screen').classList.remove('active', 'hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden', 'active');
    document.getElementById('setup-screen').classList.add('active');

    // デフォルトのメインカラー（ミク・シアン）に戻す
    document.documentElement.style.setProperty('--primary-color', "#00e5ff");
}

function togglePlay() {
    const player = document.getElementById('player');
    const playIcon = document.querySelector('.play-icon');
    const playBtn = document.getElementById('playBtn');

    if (!audioCtx) initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (isPlaying) {
        player.pause();
        playIcon.textContent = "▶";
        playIcon.style.marginLeft = "8px";
        playBtn.style.animation = "none";
    } else {
        player.play();
        playIcon.innerHTML = "&#10074;&#10074;";
        playIcon.style.marginLeft = "0px";
        if (currentAnalysis && currentAnalysis.bpm > 0) {
            const duration = 60 / currentAnalysis.bpm;
            playBtn.style.animation = `pulseBeat ${duration}s infinite alternate ease-in-out`;
        }
    }
    isPlaying = !isPlaying;
}

function initAudioContext() {
    const player = document.getElementById('player');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(player);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 512;
    drawVisualizer();
}

function getWaveColor(index, total) {
    const p = index / total;
    let r, g, b;
    if (p <= 0.8) {
        const ratio = p / 0.8;
        r = 255 + (55 - 255) * ratio;
        g = 204 + (186 - 204) * ratio;
        b = 0 + (186 - 0) * ratio;
    } else {
        r = 55; g = 186; b = 186;
    }
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function drawVisualizer() {
    if (animationId) cancelAnimationFrame(animationId);
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let maxActiveIndex = bufferLength;

    const draw = () => {
        animationId = requestAnimationFrame(draw);
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        analyser.getByteFrequencyData(dataArray);
        let currentMax = 0;
        for (let j = bufferLength - 1; j >= 0; j--) {
            if (dataArray[j] > 10) { currentMax = j; break; }
        }
        if (currentMax > 0) maxActiveIndex = maxActiveIndex * 0.98 + currentMax * 0.02;
        const drawLimit = Math.max(maxActiveIndex, bufferLength / 3);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = 180;

        for (let i = 0; i < drawLimit; i++) {
            const barHeight = dataArray[i] * 1.2;
            const angle = (i / drawLimit) * Math.PI * 2;
            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(angle) * (radius + barHeight);
            const y2 = cy + Math.sin(angle) * (radius + barHeight);
            ctx.strokeStyle = getWaveColor(i, bufferLength);
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    draw();
}

document.getElementById('player').addEventListener('ended', () => {
    isPlaying = false;
    document.querySelector('.play-icon').textContent = "▶";
    document.getElementById('playBtn').style.animation = "none";
});

loadSamples();
loadRanking();

// --- 👤 My Page Functions ---
async function deleteHistory(id, confirmMsg) {
    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`/delete_analysis/${id}`, { method: 'POST' });
        if (res.ok) {
            const el = document.getElementById(`analysis-${id}`);
            if (el) el.remove();
        } else {
            alert("Failed to delete");
        }
    } catch (e) {
        console.error(e);
    }
}