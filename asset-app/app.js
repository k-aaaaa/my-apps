// File: app.js

// --- 簡易パスワード機能 ---
(function() {
    const MY_PASSWORD = "0531"; // ←ここを書き換えてください
    const authKey = "app_authenticated";

    // すでに認証済みかチェック
    if (sessionStorage.getItem(authKey) !== "true") {
        const input = prompt("パスワードを入力してください");
        if (input === MY_PASSWORD) {
            sessionStorage.setItem(authKey, "true");
        } else {
            alert("パスワードが違います");
            document.body.innerHTML = "<h1>認証が必要です。再読み込みしてください。</h1>";
            window.stop(); // 読み込み停止
        }
    }
})();
// -----------------------
let investments = JSON.parse(localStorage.getItem('asset_data')) || [];
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

function saveLocal() {
    localStorage.setItem('asset_data', JSON.stringify(investments));
    render();
}

function saveInvestment() {
    const name = document.getElementById('in-name').value || "新規積立";
    const monthly = parseFloat(document.getElementById('in-monthly').value) || 0;
    const rate = parseFloat(document.getElementById('in-rate').value) || 0;
    investments.push({ id: Date.now(), name, monthly, rate });
    saveLocal();
    showTab('dash');
}

function calculateFuture(monthly, rate, years) {
    const r = rate / 100 / 12;
    const n = years * 12;
    return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
}

function render() {
    const list = document.getElementById('invest-list');
    const chart = document.getElementById('chart-area');
    list.innerHTML = '';
    chart.innerHTML = '';
    
    let totals = [5, 10, 15, 20, 25, 30].map(yr => {
        return investments.reduce((sum, inv) => sum + calculateFuture(inv.monthly, inv.rate, yr), 0);
    });

    investments.forEach(inv => {
        list.innerHTML += `<div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border">
            <div><div class="font-bold">${inv.name}</div><div class="text-xs text-gray-400">¥${inv.monthly.toLocaleString()}/月</div></div>
            <button onclick="deleteInv(${inv.id})" class="text-red-300 text-xs">削除</button>
        </div>`;
    });

    const max = Math.max(...totals, 1);
    totals.forEach((val, i) => {
        const height = (val / max * 100) + '%';
        chart.innerHTML += `<div class="flex-1 flex flex-col items-center">
            <div class="w-full bg-indigo-500 rounded-t bar" style="height:${height}"></div>
            <span class="text-[8px] mt-1">${(i+1)*5}年</span>
        </div>`;
    });
    document.getElementById('total-projection').innerText = "¥" + Math.round(totals[5]).toLocaleString();
}

// 共通機能（タブ切り替え・削除・同期など）
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function deleteInv(id) {
    investments = investments.filter(i => i.id !== id);
    saveLocal();
}
function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('asset_gas_url', GAS_URL);
    alert("URL保存完了");
}
async function syncCloud() {
    if (!GAS_URL) return alert("先にURLを登録してください");
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(investments), mode: 'no-cors' });
        alert("同期成功");
    } catch(e) { alert("失敗"); }
}
function downloadFile() {
    const blob = new Blob([JSON.stringify(investments)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "assets.json";
    a.click();
}

render();