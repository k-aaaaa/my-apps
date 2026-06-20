function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

// 🛡️ 文字列の無害化（XSS対策）
function escapeHTML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DB_NAME = 'AssetUniverseDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveStateToDB(stateObj) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(stateObj, 'masterState');
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function loadStateFromDB() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('masterState');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (e) => reject(e.target.error);
    });
}

function fireConfetti(options) {
    if (typeof confetti === 'function') {
        try { confetti(options); } catch (e) {}
    }
}

const defaultState = {
    securities: { history: [] },
    envelopes: [],
    rewards: [],
    reports: [],
    lastReportMonth: "",
    simulation: { startAge: 25, endAge: 65, monthly: 30000, annualRate: 5, inflationRate: 2 },
    pin: null, secretQuestion: null, secretAnswer: null,
    appTheme: 'theme-stylish',
    autoSync: false,
    customColors: {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    }
};

let state = null;
let currentInputPin = "";
let simChartInstance = null;
let pendingAchievements = [];
let simData = { labels: [], principal: [], interest: [], total: [] };
let GAS_URL = localStorage.getItem('asset_gas_url') || "";
let isMasked = false;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const storedState = await loadStateFromDB();
        state = storedState ? { ...defaultState, ...storedState } : JSON.parse(JSON.stringify(defaultState));
        if (!state.securities) state.securities = { history: [] };
        if (!state.envelopes) state.envelopes = [];
        if (!state.rewards) state.rewards = [];
        if (!state.reports) state.reports = [];
        if (!state.simulation) state.simulation = defaultState.simulation;
        if (!state.customColors) state.customColors = defaultState.customColors;
        if (state.autoSync === undefined) state.autoSync = false;
    } catch (e) {
        state = JSON.parse(JSON.stringify(defaultState));
    }

    applyCurrentThemeAndColors();
    loadSimulationInputs();
    document.getElementById('gas-url').value = GAS_URL;
    if(document.getElementById('settings-auto-sync')) document.getElementById('settings-auto-sync').checked = state.autoSync;

    const initialTab = location.hash ? location.hash.replace('#', '') : 'view-securities';

    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); }
        
        if (state.pin) {
            document.getElementById('lock-screen').classList.remove('hidden');
            resetPinDisplay();
        } else {
            document.getElementById('main-app-content').style.visibility = 'visible';
            switchTab(initialTab, false);
            updateUI();
            updateSimulation(); 
            check25thAutomated(); 
            checkAchievements();
        }
    }, 1200);

    ['sim-start-age', 'sim-end-age', 'sim-annual-rate', 'sim-inflation-rate'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).addEventListener('input', updateSimulation);
    });
});

window.addEventListener('popstate', (e) => {
    const target = e.state ? e.state.tab : 'view-securities';
    switchTab(target, false);
});

function switchTab(targetId, pushHistory = true) {
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    targetEl.classList.add('active');
    
    const navBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
    if(navBtn) navBtn.classList.add('active');

    if (targetId === 'view-simulation') updateSimulation();
    if (targetId === 'view-rewards') { renderRewards(); renderMonthlyArchive(); }
    
    if (pushHistory) {
        history.pushState({ tab: targetId }, "", "#" + targetId);
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate();
        switchTab(btn.dataset.target, true);
    });
});

async function saveLocal() {
    try { 
        await saveStateToDB(state); 
        updateUI(); 
        if (state.autoSync) cloudSyncSilent();
    } catch (e) { 
        console.error(e); 
    }
}

function openModal(id) { vibrate(); document.getElementById(id).classList.remove('hidden'); document.body.classList.add('modal-open'); }
function closeModal(id) { vibrate(); document.getElementById(id).classList.add('hidden'); document.body.classList.remove('modal-open'); }

// 👁️ マスキングと解除の完全制御
function toggleGlobalMask() {
    vibrate();
    isMasked = !isMasked;
    if (isMasked) {
        document.body.classList.add('mask-active');
        document.querySelectorAll('.maskable').forEach(el => el.innerText = "***,***");
        document.querySelectorAll('.maskable-list .history-amount, .maskable-list .sim-detail-value, .maskable-list .sim-result strong, .maskable-list .env-amount, .maskable-list .reward-target-amount, .maskable-list .archive-stat-val').forEach(el => el.innerText = "***,***");
    } else {
        document.body.classList.remove('mask-active');
    }
    updateUI(); 
    updateSimulation(); 
}

