/* File: app.js */
const MY_PASSWORD = "0531";

(function() {
    const authKey = "app_authenticated_bento";
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

let state = JSON.parse(localStorage.getItem('bento_data')) || {
    inventory: [], history: [], recipes: [{ id: 1, name: "鶏むねの照り焼き", ingredients: "鶏肉2枚" }]
};
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null;

function saveLocal() {
    localStorage.setItem('bento_data', JSON.stringify(state));
    render();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
}

function consume(recipeId) {
    const item = state.inventory.find(i => i.recipeId === recipeId);
    if (item && item.count > 0) {
        item.count--;
        if (item.count === 0) state.inventory = state.inventory.filter(i => i.recipeId !== recipeId);
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
}

function finishCooking() {
    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;
    const existing = state.inventory.find(i => i.recipeId === currentRecipe.id);
    if (existing) existing.count += count;
    else state.inventory.push({ recipeId: currentRecipe.id, name: currentRecipe.name, count: count });
    state.history.unshift({ id: Date.now(), date: new Date().toLocaleDateString(), name: currentRecipe.name, count: count });
    saveLocal();
    showTab('home');
    cancelCooking();
}

function addRecipe() {
    const name = document.getElementById('new-recipe-name').value;
    const ing = document.getElementById('new-recipe-ing').value;
    if (!name) return alert("料理名を入力してください");
    state.recipes.push({ id: Date.now(), name, ingredients: ing });
    saveLocal();
    document.getElementById('new-recipe-name').value = "";
    document.getElementById('new-recipe-ing').value = "";
    alert("レシピを追加しました");
}

function deleteRecipe(id) {
    if (!confirm("削除しますか？")) return;
    state.recipes = state.recipes.filter(r => r.id !== id);
    saveLocal();
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('bento_gas_url', GAS_URL);
    alert("URL保存完了");
}

async function syncCloud() {
    if (!GAS_URL) return alert("設定からGAS URLを登録してください");
    const btn = document.getElementById('sync-btn');
    btn.classList.add('loading');
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(state), mode: 'no-cors' });
        alert("同期成功");
    } catch (e) { alert("同期失敗"); } finally { btn.classList.remove('loading'); }
}

function downloadFile() {
    const blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "bento_data.json";
    a.click();
}

function uploadFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { state = JSON.parse(e.target.result); saveLocal(); alert("復元完了"); };
    reader.readAsText(file);
}

function render() {
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let total = 0;
    state.inventory.forEach(item => {
        total += item.count;
        invList.innerHTML += `<div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-gray-100">
            <div><div class="font-bold text-gray-800">${item.name}</div><div class="text-sm text-gray-400">${item.count}食</div></div>
            <button onclick="consume(${item.recipeId})" class="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold">食べた</button>
        </div>`;
    });
    document.getElementById('total-count').innerText = total;

    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})" class="bg-white p-4 rounded-xl text-left border shadow-sm">
            <div class="font-bold text-gray-700">${recipe.name}</div><div class="text-xs text-gray-400">${recipe.ingredients}</div>
        </button>`;
    });

    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `<div class="bg-white p-3 rounded shadow-sm border flex justify-between items-center text-sm">
            <span>${recipe.name}</span>
            <button onclick="deleteRecipe(${recipe.id})" class="text-red-500 border border-red-500 px-2 py-1 rounded">削除</button>
        </div>`;
    });

    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    state.history.slice(0, 10).forEach(h => {
        histList.innerHTML += `<div class="text-xs p-3 bg-white rounded border flex justify-between">
            <span>${h.date}</span><span class="font-bold text-gray-600">${h.name}</span><span>${h.count}食</span>
        </div>`;
    });
    document.getElementById('gas-url').value = GAS_URL;
}

render();
showTab('home');