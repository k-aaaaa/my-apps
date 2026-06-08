// ==========================================================================
// 🔑 1. 4桁パスワード認証システム
// ==========================================================================
(function() {
    let savedPass = localStorage.getItem('asset_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\n資産管理アプリ専用のパスワードを半角数字で決めてください。\n(例: 0000 など自由な数字)");
        if (savedPass) localStorage.setItem('asset_password', savedPass);
        else savedPass = "0000";
    }
    const authKey = "app_auth_asset";
    if (sessionStorage.getItem(authKey) !== "true") {
        if (prompt("パスワードを入力してください") === savedPass) {
            sessionStorage.setItem(authKey, "true");
        } else {
            document.body.innerHTML = "<div style='padding:50px;text-align:center;'><h1>認証失敗</h1><button onclick='location.reload()'>再試行</button></div>";
            throw new Error("Auth failed");
        }
    }
})();

function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

// ==========================================================================
// 💾 2. デフォルトのご褒美マイルストーン設定
// ==========================================================================
const defaultStamps = [
    { target: 0, reward: "資産形成スタート！偉い！" },
    { target: 100000, reward: "プチアイスかちょっといいコンビニスイーツプチ贅沢" },
    { target: 500000, reward: "スタバの新作をカスタム付きで贅沢に飲む" },
    { target: 1000000, reward: "いつもより少し贅沢なランチを食べる" },
    { target: 3000000, reward: "欲しかった服やアクセサリーを1つ買う" },
    { target: 5000000, reward: "高級ホテルビュッフェかプチ温泉旅行へ行く" },
    { target: 10000000, reward: "大台突破記念！最高級のディナーを堪能する" }
];

// ==========================================================================
// 💾 3. グローバルデータ構造と初期化
// ==========================================================================
let state = JSON.parse(localStorage.getItem('asset_universe_data')) || {
    evaluation: 0,       
    memo: "",            
    ageCurrent: 30,      
    ageTarget: 65,       
    initialAmount: 0,    
    monthly: 30000,      
    rate: 5.0,           
    inflation: 2.0,      
    appTheme: 'theme-stylish', 
    peepingFilterActive: false, 
    stamps: defaultStamps, 
    achievedTargets: [],  
    autoSync: false,
    splashTime: 1200,
    // 🎨 カスタムカラー
    customColors: {
        'theme-stylish': { bg: '#cbd5e1', text: '#1d1d1f', primary: '#1d1d1f' },
        'theme-cute': { bg: '#fff0f5', text: '#4a3737', primary: '#ffb3c1' },
        'theme-gaming': { bg: '#050508', text: '#00ffcc', primary: '#00ffcc' },
        'theme-glitter': { bg: '#03010a', text: '#ffffff', primary: '#8a2be2' }
    }
};
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

window.addEventListener('DOMContentLoaded', () => {
    applyCurrentThemeAndColors();

    const imgData = localStorage.getItem('asset_welcome_img');
    const splashTime = state.splashTime || 1200;
    if (imgData) {
        document.getElementById('splash-default').classList.add('hidden');
        const customImg = document.getElementById('splash-custom');
        customImg.src = imgData;
        customImg.classList.remove('hidden');
    }
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
    }, splashTime);

    document.getElementById('sync-indicator').innerText = GAS_URL ? "☁ クラウド連携ON" : "スタンドアロン";

    render();
});

function saveLocal() {
    localStorage.setItem('asset_universe_data', JSON.stringify(state));
    render();
    if (state.autoSync) cloudSyncSilent();
}

