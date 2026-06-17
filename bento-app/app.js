// ==========================================================================
// 🚀 データベースエンジン (IndexedDB) - AI版の強み（容量無制限化）
// ==========================================================================
const DB_NAME = 'BentoUniverseDB';
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
function fireConfetti(options) { if (typeof confetti === 'function') { try { confetti(options); } catch (e) {} } }
function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ==========================================================================
// 💬 トースト通知 (User版の強み)
// ==========================================================================
function showToast(msg) {
    const t = document.createElement('div');
    t.style = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:10px 20px; border-radius:30px; font-size:13px; font-weight:bold; z-index:9999; letter-spacing:0.5px; opacity:0; transition:opacity 0.3s;';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '1', 10);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 2200);
}

// ==========================================================================
// 🍱 グローバル状態 (State)
// ==========================================================================
let state = null;
let GAS_URL = localStorage.getItem('bento_gas_url') || "";
let currentCookingRecipeId = null;

const defaultState = {
    totalSaved: 0,
    inventory: [], 
    recipes: [], 
    shoppingList: [], 
    history: [], 
    saveUnit: 600,
    alertDays: 14,
    appTheme: 'theme-stylish',
    splashTime: 1200,
    autoSync: false,
    customColors: {
        'theme-stylish': { bg: '#f4f5f7', panel: 'rgba(255, 255, 255, 0.6)', accent: '#1d1d1f' },
        'theme-cute': { bg: '#fff5f5', panel: 'rgba(255, 255, 255, 0.85)', accent: '#ff85a1' },
        'theme-gaming': { bg: '#07070c', panel: 'rgba(10, 10, 20, 0.8)', accent: '#00ffcc' }
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    // 🚚 データ移行（マイグレーション）処理：古いlocalStorageがあれば救出する
    const oldLocalData = localStorage.getItem('bento_universe_data');
    if (oldLocalData) {
        try {
            const parsedOld = JSON.parse(oldLocalData);
            // 古い設計(User版)の shoppingCart と crossedOut を新しい shoppingList に変換
            if (parsedOld.shoppingCart && parsedOld.crossedOut) {
                parsedOld.shoppingList = [];
                let allIngs = [];
                parsedOld.shoppingCart.forEach(id => {
                    const r = parsedOld.recipes.find(x => x.id === id);
                    if(r && r.ingredients) allIngs.push(...r.ingredients.split(/[,\s、，]+/).filter(i => i.trim() !== ""));
                    if(r) r.inShopping = true;
                });
                allIngs = [...new Set(allIngs)];
                allIngs.forEach(ing => {
                    parsedOld.shoppingList.push({ name: ing, crossed: parsedOld.crossedOut.includes(ing) });
                });
            }
            if (parsedOld.savedAmount !== undefined) parsedOld.totalSaved = parsedOld.savedAmount;

            await saveStateToDB({ ...defaultState, ...parsedOld });
            localStorage.removeItem('bento_universe_data'); // 移行完了後に削除
        } catch(e) { console.error("データ移行エラー", e); }
    }

    try {
        const storedState = await loadStateFromDB();
        state = storedState ? { ...defaultState, ...storedState } : JSON.parse(JSON.stringify(defaultState));
        if (!state.shoppingList) state.shoppingList = [];
        if (!state.history) state.history = [];
    } catch (e) {
        state = JSON.parse(JSON.stringify(defaultState));
    }

    applyCurrentThemeAndColors();
    document.getElementById('gas-url').value = GAS_URL;
    if (document.getElementById('settings-auto-sync')) document.getElementById('settings-auto-sync').checked = state.autoSync;
    if (document.getElementById('settings-save-unit')) document.getElementById('settings-save-unit').value = state.saveUnit;
    if (document.getElementById('settings-alert-days')) document.getElementById('settings-alert-days').value = state.alertDays;
    if (document.getElementById('settings-splash-time')) document.getElementById('settings-splash-time').value = state.splashTime;

    // 💰 手動微調整イベント (User版の強み)
    document.getElementById('saved-money').addEventListener('click', () => {
        vibrate();
        const val = prompt("【節約金額の手動微調整】\n現在の合計金額を直接変更したい場合は数値を入力:", state.totalSaved);
        if (val !== null && val.trim() !== "") {
            const parsed = parseInt(val.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed)) {
                state.totalSaved = Math.max(0, parsed);
                saveLocal(); 
                showToast("💰 金額を変更しました");
            }
        }
    });

    const imgData = localStorage.getItem('bento_welcome_img');
    const splashTime = state.splashTime || 1200;
    if (imgData) {
        document.getElementById('splash-default').classList.add('hidden');
        const customImg = document.getElementById('splash-custom');
        customImg.src = imgData;
        customImg.classList.remove('hidden');
        if(document.getElementById('welcome-img-preview')) {
            document.getElementById('welcome-img-preview').src = imgData;
            document.getElementById('welcome-img-preview-container').classList.remove('hidden');
        }
    }

    const initialTab = location.hash ? location.hash.replace('#', '') : 'view-home';

    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 500); }
        switchTab(initialTab, false);
        updateUI();
    }, splashTime);
});