function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.value = theme;
    if (!state.customColors[theme]) state.customColors[theme] = defaultState.customColors[theme] || defaultState.customColors['theme-stylish'];
    const colors = state.customColors[theme];
    const root = document.documentElement;
    root.style.setProperty('--bg-color', colors.bg);
    root.style.setProperty('--panel-bg', colors.panel);
    root.style.setProperty('--accent-color', colors.accent);

    const hexToLuma = (color) => {
        const hex = color.replace('#', '');
        if(hex.length !== 6) return 1;
        const r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
        return [0.299 * r, 0.587 * g, 0.114 * b].reduce((a, b) => a + b) / 255;
    };
    root.style.setProperty('--text-color', hexToLuma(colors.bg) > 0.5 ? '#1d1d1f' : '#ffffff');

    const rgbaToHex = (rgba) => {
        const match = rgba.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)/i);
        return (match && match.length === 4) ? "#" + ("0" + parseInt(match[1],10).toString(16)).slice(-2) + ("0" + parseInt(match[2],10).toString(16)).slice(-2) + ("0" + parseInt(match[3],10).toString(16)).slice(-2) : rgba;
    };

    if (document.getElementById('custom-color-bg')) document.getElementById('custom-color-bg').value = rgbaToHex(colors.bg);
    if (document.getElementById('custom-color-panel')) document.getElementById('custom-color-panel').value = rgbaToHex(colors.panel);
    if (document.getElementById('custom-color-accent')) document.getElementById('custom-color-accent').value = rgbaToHex(colors.accent);
}
function updateCustomColor(type, value) { state.customColors[state.appTheme || 'theme-stylish'][type] = value; applyCurrentThemeAndColors(); saveLocal(); }
function resetCurrentThemeColors() { vibrate(); if(!confirm("本当にこのテーマの色を初期状態に戻しますか？")) return; state.customColors[state.appTheme || 'theme-stylish'] = { ...defaultState.customColors[state.appTheme || 'theme-stylish'] }; applyCurrentThemeAndColors(); saveLocal(); alert("テーマの色を初期化しました！"); }

// 🔧 修正: グラフのテーマ変更遅延問題を解消
function changeAppTheme(themeName) { 
    vibrate(); 
    state.appTheme = themeName; 
    applyCurrentThemeAndColors(); 
    saveLocal(); 
    if (simChartInstance) { 
        setTimeout(() => { 
            // 強制的にグラフを再描画させて色を最新にする
            renderSimChart(); 
        }, 100); 
    } 
}

// ==========================================================================
// ☁️ GAS サプライズシェア & 同期実装 (復活分)
// ==========================================================================
function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value.trim();
    localStorage.setItem('asset_gas_url', GAS_URL);
    alert("☁️ 連携URLを保存しました");
}

function toggleAutoSync(checked) {
    state.autoSync = checked;
    saveLocal();
}

function triggerManualSync() {
    vibrate();
    if (!GAS_URL) return alert("⚠️ 先に設定でGASのURLを登録してください");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "text/plain" } })
    .then(() => alert("☁️ 手動バックアップが完了しました！"))
    .catch(() => alert("⚠️ 通信に失敗しました。URLやネットワークを確認してください。"));
}

function cloudSyncSilent() {
    if (GAS_URL) fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

// ==========================================================================
// 📈 証券管理
// ==========================================================================
function recordSecurities() {
    vibrate();
    const amountStr = document.getElementById('input-securities-amount').value;
    if (!amountStr) return alert("金額を入力してください。");
    const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amount) || amount < 0) return alert("正しい金額を入力してください。");
    const today = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    state.securities.history.unshift({ id: Date.now(), date: today, amount: amount });
    saveLocal();
    document.getElementById('input-securities-amount').value = "";
    fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    checkAchievements();
}

function deleteSecuritiesHistory(id) { vibrate(); if (confirm("この記録を削除しますか？")) { state.securities.history = state.securities.history.filter(h => h.id !== id); saveLocal(); } }