function showToast(msg) {
    const t = document.createElement('div');
    t.style = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:10px 20px; border-radius:30px; font-size:12px; font-weight:bold; z-index:9999; letter-spacing:0.5px;';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// ==========================================================================
// 🎨 4. カラーカスタマイズ制御エンジン
// ==========================================================================
function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    document.body.className = theme;

    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.value = theme;

    if (!state.customColors) {
        state.customColors = {
            'theme-stylish': { bg: '#cbd5e1', text: '#1d1d1f', primary: '#1d1d1f' },
            'theme-cute': { bg: '#fff0f5', text: '#4a3737', primary: '#ffb3c1' },
            'theme-gaming': { bg: '#050508', text: '#00ffcc', primary: '#00ffcc' },
            'theme-glitter': { bg: '#03010a', text: '#ffffff', primary: '#8a2be2' }
        };
    }
    if (!state.customColors[theme]) {
        state.customColors[theme] = { bg: '#cbd5e1', text: '#1d1d1f', primary: '#1d1d1f' };
    }

    const colors = state.customColors[theme];
    const root = document.documentElement;

    if (theme === 'theme-stylish') {
        root.style.setProperty('--stylish-bg', `radial-gradient(circle at 20% 20%, #ffffff 0%, ${colors.bg} 100%)`);
        root.style.setProperty('--stylish-text', colors.text);
        root.style.setProperty('--stylish-primary', colors.primary);
    } else if (theme === 'theme-cute') {
        root.style.setProperty('--cute-bg', `linear-gradient(135deg, #ffffff 0%, ${colors.bg} 100%)`);
        root.style.setProperty('--cute-text', colors.text);
        root.style.setProperty('--cute-primary', colors.primary);
    } else if (theme === 'theme-gaming') {
        root.style.setProperty('--gaming-bg', `radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, ${colors.bg} 100%)`);
        root.style.setProperty('--gaming-text', colors.text);
        root.style.setProperty('--gaming-primary', colors.primary);
    } else if (theme === 'theme-glitter') {
        root.style.setProperty('--glitter-bg', `linear-gradient(135deg, #0e0524 0%, ${colors.bg} 60%, #000000 100%)`);
        root.style.setProperty('--glitter-text', colors.text);
        root.style.setProperty('--glitter-primary', colors.primary);
        root.style.setProperty('--glitter-reflect', colors.primary + "66"); 
    }

    const pickerBg = document.getElementById('custom-color-bg');
    const pickerText = document.getElementById('custom-color-text');
    const pickerPrimary = document.getElementById('custom-color-primary');

    if (pickerBg) pickerBg.value = colors.bg.startsWith('#') ? colors.bg : '#cbd5e1';
    if (pickerText) pickerText.value = colors.text.startsWith('#') ? colors.text : '#1d1d1f';
    if (pickerPrimary) pickerPrimary.value = colors.primary.startsWith('#') ? colors.primary : '#1d1d1f';
}

function updateCustomColor(type, value) {
    const theme = state.appTheme || 'theme-stylish';
    state.customColors[theme][type] = value;
    applyCurrentThemeAndColors();
    saveLocal();
}

function resetCurrentThemeColors() {
    vibrate();
    const theme = state.appTheme || 'theme-stylish';
    const defaults = {
        'theme-stylish': { bg: '#cbd5e1', text: '#1d1d1f', primary: '#1d1d1f' },
        'theme-cute': { bg: '#fff0f5', text: '#4a3737', primary: '#ffb3c1' },
        'theme-gaming': { bg: '#050508', text: '#00ffcc', primary: '#00ffcc' },
        'theme-glitter': { bg: '#03010a', text: '#ffffff', primary: '#8a2be2' }
    };
    state.customColors[theme] = { ...defaults[theme] };
    applyCurrentThemeAndColors();
    saveLocal();
    showToast("テーマの色を初期化しました");
}

function changeAppTheme(themeName) {
    vibrate();
    state.appTheme = themeName;
    applyCurrentThemeAndColors();
    saveLocal();
}

// ==========================================================================
// 📱 5. タブメニュー切り替え
// ==========================================================================
document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate();
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(btn.dataset.target).classList.add('active');
        btn.classList.add('active');
    });
});

// ==========================================================================
// 🕵️ 6. のぞき見防止フィルター
// ==========================================================================
function toggleBlur(el) {
    vibrate();
    el.classList.toggle('blurred-off');
}

function applyPeepingFilterToggle(checked) {
    state.peepingFilterActive = checked;
    saveLocal();
}

function refreshPeepingBlurState() {
    document.querySelectorAll('.blur-click').forEach(el => {
        if (state.peepingFilterActive) {
            el.classList.remove('blurred-off'); 
        } else {
            el.classList.add('blurred-off');    
        }
    });
}

// ==========================================================================
// 🏠 7. ダッシュボード：現在のリアル資産総額の更新とスタンプ判定
// ==========================================================================
function updateEvalPrompt() {
    vibrate();
    const val = prompt("現在のリアルな総資産残高を入力してください（半角数字）:", state.evaluation || "");
    if (val !== null && !isNaN(val) && val !== "") {
        const numVal = parseInt(val);
        const txtMemo = prompt("今回の更新に関する「一言メモ」があれば入力してください（空欄OK）");
        
        state.evaluation = numVal;
        state.memo = txtMemo || "";
        
        if (!state.achievedTargets) state.achievedTargets = [];
        
        state.stamps.forEach(s => {
            if (state.evaluation >= s.target && !state.achievedTargets.includes(s.target)) {
                state.achievedTargets.push(s.target);
                setTimeout(() => {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
                    alert(`🎉 おめでとうございます！\n総資産が【${s.target === 0 ? "START" : s.target.toLocaleString() + "円"}】を突破しました！\n\n💮 解放されたご褒美：\n${s.reward}`);
                }, 400);
            }
        });

        saveLocal();
        showToast("📈 最新の資産総額を更新しました！");
    }
}

