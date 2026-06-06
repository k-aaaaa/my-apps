// File: app.js

// データの初期化
let state = JSON.parse(localStorage.getItem('bento_data')) || {
    inventory: [],
    history: [],
    recipes: [
        { id: 1, name: "鶏むねの照り焼き", ingredients: "鶏肉:2枚, 醤油:大さじ2" },
        { id: 2, name: "鮭の塩焼き弁当", ingredients: "鮭:4切, ほうれん草:1株" },
        { id: 3, name: "具沢山カレー", ingredients: "肉:300g, 玉ねぎ:2個" },
        { id: 4, name: "ハンバーグ弁当", ingredients: "合挽肉:400g, 玉ねぎ:1個" }
    ]
};

let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null;

// --- 基本保存機能 ---
function saveLocal() {
    localStorage.setItem('bento_data', JSON.stringify(state));
    render();
}

// --- タブ切り替え ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // ナビボタンの色変更
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
    
    if (tabId !== 'create') cancelCooking();
}

// --- 在庫管理機能 ---
function consume(recipeId) {
    const item = state.inventory.find(i => i.recipeId === recipeId);
    if (item && item.count > 0) {
        item.count--;
        if (item.count === 0) {
            state.inventory = state.inventory.filter(i => i.recipeId !== recipeId);
        }
        saveLocal();
    }
}

function startCooking(recipeId) {
    currentRecipe = state.recipes.find(r => r.id === recipeId);
    document.getElementById('recipe-selection').classList.add('hidden');
    document.getElementById('cooking-panel').classList.remove('hidden');
    document.getElementById('cooking-name').innerText = currentRecipe.name;
}

function cancelCooking() {
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
    currentRecipe = null;
}

function finishCooking() {
    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;

    const existing = state.inventory.find(i => i.recipeId === currentRecipe.id);
    if (existing) {
        existing.count += count;
    } else {
        state.inventory.push({ recipeId: currentRecipe.id, name: currentRecipe.name, count: count });
    }

    state.history.unshift({
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        name: currentRecipe.name,
        count: count
    });

    saveLocal();
    showTab('home');
}

// --- バックアップ・同期機能 ---
function downloadFile() {
    const blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bento_data_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            state = JSON.parse(e.target.result);
            saveLocal();
            alert("復元完了しました！");
            showTab('home');
        } catch(err) {
            alert("エラー：ファイル形式が正しくありません。");
        }
    };
    reader.readAsText(file);
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('bento_gas_url', GAS_URL);
    alert("クラウドURLを保存しました");
}

async function syncCloud() {
    if (!GAS_URL) {
        alert("先に設定画面でクラウドURLを登録してください");
        showTab('settings');
        return;
    }
    
    const btn = document.getElementById('sync-btn');
    btn.classList.add('loading');
    
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(state),
            mode: 'no-cors'
        });
        alert("クラウド同期に送信しました！");
    } catch (e) {
        alert("同期失敗：URLを確認してください");
    } finally {
        btn.classList.remove('loading');
    }
}

// --- 描画機能 ---
function render() {
    // 在庫
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let total = 0;
    state.inventory.forEach(item => {
        total += item.count;
        invList.innerHTML += `
            <div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-gray-100">
                <div>
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-sm text-gray-400">残り ${item.count} 食</div>
                </div>
                <button onclick="consume(${item.recipeId})" class="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold active:bg-orange-200">食べた</button>
            </div>`;
    });
    document.getElementById('total-count').innerText = total;

    // レシピ選択
    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `
            <button onclick="startCooking(${recipe.id})" class="bg-white p-4 rounded-xl text-left border border-gray-100 shadow-sm active:bg-orange-50">
                <div class="font-bold text-gray-700">${recipe.name}</div>
                <div class="text-xs text-gray-400">${recipe.ingredients}</div>
            </button>`;
    });

    // 履歴
    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    state.history.slice(0, 10).forEach(h => {
        histList.innerHTML += `
            <div class="text-sm p-3 bg-white rounded border border-gray-100 flex justify-between">
                <span class="text-gray-400">${h.date}</span>
                <span class="font-bold text-gray-600">${h.name}</span>
                <span class="text-orange-500">${h.count}食</span>
            </div>`;
    });
    
    // 設定画面のURL同期
    document.getElementById('gas-url').value = GAS_URL;
}

// 初期起動
render();
showTab('home');