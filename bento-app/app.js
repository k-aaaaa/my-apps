// ==========================================================================
// 🚀 パスワード撤廃＆初期化
// ==========================================================================
function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

let state = JSON.parse(localStorage.getItem('bento_universe_data')) || {
    inventory: [],      
    history: [],        
    recipes: [],        
    shoppingCart: [],   
    crossedOut: [],     
    savedAmount: 0,     
    saveUnit: 600,      
    alertDays: 14,      
    appTheme: 'theme-stylish', 
    autoSync: false,
    splashTime: 1200,
    customColors: {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    }
};
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentRecipe = null; 

window.addEventListener('DOMContentLoaded', () => {
    applyCurrentThemeAndColors();

    const imgData = localStorage.getItem('bento_welcome_img');
    const splashTime = state.splashTime || 1200;
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

    render();
});

function saveLocal() {
    localStorage.setItem('bento_universe_data', JSON.stringify(state));
    render();
    if (state.autoSync) cloudSyncSilent();
}

function showToast(msg) {
    const t = document.createElement('div');
    t.style = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:10px 20px; border-radius:30px; font-size:12px; font-weight:bold; z-index:9999; letter-spacing:0.5px;';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// ==========================================================================
// 🎨 カラーカスタマイズ制御エンジン（部位変更版）
// ==========================================================================
function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    const themeSel = document.getElementById('theme-selector');
    if (themeSel) themeSel.value = theme;

    if (!state.customColors[theme]) {
        const defaults = {
            'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
            'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
            'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
        };
        state.customColors[theme] = defaults[theme] || defaults['theme-stylish'];
    }

    const colors = state.customColors[theme];
    const root = document.documentElement;

    root.style.setProperty('--bg-color', colors.bg);
    root.style.setProperty('--panel-bg', colors.panel);
    root.style.setProperty('--accent-color', colors.accent);

    const hexToLuma = (color) => {
        const hex = color.replace('#', '');
        if(hex.length !== 6) return 1;
        const r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
        return [0.299 * r, 0.587 * g, 0.114 * b].reduce((a, b) => a + b) / 255;
    };
    root.style.setProperty('--text-color', hexToLuma(colors.bg) > 0.5 ? '#1d1d1f' : '#ffffff');

    const rgbaToHex = (rgba) => {
        const match = rgba.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)/i);
        return (match && match.length === 4) ? "#" + ("0" + parseInt(match[1],10).toString(16)).slice(-2) + ("0" + parseInt(match[2],10).toString(16)).slice(-2) + ("0" + parseInt(match[3],10).toString(16)).slice(-2) : rgba;
    };

    const pickerBg = document.getElementById('custom-color-bg');
    const pickerPanel = document.getElementById('custom-color-panel');
    const pickerAccent = document.getElementById('custom-color-accent');
    if (pickerBg) pickerBg.value = rgbaToHex(colors.bg);
    if (pickerPanel) pickerPanel.value = rgbaToHex(colors.panel);
    if (pickerAccent) pickerAccent.value = rgbaToHex(colors.accent);
}

function updateCustomColor(type, value) {
    const theme = state.appTheme || 'theme-stylish';
    state.customColors[theme][type] = value;
    applyCurrentThemeAndColors();
    saveLocal();
}

function resetCurrentThemeColors() {
    vibrate();
    const theme = state.appTheme || 'theme-stylish';
    const defaults = {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    };
    state.customColors[theme] = { ...defaults[theme] };
    applyCurrentThemeAndColors();
    saveLocal();
    showToast("テーマの色を初期化しました！");
}

function changeAppTheme(themeName) {
    vibrate();
    state.appTheme = themeName;
    applyCurrentThemeAndColors();
    saveLocal();
}

// ==========================================================================
// 📱 タブメニュー切り替え
// ==========================================================================
document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        vibrate();
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(btn.dataset.target).classList.add('active');
        btn.classList.add('active');
    });
});

// ==========================================================================
// 🎲 今日のお弁当ルーレット
// ==========================================================================
function spinRoulette() {
    vibrate();
    if(state.inventory.length === 0) {
        return alert("冷凍ストックがありません！\nまずは「作った」タブからお弁当を追加してね🍳");
    }
    const randomIndex = Math.floor(Math.random() * state.inventory.length);
    const picked = state.inventory[randomIndex];
    
    confetti({ particleCount: 50, spread: 40, origin: { y: 0.6 } });
    
    setTimeout(() => {
        alert(`🎲 今日の運勢が導いたお弁当は…\n\n【 ${picked.emoji} ${picked.name} 】\n\nこれに決定！美味しく食べてね！😋`);
    }, 100);
}

