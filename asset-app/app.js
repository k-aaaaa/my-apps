// 初回パスワード設定＆認証
(function() {
    let savedPass = localStorage.getItem('asset_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\n資産アプリのパスワードを決めてください。", "0531");
        if (savedPass) localStorage.setItem('asset_password', savedPass);
        else savedPass = "0531";
    }
    const authKey = "app_auth_asset";
    if (sessionStorage.getItem(authKey) !== "true") {
        const input = prompt("パスワードを入力してください");
        if (input === savedPass) {
            sessionStorage.setItem(authKey, "true");
        } else {
            document.body.innerHTML = "<div style='padding:50px; text-align:center;'><h1>認証失敗</h1><p>パスワードが違います</p><button onclick='location.reload()' style='margin-top:20px; padding:10px 20px; background:#52b788; color:white; border-radius:10px;'>再試行</button></div>";
            throw new Error("Auth failed");
        }
    }
})();

// データ状態
let state = JSON.parse(localStorage.getItem('asset_data')) || {
    monthly: 30000, rate: 5, years: 20, goal: 20000000
};
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#d8f3dc] text-[#1b4332] px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 toast-anim whitespace-nowrap';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function saveLocal() {
    localStorage.setItem('asset_data', JSON.stringify(state));
    render();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');

    const titles = {
        'home': '💰 ダッシュボード', 'simulator': '📊 シミュレーション', 'settings': '⚙️ データと設定'
    };
    document.getElementById('header-title').innerText = titles[tabId];
}

// 複利計算ロジック
function calculateCompound() {
    let principal = 0;
    const m = state.monthly;
    const r = state.rate / 100;
    let data = [];
    for(let i=1; i<=state.years; i++) {
        // 年に1回の複利計算（簡易版）
        principal = (principal + (m * 12)) * (1 + r);
        data.push(Math.round(principal));
    }
    return data;
}

// シミュレーション保存
function saveSimulation() {
    state.monthly = Number(document.getElementById('input-monthly').value);
    state.rate = Number(document.getElementById('input-rate').value);
    state.years = Number(document.getElementById('input-years').value);
    state.goal = Number(document.getElementById('input-goal').value);
    saveLocal();
    showToast("📊 シミュレーションを更新しました！");
    showTab('home');
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('asset_gas_url', GAS_URL);
    showToast("💾 連携URLを保存しました");
}

async function syncCloud() {
    if (!GAS_URL) return showToast("⚠️ 設定からGAS URLを登録してください");
    const btn = document.getElementById('sync-btn');
    btn.classList.add('loading');
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(state), mode: 'no-cors' });
        showToast("☁️ クラウドへ同期しました！");
    } catch (e) { showToast("❌ 同期に失敗しました"); } finally { btn.classList.remove('loading'); }
}

function downloadFile() {
    const blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "asset_backup.json";
    a.click();
}

function uploadFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { state = JSON.parse(e.target.result); saveLocal(); showToast("🔄 復元が完了しました！"); };
    reader.readAsText(file);
}

// 数値をカンマ区切りの円表記に
function formatJPY(num) {
    return "¥" + num.toLocaleString('ja-JP');
}

function render() {
    // フォームへの値セット
    document.getElementById('input-monthly').value = state.monthly;
    document.getElementById('input-rate').value = state.rate;
    document.getElementById('input-years').value = state.years;
    document.getElementById('input-goal').value = state.goal;
    document.getElementById('gas-url').value = GAS_URL;

    const dataList = calculateCompound();
    const finalAmount = dataList.length > 0 ? dataList[dataList.length - 1] : 0;
    
    // ダッシュボード表示
    document.getElementById('future-amount').innerText = formatJPY(finalAmount);
    document.getElementById('goal-display').innerText = formatJPY(state.goal);

    // プログレスバーの計算
    let percent = Math.min(100, Math.round((finalAmount / state.goal) * 100));
    if (isNaN(percent)) percent = 0;
    document.getElementById('goal-percent').innerText = percent + "%";
    document.getElementById('progress-bar').style.width = percent + "%";
    
    // 目標達成時の色変更
    if(percent >= 100) document.getElementById('progress-bar').classList.replace('bg-[#52b788]', 'bg-yellow-400');
    else document.getElementById('progress-bar').classList.replace('bg-yellow-400', 'bg-[#52b788]');

    // グラフの描画
    const chart = document.getElementById('chart-container');
    chart.innerHTML = '';
    const maxVal = Math.max(...dataList, state.goal, 1); // 最大値の基準
    
    dataList.forEach((val, idx) => {
        const heightPercent = (val / maxVal) * 100;
        // 5年ごとに濃い色にするなどの工夫
        const barColor = (idx + 1 === state.years) ? 'bg-[#2d6a4f]' : 'bg-[#95d5b2]';
        chart.innerHTML += `<div class="flex-1 ${barColor} rounded-t-sm bar-grow opacity-90" style="height: ${heightPercent}%;" title="${idx+1}年後: ${formatJPY(val)}"></div>`;
    });
}

render();
showTab('home');