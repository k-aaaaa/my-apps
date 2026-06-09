// ==========================================================================
// 🚀 パスワード撤廃・初期化
// ==========================================================================
function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

const defaultStamps = [
    { target: 0, reward: "資産形成スタート！偉い！" },
    { target: 100000, reward: "ちょっといいコンビニスイーツプチ贅沢" },
    { target: 500000, reward: "スタバの新作をカスタム付きで贅沢に飲む" },
    { target: 1000000, reward: "いつもより少し贅沢なランチを食べる" },
    { target: 3000000, reward: "欲しかった服やアクセサリーを1つ買う" },
    { target: 5000000, reward: "高級ホテルビュッフェかプチ温泉旅行へ行く" },
    { target: 10000000, reward: "大台突破記念！最高級のディナーを堪能する" }
];

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
    graphMode: 'milestone', 
    customColors: {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
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
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); }
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
    t.style = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:10px 20px; border-radius:30px; font-size:12px; font-weight:bold; z-index:9999; letter-spacing:0.5px; pointer-events:none;';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// ==========================================================================
// 🎨 カラーカスタマイズ制御（部位変更版）
// ==========================================================================
function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.value = theme;

    if (!state.customColors[theme]) {
        const defaults = {
            'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
            'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
            'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
        };
        state.customColors[theme] = defaults[theme] || defaults['theme-stylish'];
    }

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

    const pickerBg = document.getElementById('custom-color-bg');
    const pickerPanel = document.getElementById('custom-color-panel');
    const pickerAccent = document.getElementById('custom-color-accent');
    if (pickerBg) pickerBg.value = rgbaToHex(colors.bg);
    if (pickerPanel) pickerPanel.value = rgbaToHex(colors.panel);
    if (pickerAccent) pickerAccent.value = rgbaToHex(colors.accent);
}

function updateCustomColor(type, value) {
    const theme = state.appTheme || 'theme-stylish';
    state.customColors[theme][type] = value;
    applyCurrentThemeAndColors(); saveLocal();
}

function resetCurrentThemeColors() {
    vibrate();
    const theme = state.appTheme || 'theme-stylish';
    const defaults = {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    };
    state.customColors[theme] = { ...defaults[theme] };
    applyCurrentThemeAndColors(); saveLocal();
    showToast("テーマの色を初期状態に戻しました！");
}

function changeAppTheme(themeName) {
    vibrate(); state.appTheme = themeName; applyCurrentThemeAndColors(); saveLocal();
}

// ==========================================================================
// 📱 タブ切替・モザイク
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

function toggleBlur(el) { vibrate(); el.classList.toggle('blurred-off'); }
function applyPeepingFilterToggle(checked) { state.peepingFilterActive = checked; saveLocal(); }
function refreshPeepingBlurState() {
    document.querySelectorAll('.blur-click').forEach(el => {
        if (state.peepingFilterActive) el.classList.remove('blurred-off'); 
        else el.classList.add('blurred-off');    
    });
}

// ==========================================================================
// 🏠 ダッシュボード更新
// ==========================================================================
function updateEvalPrompt() {
    vibrate();
    const val = prompt("現在のリアルな総資産残高を入力してください（半角数字）:", state.evaluation || "");
    if (val !== null && !isNaN(val) && val !== "") {
        state.evaluation = parseInt(val);
        state.memo = prompt("今回の更新に関する「一言メモ」があれば入力してください（空欄OK）") || "";
        
        if (!state.achievedTargets) state.achievedTargets = [];
        state.stamps.forEach(s => {
            if (state.evaluation >= s.target && !state.achievedTargets.includes(s.target)) {
                state.achievedTargets.push(s.target);
                setTimeout(() => { confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } }); alert(`🎉 おめでとうございます！\n総資産が【${s.target === 0 ? "START" : s.target.toLocaleString() + "円"}】を突破しました！\n\n💮 解放されたご褒美：\n${s.reward}`); }, 400);
            }
        });
        saveLocal(); showToast("📈 最新の資産総額を更新しました！");
    }
}

// ==========================================================================
// 📊 シミュレーター・ワンタッチ操作・リッチポップアップ
// ==========================================================================
function changeMonthly(delta) {
    vibrate();
    const input = document.getElementById('input-monthly');
    input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
    saveSimulationConditions();
}

function toggleGraphMode() {
    vibrate(); state.graphMode = state.graphMode === 'milestone' ? 'area' : 'milestone'; saveLocal();
}