// ==========================================================================
// 📦 在庫の修正・お金・履歴システム（エコ仕様）
// ==========================================================================
function adjustInventory(id, delta, isEaten = false) {
    vibrate();
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    
    if (isEaten) {
        item.count += delta; 
        state.savedAmount = (state.savedAmount || 0) + (parseInt(state.saveUnit) || 600);
        
        state.history.unshift({
            id: Date.now(),
            date: new Date().toLocaleDateString('ja-JP'),
            name: item.name,
            emoji: item.emoji,
            count: 1,
            snapshotRecipeId: item.recipeId 
        });
        
        // 【エコ仕様】履歴が30件を超えたら古いものを自動でサクッと削除
        if (state.history.length > 30) {
            state.history = state.history.slice(0, 30);
        }
        
        showToast(`😋 食べました！(＋${state.saveUnit}円)`);
        confetti({ particleCount: 30, spread: 40, origin: { y: 0.8 } });
    } else {
        item.count += delta;
        showToast(`📦 ストック数を修正しました`);
    }

    if (item.count <= 0) {
        state.inventory = state.inventory.filter(i => i.id !== id);
    }
    
    saveLocal();
}

function revokeEatenHistory(historyId) {
    vibrate();
    const histItem = state.history.find(h => h.id === historyId);
    if (!histItem) return;

    if (confirm(`🍱 食べた記録を取り消しますか？\n\n・節約金額から ${state.saveUnit}円 引かれます。\n・「${histItem.name}」の在庫が1食分自動で復活します。`)) {
        state.savedAmount = Math.max(0, (state.savedAmount || 0) - (parseInt(state.saveUnit) || 600));
        let stockItem = state.inventory.find(i => i.recipeId === histItem.snapshotRecipeId);
        
        if (stockItem) {
            stockItem.count += 1;
        } else {
            state.inventory.push({
                id: Date.now(), recipeId: histItem.snapshotRecipeId || Date.now(),
                name: histItem.name, emoji: histItem.emoji || "🍱", count: 1, timestamp: Date.now() 
            });
        }

        // ここで履歴配列から消すため、自動削除（slice）されたデータが勝手に復活することはありません。
        state.history = state.history.filter(h => h.id !== historyId);
        saveLocal();
        showToast("✖ 食べる前の状態に巻き戻しました");
    }
}

function editSavedAmountManual() {
    vibrate();
    const val = prompt("【節約金額の手動微調整】\n現在の合計金額を直接変更したい場合は数値を入力:", state.savedAmount);
    if (val !== null && !isNaN(val) && val !== "") {
        state.savedAmount = parseInt(val); saveLocal(); showToast("💰 金額を変更しました");
    }
}

// ==========================================================================
// 🍳 お弁当ストック作成
// ==========================================================================
function startCooking(recipeId) {
    vibrate();
    currentRecipe = state.recipes.find(r => r.id === recipeId);
    if (!currentRecipe) return;

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
    currentRecipe = null; 
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
}

function finishCooking() {
    vibrate();
    if (!currentRecipe) return;

    const count = parseInt(document.getElementById('make-count').value);
    if (!count || count <= 0) return;
    
    currentRecipe.lastCount = count;
    state.inventory.push({
        id: Date.now(), recipeId: currentRecipe.id, name: currentRecipe.name,
        emoji: currentRecipe.emoji, count: count, timestamp: Date.now()
    });
    
    currentRecipe = null; 
    document.getElementById('recipe-selection').classList.remove('hidden');
    document.getElementById('cooking-panel').classList.add('hidden');
    
    saveLocal();
    showToast(`✨ストックを追加しました！`);
    
    // ホーム画面に自動で戻る
    document.querySelector('.bottom-nav button[data-target="view-home"]').click();
}

// ==========================================================================
// 🛒 メニュー管理・お買い物リスト
// ==========================================================================
function saveRecipe() {
    vibrate();
    const id = document.getElementById('edit-recipe-id').value;
    const emoji = document.getElementById('new-recipe-emoji').value.trim() || "🍱";
    const name = document.getElementById('new-recipe-name').value.trim();
    const ing = document.getElementById('new-recipe-ing').value.trim();
    if (!name) return alert("料理名を入力してください！");

    if (id) {
        const r = state.recipes.find(x => x.id == id);
        if(r) { r.name = name; r.emoji = emoji; r.ingredients = ing; }
    } else {
        state.recipes.push({ id: Date.now(), name, emoji, ingredients: ing, lastCount: 4 });
    }
    cancelEditRecipe(); saveLocal();
}

