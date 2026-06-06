/* File: app.js */
const MY_PASSWORD = "0531";

(function() {
    const authKey = "app_authenticated_asset";
    if (sessionStorage.getItem(authKey) !== "true") {
        const input = prompt("パスワードを入力してください");
        if (input === MY_PASSWORD) {
            sessionStorage.setItem(authKey, "true");
        } else {
            alert("パスワードが違います");
            document.body.innerHTML = "<div style='padding:50px; text-align:center;'><h1>認証失敗</h1><button onclick='location.reload()'>再試行</button></div>";
            window.stop();
        }
    }
})();

let investments = JSON.parse(localStorage.getItem('asset_data')) || [{ id: 1, name: "つみたてNISA", monthly: 33333, rate: 5 }];
let GAS_URL = localStorage.getItem('asset_gas_url') || "";

function saveLocal() {
    localStorage.setItem('asset_data', JSON.stringify(investments));
    render();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

function saveInvestment() {
    const name = document.getElementById('in-name').value || "新規積立";
    const monthly = parseFloat(document.getElementById('in-monthly').value) || 0;
    const rate = parseFloat(document.getElementById('in-rate').value) || 0;
    investments.push({ id: Date.now(), name, monthly, rate });
    saveLocal();
    showTab('dash');
    document.getElementById('in-name').value = "";
    document.getElementById('in-monthly').value = "";
}

function deleteInv(id) {
    if(!confirm("削除しますか？")) return;
    investments = investments.filter(i => i.id !== id);
    saveLocal();
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
        list.innerHTML += `<div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-slate-100">
            <div><div class="font-bold text-slate-700">${inv.name}</div><div class="text-xs text-slate-400">¥${inv.monthly.toLocaleString()}/月 (${inv.rate}%)</div></div>
            <button onclick="deleteInv(${inv.id})" class="text-red-300 text-xs">削除</button>
        </div>`;
    });

    const max = Math.max(...totals, 1);
    totals.forEach((val, i) => {
        const height = (val / max * 100) + '%';
        chart.innerHTML += `<div class="flex-1 flex flex-col items-center">
            <div class="w-full bg-indigo-500 rounded-t-lg bar" style="height:${height}"></div>
            <span class="text-[8px] text-slate-400 mt-1">${(i+1)*5}年</span>
        </div>`;
    });
    document.getElementById('total-projection').innerText = "¥" + Math.round(totals[5]).toLocaleString();
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('asset_gas_url', GAS_URL);
    alert("URL保存完了");
}

async function syncCloud() {
    if (!GAS_URL) return alert("GAS URLを登録してください");
    const btn = document.getElementById('sync-btn');
    btn.style.opacity = 0.5;
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(investments), mode: 'no-cors' });
        alert("同期成功");
    } catch(e) { alert("失敗"); } finally { btn.style.opacity = 1; }
}

function downloadFile() {
    const blob = new Blob([JSON.stringify(investments)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "asset_data.json";
    a.click();
}

render();