function saveSimulationConditions() {
    state.ageCurrent = parseInt(document.getElementById('input-age-current').value) || 30;
    state.ageTarget = parseInt(document.getElementById('input-age-target').value) || 65;
    state.initialAmount = parseInt(document.getElementById('input-initial').value) || 0;
    state.monthly = parseInt(document.getElementById('input-monthly').value) || 0;
    state.rate = parseFloat(document.getElementById('input-rate').value) || 5.0;
    state.inflation = parseFloat(document.getElementById('input-inflation').value) || 2.0;
    
    if (state.ageCurrent >= state.ageTarget) {
        state.ageTarget = state.ageCurrent + 1;
        document.getElementById('input-age-target').value = state.ageTarget;
    }
    saveLocal();
}

// グラフタップ時のリッチポップアップ表示
function showChartPopup(age, total, principal) {
    vibrate();
    let popup = document.getElementById('chart-popup-element');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'chart-popup-element';
        popup.className = 'chart-popup hidden';
        document.body.appendChild(popup);
    }
    const profit = total - principal;
    popup.innerHTML = `📊 【${age}才時点の予測】\n\n💰 予測総額: ¥${total.toLocaleString()}\n(元本: ¥${principal.toLocaleString()} / 運用益: +¥${profit.toLocaleString()})`;
    
    // 一度アニメーションをリセットして再表示
    popup.classList.remove('hidden');
    popup.style.animation = 'none';
    void popup.offsetWidth; 
    popup.style.animation = null;

    clearTimeout(popup.timeoutId);
    popup.timeoutId = setTimeout(() => popup.classList.add('hidden'), 3500);
}