// 🔙 History API (タブ切り替え)
window.addEventListener('popstate', (e) => {
    const target = e.state ? e.state.tab : 'view-home';
    switchTab(target, false);
});

function switchTab(targetId, pushHistory = true) {
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    
    if(document.getElementById('edit-recipe-id') && document.getElementById('edit-recipe-id').value !== "") {
        cancelEditRecipe();
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    targetEl.classList.add('active');
    
    const navBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (pushHistory) history.pushState({ tab: targetId }, "", "#" + targetId);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => { vibrate(); switchTab(btn.dataset.target, true); });
});

async function saveLocal() {
    try { await saveStateToDB(state); updateUI(); if(state.autoSync) cloudSyncSilent(); } catch (e) { alert("⚠️ データ保存エラー。"); }
}

// ==========================================================================
// 🎨 テーマ・設定関連
// ==========================================================================
function applyCurrentThemeAndColors() {
    const theme = state.appTheme || 'theme-stylish';
    if (document.getElementById('theme-selector')) document.getElementById('theme-selector').value = theme;
    if (!state.customColors[theme]) state.customColors[theme] = defaultState.customColors['theme-stylish'];
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

    if (document.getElementById('custom-color-bg')) document.getElementById('custom-color-bg').value = rgbaToHex(colors.bg);
    if (document.getElementById('custom-color-panel')) document.getElementById('custom-color-panel').value = rgbaToHex(colors.panel);
    if (document.getElementById('custom-color-accent')) document.getElementById('custom-color-accent').value = rgbaToHex(colors.accent);
}

function updateCustomColor(type, value) { state.customColors[state.appTheme][type] = value; applyCurrentThemeAndColors(); saveLocal(); }
function resetCurrentThemeColors() { vibrate(); if(!confirm("初期色に戻しますか？")) return; state.customColors[state.appTheme] = {...defaultState.customColors[state.appTheme]}; applyCurrentThemeAndColors(); saveLocal(); showToast("色をリセットしました");}
function changeAppTheme(themeName) { vibrate(); state.appTheme = themeName; applyCurrentThemeAndColors(); saveLocal(); }

function saveAppSettings() {
    vibrate();
    const unit = parseInt(document.getElementById('settings-save-unit').value, 10);
    const alertDays = parseInt(document.getElementById('settings-alert-days').value, 10);
    if (!isNaN(unit)) state.saveUnit = unit;
    if (!isNaN(alertDays)) state.alertDays = alertDays;
    saveLocal();
    showToast("⚙️ ルールを保存しました！");
}

function saveWelcomeImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500; let scaleSize = 1;
            if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
            canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.7);
            try {
                localStorage.setItem('bento_welcome_img', base64);
                document.getElementById('welcome-img-preview').src = base64;
                document.getElementById('welcome-img-preview-container').classList.remove('hidden');
                showToast("🖼️ お出迎え画像を登録しました！");
            } catch(err) { alert("画像サイズが大きすぎます。"); }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}
function clearWelcomeImage() { vibrate(); localStorage.removeItem('bento_welcome_img'); document.getElementById('welcome-img-preview-container').classList.add('hidden'); showToast("消去しました"); }
function saveSplashTime(val) { vibrate(); state.splashTime = parseInt(val); saveLocal(); }