// ==========================================================================
// 📊 8. 計算機：年齢ベース＆初期額対応の複利シミュレーション
// ==========================================================================
function saveSimulationConditions() {
    vibrate();
    state.ageCurrent = parseInt(document.getElementById('input-age-current').value) || 30;
    state.ageTarget = parseInt(document.getElementById('input-age-target').value) || 65;
    state.initialAmount = parseInt(document.getElementById('input-initial').value) || 0;
    state.monthly = parseInt(document.getElementById('input-monthly').value) || 30000;
    state.rate = parseFloat(document.getElementById('input-rate').value) || 5.0;
    state.inflation = parseFloat(document.getElementById('input-inflation').value) || 2.0;
    
    if (state.ageCurrent >= state.ageTarget) {
        alert("⚠️ 目標の年齢は、現在の年齢より高い歳を設定してください！");
        state.ageTarget = state.ageCurrent + 1;
    }

    saveLocal();
    showToast("📊 複利シミュレーションを再計算しました");
}

// ==========================================================================
// 🖼️ 9. 設定・管理ロジック
// ==========================================================================
function saveWelcomeImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            localStorage.setItem('asset_welcome_img', event.target.result);
            document.getElementById('welcome-img-preview').src = event.target.result;
            document.getElementById('welcome-img-preview-container').classList.remove('hidden');
            showToast("🖼️ お出迎え画像を登録しました！");
        } catch(err) {
            alert("⚠️ 画像サイズが大きすぎます。小さめの画像を選んでください。");
        }
    };
    reader.readAsDataURL(file);
}

function clearWelcomeImage() {
    localStorage.removeItem('asset_welcome_img');
    document.getElementById('welcome-img-preview-container').classList.add('hidden');
    showToast("画像を消去しました");
}

function saveSplashTime(val) {
    state.splashTime = parseInt(val);
    saveLocal();
}

function savePasswordOnly() {
    const p = document.getElementById('settings-password').value.trim();
    if(p.length > 0) {
        localStorage.setItem('asset_password', p);
        showToast("🔑 パスワードを変更しました");
        document.getElementById('settings-password').value = "";
    }
}

function saveCustomRewardsList() {
    vibrate();
    state.stamps.forEach((s, idx) => {
        const inputEl = document.getElementById(`reward-input-${idx}`);
        if (inputEl) s.reward = inputEl.value.trim() || "ご褒美未設定";
    });
    saveLocal();
    showToast("🎁 ご褒美のプレゼント内容を保存しました");
}

// ==========================================================================
// ☁  10. GASバックアップ連携
// ==========================================================================
function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value.trim();
    localStorage.setItem('asset_gas_url', GAS_URL);
    document.getElementById('sync-indicator').innerText = GAS_URL ? "☁ クラウド連携ON" : "スタンドアロン";
    showToast("☁️ 連携URLを保存しました");
}

function toggleAutoSync(checked) {
    state.autoSync = checked;
    saveLocal();
}

function triggerManualSync() {
    vibrate();
    if (!GAS_URL) return showToast("⚠️ 先に設定でGASのURLを登録してください");
    showToast("☁️ 同期中...");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" })
    .then(() => showToast("☁️ 資産データをバックアップしました！"))
    .catch(() => showToast("⚠️ 同期エラーが発生しました"));
}

function cloudSyncSilent() {
    if (!GAS_URL) return;
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" });
}

function resetData() {
    if(!confirm("本当に全ての資産データをリセットしますか？設定したご褒美内容も初期化されます。")) return;
    localStorage.clear();
    location.reload();
}