// ==========================================================================
// 🎁 ご褒美の自由編集機能
// ==========================================================================
function addNewRewardField() {
    vibrate();
    state.stamps.push({ target: 5000000, reward: "新しいご褒美" });
    saveLocal();
    setTimeout(() => {
        const container = document.getElementById('custom-rewards-list');
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function removeRewardField(idx) {
    vibrate();
    if(confirm("このご褒美目標を削除しますか？")) {
        state.stamps.splice(idx, 1);
        saveLocal();
    }
}

function saveCustomRewardsList() {
    vibrate();
    let newStamps = [];
    const rows = document.querySelectorAll('.reward-edit-row');
    rows.forEach(row => {
        const tVal = parseInt(row.querySelector('.reward-target-input').value) || 0;
        const rText = row.querySelector('.reward-text-input').value.trim() || "未設定";
        newStamps.push({ target: tVal, reward: rText });
    });
    
    newStamps.sort((a, b) => a.target - b.target);
    state.stamps = newStamps;
    saveLocal();
    showToast("🎁 ご褒美リストを保存しました！");
}

// ==========================================================================
// 🖼️ 設定管理・GAS同期
// ==========================================================================
function saveWelcomeImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try { localStorage.setItem('asset_welcome_img', event.target.result); document.getElementById('welcome-img-preview').src = event.target.result; document.getElementById('welcome-img-preview-container').classList.remove('hidden'); showToast("🖼️ お出迎え画像を登録しました！"); } 
        catch(err) { alert("⚠️ 画像が大きすぎます。"); }
    };
    reader.readAsDataURL(file);
}
function clearWelcomeImage() { localStorage.removeItem('asset_welcome_img'); document.getElementById('welcome-img-preview-container').classList.add('hidden'); showToast("画像を消去しました"); }
function saveSplashTime(val) { state.splashTime = parseInt(val); saveLocal(); }

function saveGasUrl() { GAS_URL = document.getElementById('gas-url').value.trim(); localStorage.setItem('asset_gas_url', GAS_URL); document.getElementById('sync-indicator').innerText = GAS_URL ? "☁ クラウド連携ON" : "スタンドアロン"; showToast("☁️ 連携URLを保存しました"); }
function toggleAutoSync(checked) { state.autoSync = checked; saveLocal(); }
function triggerManualSync() {
    vibrate(); if (!GAS_URL) return showToast("⚠️ 先に設定でGASのURLを登録してください");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" }).then(() => showToast("☁️ 資産データをバックアップしました！")).catch(() => showToast("⚠️ 同期エラーが発生しました"));
}
function cloudSyncSilent() { if (GAS_URL) fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" }); }
function resetData() { if(!confirm("本当に全ての資産データをリセットしますか？")) return; localStorage.clear(); location.reload(); }

// ==========================================================================
// 🖌️ メイン描画（複利エンジン・グラフ・FIRE・複利強調表示）
// ==========================================================================
function render() {
    document.getElementById('current-eval-display').innerText = "¥" + (state.evaluation || 0).toLocaleString();
    
    const memoPanel = document.getElementById('memo-display-panel');
    if (state.memo && state.memo.trim() !== "") {
        memoPanel.classList.remove('hidden'); document.getElementById('latest-memo-text').innerText = state.memo;
    } else { memoPanel.classList.add('hidden'); }

    const ageCurrent = state.ageCurrent || 30;
    const ageTarget = state.ageTarget || 65;
    const initialAmt = state.initialAmount || 0;
    const monthlyAmt = state.monthly || 0;
    const rateYear = (state.rate !== undefined) ? state.rate : 5.0;
    const inflationYear = (state.inflation !== undefined) ? state.inflation : 2.0;

    document.getElementById('input-age-current').value = ageCurrent;
    document.getElementById('input-age-target').value = ageTarget;
    document.getElementById('input-initial').value = initialAmt === 0 ? "" : initialAmt;
    document.getElementById('input-monthly').value = monthlyAmt;
    document.getElementById('input-rate').value = rateYear;
    document.getElementById('input-inflation').value = inflationYear;
    document.getElementById('graph-label-current').innerText = `${ageCurrent}才`;
    document.getElementById('graph-label-target').innerText = `${ageTarget}才`;

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
        yearlyHistoryData.push({ age: ageCurrent + i, p: Math.round(currentPrincipal), e: Math.round(currentEvaluation) });
    }

    const finalEvaluationResult = yearlyHistoryData.length > 0 ? yearlyHistoryData[yearlyHistoryData.length - 1].e : currentEvaluation;
    document.getElementById('future-amount').innerText = "¥" + finalEvaluationResult.toLocaleString();
    
    const inflationCompoundFactor = Math.pow(1 + (inflationYear / 100), calculationYears);
    const realValueResult = Math.round(finalEvaluationResult / inflationCompoundFactor);
    document.getElementById('future-real-amount').innerText = "¥" + realValueResult.toLocaleString();

    // 🏝️ FIRE（不労所得）月額計算
    const fireMonthlyManYen = Math.floor((finalEvaluationResult * r) / 12 / 10000);
    document.getElementById('fire-monthly-amount').innerText = fireMonthlyManYen.toLocaleString();

    // 🔥 複利効果の強調表示パネル
    const totalProfit = finalEvaluationResult - currentPrincipal;
    const multiplier = (finalEvaluationResult / (currentPrincipal || 1)).toFixed(1);
    const highlightPanel = document.getElementById('profit-highlight');
    if (currentPrincipal > 0 && totalProfit > 0) {
        highlightPanel.innerHTML = `🔥 投資した元本 <strong>${currentPrincipal.toLocaleString()}円</strong> に対して<br>複利の力で <strong style="color:#ff4444; font-size:16px;">＋${totalProfit.toLocaleString()}円</strong> も増えました！<br><span style="font-size:11px; font-weight:bold; opacity:0.8;">(最終的に元本の約 ${multiplier}倍に膨らむ予測です)</span>`;
        highlightPanel.classList.remove('hidden');
    } else {
        highlightPanel.classList.add('hidden');
    }

    // グラフの描画
    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '';
    const maxEvaluationValue = Math.max(finalEvaluationResult, 1); 
    
    const isAreaMode = (state.graphMode === 'area');
    chartContainer.className = isAreaMode ? 'chart-flex-box mode-area' : 'chart-flex-box';

    let displayData = yearlyHistoryData;
    if (!isAreaMode) {
        displayData = yearlyHistoryData.filter(d => (d.age % 5 === 0) || d.age === ageTarget);
    }

    displayData.forEach(d => {
        const principalHeightPercent = (d.p / maxEvaluationValue) * 100;
        const totalHeightPercent = (d.e / maxEvaluationValue) * 100;
        const profitHeightPercent = Math.max(0, totalHeightPercent - principalHeightPercent);

        chartContainer.innerHTML += `
            <div class="chart-bar-container" onclick="showChartPopup(${d.age}, ${d.e}, ${d.p})">
                <div class="chart-bar-e" style="height: ${profitHeightPercent}%;"></div>
                <div class="chart-bar-p" style="height: ${principalHeightPercent}%;"></div>
            </div>
        `;
    });

    // スタンプカード
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

    // ご褒美の編集リスト生成
    const rewardMgrList = document.getElementById('custom-rewards-list');
    rewardMgrList.innerHTML = '';
    state.stamps.forEach((s, idx) => {
        rewardMgrList.innerHTML += `
            <div class="reward-edit-row">
                <input type="number" class="form-input reward-target-input" value="${s.target}">
                <span style="font-size:10px;">円</span>
                <input type="text" class="form-input flex-1 reward-text-input" placeholder="ご褒美内容" value="${s.reward}">
                <button onclick="removeRewardField(${idx})" style="background:none; border:none; color:#ff4444; font-size:16px; cursor:pointer;">✖</button>
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