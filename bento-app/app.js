// ==========================================================================
// 🚀 究極のBENTO APP ロジック
// ==========================================================================
function vibrate() { if (navigator.vibrate) navigator.vibrate(15); }

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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
// 🎨 カラーカスタマイズ制御エンジン
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
        
        if(document.getElementById('edit-recipe-id') && document.getElementById('edit-recipe-id').value !== "") {
            cancelEditRecipe();
        }

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
    
    // 🔧 確率調整（在庫数に比例させる、いわゆるくじ引き方式）
    let tickets = [];
    state.inventory.forEach(item => {
        for(let i=0; i<item.count; i++) {
            tickets.push(item);
        }
    });
    if(tickets.length === 0) return alert("ストックが0食です！");

    const randomIndex = Math.floor(Math.random() * tickets.length);
    const picked = tickets[randomIndex];
    
    confetti({ particleCount: 50, spread: 40, origin: { y: 0.6 } });
    setTimeout(() => {
        alert(`🎲 今日の運勢が導いたお弁当は…\n\n【 ${picked.emoji} ${picked.name} 】\n\nこれに決定！美味しく食べてね！😋`);
    }, 100);
}

// ==========================================================================
// 📦 在庫の修正・お金・履歴システム
// ==========================================================================
function adjustInventory(id, delta, isEaten = false) {
    vibrate();
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    
    if (isEaten) {
        item.count += delta; 
        const currentSaveUnit = parseInt(state.saveUnit) || 600;
        state.savedAmount = (state.savedAmount || 0) + currentSaveUnit;
        
        state.history.unshift({
            id: Date.now(),
            date: new Date().toLocaleDateString('ja-JP'),
            name: item.name,
            emoji: item.emoji,
            count: 1,
            savedValue: currentSaveUnit, 
            snapshotRecipeId: item.recipeId,
            snapshotTimestamp: item.timestamp 
        });
        
        if (state.history.length > 30) state.history = state.history.slice(0, 30);
        
        showToast(`😋 食べました！(＋${currentSaveUnit}円)`);
        confetti({ particleCount: 30, spread: 40, origin: { y: 0.8 } });
    } else {
        item.count += delta;
        showToast(`📦 ストック数を修正しました`);
    }

    if (item.count <= 0) state.inventory = state.inventory.filter(i => i.id !== id);
    saveLocal();
}

function revokeEatenHistory(historyId) {
    vibrate();
    const histItem = state.history.find(h => h.id === historyId);
    if (!histItem) return;

    const subtractValue = histItem.savedValue || (parseInt(state.saveUnit) || 600);

    if (confirm(`🍱 食べた記録を取り消しますか？\n\n・節約金額から ${subtractValue}円 引かれます。\n・「${histItem.name}」の在庫が1食分自動で復活します。`)) {
        
        state.savedAmount = Math.max(0, (state.savedAmount || 0) - subtractValue);
        
        let stockItem = state.inventory.find(i => i.recipeId === histItem.snapshotRecipeId && i.timestamp === histItem.snapshotTimestamp);
        
        if (stockItem) {
            stockItem.count += 1;
        } else {
            state.inventory.push({
                id: Date.now(), recipeId: histItem.snapshotRecipeId || Date.now(),
                name: histItem.name, emoji: histItem.emoji || "🍱", count: 1, timestamp: histItem.snapshotTimestamp || Date.now() 
            });
        }

        state.history = state.history.filter(h => h.id !== historyId);
        saveLocal();
        showToast("✖ 食べる前の状態に巻き戻しました");
    }
}

