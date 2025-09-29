// === GLOBALS & DOM ===
const tombolTambah = document.getElementById('tombol-tambah');
const popupForm = document.getElementById('popup-form');
const tombolTutup = document.getElementById('tutup-popup');
const formKunjungan = document.getElementById('form-kunjungan');
const isiTabel = document.getElementById('isi-tabel');
const canvas = document.getElementById('canvas-ttd');
const ctx = canvas ? canvas.getContext && canvas.getContext('2d') : null;
const hapusTTD = document.getElementById('hapus-ttd');
const tombolCetak = document.getElementById('tombol-cetak');

const toggleBtn = document.querySelector('.toggle-btn');
const sidebar = document.querySelector('.sidebar');
const links = document.querySelectorAll("nav ul li a");
const pages = document.querySelectorAll('.page');

const totalKunjunganEl = document.getElementById('total-kunjungan');
const kunjunganHariiniEl = document.getElementById('kunjungan-hariini');
const chartCanvas = document.getElementById('chart-kunjungan');
let chartInstance;

const exportWordBtn = document.getElementById('export-word');
const exportLaporanBtn = document.getElementById('export-laporan');
const laporanContainer = document.getElementById('laporan-container');
const toggleDarkmode = document.getElementById('toggle-darkmode');

let menggambar = false;
let dataKunjungan = [];
let editIndex = -1; // -1 artinya tambah baru

// Ambil user sekarang
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// === ROLE & ACCESS CHECK ===
function requireRole(allowedRoles = []) {
  // jika tidak ada user login, kirim ke login
  if (!currentUser) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    alert('Anda tidak memiliki akses ke halaman ini.');
    // arahkan sesuai role
    if (currentUser.role === 'admin') window.location.href = 'home.html';
    else window.location.href = 'user.html';
    return false;
  }
  return true;
}

// Jalankan pemeriksaan cepat saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  // Jika ini halaman admin (home.html) maka batasi hanya admin
  if (location.pathname.endsWith('home.html')) {
    if (!requireRole(['admin'])) return; // bila gagal redirect, hentikan
  }
  // Jika ini halaman user
  if (location.pathname.endsWith('user.html')) {
    if (!requireRole(['user', 'admin'])) return; // admin juga boleh
  }

  // Siapkan ukuran canvas (jika ada)
  if (canvas) {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  loadData();
  attachStorageListener();
});

// === CANVAS DRAW HELPERS ===
function getPosisi(e) {
  if (!canvas) return { x: 0, y: 0 };
  let rect = canvas.getBoundingClientRect();
  if (e.touches) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  } else {
    return { x: e.offsetX, y: e.offsetY };
  }
}