// ==========================================================================
// ☁️ クラウド同期 & データ復旧
// ==========================================================================
function saveGasUrl() { GAS_URL = document.getElementById('gas-url').value.trim(); localStorage.setItem('bento_gas_url', GAS_URL); showToast("☁️ GASのURLを保存しました。"); }
function toggleAutoSync(checked) { state.autoSync = checked; saveLocal(); }
function triggerManualSync() {
    vibrate(); if (!GAS_URL) return showToast("⚠️ GASのURLを設定してください");
    fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "text/plain" } }).then(() => showToast("☁️ バックアップ成功！")).catch(() => showToast("⚠️ 通信失敗"));
}
function cloudSyncSilent() { if (GAS_URL) fetch(GAS_URL, { method: "POST", body: JSON.stringify(state), headers: { "Content-Type": "text/plain" } }).catch(()=>{}); }

function exportData() { vibrate(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], {type: "application/json"})); a.download = `BENTO_BACKUP_${Date.now()}.json`; a.click(); }
function importData(e) {
    vibrate(); const file = e.target.files[0]; if(!file) return;
    if(!confirm("⚠️ データを上書き復元しますか？")) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            state = { ...defaultState, ...JSON.parse(ev.target.result) };
            await saveLocal(); alert("✨ 復元成功！再起動します。"); location.reload();
        } catch(err) { alert("ファイルが壊れています"); e.target.value = ''; }
    };
    reader.readAsText(file);
}
function resetData() { vibrate(); if(confirm("本当に全データを初期化しますか？")) { indexedDB.deleteDatabase(DB_NAME); localStorage.removeItem('bento_gas_url'); location.reload(); } }

// ==========================================================================
// ✏️ メニュー(レシピ)管理
// ==========================================================================
function saveRecipe() {
    vibrate();
    const idVal = document.getElementById('edit-recipe-id').value;
    const emojiStr = document.getElementById('new-recipe-emoji').value || "🍱";
    const emoji = Array.from(emojiStr)[0]; // 絵文字の千切れ防止 (AI版の強み)
    const name = document.getElementById('new-recipe-name').value.trim();
    const ingStr = document.getElementById('new-recipe-ing').value.trim();

    if (!name) return alert("料理名を入力してください");
    const ingredients = ingStr ? ingStr.split(/[,、\s]+/).map(s => s.trim()).filter(s => s) : [];

    if (idVal) {
        const recipe = state.recipes.find(r => r.id == idVal);
        if (recipe) { recipe.emoji = emoji; recipe.name = name; recipe.ingredients = ingredients; }
    } else {
        state.recipes.unshift({ id: Date.now(), emoji, name, ingredients, inShopping: false });
    }
    
    cancelEditRecipe(); saveLocal(); showToast(idVal ? "更新しました" : "追加しました");
}

