// パスワード認証（安全なプレースホルダー仕様）
(function() {
    let savedPass = localStorage.getItem('bento_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\nこのアプリ専用のパスワードを半角数字で決めてください。\n(例: 0000 など自由な数字)");
        if (savedPass) localStorage.setItem('bento_password', savedPass);
        else savedPass = "0000";
    }
    const authKey = "app_auth_bento";
    if (sessionStorage.getItem(authKey) !== "true") {
        if (prompt("パスワードを入力してください") === savedPass) {
            sessionStorage.setItem(authKey, "true");
        } else {
            document.body.innerHTML = "<div style='padding:50px;text-align:center;'><h1>認証失敗</h1><button onclick='location.reload()'>再試行</button></div>";
            throw new Error("Auth failed");
        }
    }
})();

// ブルッとする振動フィードバック
function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

// お出迎え機能＆ダークモード設定
window.addEventListener('load', () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
    
    const imgData = localStorage.getItem('bento_welcome_img');
    const splashTime = parseInt(localStorage.getItem('bento_splash_time')) || 1200;
    
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

let state = JSON.parse(localStorage.getItem('bento_data')) || {
    inventory: [], history: [], recipes: [], shoppingCart: [], crossedOut: [], 
    savedAmount: 0, saveUnit: 600, alertDays: 14, autoSync: false
};
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null;

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#bde0fe] text-[#4a4e69] dark:bg-blue-900 dark:text-blue-100 px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 whitespace-nowrap';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function saveLocal() {
    localStorage.setItem('bento_data', JSON.stringify(state));
    render();
    if (state.autoSync) cloudSyncSilent(); // 自動バックアップ
}

function showTab(tabId) {
    vibrate();
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
}

// 修正版：在庫調整関数（isEatenで「食べた」か「単なる修正」かを区別します）
function adjustInventory(id, delta, isEaten = false) {
    vibrate();
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    
    item.count += delta;

    if (isEaten) {
        // 「食べた」ボタンが押された時だけ節約金額を増やす
        state.savedAmount = (state.savedAmount || 0) + (parseInt(state.saveUnit) || 600);
        showToast(`😋 食べました！(＋${state.saveUnit}円節約)`);
    } else {
        // 単なる数間違えの修正の時
        if (delta > 0) showToast(`📦 在庫数を増やしました`);
        else if (delta < 0) showToast(`📦 在庫数を減らしました`);
    }

    // 0個になったらリストから消す
    if (item.count <= 0) {
        state.inventory = state.inventory.filter(i => i.id !== id);
    }
    
    saveLocal();
}

function startCooking(recipeId) {
    vibrate();
    currentRecipe = state.recipes.find(r => r.id === recipeId);
    document.getElementById('recipe-selection').classList.add('hidden');
    document.getElementById('cooking-panel').classList.remove('hidden');
    document.getElementById('cooking-emoji').innerText = currentRecipe.emoji || "🍱";
    document.getElementById('cooking-name').innerText = currentRecipe.name;
    document.getElementById('make-count').value = currentRecipe.lastCount || 4;
}

function changeMakeCount(delta) {
    vibrate();
    const input = document.getElementById('make-count');
    input.value = Math.max(1, parseInt(input.value) + delta);
}

function cancelCooking() {
    vibrate();
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
}

function finishCooking() {
    vibrate();
    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;
    currentRecipe.lastCount = count;
    state.inventory.push({ id: Date.now(), recipeId: currentRecipe.id, name: currentRecipe.name, emoji: currentRecipe.emoji, count: count, timestamp: Date.now() });
    state.history.unshift({ id: Date.now(), date: new Date().toLocaleDateString(), name: currentRecipe.name, emoji: currentRecipe.emoji, count: count });
    saveLocal();
    showToast(`✨ ${count}食 追加しました！`);
    showTab('home');
    cancelCooking();
}

function saveAppSettings() {
    vibrate();
    const newPass = document.getElementById('settings-password').value;
    if (newPass) {
        localStorage.setItem('bento_password', newPass);
        showToast("🔑 パスワードを更新しました");
    }
    state.saveUnit = parseInt(document.getElementById('settings-save-unit').value) || 600;
    state.alertDays = parseInt(document.getElementById('settings-alert-days').value) || 14;
    state.autoSync = document.getElementById('settings-auto-sync').checked;
    
    const splashTime = document.getElementById('settings-splash-time').value;
    localStorage.setItem('bento_splash_time', splashTime);
    
    saveLocal();
    showToast("⚙️ 設定を保存しました");
}

function saveWelcomeImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            localStorage.setItem('bento_welcome_img', event.target.result);
            document.getElementById('welcome-img-preview').src = event.target.result;
            document.getElementById('welcome-img-preview-container').classList.remove('hidden');
            showToast("🖼️ お出迎え画像を登録しました！");
        } catch(err) {
            alert("⚠️ 画像サイズが大きすぎます。もう少し小さめの画像を選んでください。");
        }
    };
    reader.readAsDataURL(file);
}

function clearWelcomeImage() {
    localStorage.removeItem('bento_welcome_img');
    document.getElementById('welcome-img-preview-container').classList.add('hidden');
    showToast("画像を消去しました");
}

function saveRecipe() {
    vibrate();
    const id = document.getElementById('edit-recipe-id').value;
    const emoji = document.getElementById('new-recipe-emoji').value || "🍱";
    const name = document.getElementById('new-recipe-name').value;
    const ing = document.getElementById('new-recipe-ing').value;
    if (!name) return showToast("⚠️ 料理名を入力してください");

    if (id) {
        const r = state.recipes.find(x => x.id == id);
        if(r) { r.name = name; r.emoji = emoji; r.ingredients = ing; }
    } else {
        state.recipes.push({ id: Date.now(), name, emoji, ingredients: ing, lastCount: 4 });
    }
    cancelEditRecipe();
    saveLocal();
}

function editRecipe(id) {
    const r = state.recipes.find(x => x.id === id);
    if(!r) return;
    document.getElementById('edit-recipe-id').value = r.id;
    document.getElementById('new-recipe-emoji').value = r.emoji;
    document.getElementById('new-recipe-name').value = r.name;
    document.getElementById('new-recipe-ing').value = r.ingredients;
    document.getElementById('save-recipe-btn').innerText = "更新する";
    document.getElementById('cancel-recipe-btn').classList.remove('hidden');
}

function cancelEditRecipe() {
    document.getElementById('edit-recipe-id').value = "";
    document.getElementById('new-recipe-emoji').value = "🍱";
    document.getElementById('new-recipe-name').value = "";
    document.getElementById('new-recipe-ing').value = "";
    document.getElementById('save-recipe-btn').innerText = "追加する";
    document.getElementById('cancel-recipe-btn').classList.add('hidden');
}

function deleteRecipe(id) {
    if (!confirm("本当に削除しますか？")) return;
    state.recipes = state.recipes.filter(r => r.id !== id);
    saveLocal();
}

function toggleShopCart(recipeId) {
    if (state.shoppingCart.includes(recipeId)) state.shoppingCart = state.shoppingCart.filter(id => id !== recipeId);
    else state.shoppingCart.push(recipeId);
    saveLocal();
}

function toggleIng(ing) {
    if (state.crossedOut.includes(ing)) state.crossedOut = state.crossedOut.filter(i => i !== ing);
    else state.crossedOut.push(ing);
    saveLocal();
}

