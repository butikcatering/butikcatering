// ====== CONFIG SUPABASE ======
const SUPABASE_URL = 'https://lqnkysmcfldmwxrwsbuj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxbmt5c21jZmxkbXd4cndzYnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MjUzMjgsImV4cCI6MjA5ODQwMTMyOH0._FCvLNNit802Z-SxoxnntOH80hyCnpwzbGzd-i-vbRI'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== STATE APLIKASI ======
let categoriesList = [];
let menuItemsList = [];
let cart = {}; // Format: { [itemId]: quantity }
let orderHistoryList = [];
let isAdmin = false; // Flag status login admin
const WHATSAPP_NUMBER = "+6285231339668"; 

// ====== EVENT INITIALIZATION ======
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupAuthListener();
    setupPriceInputFormatting();      // Format ribuan pada form Tambah Menu
    setupEditPriceInputFormatting();  // Format ribuan pada form Edit Menu
    
    // Bind form events secara aman (mencegah crash jika elemen HTML belum siap)
    bindFormEvent("form-category", handleCategorySubmit);
    bindFormEvent("form-menu", handleMenuSubmit);
    bindFormEvent("form-login", handleLoginSubmit);
    bindFormEvent("form-edit-menu", handleEditMenuSubmit);
    bindFormEvent("form-edit-category", handleEditCategorySubmit);
});

// Helper untuk bind event form secara aman
function bindFormEvent(formId, handlerFunc) {
    const formElement = document.getElementById(formId);
    if (formElement) {
        formElement.addEventListener("submit", handlerFunc);
    }
}

// Load Data Awal
async function initApp() {
    await fetchCategories();
    await fetchMenuItems();
    renderCatalog();
    populateCategoryDropdown();
    renderCategoryList();
}

// ====== NAVIGATION TABS (Sangat responsif & cocok untuk layout APK) ======
function switchTab(tabId) {
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (!targetTab) return;

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    targetTab.classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active-nav');
    });
    const activeNavLink = document.getElementById(`nav-${tabId}`);
    if (activeNavLink) activeNavLink.classList.add('active-nav');
    
    if (tabId === 'history') {
        fetchOrderHistory();
    }
}

// ====== FITUR HARGA OTOMATIS MEMAKAI TITIK ======
function setupPriceInputFormatting() {
    const priceInput = document.getElementById("menu-price");
    if (!priceInput) return;

    priceInput.addEventListener("input", (e) => {
        let rawVal = e.target.value.replace(/\D/g, "");
        if (rawVal) {
            e.target.value = Number(rawVal).toLocaleString("id-ID");
        } else {
            e.target.value = "";
        }
    });
}

function setupEditPriceInputFormatting() {
    const priceInput = document.getElementById("edit-menu-price");
    if (!priceInput) return;

    priceInput.addEventListener("input", (e) => {
        let rawVal = e.target.value.replace(/\D/g, "");
        if (rawVal) {
            e.target.value = Number(rawVal).toLocaleString("id-ID");
        } else {
            e.target.value = "";
        }
    });
}

// ====== DATABASE OPERATIONS (FETCH) ======
async function fetchCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) throw error;
        categoriesList = data || [];
    } catch (err) {
        console.error("Gagal memuat kategori:", err.message);
    }
}

async function fetchMenuItems() {
    try {
        const { data, error } = await supabaseClient
            .from('menu_items')
            .select('*');
        
        if (error) throw error;
        menuItemsList = data || [];
    } catch (err) {
        console.error("Gagal memuat menu:", err.message);
    }
}

async function fetchOrderHistory() {
    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        orderHistoryList = data || [];
        renderHistoryTable();
    } catch (err) {
        console.error("Gagal memuat histori:", err.message);
    }
}

