// ==========================================================================
// 🚀 データベースエンジン (IndexedDB)
// ==========================================================================
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

function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

// ==========================================================================
// 📦 ステート管理 (家計簿・グラフ・固定費・封筒・アーカイブ完全合体)
// ==========================================================================
const defaultState = {
    securities: { history: [] }, 
    cashflow: [],                // 収支データ [{id, type, category, amount, memo, date}]
    fixedCosts: [],              // 固定費データ [{id, name, amount}]
    envelopes: [],               
    reports: [],                 
    lastReportMonth: "",         
    pin: null,                   
    secretQuestion: null,        
    secretAnswer: null,          
    appTheme: 'theme-stylish',
    customColors: {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    }
};

let state = null;
let currentInputPin = "";
let chartInstance = null; // Chart.jsのインスタンス保持用

const CATEGORIES = {
    expense: ['食費', '日用品', 'エンタメ', '交通費', '美容・衣服', '固定費・その他'],
    income: ['給与', '副収入', 'その他投資収益']
};

// ==========================================================================
// 🚀 起動処理
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const storedState = await loadStateFromDB();
        if (storedState) {
            // ★ 超・自動穴埋め機能：どの時代の旧データが来ても安全に全枠をマージ
            state = { ...defaultState, ...storedState };
            if (!state.securities) state.securities = { history: [] };
            if (!state.cashflow) state.cashflow = [];
            if (!state.fixedCosts) state.fixedCosts = [];
            if (!state.envelopes) state.envelopes = [];
            if (!state.reports) state.reports = [];
        } else {
            state = JSON.parse(JSON.stringify(defaultState));
        }
    } catch(e) {
        state = JSON.parse(JSON.stringify(defaultState));
    }

    applyCurrentThemeAndColors();
    updateCategorySelector();

    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); }
        checkSecurityLock(); 
        check25thAutomated();
    }, 1200);

    updateUI();
});

async function saveLocal() {
    try {
        await saveStateToDB(state);
        updateUI();
    } catch (e) {
        console.error(e);
    }
}

// ==========================================================================
// 💸 収支・家計簿・グラフ・固定費ロジック (完全復活！)
// ==========================================================================
function updateCategorySelector() {
    const type = document.getElementById('cf-type').value;
    const catSel = document.getElementById('cf-category');
    if(!catSel) return;
    catSel.innerHTML = "";
    CATEGORIES[type].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.innerText = cat;
        catSel.appendChild(opt);
    });
}

function recordCashflow() {
    vibrate();
    const type = document.getElementById('cf-type').value;
    const category = document.getElementById('cf-category').value;
    const amountStr = document.getElementById('cf-amount').value;
    const memo = document.getElementById('cf-memo').value.trim();

    if(!amountStr) return alert("金額を入力してください。");
    const amount = parseInt(amountStr, 10);
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

    state.cashflow.unshift({
        id: Date.now(), type, category, amount, memo: memo || "なし", date: dateStr,
        year: today.getFullYear(), month: today.getMonth() + 1
    });

    saveLocal();
    document.getElementById('cf-amount').value = "";
    document.getElementById('cf-memo').value = "";
}

function deleteCashflow(id) {
    vibrate();
    if(confirm("この収支記録を削除しますか？")) {
        state.cashflow = state.cashflow.filter(c => c.id !== id);
        saveLocal();
    }
}

function addFixedCost() {
    vibrate();
    const name = document.getElementById('fixed-name').value.trim();
    const amountStr = document.getElementById('fixed-amount').value;
    if(!name || !amountStr) return alert("名前と金額を入力してください。");

    state.fixedCosts.push({ id: Date.now(), name, amount: parseInt(amountStr, 10) });
    saveLocal();
    document.getElementById('fixed-name').value = "";
    document.getElementById('fixed-amount').value = "";
}

function deleteFixedCost(id) {
    vibrate();
    if(confirm("この固定費を削除しますか？")) {
        state.fixedCosts = state.fixedCosts.filter(f => f.id !== id);
        saveLocal();
    }
}