function renderSecurities() {
    const totalEl = document.getElementById('display-total-securities');
    const diffEl = document.getElementById('display-diff');
    const listEl = document.getElementById('securities-history-list');
    const history = state.securities.history;
    listEl.innerHTML = "";

    if (history.length === 0) {
        if (!isMasked) totalEl.innerText = "0"; 
        diffEl.innerText = "前回比: --"; diffEl.className = "total-diff";
        listEl.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px; font-size:12px;'>まだ記録がありません</div>"; return;
    }

    const current = history[0].amount;
    if (!isMasked) totalEl.innerText = current.toLocaleString();

    if (history.length > 1) {
        if (isMasked) {
            diffEl.innerText = `前回比: ***,***`; diffEl.className = "total-diff";
        } else {
            const diff = current - history[1].amount;
            if (diff > 0) { diffEl.innerText = `前回比: +${diff.toLocaleString()}円`; diffEl.className = "total-diff diff-up"; } 
            else if (diff < 0) { diffEl.innerText = `前回比: ${diff.toLocaleString()}円`; diffEl.className = "total-diff diff-down"; } 
            else { diffEl.innerText = `前回比: ±0円`; diffEl.className = "total-diff"; }
        }
    } else {
        diffEl.innerText = "前回比: --"; diffEl.className = "total-diff";
    }

    history.forEach(item => {
        const div = document.createElement('div'); div.className = "history-item";
        div.innerHTML = `<div><div class="history-date">${item.date}</div><div class="history-amount">${isMasked ? '***,***' : '¥ ' + item.amount.toLocaleString()}</div></div><button class="btn-delete-history" onclick="deleteSecuritiesHistory(${item.id})">×</button>`;
        listEl.appendChild(div);
    });
}

// ==========================================================================
// 🧮 シミュレーション
// ==========================================================================
function loadSimulationInputs() {
    if(!document.getElementById('sim-start-age')) return;
    document.getElementById('sim-start-age').value = state.simulation.startAge; document.getElementById('sim-end-age').value = state.simulation.endAge;
    document.getElementById('sim-monthly-value').innerText = isMasked ? "***,***" : state.simulation.monthly.toLocaleString();
    document.getElementById('sim-annual-rate').value = state.simulation.annualRate; document.getElementById('sim-inflation-rate').value = state.simulation.inflationRate;
}

function adjustMonthly(delta) { vibrate(); state.simulation.monthly = Math.max(0, state.simulation.monthly + delta); document.getElementById('sim-monthly-value').innerText = isMasked ? "***,***" : state.simulation.monthly.toLocaleString(); updateSimulation(); saveLocal(); }

function updateSimulation() {
    if(!document.getElementById('sim-start-age')) return;
    let startAge = parseInt(document.getElementById('sim-start-age').value) || 25;
    let endAge = parseInt(document.getElementById('sim-end-age').value) || 65;
    const monthly = state.simulation.monthly;
    const annualRate = parseFloat(document.getElementById('sim-annual-rate').value) || 0;
    const inflationRate = parseFloat(document.getElementById('sim-inflation-rate').value) || 0;

    if (endAge <= startAge) { endAge = startAge + 1; document.getElementById('sim-end-age').value = endAge; }
    state.simulation = { startAge, endAge, monthly, annualRate, inflationRate };

    const realRate = annualRate - inflationRate;
    document.getElementById('sim-real-rate').innerText = realRate.toFixed(1);
    
    document.getElementById('sim-monthly-value').innerText = isMasked ? "***,***" : state.simulation.monthly.toLocaleString();

    const years = endAge - startAge; const labels = [], principalData = [], interestData = [], totalData = [];
    let totalAmount = 0, totalPrincipal = 0; const monthlyRate = realRate / 100 / 12;

    for (let y = 0; y <= years; y++) {
        labels.push(`${startAge + y}歳`); principalData.push(Math.round(totalPrincipal)); interestData.push(Math.round(totalAmount - totalPrincipal)); totalData.push(Math.round(totalAmount));
        for (let m = 0; m < 12; m++) { totalPrincipal += monthly; totalAmount += monthly; totalAmount *= (1 + monthlyRate); }
    }
    simData = { labels, principal: principalData, interest: interestData, total: totalData };

    const slider = document.getElementById('sim-slider'); slider.max = years; slider.value = years; updateSliderDisplay(years);
    document.getElementById('sim-end-age-label').innerText = endAge; 
    document.getElementById('sim-final-amount').innerText = isMasked ? "***,***" : Math.round(totalAmount).toLocaleString();
    
    if(document.getElementById('view-simulation').classList.contains('active')) renderSimChart();
}

