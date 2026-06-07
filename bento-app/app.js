// 初回パスワード設定＆認証システム
(function() {
    let savedPass = localStorage.getItem('bento_password');
    if (!savedPass) {
        savedPass = prompt("【初回設定】\nこのアプリ専用のパスワードを決めてください。\n(他の人にURLを教えても、データはこのスマホに守られます)", "0531");
        if (savedPass) localStorage.setItem('bento_password', savedPass);
        else savedPass = "0531"; // 未入力時のデフォルト
    }
    const authKey = "app_auth_bento";
    if (sessionStorage.getItem(authKey) !== "true") {
        const input = prompt("パスワードを入力してください");
        if (input === savedPass) {
            sessionStorage.setItem(authKey, "true");
        } else {
            document.body.innerHTML = "<div style='padding:50px; text-align:center;'><h1>認証失敗</h1><p>パスワードが違います</p><button onclick='location.reload()' style='margin-top:20px; padding:10px 20px; background:#a2d2ff; color:white; border-radius:10px;'>再試行</button></div>";
            throw new Error("Auth failed");
        }
    }
})();

// データ状態の初期化
let state = JSON.parse(localStorage.getItem('bento_data')) || {
    inventory: [], history: [], 
    recipes: [{ id: 1, name: "鶏むねの照り焼き", emoji: "🍗", ingredients: "鶏肉2枚、醤油大さじ2、みりん大さじ2" }],
    shoppingCart: [], crossedOut: []
};
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null;

// おしゃれな通知機能（トースト）
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 bg-[#bde0fe] text-[#4a4e69] px-6 py-3 rounded-full shadow-lg font-bold text-sm z-50 toast-anim whitespace-nowrap';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function saveLocal() {
    localStorage.setItem('bento_data', JSON.stringify(state));
    render();
}

// タブ切り替えとヘッダータイトル連動
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('active-nav'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active-nav');

    const titles = {
        'home': '🍱 現在の在庫', 'create': '🍳 新しく作る', 'recipe-mgr': '📖 レシピ管理',
        'shopping': '🛒 お買い物リスト', 'history': '📜 作成履歴', 'settings': '⚙️ データと設定'
    };
    document.getElementById('header-title').innerText = titles[tabId];
}

// 在庫を減らす
function consume(recipeId) {
    const item = state.inventory.find(i => i.recipeId === recipeId);
    if (item && item.count > 0) {
        item.count--;
        if (item.count === 0) state.inventory = state.inventory.filter(i => i.recipeId !== recipeId);
        saveLocal();
        showToast("😋 食べました！");
    }
}

// 調理パネルの表示
function startCooking(recipeId) {
    currentRecipe = state.recipes.find(r => r.id === recipeId);
    document.getElementById('recipe-selection').classList.add('hidden');
    document.getElementById('cooking-panel').classList.remove('hidden');
    document.getElementById('cooking-emoji').innerText = currentRecipe.emoji || "🍱";
    document.getElementById('cooking-name').innerText = currentRecipe.name;
}

function cancelCooking() {
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
}

// 調理完了・在庫追加
function finishCooking() {
    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;
    const existing = state.inventory.find(i => i.recipeId === currentRecipe.id);
    if (existing) existing.count += count;
    else state.inventory.push({ recipeId: currentRecipe.id, name: currentRecipe.name, emoji: currentRecipe.emoji || "🍱", count: count });
    
    state.history.unshift({ id: Date.now(), date: new Date().toLocaleDateString(), name: currentRecipe.name, emoji: currentRecipe.emoji || "🍱", count: count });
    saveLocal();
    showToast(`✨ ${currentRecipe.name} を ${count}食 追加しました！`);
    showTab('home');
    cancelCooking();
}

// レシピ追加
function addRecipe() {
    const emoji = document.getElementById('new-recipe-emoji').value || "🍱";
    const name = document.getElementById('new-recipe-name').value;
    const ing = document.getElementById('new-recipe-ing').value;
    if (!name) return showToast("⚠️ 料理名を入力してください");
    state.recipes.push({ id: Date.now(), name, emoji, ingredients: ing });
    saveLocal();
    document.getElementById('new-recipe-emoji').value = "🍱";
    document.getElementById('new-recipe-name').value = "";
    document.getElementById('new-recipe-ing').value = "";
    showToast("📝 レシピを追加しました！");
}

// レシピ削除
function deleteRecipe(id) {
    if (!confirm("本当に削除しますか？")) return;
    state.recipes = state.recipes.filter(r => r.id !== id);
    saveLocal();
}

// 買い物カートに追加・削除
function toggleShopCart(recipeId) {
    if (state.shoppingCart.includes(recipeId)) {
        state.shoppingCart = state.shoppingCart.filter(id => id !== recipeId);
    } else {
        state.shoppingCart.push(recipeId);
    }
    saveLocal();
}

// 材料の打ち消し線（持ってるものを消す）
function toggleIng(ing) {
    if (state.crossedOut.includes(ing)) {
        state.crossedOut = state.crossedOut.filter(i => i !== ing);
    } else {
        state.crossedOut.push(ing);
    }
    saveLocal();
}

