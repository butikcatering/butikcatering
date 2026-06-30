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
    setupAuthListener(); // Jalankan pengawas status login admin
});

// Load Data Awal
async function initApp() {
    await fetchCategories();
    await fetchMenuItems();
    renderCatalog();
    populateCategoryDropdown();
}

// ====== NAVIGATION TABS (Sangat responsif & cocok untuk layout APK) ======
function switchTab(tabId) {
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (!targetTab) return; // Mencegah crash jika element tab tidak ditemukan di HTML

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    targetTab.classList.add('active');
    
    // Hanya ambil histori dari database jika tab yang dibuka adalah histori pesanan
    if (tabId === 'history') {
        fetchOrderHistory();
    }
}

// ====== DATABASE OPERATIONS (FETCH) ======

// Ambil Kategori dari Supabase
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

// Ambil Menu dari Supabase
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

// Ambil History Pesanan dari Supabase
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

// ====== RENDER UI (Sisi Pelanggan) ======
function renderCatalog() {
    const container = document.getElementById("catalog-container");
    if (!container) return; // Cegah crash jika container catalog tidak ada
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

        if (items.length === 0) {
            if (grid) grid.innerHTML = `<p style="color:#aaa; grid-column: 1/-1;">Belum ada hidangan di kategori ini.</p>`;
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
                if (grid) grid.appendChild(card);
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
    if (!select) return;
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
    renderCatalog(); // sync tampilan catalog depan
}

function renderCart() {
    const container = document.getElementById("cart-items-container");
    if (!container) return;
    container.innerHTML = "";

    let totalBadge = 0;
    let totalPrice = 0;
    const cartEntries = Object.entries(cart);

    if (cartEntries.length === 0) {
        container.innerHTML = `<p class="empty-cart-msg">Keranjang Anda masih kosong.</p>`;
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

// ====== ACTION CHECKOUT (SAVE TO SUPABASE & REDIRECT TO WA) ======
async function checkoutOrder() {
    const nameInputEl = document.getElementById("cust-name");
    const phoneInputEl = document.getElementById("cust-phone");
    if (!nameInputEl || !phoneInputEl) return;

    const nameInput = nameInputEl.value.trim();
    const phoneInput = phoneInputEl.value.trim();

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
    nameInputEl.value = "";
    phoneInputEl.value = "";

    // 3. Alihkan ke WhatsApp Web / Aplikasi
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

// ====== FORM SUBMIT LISTENERS ======
function setupFormListeners() {
    // Submit Kategori Baru
    const formCategory = document.getElementById("form-category");
    if (formCategory) {
        formCategory.addEventListener("submit", async (e) => {
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
    }

    // Submit Menu Baru (Dengan Fitur Upload Foto langsung ke Supabase Storage)
    const formMenu = document.getElementById("form-menu");
    if (formMenu) {
        formMenu.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const categoryId = document.getElementById("menu-cat-select").value;
            const title = document.getElementById("menu-title").value.trim();
            const price = document.getElementById("menu-price").value;
            const description = document.getElementById("menu-desc").value.trim();
            
            // Ambil file foto dari input
            const imgFileInput = document.getElementById("menu-img");
            const file = imgFileInput ? imgFileInput.files[0] : null;
            
            if (!file) {
                alert("Silakan pilih file gambar katering terlebih dahulu!");
                return;
            }

            try {
                // Tampilkan pesan proses
                const submitBtn = e.target.querySelector("button[type='submit']");
                const originalBtnText = submitBtn.innerText;
                submitBtn.innerText = "Mengunggah Gambar...";
                submitBtn.disabled = true;

                // 1. Buat nama file yang unik agar gambar tidak saling menimpa di storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                const filePath = `menus/${fileName}`; // Disimpan di dalam folder 'menus' di dalam bucket

                // 2. Proses upload file ke Supabase Storage Bucket 'menu-images'
                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage
                    .from('menu-images')
                    .upload(filePath, file);

                if (uploadError) {
                    throw uploadError;
                }

                // 3. Ambil URL Publik dari foto yang berhasil diunggah
                const { data: urlData } = supabaseClient
                    .storage
                    .from('menu-images')
                    .getPublicUrl(filePath);
                
                const imageUrl = urlData.publicUrl; // Ini adalah link foto online Anda

                // 4. Simpan data menu makanan lengkap beserta link foto tadi ke tabel 'menu_items'
                const { error: dbError } = await supabaseClient
                    .from('menu_items')
                    .insert([{
                        category_id: categoryId,
                        title: title,
                        price: parseFloat(price),
                        description: description,
                        image_url: imageUrl // Menyimpan URL publik hasil upload
                    }]);

                if (dbError) {
                    throw dbError;
                }

                alert("Menu baru berhasil disimpan beserta foto!");
                
                // Reset form & kembalikan tombol
                document.getElementById("form-menu").reset();
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;

                // Muat ulang data katalog di sisi pelanggan agar langsung muncul menu barunya
                initApp(); 

            } catch (error) {
                console.error("Terjadi kesalahan:", error);
                alert("Gagal menambahkan menu: " + error.message);
                
                // Kembalikan tombol jika gagal
                const submitBtn = e.target.querySelector("button[type='submit']");
                if (submitBtn) {
                    submitBtn.innerText = "Simpan Item Menu";
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // Event Listener Submit Login Admin
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
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
        });
    }
}

// ====== KONTROL MODAL LOGIN ======
function showLoginModal() {
    const modal = document.getElementById("login-modal");
    const overlay = document.getElementById("login-overlay");
    if (modal) modal.classList.add("open");
    if (overlay) overlay.classList.add("open");
}

function hideLoginModal() {
    const modal = document.getElementById("login-modal");
    const overlay = document.getElementById("login-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

// ====== PENGATUR STATUS AUTENTIKASI ADMIN ======
function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const adminNav = document.getElementById("admin-nav");
        const loginNav = document.getElementById("login-nav");

        if (session) {
            // Jika admin login
            if (adminNav) adminNav.style.display = "inline";
            if (loginNav) loginNav.style.display = "none";
            hideLoginModal();
        } else {
            // Jika admin logout / belum masuk
            if (adminNav) adminNav.style.display = "none";
            if (loginNav) loginNav.style.display = "inline";
            switchTab('catalog'); // Kembalikan ke katalog
        }
    });
}

// ====== LOGOUT ADMIN ======
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