if (canvas) {
  // open form
  tombolTambah && tombolTambah.addEventListener('click', () => {
    popupForm.style.display = 'flex';
    setTimeout(() => popupForm.classList.add('show'), 10);
    editIndex = -1; // default tambah baru
  });

  tombolTutup && tombolTutup.addEventListener('click', () => {
    if (confirm('Yakin ingin menutup form?')) {
      popupForm.classList.remove('show');
      setTimeout(() => popupForm.style.display = 'none', 300);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    menggambar = true;
    let pos = getPosisi(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });
  canvas.addEventListener('mouseup', () => { menggambar = false; ctx.beginPath(); });
  canvas.addEventListener('mousemove', (e) => gambar(e));

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    menggambar = true;
    let pos = getPosisi(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });
  canvas.addEventListener('touchend', () => { menggambar = false; ctx.beginPath(); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); gambar(e); });

  function gambar(e) {
    if (!menggambar) return;
    let pos = getPosisi(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  hapusTTD && hapusTTD.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// === FORM SUBMIT (Tambah / Edit) ===
formKunjungan && formKunjungan.addEventListener('submit', (e) => {
  e.preventDefault();

  const tanggal = document.getElementById('tanggal').value;
  const noSpt = document.getElementById('no-spt').value;
  const nama = document.getElementById('nama').value;
  const dinas = document.getElementById('dinas').value;
  const urlTTD = canvas ? canvas.toDataURL() : '';

  if (editIndex === -1) {
    const noUrut = dataKunjungan.length + 1;
    dataKunjungan.push({ no: noUrut, tanggal, noSpt, nama, dinas, ttd: urlTTD });
    // tandai bahwa user (siapa) menambah data supaya admin lihat notif
    localStorage.setItem('newEntry', JSON.stringify({ by: currentUser ? currentUser.username : 'guest', at: new Date().toISOString() }));
  } else {
    // edit
    dataKunjungan[editIndex] = { ...dataKunjungan[editIndex], tanggal, noSpt, nama, dinas, ttd: urlTTD };
    editIndex = -1;
  }

  saveToLocal();
  loadData();

  // reset form
  popupForm.classList.remove('show');
  setTimeout(() => popupForm.style.display = 'none', 300);
  formKunjungan.reset();
  canvas && ctx.clearRect(0, 0, canvas.width, canvas.height);

  showNotif('Data berhasil disimpan!');
});

// === PRINT ===
tombolCetak && tombolCetak.addEventListener('click', () => { window.print(); });

// === SIDEBAR ===
toggleBtn && toggleBtn.addEventListener('click', () => { sidebar.classList.toggle('active'); });
document.addEventListener('click', (e) => { if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) { sidebar.classList.remove('active'); } });

// === NOTIF ===
function showNotif(pesan) {
  const notif = document.createElement('div');
  notif.textContent = pesan;
  notif.style.position = 'fixed';
  notif.style.bottom = '20px';
  notif.style.right = '20px';
  notif.style.background = '#2ecc71';
  notif.style.color = '#fff';
  notif.style.padding = '10px 20px';
  notif.style.borderRadius = '8px';
  notif.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  notif.style.zIndex = '3000';
  notif.style.opacity = '0';
  notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  notif.style.transform = 'translateY(20px)';

  document.body.appendChild(notif);
  setTimeout(() => { notif.style.opacity = '1'; notif.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => { notif.style.opacity = '0'; notif.style.transform = 'translateY(20px)'; setTimeout(() => notif.remove(), 300); }, 2500);
}

// === NAV MULTIPAGE ===
links.forEach(link => { link.addEventListener('click', e => { e.preventDefault(); const target = link.getAttribute('data-page'); pages.forEach(p => p.classList.remove('active')); document.getElementById(target).classList.add('active'); }); });

// === LOCALSTORAGE HELPERS ===
function saveToLocal() { localStorage.setItem('kunjungan', JSON.stringify(dataKunjungan)); }

function loadData() {
  const data = JSON.parse(localStorage.getItem('kunjungan')) || [];
  dataKunjungan = data;

  // Build or update filter UI (dynamic so we don't change HTML file)
  ensureFilterUI();

  // Render tables: admin wants actions + riwayat filter, user sees simplified view
  renderDataTable();
  updateDashboard();
  renderLaporan();
}

// === Dynamic Filter UI ===
function ensureFilterUI() {
  const container = document.querySelector('#data-kunjungan');
  if (!container) return;
  if (!container.querySelector('.filter-row')) {
    const div = document.createElement('div');
    div.className = 'filter-row';
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.alignItems = 'center';
    div.style.marginTop = '8px';
    div.innerHTML = `
      <label>Mulai: <input type="date" id="filter-start"></label>
      <label>Sampai: <input type="date" id="filter-end"></label>
      <button id="filter-btn" class="btn hijau">Filter</button>
      <button id="reset-filter" class="btn biru">Reset</button>
    `;
    container.insertBefore(div, container.querySelector('table'));

    document.getElementById('filter-btn').addEventListener('click', applyFilter);
    document.getElementById('reset-filter').addEventListener('click', () => { document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; renderDataTable(); });
  }
}

function applyFilter() {
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;
  renderDataTable(start, end);
}

// === Render main data table (adds actions column for admin dynamically) ===
function renderDataTable(start='', end='') {
  const tbody = document.getElementById('isi-tabel');
  if (!tbody) return;

  // Ensure header has actions column if admin
  const table = tbody.closest('table');
  if (currentUser && currentUser.role === 'admin') {
    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('.col-actions')) {
      const th = document.createElement('th'); th.className = 'col-actions'; th.textContent = 'Aksi'; thead.appendChild(th);
    }
  }

  tbody.innerHTML = '';
  const filtered = dataKunjungan.filter(d => {
    if (start && d.tanggal < start) return false;
    if (end && d.tanggal > end) return false;
    return true;
  });

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.no}</td>
      <td>${item.tanggal}</td>
      <td>${item.noSpt}</td>
      <td>${item.nama}</td>
      <td>${item.dinas}</td>
      <td>${item.ttd ? '<button class="lihat-ttd">Lihat</button>' : '-'}</td>
    `;

    if (currentUser && currentUser.role === 'admin') {
      const tdAksi = document.createElement('td');
      const btnEdit = document.createElement('button'); btnEdit.textContent = 'Edit'; btnEdit.className = 'btn biru';
      const btnHapus = document.createElement('button'); btnHapus.textContent = 'Hapus'; btnHapus.className = 'btn merah';
      btnEdit.addEventListener('click', () => openEditForm(idx));
      btnHapus.addEventListener('click', () => hapusData(idx));
      tdAksi.appendChild(btnEdit); tdAksi.appendChild(document.createTextNode(' ')); tdAksi.appendChild(btnHapus);
      tr.appendChild(tdAksi);
    }

    tbody.appendChild(tr);
  });
}

function openEditForm(index) {
  // isi form dengan data
  const d = dataKunjungan[index];
  if (!d) return;
  editIndex = index;
  document.getElementById('no-urut').value = d.no;
  document.getElementById('tanggal').value = d.tanggal;
  document.getElementById('no-spt').value = d.noSpt;
  document.getElementById('nama').value = d.nama;
  document.getElementById('dinas').value = d.dinas;
  // restore ttd gambar di canvas
  if (canvas && d.ttd) {
    const img = new Image(); img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width/devicePixelRatio,canvas.height/devicePixelRatio); };
    img.src = d.ttd;
  }
  popupForm.style.display = 'flex';
  setTimeout(() => popupForm.classList.add('show'), 10);
}

function hapusData(index) {
  if (!confirm('Yakin ingin menghapus data ini?')) return;
  dataKunjungan.splice(index, 1);
  // re-assign no
  dataKunjungan = dataKunjungan.map((d,i) => ({ ...d, no: i+1 }));
  saveToLocal();
  loadData();
  showNotif('Data berhasil dihapus');
}

// === DASHBOARD & CHART ===
function updateDashboard() {
  if (!totalKunjunganEl) return;
  totalKunjunganEl.textContent = dataKunjungan.length;
  const today = new Date().toISOString().split('T')[0];
  const totalHariIni = dataKunjungan.filter(d => d.tanggal === today).length;
  kunjunganHariiniEl.textContent = totalHariIni;
  updateChart();
}

function updateChart() {
  if (!chartCanvas) return;
  const counts = {};
  dataKunjungan.forEach(d => { counts[d.dinas] = (counts[d.dinas] || 0) + 1; });
  let labels = Object.keys(counts);
  let values = Object.values(counts);
  if (labels.length === 0) { labels = ['Dinas Sosial','Bappeda','Dinas Kesehatan']; values=[3,10,5]; }
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(chartCanvas, { type: 'pie', data: { labels, datasets: [{ label: 'Jumlah Kunjungan per Dinas', data: values, backgroundColor: ['#1d3557','#e63946','#2a9d8f','#f4a261','#a8dadc','#ffb703'], borderWidth:1 }] }, options: { responsive:true, plugins:{ legend:{ position:'right' } } } });
}

// === STATISTIK & LAPORAN ===
function renderLaporan() {
  if (!laporanContainer) return;
  laporanContainer.innerHTML = '';
  if (dataKunjungan.length === 0) { laporanContainer.innerHTML = '<p>Belum ada data kunjungan.</p>'; return; }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>No</th><th>Tanggal</th><th>No SPT</th><th>Nama</th><th>Dinas</th></tr></thead><tbody>${dataKunjungan.map((d,i)=>`<tr><td>${i+1}</td><td>${d.tanggal}</td><td>${d.noSpt}</td><td>${d.nama}</td><td>${d.dinas}</td></tr>`).join('')}</tbody>`;
  laporanContainer.appendChild(table);
}

// === EXPORT WORD (tetap) & EXPORT EXCEL (CSV) ===
exportWordBtn && exportWordBtn.addEventListener('click', () => {
  let html = '<h2>Data Kunjungan</h2><table border="1" cellspacing="0" cellpadding="5"><tr><th>No</th><th>Tanggal</th><th>No SPT</th><th>Nama</th><th>Dinas</th></tr>';
  dataKunjungan.forEach((d,i)=>{ html += `<tr><td>${i+1}</td><td>${d.tanggal}</td><td>${d.noSpt}</td><td>${d.nama}</td><td>${d.dinas}</td></tr>`; });
  html += '</table>';
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'Data_Kunjungan.doc'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// Export Excel as CSV
function exportCSV() {
  let csv = 'No,Tanggal,No SPT,Nama,Dinas\n';
  dataKunjungan.forEach((d,i)=>{ csv += `${i+1},${d.tanggal},"${d.noSpt}","${d.nama}","${d.dinas}"\n`; });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Data_Kunjungan.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Add a small export CSV button dynamically if not present
(function addExportCsvButton() {
  const container = document.querySelector('#data-kunjungan');
  if (!container) return;
  if (!container.querySelector('#export-csv')) {
    const btn = document.createElement('button'); btn.id = 'export-csv'; btn.textContent = 'Export ke Excel (CSV)'; btn.className = 'btn'; btn.style.marginLeft = '8px';
    btn.addEventListener('click', exportCSV);
    container.appendChild(btn);
  }
})();

// === DARK MODE ===
const toggleDark = document.getElementById('toggle-darkmode');
if (toggleDark) {
  toggleDark.addEventListener('change', () => { document.body.classList.toggle('dark-mode', toggleDark.checked); localStorage.setItem('darkmode', toggleDark.checked); });
  if (localStorage.getItem('darkmode') === 'true') { document.body.classList.add('dark-mode'); toggleDark.checked = true; }
}

// === LOGOUT ===
const logoutBtn = document.getElementById('logout-btn');
logoutBtn && logoutBtn.addEventListener('click', () => { if (confirm('Yakin mau logout?')) { localStorage.removeItem('currentUser'); window.location.href = 'index.html'; } });

// === STORAGE SYNC (realtime antar tab) & NOTIF untuk admin ===
function attachStorageListener() {
  window.addEventListener('storage', (e) => {
    if (e.key === 'kunjungan') {
      loadData();
    }
    if (e.key === 'newEntry') {
      if (currentUser && currentUser.role === 'admin') {
        try {
          const obj = JSON.parse(e.newValue);
          showNotif(`📣 User ${obj.by} menambah data pada ${new Date(obj.at).toLocaleString()}`);
          // clear flag
          localStorage.removeItem('newEntry');
        } catch (err) { /* ignore */ }
      }
    }
  });

  // juga lakukan pemeriksaan interval singkat (untuk beberapa browser yang tak trigger storage on same-tab)
  setInterval(() => {
    if (currentUser && currentUser.role === 'admin') {
      const n = JSON.parse(localStorage.getItem('newEntry') || 'null');
      if (n) { showNotif(`📣 User ${n.by} menambah data pada ${new Date(n.at).toLocaleString()}`); localStorage.removeItem('newEntry'); }
    }
  }, 2000);
}

// === INITIAL LOAD / STORAGE COMPATIBILITY ===
function attachStorageListenerOnce() { if (!window._sagtaStorageAttached) { attachStorageListener(); window._sagtaStorageAttached = true; } }
attachStorageListenerOnce();

// === REALTIME: listen when other pages change kunjungan (same-tab) ===
(function addLocalChangeHook() {
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k, v) { origSet(k, v); window.dispatchEvent(new Event('storage')); };
})();

// === UTIL: storage event polyfill for same-tab updates listener ===
function saveAndNotify() { saveToLocal(); window.dispatchEvent(new Event('storage')); }

// Ensure loadData available globally for other pages (like user.html)
window.sagta = { loadData, saveToLocal, dataKunjungan };

// === FIX: Inisialisasi & gambar di canvas tanda tangan (user & admin) ===
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas-ttd');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let menggambar = false;

    function posisi(e) {
      const rect = canvas.getBoundingClientRect();
      if (e.touches) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      } else {
        return { x: e.offsetX, y: e.offsetY };
      }
    }

    function mulaiGambar(e) {
      menggambar = true;
      const pos = posisi(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function gambar(e) {
      if (!menggambar) return;
      const pos = posisi(e);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function selesaiGambar() {
      menggambar = false;
      ctx.beginPath();
    }

    // Event mouse
    canvas.addEventListener('mousedown', mulaiGambar);
    canvas.addEventListener('mousemove', gambar);
    canvas.addEventListener('mouseup', selesaiGambar);
    canvas.addEventListener('mouseleave', selesaiGambar);

    // Event touch
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); mulaiGambar(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); gambar(e); });
    canvas.addEventListener('touchend', selesaiGambar);

    // Tombol hapus TTD
    const hapusTTD = document.getElementById('hapus-ttd');
    if (hapusTTD) {
      hapusTTD.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }
});