function editSavedAmountManual() {
    vibrate();
    const val = prompt("【節約金額の手動微調整】\n現在の合計金額を直接変更したい場合は数値を入力:", state.savedAmount);
    if (val !== null && val.trim() !== "") {
        const parsed = parseInt(val.replace(/[,\s]/g, ''), 10);
        if (!isNaN(parsed)) {
            state.savedAmount = Math.max(0, parsed);
            saveLocal(); 
            showToast("💰 金額を変更しました");
        } else {
            alert("正しい数値を入力してください。");
        }
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

    const inputVal = Number(document.getElementById('make-count').value);
    const count = Math.max(1, Math.floor(inputVal));
    
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
    
    document.querySelector('.bottom-nav button[data-target="view-home"]').click();
}

// ==========================================================================
// 🛒 メニュー管理・お買い物リスト
// ==========================================================================
function saveRecipe() {
    vibrate();
    const id = document.getElementById('edit-recipe-id').value;
    const emojiInput = document.getElementById('new-recipe-emoji').value.trim() || "🍱";
    const emoji = emojiInput.substring(0, 4); 
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
    if (currentRecipe && currentRecipe.id === id) cancelCooking(); 
    
    state.recipes = state.recipes.filter(r => r.id !== id);
    state.shoppingCart = state.shoppingCart.filter(cartId => cartId !== id); 
    
    let allActiveIngs = [];
    state.recipes.forEach(r => {
        if(r.ingredients) allActiveIngs.push(...r.ingredients.split(/[,\s、，]+/).filter(i => i.trim() !== ""));
    });
    state.crossedOut = state.crossedOut.filter(ing => allActiveIngs.includes(ing));

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
        if(r && r.ingredients) allIngs.push(...r.ingredients.split(/[,\s、，]+/).filter(i => i.trim() !== ""));
    });
    allIngs = [...new Set(allIngs)];
    if (allIngs.length === 0) return showToast("リストが空っぽです");
    
    allIngs.forEach(ing => {
        text += `${state.crossedOut.includes(ing) ? " ■ [済] " : " □ "}${ing}\n`;
    });
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast("📋 LINE貼り付け用にコピーしました！"))
            .catch(() => prompt("コピーがブロックされました。以下のテキストを手動でコピーしてください:", text));
    } else {
        prompt("お使いのブラウザでは自動コピーができません。以下のテキストを手動でコピーしてください:", text);
    }
}

function resetShoppingList() {
    vibrate();
    if(state.shoppingCart.length === 0) return showToast("リストは既に空です");
    if(confirm("お買い物お疲れ様でした！\nチェックしたリストを空（リセット）にしますか？")) {
        state.shoppingCart = [];
        state.crossedOut = [];
        saveLocal();
        showToast("🛒 リストをリセットしました！");
    }
}

// ==========================================================================
// 🖼️ 設定管理・GAS・バックアップ
// ==========================================================================
function saveWelcomeImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            try { 
                localStorage.setItem('bento_welcome_img', compressedBase64); 
                document.getElementById('welcome-img-preview').src = compressedBase64; 
                document.getElementById('welcome-img-preview-container').classList.remove('hidden'); 
                showToast("🖼️ お出迎え画像を登録しました！"); 
            } catch(err) { 
                alert("⚠️ まだ画像サイズが大きすぎます。別の画像を選んでください。"); 
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function clearWelcomeImage() { localStorage.removeItem('bento_welcome_img'); document.getElementById('welcome-img-preview-container').classList.add('hidden'); showToast("画像を消去しました"); }
function saveSplashTime(val) { state.splashTime = parseInt(val); saveLocal(); }
function saveAppSettings() { vibrate(); state.saveUnit = parseInt(document.getElementById('settings-save-unit').value) || 600; state.alertDays = parseInt(document.getElementById('settings-alert-days').value) || 14; saveLocal(); showToast("⚙️ 設定を保存しました"); }

function saveGasUrl() { GAS_URL = document.getElementById('gas-url').value.trim(); localStorage.setItem('bento_gas_url', GAS_URL); showToast("☁️ 連携URLを保存しました"); }
function toggleAutoSync(checked) { state.autoSync = checked; saveLocal(); }

function triggerManualSync() {
    vibrate(); 
    if (!GAS_URL) return showToast("⚠️ 先に設定でGASのURLを登録してください");
    
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" } })
    .then(res => {
        if(!res.ok && res.type !== 'opaque') throw new Error();
        showToast("☁️ 手動バックアップが完了しました！");
    })
    .catch(() => showToast("⚠️ 通信に失敗しました。URLやネット環境を確認してください"));
}
function cloudSyncSilent() { if (GAS_URL) fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "application/json" } }).catch(() => {}); }

