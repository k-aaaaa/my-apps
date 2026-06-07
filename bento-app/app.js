(function() {
    let savedPass = localStorage.getItem('bento_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\nこのアプリ専用のパスワードを決めてください。", "0531");
        if (savedPass) localStorage.setItem('bento_password', savedPass);
        else savedPass = "0531";
    }
    const authKey = "app_auth_bento";
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

let state = JSON.parse(localStorage.getItem('bento_data')) || {
    inventory: [], history: [], recipes: [], shoppingCart: [], crossedOut: [], savedAmount: 0
};
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null;

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#bde0fe] text-[#4a4e69] px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 toast-anim whitespace-nowrap';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function saveLocal() { localStorage.setItem('bento_data', JSON.stringify(state)); render(); }

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');
    const titles = { 'home':'🍱 現在の在庫', 'create':'🍳 新しく作る', 'recipe-mgr':'📖 レシピ管理', 'shopping':'🛒 お買い物リスト', 'history':'📜 作成履歴', 'settings':'⚙️ データと設定' };
    document.getElementById('header-title').innerText = titles[tabId];
}

function adjustInventory(id, delta) {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    item.count += delta;
    if (delta < 0) {
        state.savedAmount += 600; // 1食600円の節約計算
        showToast("😋 食べました！(＋600円節約)");
    }
    if (item.count <= 0) state.inventory = state.inventory.filter(i => i.id !== id);
    saveLocal();
}

function startCooking(recipeId) {
    currentRecipe = state.recipes.find(r => r.id === recipeId);
    document.getElementById('recipe-selection').classList.add('hidden');
    document.getElementById('cooking-panel').classList.remove('hidden');
    document.getElementById('cooking-emoji').innerText = currentRecipe.emoji || "🍱";
    document.getElementById('cooking-name').innerText = currentRecipe.name;
    document.getElementById('make-count').value = currentRecipe.lastCount || 4;
}

function changeMakeCount(delta) {
    const input = document.getElementById('make-count');
    input.value = Math.max(1, parseInt(input.value) + delta);
}

function cancelCooking() {
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
}

function finishCooking() {
    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;
    currentRecipe.lastCount = count; // 次回のために記憶
    state.inventory.push({ id: Date.now(), recipeId: currentRecipe.id, name: currentRecipe.name, emoji: currentRecipe.emoji, count: count, timestamp: Date.now() });
    state.history.unshift({ id: Date.now(), date: new Date().toLocaleDateString(), name: currentRecipe.name, emoji: currentRecipe.emoji, count: count });
    saveLocal();
    showToast(`✨ ${count}食 追加しました！`);
    showTab('home');
    cancelCooking();
}

function saveRecipe() {
    const id = document.getElementById('edit-recipe-id').value;
    const emoji = document.getElementById('new-recipe-emoji').value || "🍱";
    const name = document.getElementById('new-recipe-name').value;
    const ing = document.getElementById('new-recipe-ing').value;
    if (!name) return showToast("⚠️ 料理名を入力してください");

    if (id) {
        const r = state.recipes.find(x => x.id == id);
        if(r) { r.name = name; r.emoji = emoji; r.ingredients = ing; }
        showToast("📝 レシピを更新しました");
    } else {
        state.recipes.push({ id: Date.now(), name, emoji, ingredients: ing, lastCount: 4 });
        showToast("📝 レシピを追加しました");
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
    window.scrollTo(0,0);
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

function resetData() {
    if(!confirm("本当に全てのデータを消去しますか？\n（この操作は取り消せません）")) return;
    localStorage.removeItem('bento_data');
    location.reload();
}

function render() {
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let total = 0;
    const now = Date.now();
    document.getElementById('saved-money').innerText = "¥" + (state.savedAmount || 0).toLocaleString();

    if (state.inventory.length === 0) {
        invList.innerHTML = '<div class="text-center text-gray-400 py-10">在庫が空っぽです</div>';
    } else {
        // 古い順にソート
        let sortedInv = [...state.inventory].sort((a,b) => a.timestamp - b.timestamp);
        sortedInv.forEach(item => {
            total += item.count;
            const daysOld = item.timestamp ? Math.floor((now - item.timestamp) / 86400000) : 0;
            let badge = '';
            if (daysOld >= 14) badge = `<span class="bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-full ml-2 border border-red-200">⏳ ${daysOld}日経過</span>`;
            else if (daysOld >= 7) badge = `<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-full ml-2">🕒 ${daysOld}日経過</span>`;

            invList.innerHTML += `<div class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-blue-50">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">${item.emoji || "🍱"}</span>
                    <div>
                        <div class="font-bold text-gray-700 text-sm">${item.name} ${badge}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <button onclick="adjustInventory(${item.id}, -1)" class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full font-bold">-</button>
                            <span class="font-bold w-4 text-center">${item.count}</span>
                            <button onclick="adjustInventory(${item.id}, 1)" class="w-8 h-8 bg-gray-50 text-gray-400 rounded-full font-bold">+</button>
                        </div>
                    </div>
                </div>
                <button onclick="adjustInventory(${item.id}, -1)" class="bg-[#a2d2ff] text-white px-5 py-3 rounded-xl font-bold shadow-sm">食べた</button>
            </div>`;
        });
    }
    document.getElementById('total-count').innerText = total;

    // レシピ・お買い物・履歴の描画（省略なし）
    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})" class="bg-white p-4 rounded-2xl text-left border border-blue-50 shadow-sm flex items-center gap-3"><span class="text-3xl">${recipe.emoji || "🍱"}</span><div><div class="font-bold text-gray-700">${recipe.name}</div></div></button>`;
    });

    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `<div class="bg-white p-3 rounded-xl shadow-sm border border-blue-50 flex justify-between items-center text-sm"><div class="flex items-center gap-2 font-bold"><span class="text-xl">${recipe.emoji || "🍱"}</span> ${recipe.name}</div><div><button onclick="editRecipe(${recipe.id})" class="text-blue-500 bg-blue-50 px-3 py-1 rounded-lg font-bold mr-1">編集</button><button onclick="deleteRecipe(${recipe.id})" class="text-red-400 bg-red-50 px-3 py-1 rounded-lg font-bold">削除</button></div></div>`;
    });

    const shopContainer = document.getElementById('shopping-list-container');
    let shopHtml = '<div class="bg-white p-5 rounded-2xl shadow-sm border border-blue-50 mb-4"><div class="space-y-2">';
    state.recipes.forEach(r => {
        const checked = state.shoppingCart.includes(r.id) ? 'checked' : '';
        shopHtml += `<label class="flex items-center p-2 rounded-xl"><input type="checkbox" class="mr-3 w-5 h-5 accent-[#a2d2ff]" ${checked} onchange="toggleShopCart(${r.id})"> <span class="text-xl mr-2">${r.emoji || "🍱"}</span><span class="font-bold text-gray-600">${r.name}</span></label>`;
    });
    let allIngs = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) { const items = r.ingredients.split(/[,、\s]+/); allIngs.push(...items.filter(i => i.trim() !== "")); }
    });
    allIngs = [...new Set(allIngs)];
    shopHtml += '</div></div><div class="bg-white p-5 rounded-2xl shadow-sm border border-blue-50"><div class="flex flex-wrap gap-2">';
    allIngs.forEach(ing => {
        const btnClass = state.crossedOut.includes(ing) ? 'strikethrough bg-gray-100 text-gray-400' : 'bg-[#e7f5ff] text-blue-700';
        shopHtml += `<button onclick="toggleIng('${ing}')" class="px-4 py-2 border border-transparent rounded-full text-sm font-bold shadow-sm transition-all ${btnClass}">${ing}</button>`;
    });
    shopContainer.innerHTML = shopHtml + '</div></div>';

    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    state.history.slice(0, 10).forEach(h => {
        histList.innerHTML += `<div class="p-3 bg-white rounded-xl border border-blue-50 shadow-sm flex justify-between items-center text-sm"><span class="text-gray-400 text-xs">${h.date}</span><span class="font-bold text-gray-700 flex items-center gap-1"><span class="text-lg">${h.emoji || "🍱"}</span>${h.name}</span><span class="font-bold text-[#a2d2ff]">${h.count}食</span></div>`;
    });
}
render(); showTab('home');