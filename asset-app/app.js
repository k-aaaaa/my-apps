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
// 💾 2. デフォルトのご褒美マイルストーン（スタンプ）設定
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
    evaluation: 0,       // 🏠 ホーム画面用：現在のリアルな総資産額
    memo: "",            // 最新の一言メモ
    ageCurrent: 30,      // 📊 計算機用：現在の年齢
    ageTarget: 65,       // 📊 計算機用：目標の年齢
    initialAmount: 0,    // 📊 計算機用：すでに運用中の初期投資額
    monthly: 30000,      // 📊 計算機用：毎月の積立額
    rate: 5.0,           // 📊 計算機用：想定利回り(%)
    inflation: 2.0,      // 📊 計算機用：インフレ率(%)
    appTheme: 'theme-stylish', // アプリのテーマ
    peepingFilterActive: false, // 常時モザイクにするか
    stamps: defaultStamps, // ご褒美カスタマイズ用
    achievedTargets: [],  // すでにスタンプが押された目標金額リスト
    autoSync: false,
    splashTime: 1200
};
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

// アプリ起動時のイベント
window.addEventListener('DOMContentLoaded', () => {
    // テーマの即時適用
    document.body.className = state.appTheme || 'theme-stylish';
    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.value = state.appTheme || 'theme-stylish';

    // お出迎えスプラッシュ画面の制御
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

    // バックアップ用インジケーター表示
    document.getElementById('sync-indicator').innerText = GAS_URL ? "☁ クラウド連携ON" : "スタンドアロンモード";

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
// 📱 4. タブメニュー切り替え
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
// 🕵️ 5. のぞき見防止フィルター（モザイクON/OFF）
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
            el.classList.remove('blurred-off'); // モザイクを強制ON
        } else {
            el.classList.add('blurred-off');    // モザイクを解除
        }
    });
}