// === FIX: Tombol \"Lihat\" untuk menampilkan TTD dalam popup ===
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('lihat-ttd')) {
    const tr = e.target.closest('tr');
    const idx = Array.from(tr.parentNode.children).indexOf(tr);
    const data = JSON.parse(localStorage.getItem('kunjungan')) || [];
    const item = data[idx];
    if (item && item.ttd) {
      const imgWin = window.open('', 'TTD', 'width=400,height=400');
      imgWin.document.write(`<title>TTD</title><img src=\"${item.ttd}\" style=\"max-width:100%\">`);
    } else {
      alert('TTD tidak tersedia.');
    }
  }
});

// === Gambar di Canvas TTD ===
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas-ttd");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let menggambar = false;

  function posisi(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return { x: e.offsetX, y: e.offsetY };
    }
  }

  function mulai(e) {
    e.preventDefault();
    menggambar = true;
    const pos = posisi(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function gambar(e) {
    if (!menggambar) return;
    e.preventDefault();
    const pos = posisi(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function selesai() {
    menggambar = false;u
    ctx.beginPath();
  }

  // Mouse events
  canvas.addEventListener("mousedown", mulai);
  canvas.addEventListener("mousemove", gambar);
  canvas.addEventListener("mouseup", selesai);
  canvas.addEventListener("mouseleave", selesai);

  // Touch events
  canvas.addEventListener("touchstart", mulai);
  canvas.addEventListener("touchmove", gambar);
  canvas.addEventListener("touchend", selesai);

  // Hapus TTD
  const hapusTTD = document.getElementById("hapus-ttd");
  if (hapusTTD) {
    hapusTTD.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
});