function renderSimChart() {
    if (typeof Chart === 'undefined') return; 
    const ctx = document.getElementById('simChart');
    if (!ctx) return;
    if (simChartInstance) simChartInstance.destroy();
    
    // CSS変数が読み込まれるまでのラグを考慮して、もし空ならデフォルトのダークカラーにする
    let accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    if (!accentColor) accentColor = '#1d1d1f';

    simChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: simData.labels,
            datasets: [
                { label: '元本', data: simData.principal, backgroundColor: 'rgba(150, 150, 150, 0.6)', borderColor: 'rgba(150, 150, 150, 1)', borderWidth: 1 },
                { label: '運用益', data: simData.interest, backgroundColor: accentColor + '99', borderColor: accentColor, borderWidth: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ¥' + ctx.raw.toLocaleString() } } },
            scales: { x: { stacked: true, ticks: { maxTicksLimit: 6, font: { size: 10 } } }, y: { stacked: true, ticks: { callback: (val) => '¥' + (val / 10000).toFixed(0) + '万', font: { size: 10 } } } }
        }
    });
}

function updateSliderDisplay(index) {
    const idx = parseInt(index);
    document.getElementById('sim-slider-age').innerText = simData.labels[idx] || '--';
    document.getElementById('sim-slider-principal').innerText = isMasked ? "***,***" : '¥' + (simData.principal[idx] || 0).toLocaleString();
    document.getElementById('sim-slider-interest').innerText = isMasked ? "***,***" : '¥' + (simData.interest[idx] || 0).toLocaleString();
    document.getElementById('sim-slider-total').innerText = isMasked ? "***,***" : '¥' + (simData.total[idx] || 0).toLocaleString();
}
function onSimSliderChange(value) { vibrate(); updateSliderDisplay(value); }

// ==========================================================================
// ✉️ 封筒管理
// ==========================================================================
function toggleEnvManagement() { vibrate(); document.getElementById('env-management-panel').classList.toggle('hidden'); }

function openEnvelopeModal(id = null) {
    const title = document.getElementById('modal-envelope-title'); const delBtn = document.getElementById('env-btn-delete');
    if (id) {
        const env = state.envelopes.find(e => e.id === id);
        title.innerText = "封筒の編集"; document.getElementById('envelope-edit-id').value = id;
        document.getElementById('env-input-emoji').value = env.emoji; document.getElementById('env-input-name').value = env.name;
        document.getElementById('env-input-target').value = env.target; document.getElementById('env-input-color').value = env.color;
        delBtn.classList.remove('hidden');
    } else {
        title.innerText = "新しい封筒"; document.getElementById('envelope-edit-id').value = "";
        document.getElementById('env-input-emoji').value = "💰"; document.getElementById('env-input-name').value = "";
        document.getElementById('env-input-target').value = ""; document.getElementById('env-input-color').value = "#4b7bff";
        delBtn.classList.add('hidden');
    }
    openModal('modal-envelope');
}

function saveEnvelope() {
    vibrate();
    const id = document.getElementById('envelope-edit-id').value;
    
    // 🔧 修正: Array.from()[0] を使って文字化け（千切れ）を完全に防止
    const emojiStr = document.getElementById('env-input-emoji').value.trim() || "✉️";
    const emojiArray = Array.from(emojiStr);
    const emoji = emojiArray.length > 0 ? emojiArray[0] : "✉️";
    
    const name = document.getElementById('env-input-name').value.trim();
    const targetStr = document.getElementById('env-input-target').value;
    const color = document.getElementById('env-input-color').value;

    if (!name || !targetStr) return alert("入力してください。");
    const target = parseInt(targetStr.replace(/[^0-9]/g, ''), 10); 
    if (isNaN(target) || target <= 0) return alert("目標金額は1円以上を設定してください。");

    if (id) {
        const env = state.envelopes.find(e => e.id === parseInt(id));
        if (env) { env.emoji = emoji; env.name = name; env.target = target; env.color = color; }
    } else { state.envelopes.push({ id: Date.now(), emoji, name, target, current: 0, color }); }
    saveLocal(); closeModal('modal-envelope');
}