function renderCashflowSystem() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // 当月データの抽出
    const currentMonthData = state.cashflow.filter(c => c.year === currentYear && c.month === currentMonth);

    let incomeSum = 0;
    let expenseSum = 0;
    let categoryMap = {};
    CATEGORIES.expense.forEach(c => categoryMap[c] = 0);

    currentMonthData.forEach(c => {
        if (c.type === 'income') incomeSum += c.amount;
        else {
            expenseSum += c.amount;
            if (categoryMap[c.category] !== undefined) categoryMap[c.category] += c.amount;
            else categoryMap['固定費・その他'] += c.amount;
        }
    });

    // サマリー表示更新
    document.getElementById('month-income').innerText = `¥${incomeSum.toLocaleString()}`;
    document.getElementById('month-expense').innerText = `¥${expenseSum.toLocaleString()}`;
    const balance = incomeSum - expenseSum;
    const balEl = document.getElementById('month-balance');
    balEl.innerText = `¥${balance.toLocaleString()}`;
    balEl.className = balance >= 0 ? "val income" : "val expense";

    // 収支履歴リスト
    const listEl = document.getElementById('cashflow-history-list');
    listEl.innerHTML = "";
    if(state.cashflow.length === 0) {
        listEl.innerHTML = "<div style='text-align:center; opacity:0.5; font-size:12px;'>収支履歴がありません</div>";
    } else {
        state.cashflow.slice(0, 10).forEach(c => {
            const div = document.createElement('div');
            div.className = "history-item";
            div.innerHTML = `
                <div>
                    <div class="history-date">${c.date} [${c.category}]</div>
                    <div style="font-size:11px; opacity:0.6;">メモ: ${c.memo}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="history-amount ${c.type}">
                        ${c.type === 'income' ? '+' : '-'}¥${c.amount.toLocaleString()}
                    </span>
                    <button class="btn-delete-history" onclick="deleteCashflow(${c.id})">×</button>
                </div>`;
            listEl.appendChild(div);
        });
    }

    // 固定費リストの描画
    const fixedListEl = document.getElementById('fixed-costs-list');
    fixedListEl.innerHTML = "";
    if(state.fixedCosts.length === 0) {
        fixedListEl.innerHTML = "<div style='text-align:center; opacity:0.5; font-size:12px;'>登録された固定費はありません</div>";
    } else {
        state.fixedCosts.forEach(f => {
            const div = document.createElement('div');
            div.className = "history-item";
            div.innerHTML = `
                <div><div class="history-amount" style="font-size:14px;">${f.name}</div></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="history-amount expense">¥${f.amount.toLocaleString()}</span>
                    <button class="btn-delete-history" onclick="deleteFixedCost(${f.id})">×</button>
                </div>`;
            fixedListEl.appendChild(div);
        });
    }

    // 表形式：月別集計表の作成
    const tableBody = document.getElementById('report-table-body');
    tableBody.innerHTML = "";
    
    // 過去12ヶ月の枠を自動集計
    let monthlyAgg = {};
    state.cashflow.forEach(c => {
        const key = `${c.year}/${c.month}`;
        if(!monthlyAgg[key]) monthlyAgg[key] = { income: 0, expense: 0 };
        if(c.type === 'income') monthlyAgg[key].income += c.amount;
        else monthlyAgg[key].expense += c.amount;
    });

    const sortedKeys = Object.keys(monthlyAgg).sort().reverse();
    if(sortedKeys.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='4' style='opacity:0.5; font-size:12px;'>データがありません</td></tr>";
    } else {
        sortedKeys.forEach(key => {
            const row = monthlyAgg[key];
            const bal = row.income - row.expense;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${key}</td>
                <td style="color:#2e7d32;">¥${row.income.toLocaleString()}</td>
                <td style="color:#c62828;">¥${row.expense.toLocaleString()}</td>
                <td style="color:${bal >= 0 ? '#2e7d32':'#c62828'};">¥${bal.toLocaleString()}</td>`;
            tableBody.appendChild(tr);
        });
    }

    // Chart.js 支出円グラフのレンダリング
    const ctx = document.getElementById('expenseChart');
    if(!ctx) return;

    if (chartInstance) chartInstance.destroy(); // 既存のグラフを破棄して再生成

    const chartLabels = Object.keys(categoryMap);
    const chartData = Object.values(categoryMap);
    const hasData = chartData.some(v => v > 0);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: hasData ? chartLabels : ['データなし'],
            datasets: [{
                data: hasData ? chartData : [1],
                backgroundColor: hasData ? ['#ff4b4b', '#4b7bff', '#ffb700', '#32cd32', '#a84bff', '#ff69b4'] : ['#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ==========================================================================
// 📅 25日の自動振り返りシステム & 図鑑ロジック
// ==========================================================================
function check25thAutomated() {
    const today = new Date();
    if (today.getDate() === 25 && state.lastReportMonth !== `${today.getFullYear()}-${today.getMonth() + 1}`) {
        state.lastReportMonth = `${today.getFullYear()}-${today.getMonth() + 1}`;
        trigger25thReport(false);
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

    document.getElementById('modal-report-25th').classList.remove('hidden');
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });

    state.reports.unshift({ id: Date.now(), date: dateString, securitiesAmount: secTotal, envelopesAmount: envTotal, comment });
    saveLocal();
}

function renderArchiveList() {
    const listEl = document.getElementById('archive-list');
    if(!listEl) return; listEl.innerHTML = "";
    if (state.reports.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.5; font-size:12px; font-weight:bold;">まだ振り返り記録がありません。毎月25日になるとここにレポートが自動保存されます！</div>`;
        return;
    }
    state.reports.forEach(rep => {
        const div = document.createElement('div');
        div.className = "archive-card";
        div.innerHTML = `
            <div class="archive-date"><span>📅 ${rep.date}</span><button onclick="deleteArchiveItem(${rep.id})" style="background:transparent; border:none; color:#ff4444; font-size:14px; cursor:pointer;">🗑</button></div>
            <div class="archive-grid">
                <div class="archive-stat-box"><div class="archive-stat-lbl">📈 証券口座</div><div class="archive-stat-val">¥${rep.securitiesAmount.toLocaleString()}</div></div>
                <div class="archive-stat-box"><div class="archive-stat-lbl">✉️ 封筒貯金</div><div class="archive-stat-val">¥${rep.envelopesAmount.toLocaleString()}</div></div>
            </div>
            <div style="font-size:11px; opacity:0.8; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px; line-height:1.4;">${rep.comment}</div>`;
        listEl.appendChild(div);
    });
}

function deleteArchiveItem(id) {
    vibrate(); if (confirm("この記録を削除しますか？")) { state.reports = state.reports.filter(r => r.id !== id); saveLocal(); }
}

// ==========================================================================
// 🔒 セキュリティ (PINロック)
// ==========================================================================
function checkSecurityLock() { if (state.pin) { document.getElementById('lock-screen').classList.remove('hidden'); resetPinDisplay(); } }
function inputPin(num) { vibrate(); if (currentInputPin.length < 4) { currentInputPin += num; updatePinDots(); if (currentInputPin.length === 4) verifyPin(); } }
function clearPin() { vibrate(); currentInputPin = ""; updatePinDots(); document.getElementById('pin-error').innerText = ""; }
function updatePinDots() { const dots = document.querySelectorAll('.pin-dot'); dots.forEach((dot, idx) => { if (idx < currentInputPin.length) dot.classList.add('filled'); else dot.classList.remove('filled'); }); }
function resetPinDisplay() { currentInputPin = ""; updatePinDots(); document.getElementById('pin-error').innerText = ""; }
function verifyPin() { if (currentInputPin === state.pin) { document.getElementById('lock-screen').classList.add('hidden'); } else { vibrate(); document.getElementById('pin-error').innerText = "パスワードが違います"; setTimeout(resetPinDisplay, 800); } }
function showRecovery() { vibrate(); if (!state.secretQuestion) { alert("秘密の質問が未設定です。"); return; } document.getElementById('recovery-question-text').innerText = state.secretQuestion; document.getElementById('recovery-answer-input').value = ""; document.getElementById('recovery-screen').classList.remove('hidden'); }
function hideRecovery() { vibrate(); document.getElementById('recovery-screen').classList.add('hidden'); }
function attemptRecovery() { vibrate(); const ans = document.getElementById('recovery-answer-input').value.trim(); if (ans === state.secretAnswer) { state.pin = null; state.secretQuestion = null; state.secretAnswer = null; saveLocal(); document.getElementById('recovery-screen').classList.add('hidden'); document.getElementById('lock-screen').classList.add('hidden'); alert("ロックを解除しました。"); } else { alert("答えが違います。"); } }
function openLockSetupModal() { vibrate(); document.getElementById('setup-pin').value = ""; document.getElementById('setup-answer').value = ""; document.getElementById('modal-lock-setup').classList.remove('hidden'); }
function saveLockSetup() { vibrate(); const pin = document.getElementById('setup-pin').value; const q = document.getElementById('setup-question').value; const ans = document.getElementById('setup-answer').value.trim(); if(pin.length !== 4) return alert("PINは4桁です。"); if(!ans) return alert("答えを入力してください。"); state.pin = pin; state.secretQuestion = q; state.secretAnswer = ans; saveLocal(); closeModal('modal-lock-setup'); alert("ロックを設定しました！"); }
function removeLock() { vibrate(); if(confirm("本当にロックを解除しますか？")) { state.pin = null; state.secretQuestion = null; state.secretAnswer = null; saveLocal(); alert("ロックをオフにしました。"); } }

// ==========================================================================
// 📈 証券口座メインロジック
// ==========================================================================
function recordSecurities() {
    vibrate(); const amountStr = document.getElementById('input-securities-amount').value; if (!amountStr) return alert("金額を入力してください。");
    const amount = parseInt(amountStr, 10); const today = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' });
    state.securities.history.unshift({ id: Date.now(), date: today, amount: amount }); saveLocal();
    document.getElementById('input-securities-amount').value = ""; confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
}
function deleteSecuritiesHistory(id) { vibrate(); if(confirm("この記録を削除しますか？")) { state.securities.history = state.securities.history.filter(h => h.id !== id); saveLocal(); } }
function renderSecurities() {
    const totalEl = document.getElementById('display-total-securities'); const diffEl = document.getElementById('display-diff'); const listEl = document.getElementById('securities-history-list');
    const history = state.securities.history; listEl.innerHTML = "";
    if (history.length === 0) { totalEl.innerText = "0"; diffEl.innerText = "前日比: --"; diffEl.className = "total-diff"; listEl.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px; font-size:12px;'>まだ記録がありません</div>"; return; }
    const current = history[0].amount; totalEl.innerText = current.toLocaleString();
    if (history.length > 1) {
        const prev = history[1].amount; const diff = current - prev;
        if (diff > 0) { diffEl.innerText = `前日比: +${diff.toLocaleString()}円`; diffEl.className = "total-diff diff-up"; } 
        else if (diff < 0) { diffEl.innerText = `前日比: ${diff.toLocaleString()}円`; diffEl.className = "total-diff diff-down"; } 
        else { diffEl.innerText = `前日比: ±0円`; diffEl.className = "total-diff"; }
    } else { diffEl.innerText = "前日比: --"; diffEl.className = "total-diff"; }
    history.forEach(item => {
        const div = document.createElement('div'); div.className = "history-item";
        div.innerHTML = `<div><div class="history-date">${item.date}</div><div class="history-amount">¥ ${item.amount.toLocaleString()}</div></div><button class="btn-delete-history" onclick="deleteSecuritiesHistory(${item.id})">×</button>`;
        listEl.appendChild(div);
    });
}

// ==========================================================================
// ✉️ 封筒貯金ロジック
// ==========================================================================
function openEnvelopeModal(id = null) {
    vibrate(); const m = document.getElementById('modal-envelope'); const title = document.getElementById('modal-envelope-title'); const delBtn = document.getElementById('env-btn-delete');
    if (id) {
        const env = state.envelopes.find(e => e.id === id); title.innerText = "封筒の編集"; document.getElementById('envelope-edit-id').value = id;
        document.getElementById('env-input-emoji').value = env.emoji; document.getElementById('env-input-name').value = env.name;
        document.getElementById('env-input-target').value = env.target; document.getElementById('env-input-color').value = env.color; delBtn.classList.remove('hidden');
    } else {
        title.innerText = "新しい封筒"; document.getElementById('envelope-edit-id').value = ""; document.getElementById('env-input-emoji').value = "💰";
        document.getElementById('env-input-name').value = ""; document.getElementById('env-input-target').value = ""; document.getElementById('env-input-color').value = "#4b7bff"; delBtn.classList.add('hidden');
    }
    m.classList.remove('hidden');
}
function saveEnvelope() {
    vibrate(); const id = document.getElementById('envelope-edit-id').value; const emoji = document.getElementById('env-input-emoji').value || "✉️";
    const name = document.getElementById('env-input-name').value.trim(); const targetStr = document.getElementById('env-input-target').value; const color = document.getElementById('env-input-color').value;
    if (!name || !targetStr) return alert("入力してください。"); const target = parseInt(targetStr, 10);
    if (id) { const env = state.envelopes.find(e => e.id === parseInt(id)); if(env) { env.emoji = emoji; env.name = name; env.target = target; env.color = color; } } 
    else { state.envelopes.push({ id: Date.now(), emoji, name, target, current: 0, color }); }
    saveLocal(); closeModal('modal-envelope');
}
function deleteEnvelope() { vibrate(); const id = parseInt(document.getElementById('envelope-edit-id').value); if(confirm("削除しますか？")) { state.envelopes = state.envelopes.filter(e => e.id !== id); saveLocal(); closeModal('modal-envelope'); } }
function openMoneyModal(id) { vibrate(); const env = state.envelopes.find(e => e.id === id); if(!env) return; document.getElementById('em-id').value = id; document.getElementById('em-emoji').innerText = env.emoji; document.getElementById('em-name').innerText = env.name; document.getElementById('em-current').innerText = env.current.toLocaleString(); document.getElementById('em-amount').value = ""; document.getElementById('modal-envelope-money').classList.remove('hidden'); }
function updateEnvelopeMoney(type) {
    vibrate(); const id = parseInt(document.getElementById('em-id').value); const amountStr = document.getElementById('em-amount').value; if(!amountStr) return;
    const amount = parseInt(amountStr, 10); const env = state.envelopes.find(e => e.id === id); if(!env) return;
    if (type === 'add') env.current += amount; else { if (env.current < amount) return alert("残高不足です"); env.current -= amount; }
    saveLocal(); closeModal('modal-envelope-money');
    if(type === 'add' && env.current >= env.target) { setTimeout(() => { alert(`🎉満タン達成！: ${env.name}`); confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }); }, 300); }
}
function renderEnvelopes() {
    const grid = document.getElementById('envelopes-grid'); grid.innerHTML = "";
    if (state.envelopes.length === 0) { grid.innerHTML = "<div style='grid-column: 1/-1; text-align:center; opacity:0.5; padding:30px; font-weight:bold;'>まだ封筒がありません</div>"; return; }
    state.envelopes.forEach(env => {
        const percent = Math.min(100, Math.floor((env.current / env.target) * 100)); const card = document.createElement('div'); card.className = "env-card";
        card.onclick = (e) => { if(e.target.classList.contains('env-edit-btn')) return; openMoneyModal(env.id); };
        card.innerHTML = `
            <button class="env-edit-btn" onclick="openEnvelopeModal(${env.id})">⚙️</button>
            <div class="env-header" style="background: ${env.color};"><div class="env-emoji">${env.emoji}</div><div>${env.name}</div></div>
            <div class="env-body"><div class="env-amount">¥${env.current.toLocaleString()}</div><div class="env-target"><span>目標: ¥${env.target.toLocaleString()}</span><span>${percent}%</span></div><div class="env-progress-bg"><div class="env-progress-fill" style="width: ${percent}%; background: ${env.color};"></div></div></div>`;
        grid.appendChild(card);
    });
}