// ==========================================================================
// 🏠 6. ダッシュボード：現在のリアル資産総額の更新（未来とは完全分離！）
// ==========================================================================
function updateEvalPrompt() {
    vibrate();
    const val = prompt("現在のリアルな総資産残高を入力してください（半角数字）:", state.evaluation || "");
    if (val !== null && !isNaN(val) && val !== "") {
        const numVal = parseInt(val);
        const txtMemo = prompt("今回の更新に関する「一言メモ」があれば入力してください（空欄OK）\n例: ボーナス支給、株価下落、今月は節約頑張った など");
        
        state.evaluation = numVal;
        state.memo = txtMemo || "";
        
        // ご褒美マイルストーンの自動達成判定
        if (!state.achievedTargets) state.achievedTargets = [];
        
        state.stamps.forEach(s => {
            if (state.evaluation >= s.target && !state.achievedTargets.includes(s.target)) {
                state.achievedTargets.push(s.target);
                // 達成時に華やかな演出とお知らせ
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
// 📊 7. 計算機：年齢ベース＆初期額対応の複利シミュレーション
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
// 🎨 8. 着せ替え・お出迎え設定
// ==========================================================================
function changeAppTheme(themeName) {
    vibrate();
    state.appTheme = themeName;
    document.body.className = themeName;
    localStorage.setItem('asset_universe_data', JSON.stringify(state));
}

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

// ご褒美アイテムのテキスト編集保存
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
// ☁  9. GASバックアップ連携
// ==========================================================================
function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value.trim();
    localStorage.setItem('asset_gas_url', GAS_URL);
    document.getElementById('sync-indicator').innerText = GAS_URL ? "☁ クラウド連携ON" : "スタンドアロンモード";
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
    .then(() => showToast("☁️ 資産データを安全にバックアップしました！"))
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
// 🖌️ 10. メイン画面・描画（レンダリング）および複利計算エンジン
// ==========================================================================
function render() {
    // 🏠 A. ダッシュボード画面の描画
    document.getElementById('current-eval-display').innerText = "¥" + (state.evaluation || 0).toLocaleString();
    
    const memoPanel = document.getElementById('memo-display-panel');
    if (state.memo && state.memo.trim() !== "") {
        memoPanel.classList.remove('hidden');
        document.getElementById('latest-memo-text').innerText = state.memo;
    } else {
        memoPanel.classList.add('hidden');
    }

    // 📊 B. 複利シミュレーターの本格計算エンジン
    const ageCurrent = state.ageCurrent || 30;
    const ageTarget = state.ageTarget || 65;
    const initialAmt = state.initialAmount || 0;
    const monthlyAmt = state.monthly || 30000;
    const rateYear = (state.rate !== undefined) ? state.rate : 5.0;
    const inflationYear = (state.inflation !== undefined) ? state.inflation : 2.0;

    // フォームへの現在値の同期
    document.getElementById('input-age-current').value = ageCurrent;
    document.getElementById('input-age-target').value = ageTarget;
    document.getElementById('input-initial').value = initialAmt === 0 ? "" : initialAmt;
    document.getElementById('input-monthly').value = monthlyAmt;
    document.getElementById('input-rate').value = rateYear;
    document.getElementById('input-inflation').value = inflationYear;

    document.getElementById('graph-label-current').innerText = `${ageCurrent}才 (現在)`;
    document.getElementById('graph-label-target').innerText = `${ageTarget}才 (目標)`;

    // 計算年数の割り出し
    let calculationYears = ageTarget - ageCurrent;
    if (calculationYears < 1) calculationYears = 1;

    let currentPrincipal = initialAmt; // 元本の追跡（初期運用額スタート！）
    let currentEvaluation = initialAmt; // 複利評価額の追跡
    const r = rateYear / 100; // 年利（小数）
    
    let yearlyHistoryData = []; // グラフ用の年ごとデータ配列

    for (let i = 1; i <= calculationYears; i++) {
        // 1年間分の積立を加算 (毎月積立額 × 12ヶ月)
        const yearlyContribution = monthlyAmt * 12;
        currentPrincipal += yearlyContribution;
        
        // 1年分の複利運用計算 (元あった額 ＋ 今年の積立額) に年利をかける
        currentEvaluation = (currentEvaluation + yearlyContribution) * (1 + r);
        
        yearlyHistoryData.push({
            yearIndex: i,
            age: ageCurrent + i,
            p: Math.round(currentPrincipal),
            e: Math.round(currentEvaluation)
        });
    }

    // 最終予測資産額の表示
    const finalEvaluationResult = yearlyHistoryData.length > 0 ? yearlyHistoryData[yearlyHistoryData.length - 1].e : currentEvaluation;
    document.getElementById('future-amount').innerText = "¥" + finalEvaluationResult.toLocaleString();
    
    // 物価上昇（インフレ）を考慮した実質価値の計算
    const inflationCompoundFactor = Math.pow(1 + (inflationYear / 100), calculationYears);
    const realValueResult = Math.round(finalEvaluationResult / inflationCompoundFactor);
    document.getElementById('future-real-amount').innerText = "¥" + realValueResult.toLocaleString();

    // 📊 C. 動的予測棒グラフの生成
    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '';
    const maxEvaluationValue = Math.max(finalEvaluationResult, 1); // 高さの基準

    yearlyHistoryData.forEach(d => {
        const principalHeightPercent = (d.p / maxEvaluationValue) * 100;
        const totalHeightPercent = (d.e / maxEvaluationValue) * 100;
        const profitHeightPercent = Math.max(0, totalHeightPercent - principalHeightPercent);

        // 各年齢ごとの縦棒
        chartContainer.innerHTML += `
            <div class="chart-bar-container" title="${d.age}才時点の予測\n総額: ¥${d.e.toLocaleString()}\n(うち元本: ¥${d.p.toLocaleString()})">
                <div class="chart-bar-e" style="height: ${profitHeightPercent}%;"></div>
                <div class="chart-bar-p" style="height: ${principalHeightPercent}%;"></div>
            </div>
        `;
    });

    // 💮 D. ご褒美スタンプカード（マイルストーン）の描画
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

    // 設定画面内のご褒美文字入力リストの生成
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

    // 設定画面インプット同期
    document.getElementById('settings-peeping').checked = state.peepingFilterActive || false;
    document.getElementById('gas-url').value = GAS_URL;
    
    const imgData = localStorage.getItem('asset_welcome_img');
    if (imgData) {
        document.getElementById('welcome-img-preview').src = imgData;
        document.getElementById('welcome-img-preview-container').classList.remove('hidden');
    }
    document.getElementById('settings-splash-time').value = state.splashTime || 1200;

    // のぞき見防止フィルターのモザイク更新
    refreshPeepingBlurState();
}