// ====== CONFIG SUPABASE (Hubungkan dengan project Anda) ======
const SUPABASE_URL = 'https://lqnkysmcfldmwxrwsbuj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxbmt5c21jZmxkbXd4cndzYnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MjUzMjgsImV4cCI6MjA5ODQwMTMyOH0._FCvLNNit802Z-SxoxnntOH80hyCnpwzbGzd-i-vbRI'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== STATE APLIKASI ======
let categoriesList = [];
let menuItemsList = [];
let cart = {}; // Format: { [itemId]: quantity }
let orderHistoryList = [];

// No WhatsApp Penerima (Butik Catering) - Format Kode Negara tanpa '+' atau '0' di depan. Contoh: 628123456789
const WHATSAPP_NUMBER = "628123456789"; 

// ====== EVENT INITIALIZATION ======
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupFormListeners();
});

// Load Data Awal
async function initApp() {
    await fetchCategories();
    await fetchMenuItems();
    await fetchOrderHistory();
    renderCatalog();
    populateCategoryDropdown();
}

// ====== NAVIGATION TABS (Sangat responsif & cocok untuk layout APK) ======
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Auto-fetch data baru jika ke tab history
    if(tabId === 'history') {
        fetchOrderHistory();
    }
}

// ====== DATABASE OPERATIONS (FETCH) ======

// Ambil Kategori dari Supabase
async function fetchCategories() {
    const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
    
    if (error) console.error("Error categories:", error);
    else categoriesList = data || [];
}

// Ambil Menu dari Supabase
async function fetchMenuItems() {
    const { data, error } = await supabaseClient
        .from('menu_items')
        .select('*');
    
    if (error) console.error("Error menus:", error);
    else menuItemsList = data || [];
}

// Ambil History Pesanan dari Supabase
async function fetchOrderHistory() {
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) console.error("Error orders:", error);
    else {
        orderHistoryList = data || [];
        renderHistoryTable();
    }
}