function exportData() {
    vibrate();
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BENTO_APP_BACKUP_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    vibrate();
    const file = e.target.files[0];
    if(!file) return;
    
    if(!confirm("⚠️ 警告\nファイルを読み込むと、現在のデータはすべて上書きされます！\n本当によろしいですか？")) {
        e.target.value = ''; return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const importedState = JSON.parse(ev.target.result);
            if(importedState && importedState.inventory && importedState.recipes) {
                state = { ...state, ...importedState };
                saveLocal();
                alert("✨ データの復元に成功しました！アプリをリロードします。");
                location.reload();
            } else {
                alert("⚠️ このファイルはお弁当アプリのバックアップではありません。");
            }
        } catch(err) {
            alert("⚠️ 読み込みエラー: ファイルが壊れている可能性があります。");
        }
    };
    reader.readAsText(file);
}

function resetData() { 
    if(!confirm("本当に全てのデータを初期化しますか？\n（※他のアプリのデータは無事です）")) return; 
    localStorage.removeItem('bento_universe_data'); 
    localStorage.removeItem('bento_welcome_img');
    localStorage.removeItem('bento_gas_url');
    location.reload(); 
}

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
                    <div class="bento-emoji-wrapper">${escapeHTML(item.emoji || "🍱")}</div>
                    <div class="bento-details">
                        <div class="bento-name-row"><span class="bento-name">${escapeHTML(item.name)}</span>${badgeHtml}</div>
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
        recList.innerHTML += `<button onclick="startCooking(${recipe.id})"><span style="font-size:30px;">${escapeHTML(recipe.emoji || "🍱")}</span><div style="font-weight:900; font-size:14px;">${escapeHTML(recipe.name)}</div></button>`;
    });

    const editList = document.getElementById('recipe-edit-list');
    editList.innerHTML = '';
    state.recipes.forEach(recipe => {
        editList.innerHTML += `
            <div class="recipe-edit-row">
                <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:16px;">${escapeHTML(recipe.emoji || "🍱")}</span> ${escapeHTML(recipe.name)}</div>
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
        shopHtml += `<label class="shopping-item-row"><input type="checkbox" class="shopping-checkbox" ${checked} onchange="toggleShopCart(${r.id})"><span style="font-size:16px; margin-right:4px;">${escapeHTML(r.emoji || "🍱")}</span> ${escapeHTML(r.name)}を買う</label>`;
    });
    shopHtml += '</div><hr style="border:0; border-top:1px solid rgba(0,0,0,0.05); margin:15px 0;"><div class="ing-tag-container">';
    
    let allIngredients = [];
    state.shoppingCart.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(r && r.ingredients) allIngredients.push(...r.ingredients.split(/[,\s、，]+/).filter(i => i.trim() !== ""));
    });
    allIngredients = [...new Set(allIngredients)];
    
    if(allIngredients.length === 0) shopHtml += '<p style="font-size:11px; opacity:0.5; font-weight:bold; text-align:center; width:100%;">上にチェックを入れると、買うものタグが自動生成されます</p>';
    else {
        allIngredients.forEach(ing => {
            const isCrossed = state.crossedOut.includes(ing);
            shopHtml += `<button onclick="toggleIng('${escapeHTML(ing)}')" class="ing-tag ${isCrossed ? 'crossed' : 'active'}">${escapeHTML(ing)}</button>`;
        });
    }
    shopContainer.innerHTML = shopHtml + '</div>';

    const histList = document.getElementById('history-list');
    histList.innerHTML = '';
    if(state.history.length === 0) histList.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.4; font-size:12px; font-weight:bold;">食べた履歴はまだありません😋</div>';
    
    state.history.forEach(h => {
        const histValue = h.savedValue || state.saveUnit || 600;
        histList.innerHTML += `
            <div class="history-item-row">
                <div class="history-meta">${h.date}</div>
                <div class="history-core"><span style="font-size:16px;">${escapeHTML(h.emoji || "🍱")}</span><span>${escapeHTML(h.name)} を1食</span></div>
                <span class="history-amount">¥${histValue}浮いた!</span>
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration failed: ', err);
        });
    });
}