function editRecipe(id) {
    vibrate(); const recipe = state.recipes.find(r => r.id === id); if (!recipe) return;
    document.getElementById('edit-recipe-id').value = recipe.id;
    document.getElementById('new-recipe-emoji').value = recipe.emoji;
    document.getElementById('new-recipe-name').value = recipe.name;
    document.getElementById('new-recipe-ing').value = recipe.ingredients.join(", ");
    document.getElementById('save-recipe-btn').innerText = "上書き更新";
    document.getElementById('cancel-recipe-btn').classList.remove('hidden');
    document.getElementById('view-menu').scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditRecipe() {
    vibrate();
    document.getElementById('edit-recipe-id').value = "";
    document.getElementById('new-recipe-emoji').value = "";
    document.getElementById('new-recipe-name').value = "";
    document.getElementById('new-recipe-ing').value = "";
    document.getElementById('save-recipe-btn').innerText = "メニューに追加";
    document.getElementById('cancel-recipe-btn').classList.add('hidden');
}

function deleteRecipe(id) {
    vibrate();
    if (confirm("このメニューを削除しますか？\n(※現在のストックは消えません)")) {
        const recipe = state.recipes.find(r => r.id === id);
        if (recipe && recipe.inShopping) {
            recipe.ingredients.forEach(ing => {
                state.shoppingList = state.shoppingList.filter(item => item.name !== ing);
            });
        }
        state.recipes = state.recipes.filter(r => r.id !== id);
        if (document.getElementById('edit-recipe-id').value == id) cancelEditRecipe();
        saveLocal();
    }
}

function toggleShoppingRecipe(id, checked) {
    vibrate(); const recipe = state.recipes.find(r => r.id === id); if(!recipe) return;
    recipe.inShopping = checked;
    if (checked) {
        recipe.ingredients.forEach(ing => {
            if (!state.shoppingList.find(i => i.name === ing)) state.shoppingList.push({ name: ing, crossed: false });
        });
    } else {
        recipe.ingredients.forEach(ing => {
            state.shoppingList = state.shoppingList.filter(i => i.name !== ing);
        });
    }
    saveLocal();
}

// ==========================================================================
// 🛒 買い物リスト管理
// ==========================================================================
function toggleShoppingItem(name) { vibrate(); const item = state.shoppingList.find(i => i.name === name); if(item) { item.crossed = !item.crossed; saveLocal(); } }

function resetCrossedOut() { 
    vibrate(); 
    if(!state.shoppingList.some(i => i.crossed)) return showToast("済マークはまだありません");
    if(confirm("買ったもの（済マーク）だけをリセットし、来週も同じメニューをリストに残しますか？")) {
        state.shoppingList = state.shoppingList.filter(i => !i.crossed); 
        saveLocal(); 
        showToast("🧹 済マークを消去しました");
    }
}

function resetShoppingList() { 
    vibrate(); 
    if(state.shoppingList.length === 0) return showToast("リストは既に空です");
    if(confirm("カートをすべて空にしますか？")) { 
        state.shoppingList = []; 
        state.recipes.forEach(r => r.inShopping = false); 
        saveLocal(); 
        showToast("🗑️ カートを空にしました");
    } 
}

function copyShoppingListToClipboard() {
    vibrate(); 
    const items = state.shoppingList.filter(i => !i.crossed).map(i => "・" + i.name).join("\n");
    if(!items) return showToast("買うものがありません");
    const text = `🛒 週末お買い物メモ\n${items}`;
    navigator.clipboard.writeText(text).then(() => showToast("📋 LINE貼り付け用にコピーしました！")).catch(() => prompt("コピーしてください:", text));
}

// ==========================================================================
// 🍳 調理 (ストック作成)
// ==========================================================================
function startCooking(id) {
    vibrate(); const recipe = state.recipes.find(r => r.id === id); if(!recipe) return;
    currentCookingRecipeId = id;
    document.getElementById('cooking-emoji').innerText = recipe.emoji;
    document.getElementById('cooking-name').innerText = recipe.name;
    document.getElementById('make-count').value = 4;
    document.getElementById('cooking-panel').classList.remove('hidden');
    document.getElementById('recipe-selection').classList.add('hidden');
}

function changeMakeCount(delta) {
    vibrate(); const input = document.getElementById('make-count');
    let val = parseInt(input.value, 10) || 0;
    val = Math.max(1, val + delta); input.value = val;
}

function cancelCooking() {
    vibrate(); currentCookingRecipeId = null;
    document.getElementById('cooking-panel').classList.add('hidden');
    document.getElementById('recipe-selection').classList.remove('hidden');
}

function finishCooking() {
    vibrate(); if(!currentCookingRecipeId) return;
    const count = parseInt(document.getElementById('make-count').value, 10) || 0;
    if (count <= 0) return alert("1食以上で作ってね");
    
    const recipe = state.recipes.find(r => r.id === currentCookingRecipeId);
    
    // User版の強み: Timestampや名前を記録して堅牢に
    state.inventory.push({ 
        id: Date.now(), 
        recipeId: currentCookingRecipeId, 
        name: recipe ? recipe.name : "不明",
        emoji: recipe ? recipe.emoji : "🍱",
        count: count, 
        timestamp: Date.now() 
    });
    
    cancelCooking(); saveLocal();
    fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => { switchTab('view-home'); }, 600);
}