// 設定・GAS関連
function saveGasUrl() {
    GAS_URL = document.getElementById('gas-url').value;
    localStorage.setItem('bento_gas_url', GAS_URL);
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
    a.download = "bento_backup.json";
    a.click();
}

function uploadFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { state = JSON.parse(e.target.result); saveLocal(); showToast("🔄 復元が完了しました！"); };
    reader.readAsText(file);
}

// 画面の描画（レンダー）
function render() {
    // 1. 在庫リスト（色で警告表示）
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let total = 0;
    if (state.inventory.length === 0) {
        invList.innerHTML = '<div class="text-center text-gray-400 py-10">在庫が空っぽです。<br>下の「🍳作る」から補充しましょう！</div>';
    } else {
        state.inventory.forEach(item => {
            total += item.count;
            let countColor = "text-red-400"; // 少ない
            if (item.count >= 4) countColor = "text-green-500"; // 十分
            else if (item.count >= 2) countColor = "text-yellow-500"; // 普通

            invList.innerHTML += `<div class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-blue-50">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">${item.emoji || "🍱"}</span>
                    <div><div class="font-bold text-gray-700">${item.name}</div><div class="text-sm font-bold ${countColor}">残り ${item.count} 食</div></div>
                </div>
                <button onclick="consume(${item.recipeId})" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold">食べた</button>
            </div>`;
        });
    }
    document.getElementById('total-count').innerText = total;

    // 2. 作る（レシピ選択）
    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    if (state.recipes.length === 0) recList.innerHTML = '<div class="text-center text-gray-400 py-10">レシピがありません。<br>「📖レシピ」から登録してください。</div>';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})" class="bg-white p-4 rounded-2xl text-left border border-blue-50 shadow-sm flex items-center gap-3">
            <span class="text-3xl">${recipe.emoji || "🍱"}</span>
            <div><div class="font-bold text-gray-700">${recipe.name}</div></div>
        </button>`;
    });

    // 3. レシピ管理一覧
    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `<div class="bg-white p-3 rounded-xl shadow-sm border border-blue-50 flex justify-between items-center text-sm">
            <div class="flex items-center gap-2 font-bold"><span class="text-xl">${recipe.emoji || "🍱"}</span> ${recipe.name}</div>
            <button onclick="deleteRecipe(${recipe.id})" class="text-red-400 bg-red-50 px-3 py-1 rounded-lg font-bold">削除</button>
        </div>`;
    });

    // 4. お買い物リスト描画
    const shopContainer = document.getElementById('shopping-list-container');
    let shopHtml = '<div class="bg-white p-5 rounded-2xl shadow-sm border border-blue-50 mb-4"><h3 class="font-bold text-gray-700 mb-3 text-sm">今週作る予定のレシピを選択</h3><div class="space-y-2">';
    state.recipes.forEach(r => {
        const checked = state.shoppingCart.includes(r.id) ? 'checked' : '';
        shopHtml += `<label class="flex items-center p-2 rounded-xl active:bg-gray-50"><input type="checkbox" class="mr-3 w-5 h-5 accent-[#a2d2ff]" ${checked} onchange="toggleShopCart(${r.id})"> <span class="text-xl mr-2">${r.emoji || "🍱"}</span><span class="font-bold text-gray-600">${r.name}</span></label>`;
    });
    
    // 材料の集計
    let allIngs = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) {
            // スペースやカンマ、読点で分割
            const items = r.ingredients.split(/[,、\s]+/);
            allIngs.push(...items.filter(i => i.trim() !== ""));
        }
    });
    allIngs = [...new Set(allIngs)]; // 重複削除

    shopHtml += '</div></div><div class="bg-white p-5 rounded-2xl shadow-sm border border-blue-50"><h3 class="font-bold text-gray-700 mb-3 text-sm">買うものリスト（家にあるものはタップで消す）</h3><div class="flex flex-wrap gap-2">';
    if(allIngs.length === 0) shopHtml += '<p class="text-sm text-gray-400">上のレシピにチェックを入れると材料が表示されます</p>';
    allIngs.forEach(ing => {
        const isCrossed = state.crossedOut.includes(ing);
        const btnClass = isCrossed ? 'strikethrough bg-gray-100 text-gray-400 border-transparent' : 'bg-[#e7f5ff] text-blue-700 border-blue-200';
        shopHtml += `<button onclick="toggleIng('${ing}')" class="px-4 py-2 border rounded-full text-sm font-bold shadow-sm transition-all ${btnClass}">${ing}</button>`;
    });
    shopHtml += '</div></div>';
    shopContainer.innerHTML = shopHtml;

    // 5. 履歴リスト
    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    if (state.history.length === 0) histList.innerHTML = '<div class="text-center text-gray-400 py-10">まだ履歴がありません</div>';
    state.history.slice(0, 10).forEach(h => {
        histList.innerHTML += `<div class="p-3 bg-white rounded-xl border border-blue-50 shadow-sm flex justify-between items-center text-sm">
            <span class="text-gray-400 text-xs">${h.date}</span><span class="font-bold text-gray-700 flex items-center gap-1"><span class="text-lg">${h.emoji || "🍱"}</span>${h.name}</span><span class="font-bold text-[#a2d2ff]">${h.count}食</span>
        </div>`;
    });

    document.getElementById('gas-url').value = GAS_URL;
}

render();
showTab('home');