function deleteEnvelope() {
    vibrate(); const id = parseInt(document.getElementById('envelope-edit-id').value);
    const env = state.envelopes.find(e => e.id === id); if (!env) return;
    let msg = "この封筒を削除しますか？\n（※中身のお金や履歴は総資産には戻らず、完全に消滅します）";
    if (env.current > 0) msg = `⚠️ 最終警告\nこの封筒には現在 ¥${env.current.toLocaleString()} が入っています。\n現実の封筒を処分するのと同じく、削除するとこの金額も完全に消滅します！\n本当に削除してよろしいですか？`;
    if (confirm(msg)) { state.envelopes = state.envelopes.filter(e => e.id !== id); saveLocal(); closeModal('modal-envelope'); }
}

function openMoneyModal(id) {
    const env = state.envelopes.find(e => e.id === id); if (!env) return;
    document.getElementById('em-id').value = id; 
    document.getElementById('em-emoji').innerText = escapeHTML(env.emoji);
    document.getElementById('em-name').innerText = escapeHTML(env.name); 
    document.getElementById('em-current').innerText = env.current.toLocaleString();
    document.getElementById('em-amount').value = ""; 
    openModal('modal-envelope-money');
}

function updateEnvelopeMoney(type) {
    vibrate();
    const id = parseInt(document.getElementById('em-id').value);
    const amountStr = document.getElementById('em-amount').value;
    const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
    
    if (isNaN(amount) || amount <= 0) return alert("1円以上の金額を入力してください。");
    const env = state.envelopes.find(e => e.id === id); if (!env) return;

    const wasFull = env.current >= env.target;

    if (type === 'add') { env.current += amount; } else { if (env.current < amount) return alert("残高不足です"); env.current -= amount; }
    saveLocal(); closeModal('modal-envelope-money');

    if (type === 'add' && !wasFull && env.current >= env.target) {
        setTimeout(() => { alert(`🎉満タン達成！: ${env.name}`); fireConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }); }, 300);
    }
}

function renderEnvelopes() {
    const grid = document.getElementById('envelopes-grid'); const mContainer = document.getElementById('management-envelope-list');
    if(!grid || !mContainer) return;
    grid.innerHTML = ""; mContainer.innerHTML = "";

    if (state.envelopes.length === 0) {
        grid.innerHTML = "<div style='grid-column: 1/-1; text-align:center; opacity:0.5; padding:30px; font-weight:bold;'>まだ封筒がありません</div>";
        mContainer.innerHTML = "<div style='text-align:center; opacity:0.5; font-size:12px;'>編集できる封筒がありません</div>"; return;
    }

    state.envelopes.forEach(env => {
        const percent = Math.min(100, Math.floor((env.current / env.target) * 100));
        const card = document.createElement('div'); card.className = "env-card"; card.onclick = () => openMoneyModal(env.id);
        card.innerHTML = `<div class="env-header" style="background: ${env.color};"><div class="env-emoji">${escapeHTML(env.emoji)}</div><div class="env-header-name">${escapeHTML(env.name)}</div></div>
            <div class="env-body"><div class="env-amount">${isMasked ? '***,***' : '¥' + env.current.toLocaleString()}</div><div class="env-target"><span>目標: ¥${env.target.toLocaleString()}</span><span>${percent}%</span></div>
            <div class="env-progress-bg"><div class="env-progress-fill" style="width: ${percent}%; background: ${env.color};"></div></div></div>`;
        grid.appendChild(card);

        const mItem = document.createElement('div');
        mItem.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--panel-bg); padding:10px; border-radius:8px;';
        mItem.innerHTML = `<div style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHTML(env.emoji)} ${escapeHTML(env.name)} (¥${env.target.toLocaleString()})</div>
            <button class="btn btn-outline" style="padding:6px 12px; font-size:12px;" onclick="openEnvelopeModal(${env.id})">✏️ 編集</button>`;
        mContainer.appendChild(mItem);
    });
}