// ==========================================================================
// 🖌️ 11. メイン画面・描画（レンダリング）および複利計算エンジン
// ==========================================================================
function render() {
    document.getElementById('current-eval-display').innerText = "¥" + (state.evaluation || 0).toLocaleString();
    
    const memoPanel = document.getElementById('memo-display-panel');
    if (state.memo && state.memo.trim() !== "") {
        memoPanel.classList.remove('hidden');
        document.getElementById('latest-memo-text').innerText = state.memo;
    } else {
        memoPanel.classList.add('hidden');
    }

    const ageCurrent = state.ageCurrent || 30;
    const ageTarget = state.ageTarget || 65;
    const initialAmt = state.initialAmount || 0;
    const monthlyAmt = state.monthly || 30000;
    const rateYear = (state.rate !== undefined) ? state.rate : 5.0;
    const inflationYear = (state.inflation !== undefined) ? state.inflation : 2.0;

    document.getElementById('input-age-current').value = ageCurrent;
    document.getElementById('input-age-target').value = ageTarget;
    document.getElementById('input-initial').value = initialAmt === 0 ? "" : initialAmt;
    document.getElementById('input-monthly').value = monthlyAmt;
    document.getElementById('input-rate').value = rateYear;
    document.getElementById('input-inflation').value = inflationYear;

    document.getElementById('graph-label-current').innerText = `${ageCurrent}才 (現在)`;
    document.getElementById('graph-label-target').innerText = `${ageTarget}才 (目標)`;

    let calculationYears = ageTarget - ageCurrent;
    if (calculationYears < 1) calculationYears = 1;

    let currentPrincipal = initialAmt; 
    let currentEvaluation = initialAmt; 
    const r = rateYear / 100; 
    
    let yearlyHistoryData = []; 

    for (let i = 1; i <= calculationYears; i++) {
        const yearlyContribution = monthlyAmt * 12;
        currentPrincipal += yearlyContribution;
        currentEvaluation = (currentEvaluation + yearlyContribution) * (1 + r);
        
        yearlyHistoryData.push({
            yearIndex: i,
            age: ageCurrent + i,
            p: Math.round(currentPrincipal),
            e: Math.round(currentEvaluation)
        });
    }

    const finalEvaluationResult = yearlyHistoryData.length > 0 ? yearlyHistoryData[yearlyHistoryData.length - 1].e : currentEvaluation;
    document.getElementById('future-amount').innerText = "¥" + finalEvaluationResult.toLocaleString();
    
    const inflationCompoundFactor = Math.pow(1 + (inflationYear / 100), calculationYears);
    const realValueResult = Math.round(finalEvaluationResult / inflationCompoundFactor);
    document.getElementById('future-real-amount').innerText = "¥" + realValueResult.toLocaleString();

    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '';
    const maxEvaluationValue = Math.max(finalEvaluationResult, 1); 

    yearlyHistoryData.forEach(d => {
        const principalHeightPercent = (d.p / maxEvaluationValue) * 100;
        const totalHeightPercent = (d.e / maxEvaluationValue) * 100;
        const profitHeightPercent = Math.max(0, totalHeightPercent - principalHeightPercent);

        chartContainer.innerHTML += `
            <div class="chart-bar-container" title="${d.age}才時点の予測\n総額: ¥${d.e.toLocaleString()}\n(うち元本: ¥${d.p.toLocaleString()})">
                <div class="chart-bar-e" style="height: ${profitHeightPercent}%;"></div>
                <div class="chart-bar-p" style="height: ${principalHeightPercent}%;"></div>
            </div>
        `;
    });

    const stampList = document.getElementById('stamp-list');
    stampList.innerHTML = '';
    
    if (!state.achievedTargets) state.achievedTargets = [];

    state.stamps.forEach(s => {
        const isAchieved = state.evaluation >= s.target;
        const masuClass = isAchieved ? 'panel stamp-card-masu achieved' : 'panel stamp-card-masu not-achieved';
        const stampMarkHtml = isAchieved ? '<div class="achieved-stamp-mark">💮</div>' : '';
        const targetLabelText = s.target === 0 ? "START" : `¥${(s.target).toLocaleString()}`;
        
        stampList.innerHTML += `
            <div class="${masuClass}">
                ${stampMarkHtml}
                <div class="stamp-text-info">${s.target === 0 ? "初期登録" : "総資産目標"}</div>
                <div class="stamp-target-val">${targetLabelText}</div>
                <div class="stamp-reward-text">🎁 ${s.reward}</div>
            </div>
        `;
    });

    const rewardMgrList = document.getElementById('custom-rewards-list');
    rewardMgrList.innerHTML = '';
    state.stamps.forEach((s, idx) => {
        const targetLabelText = s.target === 0 ? "START" : `${s.target / 10000}万円`;
        rewardMgrList.innerHTML += `
            <div class="reward-edit-row">
                <span class="reward-edit-label">${targetLabelText}:</span>
                <input type="text" id="reward-input-${idx}" class="form-input flex-1" style="padding:6px 10px; font-size:12px;" value="${s.reward}">
            </div>
        `;
    });

    document.getElementById('settings-peeping').checked = state.peepingFilterActive || false;
    document.getElementById('gas-url').value = GAS_URL;
    
    const imgData = localStorage.getItem('asset_welcome_img');
    if (imgData) {
        document.getElementById('welcome-img-preview').src = imgData;
        document.getElementById('welcome-img-preview-container').classList.remove('hidden');
    }
    document.getElementById('settings-splash-time').value = state.splashTime || 1200;

    refreshPeepingBlurState();
}