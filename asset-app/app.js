// パスワード認証
(function() {
    let savedPass = localStorage.getItem('asset_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\nこのアプリ専用のパスワードを半角数字で決めてください。\n(例: 0000 など自由な数字)");
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

window.addEventListener('load', () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
    const imgData = localStorage.getItem('asset_welcome_img');
    const splashTime = parseInt(localStorage.getItem('asset_splash_time')) || 1200;
    
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
});

const defaultStamps = [
    { target: 0, reward: "なし", text: "資産形成スタート！偉い！" },
    { target: 300000, reward: "プチアイスやスタバ新作など", text: "30万円突破！" },
    { target: 1000000, reward: "少し贅沢なランチ", text: "大台の100万円到達！" }
];
for(let i=2; i<=10; i++) {
    defaultStamps.push({ target: i * 1000000, reward: "お好きなお菓子など", text: `${i}00万円到達！` });
}

let state = JSON.parse(localStorage.getItem('asset_data')) || {
    principal: 0, evaluation: 0, monthly: 30000, investDay: 1, rate: 5, inflation: 2, years: 20, 
    lastInvestMonth: "", peeping: false, autoSync: false, memo: "", stamps: defaultStamps, achievedList: []
};
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#d8f3dc] text-[#1b4332] dark:bg-emerald-900 dark:text-emerald-100 px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 whitespace-nowrap';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function saveLocal() {
    localStorage.setItem('asset_data', JSON.stringify(state));
    render();
    if (state.autoSync) cloudSyncSilent();
}

function checkAutoInvest() {
    const today = new Date();
    const currentMonthStr = today.getFullYear() + "-" + (today.getMonth() + 1);
    if (state.lastInvestMonth !== currentMonthStr && today.getDate() >= state.investDay) {
        state.principal += state.monthly;
        state.lastInvestMonth = currentMonthStr;
        saveLocal();
    }
}
checkAutoInvest();

function showTab(tabId) {
    vibrate();
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
}

function toggleBlur(el) { vibrate(); el.classList.toggle('blurred-off'); }
function applyPeepingFilter() {
    const isPeeping = document.getElementById('settings-peeping').checked;
    document.querySelectorAll('.blur-click').forEach(el => {
        if (isPeeping) el.classList.remove('blurred-off');
        else el.classList.add('blurred-off');
    });
}

function updateEvalPrompt() {
    vibrate();
    const val = prompt("現在の評価額（現在の資産残高）を入力してください", state.evaluation);
    if(val !== null && !isNaN(val) && val !== "") {
        const numVal = Number(val);
        const txtMemo = prompt("今回の「一言メモ」があれば入力してください（空欄OK）\n例: 株価暴落、ボーナス月など");
        
        state.evaluation = numVal;
        if (state.principal === 0 || state.principal > state.evaluation) state.principal = state.evaluation;
        if (txtMemo) state.memo = txtMemo;
        
        state.stamps.forEach(s => {
            if (state.evaluation >= s.target && !state.achievedList.includes(s.target)) {
                state.achievedList.push(s.target);
                setTimeout(() => {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                    alert(`🎉 おめでとうございます！\n【${s.text}】を達成しました！\nご褒美：${s.reward}`);
                }, 500);
            }
        });
        saveLocal();
        showToast("📈 最新データを反映しました！");
    }
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

function saveSimulation() {
    vibrate();
    state.monthly = Number(document.getElementById('input-monthly').value);
    state.rate = Number(document.getElementById('input-rate').value);
    state.inflation = Number(document.getElementById('input-inflation').value);
    state.years = Number(document.getElementById('input-years').value);
    saveLocal();
    showToast("📊 計算機を更新しました");
}

function saveAppSettings() {
    vibrate();
    const newPass = document.getElementById('settings-password').value;
    if (newPass) {
        localStorage.setItem('asset_password', newPass);
        showToast("🔑 パスワードを更新しました");
    }
    state.peeping = document.getElementById('settings-peeping').checked;
    state.autoSync = document.getElementById('settings-auto-sync').checked;
    
    const splashTime = document.getElementById('settings-splash-time').value;
    localStorage.setItem('asset_splash_time', splashTime);

    state.stamps.forEach((s, idx) => {
        const inputEl = document.getElementById(`reward-input-${idx}`);
        if (inputEl) s.reward = inputEl.value;
    });

    saveLocal();
    showToast("⚙️ 設定を保存しました");
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('asset_gas_url', GAS_URL);
    showToast("☁️ 連携URLを保存しました");
}

function triggerManualSync() {
    vibrate();
    if (!GAS_URL) return showToast("⚠️ 先に設定でGASのURLを保存してください");
    showToast("☁️ 同期中...");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" })
    .then(() => showToast("☁️ クラウドへ手動同期しました！"))
    .catch(() => showToast("⚠️ 同期エラーが発生しました"));
}

function cloudSyncSilent() {
    if (!GAS_URL) return;
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" });
}

function resetData() {
    if(!confirm("本当に全てのデータを消去しますか？")) return;
    localStorage.clear();
    location.reload();
}

function formatJPY(num) { return "¥" + num.toLocaleString('ja-JP'); }

function render() {
    document.getElementById('settings-peeping').checked = state.peeping || false;
    document.getElementById('settings-auto-sync').checked = state.autoSync || false;
    document.getElementById('gas-url').value = GAS_URL;

    // ホーム画面：現在の資産だけを表示
    document.getElementById('current-eval-display').innerText = formatJPY(state.evaluation || 0);

    if (state.memo) {
        document.getElementById('memo-display-panel').classList.remove('hidden');
        document.getElementById('latest-memo-text').innerText = state.memo;
    }

    const imgData = localStorage.getItem('asset_welcome_img');
    if (imgData) {
        document.getElementById('welcome-img-preview').src = imgData;
        document.getElementById('welcome-img-preview-container').classList.remove('hidden');
    }

    // シミュレーター画面の入力値と計算
    document.getElementById('input-monthly').value = state.monthly || 30000;
    document.getElementById('input-rate').value = state.rate || 5;
    document.getElementById('input-inflation').value = state.inflation || 2;
    document.getElementById('input-years').value = state.years || 20;

    let currentP = state.evaluation || 0; // 現在の資産額をスタート地点にする
    let currentE = state.evaluation || 0;
    const m = state.monthly || 30000;
    const r = (state.rate || 5) / 100;
    let graphData = [];

    for(let i=1; i<=(state.years || 20); i++) {
        currentP += (m * 12);
        currentE = (currentE + (m * 12)) * (1 + r);
        graphData.push({ p: Math.round(currentP), e: Math.round(currentE) });
    }

    const finalE = graphData.length > 0 ? graphData[graphData.length - 1].e : currentE;
    document.getElementById('future-amount').innerText = formatJPY(finalE);
    
    const realValue = Math.round(finalE / Math.pow(1 + ((state.inflation || 2) / 100), (state.years || 20)));
    document.getElementById('future-real-amount').innerText = formatJPY(realValue);

    const chart = document.getElementById('chart-container');
    chart.innerHTML = '';
    const maxVal = Math.max(finalE, 1); 
    
    graphData.forEach((d, idx) => {
        const pPercent = (d.p / maxVal) * 100;
        const profitPercent = Math.max(0, ((d.e - d.p) / maxVal) * 100);
        chart.innerHTML += `<div class="flex-1 flex flex-col justify-end" title="${idx+1}年後: ${formatJPY(d.e)}">
            <div class="bg-[#74c69d] w-full opacity-90 rounded-t-sm" style="height: ${profitPercent}%;"></div>
            <div class="bg-[#2d6a4f] w-full" style="height: ${pPercent}%;"></div>
        </div>`;
    });

    // スタンプ
    const stampList = document.getElementById('stamp-list');
    stampList.innerHTML = '';
    state.stamps.forEach(s => {
        const isAchieved = state.evaluation >= s.target;
        const opacity = isAchieved ? 'opacity-100' : 'opacity-40 grayscale';
        const stampMark = isAchieved ? '<div class="absolute -top-3 -right-3 text-red-500 font-black text-4xl transform rotate-12 drop-shadow-md">💮</div>' : '';
        const targetText = s.target === 0 ? "START" : `${(s.target / 10000).toLocaleString()}万円`;
        
        stampList.innerHTML += `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-green-50 dark:border-gray-700 relative ${opacity}">
                ${stampMark}
                <div class="text-[10px] text-gray-400 font-bold mb-1">${s.text}</div>
                <div class="text-xl font-black text-[#2d6a4f] dark:text-emerald-400 mb-1">${targetText}</div>
                <div class="text-xs font-bold text-orange-400 dark:text-amber-500">🎁 ${s.reward}</div>
            </div>
        `;
    });

    const rewardMgrList = document.getElementById('custom-rewards-list');
    rewardMgrList.innerHTML = '';
    state.stamps.forEach((s, idx) => {
        const targetText = s.target === 0 ? "START" : `${(s.target / 10000).toLocaleString()}万`;
        rewardMgrList.innerHTML += `
            <div class="flex items-center gap-2 text-xs">
                <span class="w-16 font-bold text-gray-400">${targetText}:</span>
                <input type="text" id="reward-input-${idx}" class="flex-1 border-b border-gray-200 dark:border-gray-600 bg-transparent p-1 font-bold text-gray-700 dark:text-gray-200 outline-none" value="${s.reward}">
            </div>
        `;
    });

    applyPeepingFilter();
}
render(); showTab('home');