// ==========================================================================
// 🎁 ご褒美＆振り返り
// ==========================================================================
function addRewardTarget() {
    vibrate();
    const amountStr = document.getElementById('reward-target-amount').value;
    const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
    const name = document.getElementById('reward-target-name').value.trim();
    if (isNaN(amount) || !name) return alert("金額とご褒美を正しく入力してください。");
    if (amount <= 0) return alert("目標金額は1円以上を設定してください。");

    state.rewards.push({ id: Date.now(), amount: amount, name: name, achieved: false, achievedDate: null, shown: false });
    saveLocal(); document.getElementById('reward-target-amount').value = ""; document.getElementById('reward-target-name').value = ""; checkAchievements();
}

function deleteReward(id) { vibrate(); if (confirm("この目標を削除しますか？")) { state.rewards = state.rewards.filter(r => r.id !== id); saveLocal(); } }

function checkAchievements() {
    if (state.securities.history.length === 0) return;
    const currentAmount = state.securities.history[0].amount; const today = new Date().toLocaleDateString('ja-JP');
    state.rewards.forEach(reward => {
        if (!reward.achieved && currentAmount >= reward.amount) { reward.achieved = true; reward.achievedDate = today; if (!reward.shown) pendingAchievements.push(reward); }
    });
    saveLocal(); showNextAchievement();
}

function showNextAchievement() {
    if (pendingAchievements.length === 0) return;
    const reward = pendingAchievements.shift(); reward.shown = true; saveLocal();
    document.getElementById('achievement-amount').innerText = `¥${reward.amount.toLocaleString()}`;
    document.getElementById('achievement-reward').innerText = `🎁 ${escapeHTML(reward.name)}`;
    openModal('modal-achievement');
    fireConfetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
}

function closeAchievementModal() { closeModal('modal-achievement'); setTimeout(showNextAchievement, 500); }

function renderRewards() {
    const pendingList = document.getElementById('reward-pending-list'); const achievedList = document.getElementById('reward-achieved-list');
    if(!pendingList || !achievedList) return;
    pendingList.innerHTML = ""; achievedList.innerHTML = "";
    const pendingRewards = state.rewards.filter(r => !r.achieved).sort((a, b) => a.amount - b.amount);
    const achievedRewards = state.rewards.filter(r => r.achieved).sort((a, b) => b.amount - a.amount);

    if (pendingRewards.length === 0) pendingList.innerHTML = "<div style='text-align:center; opacity:0.5; font-size:12px; padding:15px;'>目標を設定しましょう！</div>";
    else pendingRewards.forEach(r => {
        const div = document.createElement('div'); div.className = "reward-item";
        div.innerHTML = `<div class="reward-info"><div class="reward-target-amount">${isMasked ? '***,***' : '¥' + r.amount.toLocaleString()}</div><div class="reward-name">🎁 ${escapeHTML(r.name)}</div></div><button class="btn-delete-history" onclick="deleteReward(${r.id})">×</button>`;
        pendingList.appendChild(div);
    });

    if (achievedRewards.length === 0) achievedList.innerHTML = "<div style='text-align:center; opacity:0.5; font-size:12px; padding:15px;'>まだ達成した目標はありません</div>";
    else achievedRewards.forEach(r => {
        const div = document.createElement('div'); div.className = "reward-item achieved";
        div.innerHTML = `<div class="reward-info"><div class="reward-target-amount">${isMasked ? '***,***' : '¥' + r.amount.toLocaleString()}</div><div class="reward-name">🎁 ${escapeHTML(r.name)}</div><div class="reward-achieved-date">📅 ${r.achievedDate} 達成</div></div><div class="reward-badge">🏆</div>`;
        achievedList.appendChild(div);
    });
}

function check25thAutomated() {
    const today = new Date();
    if (today.getDate() === 25 && state.lastReportMonth !== `${today.getFullYear()}-${today.getMonth() + 1}`) {
        state.lastReportMonth = `${today.getFullYear()}-${today.getMonth() + 1}`; trigger25thReport(false);
    }
}

