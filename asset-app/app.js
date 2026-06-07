(function() {
    let savedPass = localStorage.getItem('asset_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\n資産アプリのパスワードを決めてください。", "0531");
        if (savedPass) localStorage.setItem('asset_password', savedPass);
        else savedPass = "0531";
    }
    const authKey = "app_auth_asset";
    if (sessionStorage.getItem(authKey) !== "true") {
        if (prompt("パスワードを入力してください") === savedPass) sessionStorage.setItem(authKey, "true");
        else { document.body.innerHTML = "<div style='padding:50px;text-align:center;'><h1>認証失敗</h1><button onclick='location.reload()'>再試行</button></div>"; throw new Error("Auth failed"); }
    }
})();

window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); }
    }, 800);
});

let state = JSON.parse(localStorage.getItem('asset_data')) || {
    principal: 0, evaluation: 0, monthly: 30000, investDay: 1, rate: 5, inflation: 2, years: 20, lastInvestMonth: ""
};

// スタンプ（マイルストーン）定義
const STAMPS = [
    { target: 0, reward: "ご褒美なし", text: "資産形成スタート！偉い！" },
    { target: 300000, reward: "プチご褒美（スタバ新作など）", text: "最初の壁突破！" },
    { target: 1000000, reward: "ちょっと美味しいランチ", text: "大台の100万円到達！" }
];
for(let i=2; i<=10; i++) {
    STAMPS.push({ target: i * 1000000, reward: "お好きなお菓子や入浴剤", text: `${i}00万円到達！` });
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#d8f3dc] text-[#1b4332] px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 toast-anim whitespace-nowrap';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function saveLocal() { localStorage.setItem('asset_data', JSON.stringify(state)); render(); }

// 自動積立ロジック（開いた時に確認）
function checkAutoInvest() {
    const today = new Date();
    const currentMonthStr = today.getFullYear() + "-" + (today.getMonth() + 1);
    if (state.lastInvestMonth !== currentMonthStr && today.getDate() >= state.investDay) {
        state.principal += state.monthly;
        state.lastInvestMonth = currentMonthStr;
        saveLocal();
        showToast("✨ 今月の自動積立を元本に反映しました！");
    }
}
checkAutoInvest();

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
    const titles = { 'home':'💰 ダッシュボード', 'milestones':'💮 ご褒美スタンプ', 'simulator':'📊 積立設定', 'settings':'⚙️ 設定' };
    document.getElementById('header-title').innerText = titles[tabId];
}

function updateEvalPrompt() {
    const val = prompt("証券アプリを見て、現在の「評価額（残高）」を入力してください\n※カンマなしの半角数字", state.evaluation);
    if(val !== null && !isNaN(val)) {
        state.evaluation = Number(val);
        // 元本が評価額より大きすぎる場合（初期化時など）の補正
        if (state.principal === 0 || state.principal > state.evaluation) state.principal = state.evaluation;
        saveLocal();
        showToast("📈 最新の評価額を反映しました！");
    }
}

function saveSimulation() {
    state.monthly = Number(document.getElementById('input-monthly').value);
    state.investDay = Number(document.getElementById('input-day').value);
    state.rate = Number(document.getElementById('input-rate').value);
    state.inflation = Number(document.getElementById('input-inflation').value);
    state.years = Number(document.getElementById('input-years').value);
    saveLocal();
    showToast("📊 設定を保存しました");
    showTab('home');
}

function resetData() {
    if(!confirm("本当に全てのデータを消去しますか？")) return;
    localStorage.removeItem('asset_data');
    location.reload();
}

function formatJPY(num) { return "¥" + num.toLocaleString('ja-JP'); }

function render() {
    document.getElementById('input-monthly').value = state.monthly;
    document.getElementById('input-day').value = state.investDay;
    document.getElementById('input-rate').value = state.rate;
    document.getElementById('input-inflation').value = state.inflation;
    document.getElementById('input-years').value = state.years;

    document.getElementById('current-eval-display').innerText = formatJPY(state.evaluation);
    document.getElementById('current-principal-display').innerText = formatJPY(state.principal);

    // グラフと未来予測の計算
    let currentP = state.principal;
    let currentE = state.evaluation;
    const m = state.monthly;
    const r = state.rate / 100;
    let graphData = [];

    for(let i=1; i<=state.years; i++) {
        currentP += (m * 12);
        currentE = (currentE + (m * 12)) * (1 + r);
        graphData.push({ p: Math.round(currentP), e: Math.round(currentE) });
    }

    const finalE = graphData.length > 0 ? graphData[graphData.length - 1].e : state.evaluation;
    document.getElementById('future-amount').innerText = formatJPY(finalE);
    
    // インフレ考慮の実質価値
    const realValue = Math.round(finalE / Math.pow(1 + (state.inflation / 100), state.years));
    document.getElementById('future-real-amount').innerText = formatJPY(realValue);

    const chart = document.getElementById('chart-container');
    chart.innerHTML = '';
    const maxVal = Math.max(finalE, 1); 
    
    graphData.forEach((d, idx) => {
        const pPercent = (d.p / maxVal) * 100;
        const profitPercent = ((d.e - d.p) / maxVal) * 100;
        chart.innerHTML += `<div class="flex-1 flex flex-col justify-end" title="${idx+1}年後: ${formatJPY(d.e)}">
            <div class="bg-[#74c69d] w-full opacity-90 rounded-t-sm" style="height: ${profitPercent}%;"></div>
            <div class="bg-[#2d6a4f] w-full" style="height: ${pPercent}%;"></div>
        </div>`;
    });

    // スタンプカード描画
    const stampList = document.getElementById('stamp-list');
    stampList.innerHTML = '';
    STAMPS.forEach(s => {
        const isAchieved = state.evaluation >= s.target;
        const opacity = isAchieved ? 'opacity-100' : 'opacity-40 grayscale';
        const stampMark = isAchieved ? '<div class="absolute -top-3 -right-3 text-red-500 font-black text-4xl transform rotate-12 drop-shadow-md">💮</div>' : '';
        
        stampList.innerHTML += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-green-50 relative ${opacity} transition-all">
                ${stampMark}
                <div class="text-[10px] text-gray-400 font-bold mb-1">${s.text}</div>
                <div class="text-xl font-black text-[#2d6a4f] mb-1">${(s.target / 10000).toLocaleString()}万円</div>
                <div class="text-xs font-bold text-orange-400">🎁 ${s.reward}</div>
            </div>
        `;
    });
}
render(); showTab('home');