function editRecipe(id) {
    const r = state.recipes.find(x => x.id === id); if(!r) return;
    document.getElementById('edit-recipe-id').value = r.id;
    document.getElementById('new-recipe-emoji').value = r.emoji;
    document.getElementById('new-recipe-name').value = r.name;
    document.getElementById('new-recipe-ing').value = r.ingredients;
    document.getElementById('save-recipe-btn').innerText = "メニューを更新";
    document.getElementById('cancel-recipe-btn').classList.remove('hidden');
}

function cancelEditRecipe() {
    document.getElementById('edit-recipe-id').value = ""; document.getElementById('new-recipe-emoji').value = "🍱"; document.getElementById('new-recipe-name').value = ""; document.getElementById('new-recipe-ing').value = "";
    document.getElementById('save-recipe-btn').innerText = "メニューに追加"; document.getElementById('cancel-recipe-btn').classList.add('hidden');
}

function deleteRecipe(id) {
    if (!confirm("このメニューを削除しますか？(ストックは消えません)")) return;
    if (currentRecipe && currentRecipe.id === id) cancelCooking(); // 調理中の誤作動防止
    
    state.recipes = state.recipes.filter(r => r.id !== id);
    state.shoppingCart = state.shoppingCart.filter(cartId => cartId !== id); 
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
    let text = "【週末お買い物リスト】\n";
    let allIngs = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) allIngs.push(...r.ingredients.split(/[,、\s]+/).filter(i => i.trim() !== ""));
    });
    allIngs = [...new Set(allIngs)];
    if (allIngs.length === 0) return showToast("リストが空っぽです");
    
    allIngs.forEach(ing => {
        text += `${state.crossedOut.includes(ing) ? " ■ [済] " : " □ "}${ing}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => showToast("📋 LINE貼り付け用にコピーしました！"));
}

// ==========================================================================
// 🖼️ 設定管理・GAS同期
// ==========================================================================
function saveWelcomeImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try { localStorage.setItem('bento_welcome_img', event.target.result); document.getElementById('welcome-img-preview').src = event.target.result; document.getElementById('welcome-img-preview-container').classList.remove('hidden'); showToast("🖼️ お出迎え画像を登録しました！"); } 
        catch(err) { alert("⚠️ 画像サイズが大きすぎます。小さめの画像を選んでください。"); }
    };
    reader.readAsDataURL(file);
}
function clearWelcomeImage() { localStorage.removeItem('bento_welcome_img'); document.getElementById('welcome-img-preview-container').classList.add('hidden'); showToast("画像を消去しました"); }
function saveSplashTime(val) { state.splashTime = parseInt(val); saveLocal(); }
function saveAppSettings() { vibrate(); state.saveUnit = parseInt(document.getElementById('settings-save-unit').value) || 600; state.alertDays = parseInt(document.getElementById('settings-alert-days').value) || 14; saveLocal(); showToast("⚙️ 設定を保存しました"); }

function saveGasUrl() { GAS_URL = document.getElementById('gas-url').value.trim(); localStorage.setItem('bento_gas_url', GAS_URL); showToast("☁️ 連携URLを保存しました"); }
function toggleAutoSync(checked) { state.autoSync = checked; saveLocal(); }
function triggerManualSync() {
    vibrate(); if (!GAS_URL) return showToast("⚠️ 先に設定でGASのURLを登録してください");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" }).then(() => showToast("☁️ 手動バックアップが完了しました！")).catch(() => showToast("⚠️ 同期に失敗しました"));
}
function cloudSyncSilent() { if (GAS_URL) fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" }, mode: "no-cors" }); }
function resetData() { if(!confirm("本当に全てのデータを初期化しますか？")) return; localStorage.clear(); location.reload(); }

// ==========================================================================
// 🖌️ メイン画面・描画ロジック
// ==========================================================================
function render() {
    const now = Date.now();
    const savedMoneyEl = document.getElementById('saved-money');
    savedMoneyEl.innerText = "¥" + (state.savedAmount || 0).toLocaleString();
    savedMoneyEl.onclick = editSavedAmountManual;

    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let totalStockCount = 0;

    let sortedInv = [...state.inventory].sort((a,b) => a.timestamp - b.timestamp);
    
    if(sortedInv.length === 0) {
        invList.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.5; font-weight:bold; font-size:14px;">冷凍ストックがありません。<br>下の「作った」から追加してね！🍳</div>';
    }

    sortedInv.forEach(item => {
        totalStockCount += item.count;
        const daysOld = item.timestamp ? Math.floor((now - item.timestamp) / 86400000) : 0;
        
        let badgeHtml = '';
        const limit = state.alertDays || 14;
        if (daysOld >= limit) badgeHtml = `<span class="badge-danger">⏳ ${daysOld}日経過・早めに！</span>`;
        else if (daysOld >= limit / 2) badgeHtml = `<span class="badge-warning">🕒 ${daysOld}日経過</span>`;

        invList.innerHTML += `
            <div class="bento-card">
                <div class="bento-info">
                    <div class="bento-emoji-wrapper">${item.emoji || "🍱"}</div>
                    <div class="bento-details">
                        <div class="bento-name-row"><span class="bento-name">${item.name}</span>${badgeHtml}</div>
                        <div class="bento-qty-control">
                            <button onclick="adjustInventory(${item.id}, -1, false)" class="btn-circle">-</button>
                            <span class="qty-display">${item.count}</span>
                            <button onclick="adjustInventory(${item.id}, 1, false)" class="btn-circle">+</button>
                        </div>
                    </div>
                </div>
                <button onclick="adjustInventory(${item.id}, -1, true)" class="btn-eat">食べた</button>
            </div>
        `;
    });
    document.getElementById('total-count').innerText = totalStockCount;

    const recList = document.getElementById('recipe-selection');
    recList.innerHTML = '';
    if(state.recipes.length === 0) recList.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; opacity:0.5; font-weight:bold; font-size:13px;">「メニュー」タブから料理を登録してください✏️</div>';
    state.recipes.forEach(recipe => {
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})"><span style="font-size:30px;">${recipe.emoji || "🍱"}</span><div style="font-weight:900; font-size:14px;">${recipe.name}</div></button>`;
    });

    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `
            <div class="recipe-edit-row">
                <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:16px;">${recipe.emoji || "🍱"}</span> ${recipe.name}</div>
                <div style="display:flex;gap:4px;">
                    <button onclick="editRecipe(${recipe.id})" style="color:var(--accent-color); background:none; border:none; font-weight:bold; cursor:pointer;">編集</button>
                    <button onclick="deleteRecipe(${recipe.id})" style="color:#c53030; background:none; border:none; font-weight:bold; cursor:pointer; margin-left:6px;">削除</button>
                </div>
            </div>
        `;
    });

    const shopContainer = document.getElementById('shopping-list-container');
    let shopHtml = '<div class="space-y" style="display:flex; flex-direction:column; gap:6px;">';
    state.recipes.forEach(r => {
        const checked = state.shoppingCart.includes(r.id) ? 'checked' : '';
        shopHtml += `<label class="shopping-item-row"><input type="checkbox" class="shopping-checkbox" ${checked} onchange="toggleShopCart(${r.id})"><span style="font-size:16px; margin-right:4px;">${r.emoji || "🍱"}</span> ${r.name}を買う</label>`;
    });
    shopHtml += '</div><hr style="border:0; border-top:1px solid rgba(0,0,0,0.05); margin:15px 0;"><div class="ing-tag-container">';
    
    let allIngredients = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) allIngredients.push(...r.ingredients.split(/[,、\s]+/).filter(i => i.trim() !== ""));
    });
    allIngredients = [...new Set(allIngredients)];
    
    if(allIngredients.length === 0) shopHtml += '<p style="font-size:11px; opacity:0.5; font-weight:bold; text-align:center; width:100%;">上にチェックを入れると、買うものタグが自動生成されます</p>';
    else {
        allIngredients.forEach(ing => {
            const isCrossed = state.crossedOut.includes(ing);
            shopHtml += `<button onclick="toggleIng('${ing}')" class="ing-tag ${isCrossed ? 'crossed' : 'active'}">${ing}</button>`;
        });
    }
    shopContainer.innerHTML = shopHtml + '</div>';

    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    if(state.history.length === 0) histList.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.4; font-size:12px; font-weight:bold;">食べた履歴はまだありません😋</div>';
    
    state.history.forEach(h => {
        histList.innerHTML += `
            <div class="history-item-row">
                <div class="history-meta">${h.date}</div>
                <div class="history-core"><span style="font-size:16px;">${h.emoji || "🍱"}</span><span>${h.name} を1食</span></div>
                <span class="history-amount">¥${state.saveUnit}浮いた!</span>
                <button onclick="revokeEatenHistory(${h.id})" class="btn-delete-history" title="取り消して在庫に戻す">✖</button>
            </div>
        `;
    });

    document.getElementById('settings-save-unit').value = state.saveUnit || 600;
    document.getElementById('settings-alert-days').value = state.alertDays || 14;
    document.getElementById('gas-url').value = GAS_URL;
    const autoSyncEl = document.getElementById('settings-auto-sync');
    if (autoSyncEl) autoSyncEl.checked = state.autoSync || false;
}