function copyShoppingListToClipboard() {
    vibrate();
    let text = "【お買い物リスト】\n";
    let allIngs = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) {
            const items = r.ingredients.split(/[,、\s]+/);
            allIngs.push(...items.filter(i => i.trim() !== ""));
        }
    });
    allIngs = [...new Set(allIngs)];
    
    if (allIngs.length === 0) {
        showToast("リストが空っぽです");
        return;
    }
    
    allIngs.forEach(ing => {
        const check = state.crossedOut.includes(ing) ? " [済] " : " □ ";
        text += `${check}${ing}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        showToast("📋 コピーしました！LINEに貼ってね");
    });
}

function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('bento_gas_url', GAS_URL);
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

function render() {
    document.getElementById('settings-save-unit').value = state.saveUnit || 600;
    document.getElementById('settings-alert-days').value = state.alertDays || 14;
    document.getElementById('settings-auto-sync').checked = state.autoSync || false;
    document.getElementById('gas-url').value = GAS_URL;
    
    const imgData = localStorage.getItem('bento_welcome_img');
    if (imgData) {
        document.getElementById('welcome-img-preview').src = imgData;
        document.getElementById('welcome-img-preview-container').classList.remove('hidden');
    }

    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let total = 0;
    const now = Date.now();
    document.getElementById('saved-money').innerText = "¥" + (state.savedAmount || 0).toLocaleString();

    let sortedInv = [...state.inventory].sort((a,b) => a.timestamp - b.timestamp);
    sortedInv.forEach(item => {
        total += item.count;
        const daysOld = item.timestamp ? Math.floor((now - item.timestamp) / 86400000) : 0;
        let badge = '';
        const limit = state.alertDays || 14;
        if (daysOld >= limit) badge = `<span class="bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-full ml-2 border border-red-200">⏳ ${daysOld}日経過</span>`;
        else if (daysOld >= limit / 2) badge = `<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-full ml-2">🕒 ${daysOld}日経過</span>`;

        invList.innerHTML += `<div class="bg-white dark:bg-gray-800 p-4 rounded-2xl flex justify-between items-center shadow-sm border border-blue-50 dark:border-gray-700">
            <div class="flex items-center gap-3">
                <span class="text-3xl">${item.emoji || "🍱"}</span>
                <div>
                    <div class="font-bold text-gray-700 dark:text-gray-200 text-sm">${item.name} ${badge}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <button onclick="adjustInventory(${item.id}, -1, false)" class="w-8 h-8 bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-300 rounded-full font-bold">-</button>
                        <span class="font-bold w-4 text-center">${item.count}</span>
                        <button onclick="adjustInventory(${item.id}, 1, false)" class="w-8 h-8 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-300 rounded-full font-bold">+</button>
                    </div>
                </div>
            </div>
            <button onclick="adjustInventory(${item.id}, -1, true)" class="bg-[#a2d2ff] text-white px-5 py-3 rounded-xl font-bold shadow-sm">食べた</button>
        </div>`;
    });
    document.getElementById('total-count').innerText = total;

    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})" class="bg-white dark:bg-gray-800 p-4 rounded-2xl text-left border border-blue-50 dark:border-gray-700 shadow-sm flex items-center gap-3"><span class="text-3xl">${recipe.emoji || "🍱"}</span><div><div class="font-bold text-gray-700 dark:text-gray-200">${recipe.name}</div></div></button>`;
    });

    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `<div class="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-blue-50 dark:border-gray-700 flex justify-between items-center text-sm"><div class="flex items-center gap-2 font-bold"><span class="text-xl">${recipe.emoji || "🍱"}</span> ${recipe.name}</div><div><button onclick="editRecipe(${recipe.id})" class="text-blue-500 bg-blue-50 dark:bg-gray-700 px-3 py-1 rounded-lg font-bold mr-1">編集</button><button onclick="deleteRecipe(${recipe.id})" class="text-red-400 bg-red-50 dark:bg-transparent px-3 py-1 rounded-lg font-bold">削除</button></div></div>`;
    });

    const shopContainer = document.getElementById('shopping-list-container');
    let shopHtml = '<div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-blue-50 dark:border-gray-700 mb-4"><div class="space-y-2">';
    state.recipes.forEach(r => {
        const checked = state.shoppingCart.includes(r.id) ? 'checked' : '';
        shopHtml += `<label class="flex items-center p-2 rounded-xl"><input type="checkbox" class="mr-3 w-5 h-5 accent-[#a2d2ff]" ${checked} onchange="toggleShopCart(${r.id})"> <span class="text-xl mr-2">${r.emoji || "🍱"}</span><span class="font-bold text-gray-600 dark:text-gray-300">${r.name}</span></label>`;
    });
    let allIngs = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) { const items = r.ingredients.split(/[,、\s]+/); allIngs.push(...items.filter(i => i.trim() !== "")); }
    });
    allIngs = [...new Set(allIngs)];
    shopHtml += '</div></div><div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-blue-50 dark:border-gray-700"><div class="flex flex-wrap gap-2">';
    allIngs.forEach(ing => {
        const btnClass = state.crossedOut.includes(ing) ? 'strikethrough bg-gray-100 text-gray-400 dark:bg-gray-700' : 'bg-[#e7f5ff] text-blue-700 dark:bg-blue-900 dark:text-blue-200';
        shopHtml += `<button onclick="toggleIng('${ing}')" class="px-4 py-2 border border-transparent rounded-full text-sm font-bold shadow-sm transition-all ${btnClass}">${ing}</button>`;
    });
    shopContainer.innerHTML = shopHtml + '</div></div>';

    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    state.history.slice(0, 10).forEach(h => {
        histList.innerHTML += `<div class="p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-50 dark:border-gray-700 shadow-sm flex justify-between items-center text-sm"><span class="text-gray-400 text-xs">${h.date}</span><span class="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1"><span class="text-lg">${h.emoji || "🍱"}</span>${h.name}</span><span class="font-bold text-[#a2d2ff]">${h.count}食</span></div>`;
    });
}
render(); showTab('home');