// ==========================================================================
// 🍱 食べる＆捨てる (ストック消費) & ルーレット & 巻き戻し(User版の強み)
// ==========================================================================
function spinRoulette() {
    vibrate();
    let tickets = [];
    state.inventory.forEach(item => {
        for(let i=0; i<item.count; i++) { tickets.push(item); }
    });
    if(tickets.length === 0) return alert("ストックがありません！作ってね！");

    const picked = tickets[Math.floor(Math.random() * tickets.length)];
    fireConfetti({ particleCount: 50, spread: 40, origin: { y: 0.6 } });
    setTimeout(() => {
        alert(`🎲 今日の運勢が導いたお弁当は…\n\n【 ${picked.emoji} ${picked.name} 】\n\nこれに決定！美味しく食べてね！😋`);
    }, 100);
}

function adjustInventory(id, delta, isEaten = false) {
    vibrate();
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    
    if (isEaten) {
        item.count += delta; 
        const currentSaveUnit = parseInt(state.saveUnit) || 600;
        state.totalSaved += currentSaveUnit;
        
        // 詳細な履歴保存 (User版の強み)
        state.history.unshift({
            id: Date.now(),
            date: new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            name: item.name,
            emoji: item.emoji,
            savedValue: currentSaveUnit, 
            snapshotRecipeId: item.recipeId,
            snapshotTimestamp: item.timestamp 
        });
        
        if (state.history.length > 30) state.history = state.history.slice(0, 30);
        
        showToast(`😋 食べました！(＋${currentSaveUnit}円)`);
        fireConfetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
    } else {
        // ただの在庫増減 (＋－ボタン)
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

    if (confirm(`🍱 食べた記録を取り消しますか？\n\n・節約金額から ${subtractValue}円 引かれます。\n・「${histItem.name}」の在庫が1食分復活します。`)) {
        state.totalSaved = Math.max(0, state.totalSaved - subtractValue);
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

function discardBento(invId) {
    vibrate(); 
    if(!confirm("⚠️ このストックを1食分、破棄（捨てる）しますか？\n（※節約金額は加算されません）")) return;
    const item = state.inventory.find(i => i.id === invId); if(!item) return;
    item.count--;
    if (item.count <= 0) state.inventory = state.inventory.filter(i => i.id !== invId);
    saveLocal();
    showToast("🗑 1食分を破棄しました");
}

// ==========================================================================
// 🔄 UIの再描画 (Render) - AI版の強み(部品ごとの安全な描画)
// ==========================================================================
function updateUI() {
    document.getElementById('saved-money').innerText = `¥${state.totalSaved.toLocaleString()}`;
    const totalCount = state.inventory.reduce((sum, item) => sum + item.count, 0);
    document.getElementById('total-count').innerText = totalCount;

    renderInventory();
    renderRecipes();
    renderShoppingList();
    renderHistory();
}

function renderInventory() {
    const list = document.getElementById('inventory-list'); if(!list) return;
    list.innerHTML = "";
    if (state.inventory.length === 0) { list.innerHTML = `<p style="text-align:center; opacity:0.5; padding:20px; font-size:12px; font-weight:bold;">ストックが空っぽです！<br>「作った」タブから補充しよう🍱</p>`; return; }

    const now = Date.now();
    const sorted = [...state.inventory].sort((a, b) => a.timestamp - b.timestamp); // 古い順

    sorted.forEach(item => {
        const daysPassed = item.timestamp ? Math.floor((now - item.timestamp) / 86400000) : 0;
        let badgeHtml = `<span style="font-size:11px; opacity:0.6; font-weight:bold;">${daysPassed === 0 ? "今日" : daysPassed + "日前"}に作成</span>`;
        if (daysPassed >= state.alertDays) {
            badgeHtml = `<span class="badge-danger">⚠️ ${daysPassed}日経過！危険かも</span>`;
        } else if (daysPassed >= state.alertDays - 3) {
            badgeHtml = `<span class="badge-warning">⚡️ 早く食べて！</span>`;
        }

        const div = document.createElement('div'); div.className = "bento-card";
        div.innerHTML = `
            <div class="bento-info">
                <div class="bento-emoji-wrapper">${escapeHTML(item.emoji || "🍱")}</div>
                <div class="bento-details">
                    <div class="bento-name-row"><div class="bento-name">${escapeHTML(item.name)}</div></div>
                    <div style="margin-top:4px;">${badgeHtml}</div>
                </div>
            </div>
            <div class="bento-qty-control">
                <button onclick="discardBento(${item.id})" class="btn-circle" style="color:#ff4444; background:rgba(255,0,0,0.1);" title="捨てる">🗑</button>
                <button onclick="adjustInventory(${item.id}, -1, false)" class="btn-circle" style="margin-left:10px;">-</button>
                <div class="qty-display">${item.count}</div>
                <button onclick="adjustInventory(${item.id}, 1, false)" class="btn-circle">+</button>
                <button onclick="adjustInventory(${item.id}, -1, true)" class="btn-eat" style="margin-left:5px;">食べる</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderRecipes() {
    const grid = document.getElementById('recipe-selection');
    const editList = document.getElementById('recipe-edit-list');
    if(!grid || !editList) return;
    grid.innerHTML = ""; editList.innerHTML = "";

    if (state.recipes.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; opacity:0.5; font-size:12px; font-weight:bold;">メニューがありません。<br>「メニュー」タブから登録してね。</div>`;
        return;
    }

    state.recipes.forEach(recipe => {
        // 作る用ボタン
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="font-size:24px;">${escapeHTML(recipe.emoji)}</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(recipe.name)}</span>`;
        btn.onclick = () => startCooking(recipe.id);
        grid.appendChild(btn);

        // 管理リスト用
        const row = document.createElement('div'); row.className = "recipe-edit-row";
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                <input type="checkbox" class="shopping-checkbox" ${recipe.inShopping ? 'checked' : ''} onchange="toggleShoppingRecipe(${recipe.id}, this.checked)">
                <span style="font-size:18px;">${escapeHTML(recipe.emoji)}</span>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(recipe.name)}</span>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-text-danger" style="color:var(--accent-color); text-decoration:none;" onclick="editRecipe(${recipe.id})">✏️</button>
                <button class="btn-text-danger" style="text-decoration:none;" onclick="deleteRecipe(${recipe.id})">🗑️</button>
            </div>
        `;
        editList.appendChild(row);
    });
}

function renderShoppingList() {
    const container = document.getElementById('shopping-list-container'); if(!container) return;
    container.innerHTML = "";
    if (state.shoppingList.length === 0) {
        container.innerHTML = `<p class="text-center opacity-50 text-xs">メニュー管理でチェックした料理の材料がここに自動で並びます</p>`; return;
    }
    const tagContainer = document.createElement('div'); tagContainer.className = "ing-tag-container";
    state.shoppingList.forEach(item => {
        const tag = document.createElement('button');
        tag.className = `ing-tag ${item.crossed ? 'crossed' : 'active'}`;
        tag.innerText = item.name;
        tag.onclick = () => toggleShoppingItem(item.name);
        tagContainer.appendChild(tag);
    });
    container.appendChild(tagContainer);
}

function renderHistory() {
    const list = document.getElementById('history-list'); if(!list) return;
    list.innerHTML = "";
    if (state.history.length === 0) { list.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:12px; font-weight:bold;">まだ履歴がありません</p>`; return; }
    
    state.history.forEach(item => {
        const row = document.createElement('div'); row.className = "history-item-row";
        row.innerHTML = `
            <div class="history-core">
                <span style="font-size:18px;">${escapeHTML(item.emoji)}</span>
                <span>${escapeHTML(item.name)}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span class="history-amount" style="color:var(--accent-color);">+¥${item.savedValue || 600}</span>
                <span class="history-meta">${item.date}</span>
            </div>
            <button onclick="revokeEatenHistory(${item.id})" class="btn-delete-history" title="取り消す">✖</button>
        `;
        list.appendChild(row);
    });
}

// 🔧 SW登録 (PWAキャッシュ対策)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = 'sw.js?v=' + new Date().getTime(); 
        navigator.serviceWorker.register(swUrl).catch(err => console.log('SW registration failed: ', err));
    });
}