function trigger25thReport(isTestMode = false) {
    vibrate();
    const secTotal = state.securities.history.length > 0 ? state.securities.history[0].amount : 0;
    const envTotal = state.envelopes.reduce((sum, env) => sum + env.current, 0);
    const today = new Date();
    const dateString = isTestMode ? `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()} (テスト)` : `${today.getFullYear()}年 ${today.getMonth() + 1}月25日`;

    let comment = "今月も資産管理お疲れ様でした！一歩一歩、確実に未来の自分のための種まきができています。この調子で楽しく続けていきましょう！🌱";
    if (secTotal > 1000000) comment = "凄い！証券口座の評価額が大きな大台をキープしていますね。投資の複利効果が育ってきています！🏆";

    document.getElementById('report-date-title').innerText = dateString;
    document.getElementById('report-securities-val').innerText = `¥ ${secTotal.toLocaleString()}`;
    document.getElementById('report-envelopes-val').innerText = `¥ ${envTotal.toLocaleString()}`;
    document.getElementById('report-comment').innerText = comment;
    openModal('modal-report-25th');
    fireConfetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });

    state.reports.unshift({ id: Date.now(), date: dateString, securitiesAmount: secTotal, envelopesAmount: envTotal, comment });
    saveLocal();
}

function renderMonthlyArchive() {
    const listEl = document.getElementById('monthly-archive-list'); if (!listEl) return;
    listEl.innerHTML = "";
    if (state.reports.length === 0) return listEl.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5; font-size:12px; font-weight:bold;">まだ振り返り記録がありません。<br>毎月25日に自動保存されます！</div>`;

    state.reports.forEach(rep => {
        const div = document.createElement('div'); div.className = "archive-card";
        div.innerHTML = `<div class="archive-date"><span>📅 ${rep.date}</span><button onclick="deleteArchiveItem(${rep.id})" style="background:transparent; border:none; color:#ff4444; font-size:14px; cursor:pointer;">🗑</button></div>
            <div class="archive-grid"><div class="archive-stat-box"><div class="archive-stat-lbl">📈 証券口座</div><div class="archive-stat-val">${isMasked ? '***,***' : '¥'+rep.securitiesAmount.toLocaleString()}</div></div>
            <div class="archive-stat-box"><div class="archive-stat-lbl">✉️ 封筒貯金</div><div class="archive-stat-val">${isMasked ? '***,***' : '¥'+rep.envelopesAmount.toLocaleString()}</div></div></div>
            <div style="font-size:11px; opacity:0.8; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px; line-height:1.4;">${escapeHTML(rep.comment)}</div>`;
        listEl.appendChild(div);
    });
}
function deleteArchiveItem(id) { vibrate(); if (confirm("この記録を削除しますか？")) { state.reports = state.reports.filter(r => r.id !== id); saveLocal(); } }