// ====== RENDER UI (Sisi Pelanggan & Tombol Admin) ======
function renderCatalog() {
    const container = document.getElementById("catalog-container");
    if (!container) return;
    container.innerHTML = "";

    if (categoriesList.length === 0) {
        container.innerHTML = `<div class="loading-spinner"><p style="color:var(--text-muted)">Belum ada hidangan katering yang dibuat oleh Admin.</p></div>`;
        return;
    }

    categoriesList.forEach(category => {
        const items = menuItemsList.filter(item => item.category_id === category.id);
        const section = document.createElement("div");
        section.className = "category-section";
        
        section.innerHTML = `
            <h2 class="category-title">${category.name}</h2>
            <div class="menu-grid" id="category-grid-${category.id}"></div>
        `;
        
        container.appendChild(section);
        const grid = document.getElementById(`category-grid-${category.id}`);

        if (items.length === 0) {
            if (grid) grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">Belum ada hidangan di kategori ini.</p>`;
        } else {
            items.forEach(item => {
                const qty = cart[item.id] || 0;
                
                // JIKA ADMIN LOGIN: Tampilkan Edit & Hapus, SEMBUNYIKAN Tombol "Tambah ke Keranjang"
                // JIKA PELANGGAN: Sembunyikan Edit & Hapus, TAMPILKAN Tombol "Tambah ke Keranjang"
                let adminActionMarkup = "";
                let cartActionMarkup = "";

                if (isAdmin) {
                    adminActionMarkup = `
                        <div class="admin-card-actions">
                            <button class="btn-card-edit" onclick="editMenuItem(${item.id})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                            <button class="btn-card-delete" onclick="deleteMenuItem(${item.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
                        </div>
                    `;
                } else {
                    cartActionMarkup = `
                        <div class="action-btn-area" id="action-area-${item.id}">
                            ${qty > 0 ? renderQtyController(item.id, qty) : `<button class="btn-add" onclick="updateCartQty(${item.id}, 1)">Tambah</button>`}
                        </div>
                    `;
                }

                const card = document.createElement("div");
                card.className = "menu-card";
                card.innerHTML = `
                    <img class="menu-img" src="${item.image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x400?text=Premium+Butik+Catering'">
                    <div class="menu-body">
                        <h3 class="menu-item-title">${item.title}</h3>
                        <p class="menu-item-desc">${item.description}</p>
                        <div class="menu-item-footer">
                            <span class="menu-item-price">Rp ${parseFloat(item.price).toLocaleString('id-ID')}<span class="price-unit">/pcs</span></span>
                            ${cartActionMarkup}
                        </div>
                        ${adminActionMarkup}
                    </div>
                `;
                if (grid) grid.appendChild(card);
            });
        }
    });
}

function renderQtyController(itemId, qty) {
    return `
        <div class="qty-controller">
            <button class="qty-btn" onclick="updateCartQty(${itemId}, -1)">-</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${itemId}, 1)">+</button>
        </div>
    `;
}

function populateCategoryDropdown() {
    const select = document.getElementById("menu-cat-select");
    if (!select) return;
    select.innerHTML = `<option value="">-- Pilih Kategori --</option>`;
    categoriesList.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.innerText = cat.name;
        select.appendChild(option);
    });
}