// ==========================================================================
// 💾 バックアップ機能
// ==========================================================================
function exportData() {
    vibrate(); const dataStr = JSON.stringify(state); const blob = new Blob([dataStr], {type: "application/json"}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `MY_ASSET_BACKUP_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
}
function importData(e) {
    vibrate(); const file = e.target.files[0]; if(!file) return; if(!confirm("上書きされますがよろしいですか？")) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const importedState = JSON.parse(ev.target.result);
            if(importedState && (importedState.securities || importedState.envelopes || importedState.cashflow)) {
                state = { ...defaultState, ...importedState };
                if (!state.securities) state.securities = { history: [] };
                if (!state.cashflow) state.cashflow = [];
                if (!state.fixedCosts) state.fixedCosts = [];
                if (!state.envelopes) state.envelopes = [];
                if (!state.reports) state.reports = [];
                await saveLocal(); alert("✨ データ復元成功！"); location.reload();
            } else { alert("⚠️ 正しいバックアップファイルではありません。"); }
        } catch(err) { alert("⚠️ 読み込みエラーが発生しました。"); }
    };
    reader.readAsText(file);
}

// ==========================================================================
// 📱 UIナビゲーション & 表示更新
// ==========================================================================
function updateUI() {
    renderSecurities();
    renderCashflowSystem(); // 家計簿画面の描画
    renderEnvelopes();
    renderArchiveList();

    const lockText = document.getElementById('lock-status-text'); const btnSetup = document.getElementById('btn-setup-lock'); const btnRemove = document.getElementById('btn-remove-lock');
    if(state.pin) { lockText.innerText = "設定済み (ON)"; lockText.style.color = "#4b7bff"; btnSetup.innerText = "パスワードを変更する"; btnRemove.classList.remove('hidden'); } 
    else { lockText.innerText = "未設定 (OFF)"; lockText.style.color = "inherit"; btnSetup.innerText = "ロックを設定する"; btnRemove.classList.add('hidden'); }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate();
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(btn.dataset.target).classList.add('active');
        btn.classList.add('active');
        if(btn.dataset.target === 'view-cashflow') renderCashflowSystem(); // 収支タブを開いた時に再計算＆グラフ更新
        if(btn.dataset.target === 'view-archive') renderArchiveList();
    });
});

function closeModal(id) { vibrate(); document.getElementById(id).classList.add('hidden'); }

function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    const themeSel = document.getElementById('theme-selector'); if (themeSel) themeSel.value = theme;
    const colors = state.customColors[theme] || state.customColors['theme-stylish'];
    const root = document.documentElement; root.style.setProperty('--bg-color', colors.bg); root.style.setProperty('--panel-bg', colors.panel); root.style.setProperty('--accent-color', colors.accent);
    const hexToLuma = (color) => { const hex = color.replace('#', ''); return [parseInt(hex.substr(0,2),16)*0.299, parseInt(hex.substr(2,2),16)*0.587, parseInt(hex.substr(4,2),16)*0.114].reduce((a,b)=>a+b)/255; };
    root.style.setProperty('--text-color', hexToLuma(colors.bg) > 0.5 ? '#1d1d1f' : '#ffffff');
}
function changeAppTheme(themeName) { vibrate(); state.appTheme = themeName; applyCurrentThemeAndColors(); saveLocal(); }