// ==========================================================================
// 🔒 セキュリティ管理
// ==========================================================================
function checkSecurityLock() { 
    if (state.pin) { 
        document.getElementById('lock-screen').classList.remove('hidden'); 
        resetPinDisplay(); 
    } 
}
function inputPin(num) { vibrate(); if (currentInputPin.length < 4) { currentInputPin += num; updatePinDots(); if (currentInputPin.length === 4) verifyPin(); } }
function clearPin() { vibrate(); currentInputPin = ""; updatePinDots(); document.getElementById('pin-error').innerText = ""; }
function updatePinDots() { document.querySelectorAll('.pin-dot').forEach((dot, idx) => { if (idx < currentInputPin.length) dot.classList.add('filled'); else dot.classList.remove('filled'); }); }
function resetPinDisplay() { currentInputPin = ""; updatePinDots(); document.getElementById('pin-error').innerText = ""; }
function verifyPin() {
    if (currentInputPin === state.pin) {
        document.getElementById('lock-screen').classList.add('hidden');
        document.getElementById('main-app-content').style.visibility = 'visible';
        
        const initialTab = location.hash ? location.hash.replace('#', '') : 'view-securities';
        switchTab(initialTab, false);
        updateUI(); updateSimulation(); check25thAutomated(); checkAchievements();
    } else { 
        vibrate(); document.getElementById('pin-error').innerText = "パスワードが違います"; setTimeout(resetPinDisplay, 800); 
    }
}
function showRecovery() { vibrate(); if (!state.secretQuestion) return alert("秘密の質問が未設定です。"); document.getElementById('recovery-question-text').innerText = escapeHTML(state.secretQuestion); document.getElementById('recovery-answer-input').value = ""; document.getElementById('recovery-screen').classList.remove('hidden'); }
function hideRecovery() { vibrate(); document.getElementById('recovery-screen').classList.add('hidden'); }
function attemptRecovery() {
    vibrate(); const ans = document.getElementById('recovery-answer-input').value.trim();
    if (ans === state.secretAnswer) { 
        state.pin = null; state.secretQuestion = null; state.secretAnswer = null; saveLocal(); 
        document.getElementById('recovery-screen').classList.add('hidden'); 
        document.getElementById('lock-screen').classList.add('hidden'); 
        document.getElementById('main-app-content').style.visibility = 'visible';
        updateUI(); updateSimulation();
        alert("ロックを強制解除しました。"); 
    } else alert("答えが違います。");
}
function openLockSetupModal() { document.getElementById('setup-pin').value = ""; document.getElementById('setup-answer').value = ""; openModal('modal-lock-setup'); }
function saveLockSetup() {
    vibrate(); 
    const pin = document.getElementById('setup-pin').value; 
    const q = document.getElementById('setup-question').value; 
    const ans = document.getElementById('setup-answer').value.trim();
    if (pin.length !== 4) return alert("PINは4桁の数字を入力してください。"); 
    if (!ans) return alert("答えを入力してください。");
    state.pin = pin; state.secretQuestion = q; state.secretAnswer = ans; saveLocal(); closeModal('modal-lock-setup'); alert("ロックを設定しました！次回起動時から有効になります。");
}
function removeLock() { vibrate(); if (confirm("本当にロックを解除しますか？")) { state.pin = null; state.secretQuestion = null; state.secretAnswer = null; saveLocal(); alert("ロックをオフにしました。"); } }

function resetData() {
    vibrate();
    if(!confirm("⚠️ 最終警告\n本当にすべてのデータを初期化（全消去）しますか？\n（復元するにはエクスポートしたJSONファイルが必要です）")) return;
    
    localStorage.removeItem('asset_gas_url');
    const req = indexedDB.deleteDatabase(DB_NAME);
    
    req.onsuccess = function () {
        alert("データを完全に消去しました。アプリを初期化します。");
        location.reload();
    };
    req.onerror = function () {
        alert("消去に失敗しました。スマホの設定からSafari等のキャッシュを削除してください。");
    };
    req.onblocked = function () {
        alert("⚠️ データベースがロックされています。他のタブをすべて閉じるか、アプリを再起動してからお試しください。");
    };
}

function exportData() { vibrate(); const dataStr = JSON.stringify(state); const blob = new Blob([dataStr], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `MY_ASSET_BACKUP_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); }
function importData(e) {
    vibrate(); const file = e.target.files[0]; if (!file) return;
    if (!confirm("現在のデータはすべて上書きされますがよろしいですか？")) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const importedState = JSON.parse(ev.target.result);
            if (importedState && typeof importedState === 'object') {
                state = { ...defaultState, ...importedState };
                await saveLocal(); alert("✨ データ復元成功！アプリを再起動します。"); location.reload();
            } else { throw new Error("不正なデータ"); }
        } catch (err) { alert("⚠️ 読み込みエラーが発生しました。ファイルが壊れています。"); e.target.value = ''; }
    };
    reader.readAsText(file);
}

function updateUI() {
    renderSecurities(); renderEnvelopes(); renderRewards(); renderMonthlyArchive();
    const lockText = document.getElementById('lock-status-text'); const btnSetup = document.getElementById('btn-setup-lock'); const btnRemove = document.getElementById('btn-remove-lock');
    if(!lockText) return;
    if (state.pin) { lockText.innerText = "設定済み (ON)"; lockText.style.color = "#4b7bff"; btnSetup.innerText = "パスワードを変更する"; btnRemove.classList.remove('hidden'); } 
    else { lockText.innerText = "未設定 (OFF)"; lockText.style.color = "inherit"; btnSetup.innerText = "ロックを設定する"; btnRemove.classList.add('hidden'); }
}

// 🔧 PWA更新バスター用 SW登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = 'sw.js?v=' + new Date().getTime(); // キャッシュバスター
        navigator.serviceWorker.register(swUrl).catch(err => console.log('SW registration failed: ', err));
    });
}