// ====== RENDER UI (Sisi Pelanggan) ======
function renderCatalog() {
    const container = document.getElementById("catalog-container");
    container.innerHTML = "";

    if (categoriesList.length === 0) {
        container.innerHTML = `<div class="loading">Belum ada menu yang dibuat oleh Admin.</div>`;
        return;
    }

    categoriesList.forEach(category => {
        // Cari menu yang berasosiasi dengan kategori saat ini
        const items = menuItemsList.filter(item => item.category_id === category.id);
        
        // Buat Section Kategori (Submenu Custom)
        const section = document.createElement("div");
        section.className = "category-section";
        
        section.innerHTML = `
            <h2 class="category-title">${category.name}</h2>
            <div class="menu-grid" id="category-grid-${category.id}">
                <!-- Menu Card Items -->
            </div>
        `;
        
        container.appendChild(section);
        const grid = document.getElementById(`category-grid-${category.id}`);

        if(items.length === 0) {
            grid.innerHTML = `<p style="color:#aaa; grid-column: 1/-1;">Belum ada hidangan di kategori ini.</p>`;
        } else {
            items.forEach(item => {
                const qty = cart[item.id] || 0;
                const card = document.createElement("div");
                card.className = "menu-card";
                card.innerHTML = `
                    <img class="menu-img" src="${item.image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x400?text=Kue+Butik+Catering'">
                    <div class="menu-body">
                        <h3 class="menu-item-title">${item.title}</h3>
                        <p class="menu-item-desc">${item.description}</p>
                        <div class="menu-item-footer">
                            <span class="menu-item-price">Rp ${parseFloat(item.price).toLocaleString('id-ID')}</span>
                            <div class="action-btn-area" id="action-area-${item.id}">
                                ${qty > 0 ? renderQtyController(item.id, qty) : `<button class="btn-add" onclick="updateCartQty(${item.id}, 1)">Tambah</button>`}
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    });
}

// Tombol Penambah/Pengurang Qty Ala-ala Shopee
function renderQtyController(itemId, qty) {
    return `
        <div class="qty-controller">
            <button class="qty-btn" onclick="updateCartQty(${itemId}, -1)">-</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${itemId}, 1)">+</button>
        </div>
    `;
}

// Dropdown Kategori di form Admin
function populateCategoryDropdown() {
    const select = document.getElementById("menu-cat-select");
    select.innerHTML = `<option value="">-- Pilih Kategori --</option>`;
    categoriesList.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.innerText = cat.name;
        select.appendChild(option);
    });
}

// ====== CART & SHOPEE-STYLE DRAWER LOGIC ======
function toggleCart() {
    document.getElementById("cart-sidebar").classList.toggle("open");
    document.getElementById("cart-overlay").classList.toggle("open");
}

function updateCartQty(itemId, change) {
    const currentQty = cart[itemId] || 0;
    const newQty = currentQty + change;

    if (newQty <= 0) {
        delete cart[itemId];
    } else {
        cart[itemId] = newQty;
    }

    renderCart();
    renderCatalog(); // sync tampilan catalog depan
}

function renderCart() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";

    let totalBadge = 0;
    let totalPrice = 0;
    const cartEntries = Object.entries(cart);

    if (cartEntries.length === 0) {
        container.innerHTML = `<p class="empty-cart-msg">Keranjang Anda masih kosong.</p>`;
        document.getElementById("cart-badge").innerText = 0;
        document.getElementById("cart-total-price").innerText = "Rp 0";
        return;
    }

    cartEntries.forEach(([itemId, qty]) => {
        const item = menuItemsList.find(i => i.id == itemId);
        if (item) {
            totalBadge += qty;
            totalPrice += item.price * qty;

            const row = document.createElement("div");
            row.className = "cart-item-row";
            row.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <span>Rp ${parseFloat(item.price).toLocaleString('id-ID')} x ${qty}</span>
                </div>
                ${renderQtyController(item.id, qty)}
            `;
            container.appendChild(row);
        }
    });

    document.getElementById("cart-badge").innerText = totalBadge;
    document.getElementById("cart-total-price").innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;
}

// ====== ACTION CHECKOUT (SAVE TO SUPABASE & REDIRECT TO WA) ======
async function checkoutOrder() {
    const nameInput = document.getElementById("cust-name").value.trim();
    const phoneInput = document.getElementById("cust-phone").value.trim();

    if (!nameInput || !phoneInput) {
        alert("Silakan isi Nama dan No. WhatsApp terlebih dahulu!");
        return;
    }

    if (Object.keys(cart).length === 0) {
        alert("Keranjang belanjaan Anda masih kosong!");
        return;
    }

    // Bangun daftar belanja JSON untuk database dan Teks WA
    const itemsPayload = [];
    let waMessage = `Halo *Butik Catering*, saya ingin memesan:\n\n`;
    let totalPrice = 0;

    Object.entries(cart).forEach(([itemId, qty]) => {
        const item = menuItemsList.find(i => i.id == itemId);
        if (item) {
            const subtotal = item.price * qty;
            totalPrice += subtotal;
            itemsPayload.push({
                item_id: item.id,
                title: item.title,
                price: item.price,
                qty: qty
            });
            waMessage += `• *${item.title}* (${qty}x) - Rp ${subtotal.toLocaleString('id-ID')}\n`;
        }
    });

    waMessage += `\n*Total Bayar: Rp ${totalPrice.toLocaleString('id-ID')}*\n\n`;
    waMessage += `*Detail Pengirim:*\nNama: ${nameInput}\nNo. HP: ${phoneInput}\n\nMohon dikonfirmasi pesanannya, terima kasih!`;

    // 1. Simpan ke Database Supabase (Untuk Catatan History)
    const { error } = await supabaseClient
        .from('orders')
        .insert([{
            customer_name: nameInput,
            customer_phone: phoneInput,
            items: itemsPayload,
            total_price: totalPrice,
            status: 'Pending'
        }]);

    if (error) {
        console.error("Gagal menyimpan pesanan:", error);
        alert("Terjadi gangguan server. Coba beberapa saat lagi.");
        return;
    }

    // 2. Kosongkan Keranjang & Reset Form
    cart = {};
    renderCart();
    renderCatalog();
    toggleCart();
    document.getElementById("cust-name").value = "";
    document.getElementById("cust-phone").value = "";

    // 3. Alihkan ke WhatsApp Web / Aplikasi
    const encodedMessage = encodeURIComponent(waMessage);
    const waUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
    window.open(waUrl, "_blank");
}

// ====== VIEW HISTORY PESANAN ======
function renderHistoryTable() {
    const tbody = document.getElementById("history-list");
    tbody.innerHTML = "";

    if (orderHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Belum ada pesanan masuk.</td></tr>`;
        return;
    }

    orderHistoryList.forEach(order => {
        // Gabung list item jadi teks ringkas
        const itemsList = order.items.map(i => `${i.title} (${i.qty}x)`).join(", ");
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${order.id}</td>
            <td><strong>${order.customer_name}</strong></td>
            <td>${order.customer_phone}</td>
            <td style="max-width: 250px; font-size: 0.85rem; color:#555;">${itemsList}</td>
            <td><strong>Rp ${parseFloat(order.total_price).toLocaleString('id-ID')}</strong></td>
            <td><span class="status-badge" style="background:#FFF9E6; color:#D4AF37; padding:4px 8px; border-radius:5px; font-size:0.8rem; font-weight:bold;">${order.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// ====== FORM SUBMIT LISTENERS (Sisi Admin) ======
function setupFormListeners() {
    // Submit Kategori Baru
    document.getElementById("form-category").addEventListener("submit", async (e) => {
        e.preventDefault();
        const catNameInput = document.getElementById("cat-name").value.trim();

        const { error } = await supabaseClient
            .from('categories')
            .insert([{ name: catNameInput }]);

        if (error) {
            alert("Gagal menambahkan kategori!");
        } else {
            alert("Kategori berhasil ditambahkan!");
            document.getElementById("cat-name").value = "";
            initApp(); // Refetch & render
        }
    });

    // Submit Menu Baru
    document.getElementById("form-menu").addEventListener("submit", async (e) => {
        e.preventDefault();
        const categoryId = document.getElementById("menu-cat-select").value;
        const title = document.getElementById("menu-title").value.trim();
        const price = document.getElementById("menu-price").value;
        const description = document.getElementById("menu-desc").value.trim();
        const imageUrl = document.getElementById("menu-img").value.trim();

        const { error } = await supabaseClient
            .from('menu_items')
            .insert([{
                category_id: categoryId,
                title: title,
                price: parseFloat(price),
                description: description,
                image_url: imageUrl
            }]);

        if (error) {
            alert("Gagal menambahkan menu!");
            console.error(error);
        } else {
            alert("Menu berhasil ditambahkan!");
            document.getElementById("form-menu").reset();
            initApp(); // Refetch & render
        }
    });
}