// ====== DAFTAR KATEGORI (ADMIN) - LIST, EDIT, HAPUS ======
function renderCategoryList() {
    const container = document.getElementById("category-list");
    if (!container) return;
    container.innerHTML = "";

    if (categoriesList.length === 0) {
        container.innerHTML = `<p class="category-list-empty">Belum ada kategori yang dibuat.</p>`;
        return;
    }

    categoriesList.forEach(cat => {
        const itemCount = menuItemsList.filter(item => item.category_id === cat.id).length;

        const row = document.createElement("div");
        row.className = "category-list-row";
        row.innerHTML = `
            <div>
                <div class="cat-name-text">${cat.name}</div>
                <div class="cat-item-count">${itemCount} item menu</div>
            </div>
            <div class="category-list-actions">
                <button class="btn-cat-edit" onclick="editCategory(${cat.id})" title="Edit Kategori"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-cat-delete" onclick="deleteCategory(${cat.id})" title="Hapus Kategori"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(row);
    });
}

// Memicu munculnya data lama di Form Edit Kategori
function editCategory(id) {
    const cat = categoriesList.find(c => c.id === id);
    if (!cat) return;

    document.getElementById("edit-cat-id").value = cat.id;
    document.getElementById("edit-cat-name").value = cat.name;
    showEditCategoryModal();
}

async function handleEditCategorySubmit(e) {
    e.preventDefault();

    const id = document.getElementById("edit-cat-id").value;
    const name = document.getElementById("edit-cat-name").value.trim();
    if (!name) return;

    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Menyimpan...";
    submitBtn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('categories')
            .update({ name: name })
            .eq('id', id);

        if (error) throw error;

        alert("Kategori berhasil diperbarui!");
        hideEditCategoryModal();
        initApp(); // Muat ulang visual (katalog, dropdown, dan daftar kategori)
    } catch (error) {
        console.error("Gagal mengedit kategori:", error);
        alert("Gagal menyimpan perubahan: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
}

// Hapus kategori. Kategori yang masih punya menu di dalamnya tidak boleh
// dihapus langsung supaya tidak ada menu "yatim" tanpa kategori.
async function deleteCategory(id) {
    const itemCount = menuItemsList.filter(item => item.category_id === id).length;

    if (itemCount > 0) {
        alert(`Kategori ini masih memiliki ${itemCount} item menu. Hapus atau pindahkan menu tersebut terlebih dahulu sebelum menghapus kategorinya.`);
        return;
    }

    const yakin = confirm("Apakah Anda yakin ingin menghapus kategori ini?");
    if (!yakin) return;

    try {
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Kategori berhasil dihapus!");
        initApp(); // Refresh data
    } catch (error) {
        console.error("Gagal menghapus kategori:", error);
        alert("Gagal menghapus kategori: " + error.message);
    }
}

// ====== KERANJANG BELANJA (Shopee Drawer Style) ======
function toggleCart() {
    const sidebar = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    if (sidebar) sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("open");
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
    renderCatalog();
}

function renderCart() {
    const container = document.getElementById("cart-items-container");
    if (!container) return;
    container.innerHTML = "";

    let totalBadge = 0;
    let totalPrice = 0;
    const cartEntries = Object.entries(cart);

    if (cartEntries.length === 0) {
        container.innerHTML = `<p class="empty-cart-msg">Keranjang belanja Anda masih kosong.</p>`;
        const badge = document.getElementById("cart-badge");
        const totalText = document.getElementById("cart-total-price");
        if (badge) badge.innerText = 0;
        if (totalText) totalText.innerText = "Rp 0";
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

    const badge = document.getElementById("cart-badge");
    const totalText = document.getElementById("cart-total-price");
    if (badge) badge.innerText = totalBadge;
    if (totalText) totalText.innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;
}

// ====== ACTION CHECKOUT (SAVE TO DATABASE & REDIRECT TO WA) ======
async function checkoutOrder() {
    const nameInputEl = document.getElementById("cust-name");
    const phoneInputEl = document.getElementById("cust-phone");
    if (!nameInputEl || !phoneInputEl) return;

    const nameInput = nameInputEl.value.trim();
    const phoneInput = phoneInputEl.value.trim();

    if (!nameInput || !phoneInput) {
        alert("Silakan isi Nama Lengkap dan No. WhatsApp Anda terlebih dahulu!");
        return;
    }

    if (Object.keys(cart).length === 0) {
        alert("Keranjang belanjaan Anda masih kosong!");
        return;
    }

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

    // Simpan ke database histori orders
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
        alert("Terjadi masalah pada koneksi database. Coba sesaat lagi.");
        return;
    }

    cart = {};
    renderCart();
    renderCatalog();
    toggleCart();
    nameInputEl.value = "";
    phoneInputEl.value = "";

    const encodedMessage = encodeURIComponent(waMessage);
    const waUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
    window.open(waUrl, "_blank");
}

// ====== VIEW HISTORY PESANAN ======
function renderHistoryTable() {
    const tbody = document.getElementById("history-list");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (orderHistoryList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Belum ada histori pesanan yang masuk.</td></tr>`;
        return;
    }

    orderHistoryList.forEach(order => {
        const itemsList = order.items.map(i => `${i.title} (${i.qty}x)`).join(", ");
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${order.id}</td>
            <td><strong>${order.customer_name}</strong></td>
            <td>${order.customer_phone}</td>
            <td style="max-width: 250px; font-size: 0.85rem; color: var(--text-muted);">${itemsList}</td>
            <td><strong>Rp ${parseFloat(order.total_price).toLocaleString('id-ID')}</strong></td>
            <td><span class="status-badge" style="background:var(--accent-light); color:var(--primary-color); padding:5px 10px; border-radius:30px; font-size:0.8rem; font-weight:700;">${order.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// ====== HANDLER SUBMIT FORM (SISI ADMIN) ======
async function handleCategorySubmit(e) {
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
        initApp(); 
    }
}

async function handleMenuSubmit(e) {
    e.preventDefault();
    
    const categoryId = document.getElementById("menu-cat-select").value;
    const title = document.getElementById("menu-title").value.trim();
    
    const rawPrice = document.getElementById("menu-price").value;
    const price = rawPrice.replace(/\./g, ""); // hilangkan titik pembatas

    const description = document.getElementById("menu-desc").value.trim();
    const imgFileInput = document.getElementById("menu-img");
    const file = imgFileInput ? imgFileInput.files[0] : null;
    
    if (!file) {
        alert("Silakan pilih file gambar katering terlebih dahulu!");
        return;
    }

    try {
        const submitBtn = e.target.querySelector("button[type='submit']");
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Mengunggah Gambar...";
        submitBtn.disabled = true;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `menus/${fileName}`;

        // Upload ke bucket 'menu-images'
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('menu-images')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data: urlData } = supabaseClient
            .storage
            .from('menu-images')
            .getPublicUrl(filePath);
        
        const imageUrl = urlData.publicUrl;

        // Tulis data ke tabel 'menu_items'
        const { error: dbError } = await supabaseClient
            .from('menu_items')
            .insert([{
                category_id: categoryId,
                title: title,
                price: parseFloat(price),
                description: description,
                image_url: imageUrl
            }]);

        if (dbError) {
            throw dbError;
        }

        alert("Menu baru berhasil disimpan beserta foto!");
        document.getElementById("form-menu").reset();
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        initApp(); 

    } catch (error) {
        console.error("Terjadi kesalahan:", error);
        alert("Gagal menambahkan menu: " + error.message);
        
        const submitBtn = e.target.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.innerText = "Simpan Item Menu";
            submitBtn.disabled = false;
        }
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    let usernameInput = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    // Supabase membutuhkan format email. Kita secara otomatis mengubah input admin di latar belakang
    if (!usernameInput.includes("@")) {
        usernameInput = `${usernameInput}@butikcatering.com`;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: usernameInput,
            password: password,
        });

        if (error) {
            throw error;
        }

        alert("Selamat datang kembali, Admin!");
        document.getElementById("form-login").reset();
        hideLoginModal();
    } catch (error) {
        alert("Gagal Login: " + error.message);
    }
}

// ====== MODUL EDIT HIDANGAN KATERING ======

// Fungsi memicu munculnya data lama di input Form Edit
function editMenuItem(id) {
    const item = menuItemsList.find(i => i.id === id);
    if (!item) return;

    document.getElementById("edit-menu-id").value = item.id;
    document.getElementById("edit-menu-title").value = item.title;
    document.getElementById("edit-menu-price").value = parseFloat(item.price).toLocaleString('id-ID');
    document.getElementById("edit-menu-desc").value = item.description;

    // Populasikan daftar kategori pilihan di dalam form edit
    const select = document.getElementById("edit-menu-cat-select");
    if (select) {
        select.innerHTML = "";
        categoriesList.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.innerText = cat.name;
            if (cat.id === item.category_id) option.selected = true;
            select.appendChild(option);
        });
    }

    showEditMenuModal();
}

async function handleEditMenuSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("edit-menu-id").value;
    const categoryId = document.getElementById("edit-menu-cat-select").value;
    const title = document.getElementById("edit-menu-title").value.trim();
    
    const rawPrice = document.getElementById("edit-menu-price").value;
    const price = rawPrice.replace(/\./g, ""); // hilangkan titik pembatas

    const description = document.getElementById("edit-menu-desc").value.trim();
    const imgFileInput = document.getElementById("edit-menu-img");
    const file = imgFileInput ? imgFileInput.files[0] : null;

    try {
        const submitBtn = e.target.querySelector("button[type='submit']");
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Menyimpan Perubahan...";
        submitBtn.disabled = true;

        let imageUrl = null;

        // Jika admin mengunggah file foto pengganti
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `menus/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('menu-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient
                .storage
                .from('menu-images')
                .getPublicUrl(filePath);
            
            imageUrl = urlData.publicUrl;
        }

        const updatePayload = {
            category_id: categoryId,
            title: title,
            price: parseFloat(price),
            description: description
        };

        if (imageUrl) {
            updatePayload.image_url = imageUrl;
        }

        const { error: dbError } = await supabaseClient
            .from('menu_items')
            .update(updatePayload)
            .eq('id', id);

        if (dbError) throw dbError;

        alert("Item menu berhasil diperbarui!");
        document.getElementById("form-edit-menu").reset();
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        hideEditMenuModal();
        initApp(); // Muat ulang visual

    } catch (error) {
        console.error("Gagal mengedit:", error);
        alert("Gagal menyimpan perubahan: " + error.message);
        
        const submitBtn = e.target.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.innerText = "Simpan Perubahan";
            submitBtn.disabled = false;
        }
    }
}

// ====== PROSES HAPUS HIDANGAN ======
async function deleteMenuItem(id) {
    const yakin = confirm("Apakah Anda yakin ingin menghapus hidangan ini?");
    if (!yakin) return;

    try {
        const { error } = await supabaseClient
            .from('menu_items')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Hidangan berhasil dihapus!");
        initApp(); // Refresh data
    } catch (error) {
        alert("Gagal menghapus: " + error.message);
    }
}

// ====== MODAL POPUPS ======
function showLoginModal() {
    const modal = document.getElementById("login-modal");
    const overlay = document.getElementById("login-overlay");
    if (modal) modal.classList.add("open");
    if (overlay) overlay.classList.add("open");
}

// ====== KONTROL POPUPS MODAL ======
function hideLoginModal() {
    const modal = document.getElementById("login-modal");
    const overlay = document.getElementById("login-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

function showEditMenuModal() {
    const modal = document.getElementById("edit-menu-modal");
    const overlay = document.getElementById("edit-menu-overlay");
    if (modal) modal.classList.add("open");
    if (overlay) overlay.classList.add("open");
}

function hideEditMenuModal() {
    const modal = document.getElementById("edit-menu-modal");
    const overlay = document.getElementById("edit-menu-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

function showEditCategoryModal() {
    const modal = document.getElementById("edit-category-modal");
    const overlay = document.getElementById("edit-category-overlay");
    if (modal) modal.classList.add("open");
    if (overlay) overlay.classList.add("open");
}

function hideEditCategoryModal() {
    const modal = document.getElementById("edit-category-modal");
    const overlay = document.getElementById("edit-category-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}
// ====== PENGATUR STATUS LOGIN ADMIN ======
function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const adminNav = document.getElementById("admin-nav");
        const loginNav = document.getElementById("login-nav");
        const cartBtn = document.querySelector(".cart-btn"); // Ambil elemen tombol keranjang belanja

        if (session) {
            isAdmin = true; // Nyalakan flag admin
            if (adminNav) adminNav.style.display = "inline";
            if (loginNav) loginNav.style.display = "none";
            if (cartBtn) cartBtn.style.display = "none"; // SEMBUNYIKAN ikon keranjang katering untuk Admin
            hideLoginModal();
        } else {
            isAdmin = false; // Matikan flag admin
            if (adminNav) adminNav.style.display = "none";
            if (loginNav) loginNav.style.display = "inline";
            if (cartBtn) cartBtn.style.display = "flex"; // TAMPILKAN kembali ikon keranjang katering untuk Pelanggan
            switchTab('catalog'); 
        }
        renderCatalog(); // Segarkan ulang katalog untuk menyesuaikan tombol secara reaktif
    });
}
// ====== PROSES LOGOUT ADMIN ======
async function logoutAdmin() {
    const yakin = confirm("Apakah Anda yakin ingin keluar dari Admin Panel?");
    if (yakin) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert("Gagal Keluar: " + error.message);
        } else {
            alert("Anda telah keluar.");
        }
    }
}
