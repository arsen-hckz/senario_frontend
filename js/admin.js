if (localStorage.getItem('snr_is_staff') !== '1') window.location.href = '/';

snrInitNav();
function logout() { snrLogout(); }

var editingProductId = null;

/* NAV */
function showPage(page, link) {
  document.querySelectorAll('.admin-page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sidebar-nav a').forEach(function(a) { a.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  if (link) link.classList.add('active');
  if (page === 'products')   renderProducts();
  if (page === 'orders')     renderAllOrders();
  if (page === 'moodboard')  renderMoodboardAdmin();
  if (page === 'posts')      renderSalePostsAdmin();
}

/* OVERVIEW */
async function renderOverview() {
  try {
    var pRes = await apiFetch('/products/admin/');
    var oRes = await apiFetch('/orders/admin/');
    var products = pRes && pRes.ok ? await pRes.json() : [];
    var orders   = oRes && oRes.ok ? await oRes.json() : [];

    /* Revenue and sales only count orders that were paid and not cancelled;
       pending ones may never be paid. */
    var sold       = orders.filter(function(o){ return ['confirmed','shipped','delivered'].indexOf(o.status) !== -1; });
    var revenue    = sold.reduce(function(s,o){ return s + parseFloat(o.total||0); }, 0);
    var totalUnits = sold.reduce(function(s,o){ return s + (o.items||[]).reduce(function(ss,i){ return ss+(i.qty||1); },0); }, 0);
    var onSale     = products.filter(function(p){ return p.sale_price && parseFloat(p.sale_price) < parseFloat(p.price); }).length;

    var stats = [
      { label:'Products',   value: products.length },
      { label:'Orders',     value: orders.length },
      { label:'Revenue',    value: '' + formatEuro(revenue) },
      { label:'Units Sold', value: totalUnits },
      { label:'On Sale',    value: onSale }
    ];
    var grid = document.getElementById('statGrid');
    grid.style.gridTemplateColumns = 'repeat(5,1fr)';
    grid.innerHTML = stats.map(function(s){
      return '<div class="stat-card"><div class="stat-label">'+s.label+'</div><div class="stat-value">'+s.value+'</div></div>';
    }).join('');

    /* top products */
    var itemSales = {};
    sold.forEach(function(order) {
      (order.items||[]).forEach(function(item) {
        var key = item.product_name;
        if (!itemSales[key]) itemSales[key] = { qty:0, revenue:0 };
        itemSales[key].qty     += (item.qty||1);
        itemSales[key].revenue += parseFloat(item.price||0)*(item.qty||1);
      });
    });
    var topItems = Object.keys(itemSales).map(function(k){ return { name:k, qty:itemSales[k].qty, revenue:itemSales[k].revenue }; });
    topItems.sort(function(a,b){ return b.qty - a.qty; });

    var topHtml = '<div class="analytics-card"><p class="analytics-title">Top Products by Sales</p>';
    if (!topItems.length) {
      topHtml += '<p class="analytics-empty">No sales data yet.</p>';
    } else {
      topItems.slice(0,6).forEach(function(item, i) {
        topHtml += '<div class="top-item"><div style="display:flex;align-items:center;"><span class="top-item__rank">'+(i+1)+'.</span><span class="top-item__name">'+escHtml(item.name)+'</span></div><div class="top-item__stats">'+item.qty+' sold &nbsp;·&nbsp; ' + formatEuro(item.revenue)+'</div></div>';
      });
    }
    topHtml += '</div>';

    /* orders by day */
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var dayCount = [0,0,0,0,0,0,0];
    orders.forEach(function(o) {
      var d = new Date(o.created_at);
      if (!isNaN(d.getTime())) dayCount[d.getDay()]++;
    });
    var maxDay  = Math.max.apply(null, dayCount) || 1;
    var peakIdx = dayCount.indexOf(Math.max.apply(null, dayCount));
    var dayHtml = '<div class="analytics-card"><p class="analytics-title">Orders by Day of Week</p>';
    if (!orders.length) {
      dayHtml += '<p class="analytics-empty">No order data yet.</p>';
    } else {
      dayNames.forEach(function(day, i) {
        var pct = Math.round((dayCount[i] / maxDay) * 100);
        dayHtml += '<div class="day-row"><span class="day-label">'+day+'</span><div class="day-bar-track"><div class="day-bar-fill'+(i===peakIdx?' peak':'')+'" style="width:'+pct+'%"></div></div><span class="day-count">'+dayCount[i]+'</span></div>';
      });
    }
    dayHtml += '</div>';
    document.getElementById('analyticsGrid').innerHTML = topHtml + dayHtml;

    /* recent orders */
    var tbody = document.getElementById('recentOrdersBody');
    tbody.innerHTML = '';
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--gray);text-align:center;padding:24px;">No orders yet.</td></tr>';
      return;
    }
    orders.slice(0,5).forEach(function(order){
      var date = new Date(order.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>#'+order.id+'</td><td>'+date+'</td><td>'+(order.items||[]).length+'</td><td>' + formatEuro(parseFloat(order.total||0))+'</td><td><span class="status-badge status-badge--'+order.status+'">'+order.status+'</span></td>';
      tbody.appendChild(tr);
    });
  } catch (ex) {
    document.getElementById('statGrid').innerHTML = '<p style="color:var(--gray);">Failed to load overview.</p>';
  }
}

/* PRODUCTS */
function stockBadge(stock) {
  if (stock === 0) return '<span class="stock-badge stock-badge--oos">Out of Stock</span>';
  if (stock < 10)  return '<span class="stock-badge stock-badge--low">Low Stock</span>';
  return                  '<span class="stock-badge stock-badge--in">In Stock</span>';
}

async function renderProducts() {
  var tbody = document.getElementById('productTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">Loading...</td></tr>';
  try {
    var res = await apiFetch('/products/admin/');
    var products = res && res.ok ? await res.json() : [];
    document.getElementById('productCount').textContent = products.length + ' product' + (products.length===1?'':'s');
    tbody.innerHTML = '';
    products.forEach(function(p) {
      var stock  = (p.variants && p.variants.length)
        ? p.variants.reduce(function(sum, v) { return sum + (v.stock || 0); }, 0)
        : (p.stock || 0);
      var onSale = p.sale_price && parseFloat(p.sale_price) < parseFloat(p.price);
      var priceCell = onSale
        ? '<span style="text-decoration:line-through;color:var(--gray);">' + formatEuro(parseFloat(p.price))+'</span> <span style="color:var(--orange);">' + formatEuro(parseFloat(p.sale_price))+'</span>'
        : '' + formatEuro(parseFloat(p.price));
      var safeName = escHtml(p.name);
      var nameCell = safeName + (onSale ? '<span class="sale-badge">Sale</span>' : '');
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><img class="product-thumb" src="'+(p.image||'')+'" alt="'+safeName+'"></td>'+
        '<td>'+nameCell+'</td>'+
        '<td style="font-family:var(--ff-mono);font-size:11px;">'+priceCell+'</td>'+
        '<td style="font-family:var(--ff-mono);font-size:11px;">'+stock+'</td>'+
        '<td>'+stockBadge(stock)+'</td>'+
        '<td>'+(p.category ? escHtml(p.category.name) : '—')+'</td>'+
        '<td>'+
          '<button class="action-btn action-btn--edit" data-click="editProduct" data-id="'+p.id+'">Edit</button>'+
          '<button class="action-btn action-btn--delete" data-click="deleteProduct" data-id="'+p.id+'">Delete</button>'+
        '</td>';
      tbody.appendChild(tr);
    });
  } catch (ex) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">Failed to load products.</td></tr>';
  }
}

/* ALL ORDERS */
async function renderAllOrders() {
  var tbody = document.getElementById('allOrdersBody');
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">Loading...</td></tr>';
  try {
    var res = await apiFetch('/orders/admin/');
    var orders = res && res.ok ? await res.json() : [];
    tbody.innerHTML = '';
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:24px;">No orders yet.</td></tr>';
      return;
    }
    orders.forEach(function(order) {
      var date  = new Date(order.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
      var total = formatEuro(order.total);
      var tr    = document.createElement('tr');
      tr.innerHTML =
        '<td>#'+order.id+'</td>'+
        '<td>'+date+'</td>'+
        '<td class="order-cell">'+escHtml(order.full_name)+(order.is_guest ? ' <span style="color:var(--gray);">(guest)</span>' : '')+
          (order.email ? '<br><a href="mailto:'+escHtml(order.email)+'">'+escHtml(order.email)+'</a>' : '')+
          (order.phone ? '<br><a href="tel:'+escHtml(order.phone.replace(/[^+0-9]/g, ''))+'">'+escHtml(order.phone)+'</a>' : '')+
        '</td>'+
        '<td class="order-cell">'+escHtml(order.address)+'<br>'+escHtml(order.postal_code)+' '+escHtml(order.city)+'<br>'+escHtml(order.country)+'</td>'+
        '<td class="order-cell">'+(order.items||[]).map(function(item) {
          return escHtml(item.qty+'× '+item.product_name+(item.size ? ' ('+item.size+')' : ''));
        }).join('<br>')+'</td>'+
        '<td>'+total+'</td>'+
        '<td>'+
          '<select class="order-status-select" data-change="updateOrderStatus" data-order-id="'+order.id+'">'+
            ['pending','confirmed','shipped','delivered','cancelled'].map(function(s){
              return '<option value="'+s+'"'+(order.status===s?' selected':'')+'>'+s+'</option>';
            }).join('')+
          '</select>'+
        '</td>';
      tbody.appendChild(tr);
    });
  } catch (ex) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--gray);text-align:center;padding:24px;">Failed to load orders.</td></tr>';
  }
}

async function updateOrderStatus(orderId, status) {
  /* Stock follows the status: confirmed/shipped/delivered hold it,
     pending/cancelled give it back. */
  try {
    var res = await apiFetch('/orders/admin/' + orderId + '/', {
      method: 'PATCH',
      body: JSON.stringify({status: status})
    });
    if (!res || !res.ok) throw new Error();
    var data = await res.json();
    if (data.refund_needed) {
      alert('Order #' + orderId + ' was paid through Viva. Its stock is back on sale; refund the customer in the Viva portal.');
    }
  } catch (ex) {
    alert('Could not change the status of order #' + orderId + '.');
    renderAllOrders();
  }
}

/* MODAL */
/* One stock box per size. The standard sizes are always offered; any
   other size a product already has (e.g. "One Size") is kept as well, so
   saving never drops it. Blank = not sold in that size. */
var STANDARD_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

function renderSizeInputs(variants) {
  var wrap = document.getElementById('fSizeStock');
  var stockBySize = {};
  variants.forEach(function(v) { stockBySize[v.size] = v.stock; });
  var sizes = STANDARD_SIZES.slice();
  variants.forEach(function(v) { if (sizes.indexOf(v.size) === -1) sizes.push(v.size); });
  wrap.innerHTML = '';
  sizes.forEach(function(size) {
    var label = document.createElement('label');
    var name = document.createElement('span');
    name.textContent = size;
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.placeholder = '—';
    input.dataset.size = size;
    if (stockBySize[size] !== undefined) input.value = stockBySize[size];
    input.addEventListener('input', syncQtyField);
    label.appendChild(name);
    label.appendChild(input);
    wrap.appendChild(label);
  });
  syncQtyField();
}

/* With sizes, stock is counted per size, so the overall quantity is unused. */
function syncQtyField() {
  var sized = collectSizes().length > 0;
  document.getElementById('fQty').disabled = sized;
  document.getElementById('fQtyNote').textContent = sized ? '(set per size below)' : '(products without sizes)';
}

function collectSizes() {
  var sizes = [];
  document.querySelectorAll('#fSizeStock input').forEach(function(input) {
    if (input.value.trim() === '') return;
    sizes.push({size: input.dataset.size, stock: parseInt(input.value, 10)});
  });
  return sizes;
}

async function openModal(productId) {
  editingProductId = productId || null;
  var title = document.getElementById('modalTitle');
  if (editingProductId) {
    title.textContent = 'Edit Product';
    try {
      var res2 = await apiFetch('/products/admin/' + editingProductId + '/');
      if (res2 && res2.ok) {
        var p = await res2.json();
        document.getElementById('fName').value      = p.name;
        document.getElementById('fPrice').value     = parseFloat(p.price);
        document.getElementById('fQty').value       = p.stock || 0;
        document.getElementById('fSalePrice').value = p.sale_price ? parseFloat(p.sale_price) : '';
        document.getElementById('fTag').value       = '';
        renderSizeInputs(p.variants || []);
        document.getElementById('fDesc').value      = p.description || '';
        resetGallery(p.images);
      }
    } catch (ex) {}
  } else {
    title.textContent = 'Add Product';
    ['fName','fPrice','fQty','fSalePrice','fTag','fDesc'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('fQty').value = '0';
    renderSizeInputs([]);
    resetGallery([]);
  }
  document.getElementById('productModal').classList.add('open');
}

/* Product photo gallery being edited in the modal. Each entry is either
   an existing photo {id, url} or a newly picked file {file, url}. */
var galleryItems = [];
var removedImageIds = [];
var MAX_PRODUCT_PHOTOS = 12;

function resetGallery(images) {
  galleryItems = (images || []).map(function(img) { return {id: img.id, url: img.image}; });
  removedImageIds = [];
  renderGallery();
}

function addGalleryFiles(input) {
  Array.prototype.forEach.call(input.files || [], function(file) {
    if (galleryItems.length >= MAX_PRODUCT_PHOTOS) return;
    galleryItems.push({file: file, url: URL.createObjectURL(file)});
  });
  if ((input.files || []).length && galleryItems.length >= MAX_PRODUCT_PHOTOS) {
    alert('A product can have at most ' + MAX_PRODUCT_PHOTOS + ' photos.');
  }
  input.value = '';
  renderGallery();
}

function moveGalleryItem(i, delta) {
  var j = i + delta;
  if (j < 0 || j >= galleryItems.length) return;
  var tmp = galleryItems[i]; galleryItems[i] = galleryItems[j]; galleryItems[j] = tmp;
  renderGallery();
}

function removeGalleryItem(i) {
  var item = galleryItems.splice(i, 1)[0];
  if (item.id) removedImageIds.push(item.id);
  if (item.file) URL.revokeObjectURL(item.url);
  renderGallery();
}

function renderGallery() {
  var wrap = document.getElementById('galleryEdit');
  wrap.innerHTML = '';
  galleryItems.forEach(function(item, i) {
    var tile = document.createElement('div');
    tile.className = 'gallery-edit__tile';
    var img = document.createElement('img');
    img.src = item.url;
    img.alt = '';
    tile.appendChild(img);
    if (i === 0) {
      var badge = document.createElement('span');
      badge.className = 'gallery-edit__cover';
      badge.textContent = 'Cover';
      tile.appendChild(badge);
    }
    var bar = document.createElement('div');
    bar.className = 'gallery-edit__bar';
    [['\u2190', 'Move left', function() { moveGalleryItem(i, -1); }, i === 0],
     ['\u2192', 'Move right', function() { moveGalleryItem(i, 1); }, i === galleryItems.length - 1],
     ['\u00d7', 'Remove', function() { removeGalleryItem(i); }, false]
    ].forEach(function(cfg) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = cfg[0];
      b.title = cfg[1];
      b.disabled = cfg[3];
      b.addEventListener('click', cfg[2]);
      bar.appendChild(b);
    });
    tile.appendChild(bar);
    wrap.appendChild(tile);
  });
}

function closeModal() {
  document.getElementById('productModal').classList.remove('open');
  galleryItems.forEach(function(item) { if (item.file) URL.revokeObjectURL(item.url); });
  resetGallery([]);
  editingProductId = null;
}

async function saveProduct() {
  var name  = document.getElementById('fName').value.trim();
  var price = parseFloat(document.getElementById('fPrice').value);
  if (!name || isNaN(price)) { alert('Name and price are required.'); return; }

  try {
    var saleText  = document.getElementById('fSalePrice').value.trim();
    var salePrice = saleText === '' ? '' : parseFloat(saleText);
    if (salePrice !== '' && (isNaN(salePrice) || salePrice <= 0 || salePrice >= price)) {
      alert('The sale price must be more than 0 and less than the price. Leave it empty for no sale.');
      return;
    }
    var stock     = parseInt(document.getElementById('fQty').value) || 0;
    var desc      = document.getElementById('fDesc').value.trim();
    var sizes     = collectSizes();
    if (sizes.some(function(s) { return isNaN(s.stock) || s.stock < 0; })) {
      alert('Size stock must be a whole number, 0 or more.');
      return;
    }

    var payload = new FormData();
    payload.append('name', name);
    payload.append('price', price);
    payload.append('stock', stock);
    payload.append('description', desc);
    // New products start visible; an edit leaves visibility alone, so a
    // product hidden in the Django admin stays hidden.
    if (!editingProductId) payload.append('is_active', 'true');
    payload.append('sizes', JSON.stringify(sizes));
    // Always sent: an empty value ends the sale.
    payload.append('sale_price', salePrice);
    // Gallery: the full order as shown, where new files are "new-<n>" in
    // the order they are uploaded, plus any removed existing photos.
    var newCount = 0;
    galleryItems.forEach(function(item) {
      if (item.id) {
        payload.append('image_order', item.id);
      } else {
        payload.append('image_order', 'new-' + newCount++);
        payload.append('uploaded_images', item.file);
      }
    });
    removedImageIds.forEach(function(id) { payload.append('remove_image_ids', id); });

    var res;
    if (editingProductId) {
      res = await apiFetch('/products/admin/' + editingProductId + '/', {
        method: 'PATCH',
        body: payload
      });
    } else {
      res = await apiFetch('/products/admin/', {
        method: 'POST',
        body: payload
      });
    }
    if (res && res.ok) {
      closeModal();
      renderProducts();
    } else {
      var err = res ? await res.json() : {};
      alert(JSON.stringify(err) || 'Save failed.');
    }
  } catch (ex) {
    alert('Error: ' + ex.message);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  try {
    var res = await apiFetch('/products/admin/' + productId + '/', { method: 'DELETE' });
    if (res && (res.ok || res.status === 204)) renderProducts();
  } catch (ex) {}
}

document.getElementById('productModal').addEventListener('click', function(e){
  if (e.target === this) closeModal();
});

/* MOODBOARD */
var MOODBOARD_LIBRARY_IMAGES = [
  'extracted_images/page2_img1.jpeg', 'extracted_images/page3_img1.jpeg',
  'extracted_images/page4_img1.jpeg', 'extracted_images/page5_img1.jpeg',
  'extracted_images/page6_img1.jpeg', 'extracted_images/page7_img1.jpeg',
  'extracted_images/page8_img1.jpeg',
  '655308244_877927155229165_117727282973964430_n.jpg',
  '664233845_1534089618121126_8397825813666279650_n.jpg',
  '665278342_1746696659645517_6436919400386070473_n.jpg',
  '678951775_1541941244170275_8788756879565237981_n.jpg',
  '686153898_1459679375625397_5430363690105946194_n.jpg',
  'new_img1.png', 'new_img2.png'
];

var editingMoodboardId  = null;
var moodboardUploadFile = null;
var moodboardSrcPreview = null;

async function renderMoodboardAdmin() {
  document.getElementById('mbApiNote').textContent = MOODBOARD_API_ENABLED
    ? 'Synced to the moodboard API — visible to every visitor.'
    : 'Saved to this browser only (local prototype) until the moodboard API is connected — see moodboard-data.js.';

  var grid = document.getElementById('moodboardGrid');
  grid.innerHTML = '<p style="color:var(--gray);font-size:11px;">Loading...</p>';
  var photos = await getMoodboardPhotos();
  document.getElementById('moodboardCount').textContent = photos.length + ' photo' + (photos.length === 1 ? '' : 's');

  if (!photos.length) {
    grid.innerHTML = '<p style="color:var(--gray);font-size:11px;">No photos yet — add one to populate the moodboard.</p>';
    return;
  }

  grid.innerHTML = photos.map(function (p, i) {
    return '<div class="mb-micro__tile" draggable="true" ' +
             'data-id="' + escHtml(p.id) + '">' +
             '<img src="' + escHtml(p.thumb || p.src) + '" alt="">' +
             '<div class="mb-micro__cap"><span>' + escHtml(p.title) + '</span></div>' +
             '<div class="mb-micro__order">' + (i + 1) + '</div>' +
             '<div class="mb-micro__actions">' +
               '<button type="button" class="mb-micro__act" title="Edit" data-click="editMoodboardPhoto" data-id="' + escHtml(p.id) + '">&#9998;</button>' +
               '<button type="button" class="mb-micro__act mb-micro__act--delete" title="Delete" data-click="deleteMoodboardPhoto" data-id="' + escHtml(p.id) + '">&times;</button>' +
             '</div>' +
           '</div>';
  }).join('');
  bindTileDrag(grid, '.mb-micro__tile', mbDragStart, mbDragOver, mbDragLeave, mbDrop, mbDragEnd);
}

/* Drag-and-drop reordering. Listeners go on each tile rather than through
   data-* delegation because the handlers use e.currentTarget as the tile. */
function bindTileDrag(grid, selector, start, over, leave, drop, end) {
  grid.querySelectorAll(selector).forEach(function (tile) {
    var id = tile.dataset.id;
    tile.addEventListener('dragstart', function (e) { start(e, id); });
    tile.addEventListener('dragover',  function (e) { over(e, id); });
    tile.addEventListener('dragleave', function (e) { leave(e); });
    tile.addEventListener('drop',      function (e) { drop(e, id); });
    tile.addEventListener('dragend',   function (e) { end(e); });
  });
}

var mbDragSrcId = null;

function mbDragStart(e, id) {
  mbDragSrcId = String(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', mbDragSrcId);
  e.currentTarget.classList.add('mb-micro__tile--dragging');
}

function mbDragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (mbDragSrcId === String(id)) return;
  e.currentTarget.classList.add('mb-micro__tile--over');
}

function mbDragLeave(e) {
  e.currentTarget.classList.remove('mb-micro__tile--over');
}

function mbDragEnd(e) {
  e.currentTarget.classList.remove('mb-micro__tile--dragging');
  document.querySelectorAll('.mb-micro__tile--over').forEach(function (el) {
    el.classList.remove('mb-micro__tile--over');
  });
  mbDragSrcId = null;
}

async function mbDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('mb-micro__tile--over');
  var srcId = mbDragSrcId;
  mbDragSrcId = null;
  if (!srcId || srcId === String(targetId)) return;

  var photos = await getMoodboardPhotos();
  var fromIdx = photos.findIndex(function (p) { return String(p.id) === srcId; });
  var toIdx   = photos.findIndex(function (p) { return String(p.id) === String(targetId); });
  if (fromIdx < 0 || toIdx < 0) return;

  var tmp = photos[fromIdx];
  photos[fromIdx] = photos[toIdx];
  photos[toIdx] = tmp;

  await reorderMoodboardPhotos(photos.map(function (p) { return p.id; }));
  renderMoodboardAdmin();
}

function setMoodboardSource(mode) {
  document.getElementById('mbSrcUploadBtn').classList.toggle('active', mode === 'upload');
  document.getElementById('mbSrcExistingBtn').classList.toggle('active', mode === 'existing');
  document.getElementById('mbUploadField').style.display   = mode === 'upload'   ? '' : 'none';
  document.getElementById('mbExistingField').style.display = mode === 'existing' ? '' : 'none';
}

function previewMoodboardUpload(input) {
  if (input.files && input.files[0]) {
    moodboardUploadFile = input.files[0];
    moodboardSrcPreview = null;
    var preview = document.getElementById('mbImagePreview');
    preview.src = URL.createObjectURL(input.files[0]);
    preview.style.display = 'block';
  }
}

function previewMoodboardExisting(path) {
  moodboardSrcPreview = path;
  moodboardUploadFile = null;
  var preview = document.getElementById('mbImagePreview');
  if (path) {
    preview.src = path;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

function populateMoodboardExistingSelect(selected) {
  var select = document.getElementById('mbExistingSelect');
  select.innerHTML = '<option value="">— choose an image —</option>' +
    MOODBOARD_LIBRARY_IMAGES.map(function (src) {
      return '<option value="' + escHtml(src) + '"' + (src === selected ? ' selected' : '') + '>' + escHtml(src) + '</option>';
    }).join('');
}

async function openMoodboardModal(id) {
  editingMoodboardId  = id || null;
  moodboardUploadFile = null;
  moodboardSrcPreview = null;
  populateMoodboardExistingSelect(null);
  document.getElementById('mbImagePreview').style.display = 'none';
  document.getElementById('mbImageFile').value = '';

  var title = document.getElementById('mbModalTitle');
  if (editingMoodboardId) {
    title.textContent = 'Edit Photo';
    var photos = await getMoodboardPhotos();
    var p = photos.find(function (ph) { return String(ph.id) === String(editingMoodboardId); });
    if (p) {
      document.getElementById('mbTitle').value = p.title;
      document.getElementById('mbBody').value  = p.body;
      moodboardSrcPreview = p.src;
      var isKnown = MOODBOARD_LIBRARY_IMAGES.indexOf(p.src) > -1;
      setMoodboardSource(isKnown ? 'existing' : 'upload');
      if (isKnown) {
        populateMoodboardExistingSelect(p.src);
      }
      var preview = document.getElementById('mbImagePreview');
      preview.src = p.src;
      preview.style.display = 'block';
    }
  } else {
    title.textContent = 'Add Photo';
    document.getElementById('mbTitle').value = '';
    document.getElementById('mbBody').value  = '';
    setMoodboardSource('upload');
  }
  document.getElementById('moodboardModal').classList.add('open');
}

function closeMoodboardModal() {
  document.getElementById('moodboardModal').classList.remove('open');
  editingMoodboardId  = null;
  moodboardUploadFile = null;
  moodboardSrcPreview = null;
}

async function saveMoodboardPhotoAdmin() {
  var title = document.getElementById('mbTitle').value.trim();
  var body  = document.getElementById('mbBody').value.trim();
  if (!title) { alert('Title is required.'); return; }
  if (!moodboardUploadFile && !moodboardSrcPreview) { alert('Choose or upload an image.'); return; }

  try {
    var payload = { id: editingMoodboardId, title: title, body: body };
    if (moodboardUploadFile) payload.file = moodboardUploadFile;
    else payload.src = moodboardSrcPreview;

    await saveMoodboardPhoto(payload);
    closeMoodboardModal();
    renderMoodboardAdmin();
  } catch (ex) {
    alert(ex.message || 'Save failed.');
  }
}

async function deleteMoodboardPhotoAdmin(id) {
  if (!confirm('Delete this photo?')) return;
  await deleteMoodboardPhoto(id);
  renderMoodboardAdmin();
}

document.getElementById('moodboardModal').addEventListener('click', function (e) {
  if (e.target === this) closeMoodboardModal();
});

/* SALE POSTS */
var editingPostId    = null;
var postProductCache = [];

async function renderSalePostsAdmin() {
  document.getElementById('spApiNote').textContent = POSTS_API_ENABLED
    ? 'Synced to the sale-posts API — visible to every visitor.'
    : 'Saved to this browser only (local prototype) until the sale-posts API is connected — see posts-data.js.';

  var grid = document.getElementById('postGrid');
  grid.innerHTML = '<p style="color:var(--gray);font-size:11px;">Loading...</p>';
  var imported = await importLocalSalePosts();
  if (imported) alert(imported + ' sale post(s) saved only in this browser were uploaded — every visitor sees them now.');
  var posts = await hydrateSalePostsAdmin(await getSalePostsAdmin());
  document.getElementById('postCount').textContent = posts.length + ' post' + (posts.length === 1 ? '' : 's');

  if (!posts.length) {
    grid.innerHTML = '<p style="color:var(--gray);font-size:11px;">No posts yet — feature a product to populate the Sale page.</p>';
    return;
  }

  grid.innerHTML = posts.map(function (post, i) {
    var p = post.product;
    return '<div class="sp-tile" draggable="true" ' +
             'data-id="' + escHtml(post.id) + '">' +
             '<img class="sp-tile__img" src="' + escHtml(p.image || '') + '" alt="">' +
             '<div class="sp-tile__body">' +
               '<div class="sp-tile__headline">' + escHtml(post.headline) + '</div>' +
               '<div class="sp-tile__product">' + escHtml(p.name) + (p.is_active === false ? ' — hidden, not on the Sale page' : '') + '</div>' +
             '</div>' +
             '<div class="sp-tile__order">' + (i + 1) + '</div>' +
             '<div class="sp-tile__actions">' +
               '<button type="button" class="sp-tile__act" title="Edit" data-click="editPost" data-id="' + escHtml(post.id) + '">&#9998;</button>' +
               '<button type="button" class="sp-tile__act sp-tile__act--delete" title="Delete" data-click="deletePost" data-id="' + escHtml(post.id) + '">&times;</button>' +
             '</div>' +
           '</div>';
  }).join('');
  bindTileDrag(grid, '.sp-tile', spDragStart, spDragOver, spDragLeave, spDrop, spDragEnd);
}

var spDragSrcId = null;

function spDragStart(e, id) {
  spDragSrcId = String(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', spDragSrcId);
  e.currentTarget.classList.add('sp-tile--dragging');
}

function spDragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (spDragSrcId === String(id)) return;
  e.currentTarget.classList.add('sp-tile--over');
}

function spDragLeave(e) {
  e.currentTarget.classList.remove('sp-tile--over');
}

function spDragEnd(e) {
  e.currentTarget.classList.remove('sp-tile--dragging');
  document.querySelectorAll('.sp-tile--over').forEach(function (el) {
    el.classList.remove('sp-tile--over');
  });
  spDragSrcId = null;
}

async function spDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('sp-tile--over');
  var srcId = spDragSrcId;
  spDragSrcId = null;
  if (!srcId || srcId === String(targetId)) return;

  var posts = await getSalePostsAdmin();
  var fromIdx = posts.findIndex(function (p) { return String(p.id) === srcId; });
  var toIdx   = posts.findIndex(function (p) { return String(p.id) === String(targetId); });
  if (fromIdx < 0 || toIdx < 0) return;

  var tmp = posts[fromIdx];
  posts[fromIdx] = posts[toIdx];
  posts[toIdx] = tmp;

  await reorderSalePosts(posts.map(function (p) { return p.id; }));
  renderSalePostsAdmin();
}

async function populatePostProductSelect(selectedSlug) {
  var select = document.getElementById('spProduct');
  select.innerHTML = '<option value="">Loading products...</option>';
  try {
    var res = await apiFetch('/products/admin/');
    postProductCache = res && res.ok ? await res.json() : [];
  } catch (ex) {
    postProductCache = [];
  }
  select.innerHTML = '<option value="">— choose a product —</option>' +
    postProductCache.map(function (p) {
      return '<option value="' + escHtml(p.slug) + '"' + (p.slug === selectedSlug ? ' selected' : '') + '>' +
               escHtml(p.name) + ' — €' + parseFloat(p.effective_price || p.price) +
             '</option>';
    }).join('');
  previewPostProduct();
}

function previewPostProduct() {
  var slug    = document.getElementById('spProduct').value;
  var preview = document.getElementById('spPreview');
  var product = postProductCache.find(function (p) { return p.slug === slug; });
  if (!product) { preview.style.display = 'none'; return; }
  document.getElementById('spPreviewImg').src = product.image || '';
  var onSale = product.sale_price && parseFloat(product.effective_price || product.price) < parseFloat(product.price);
  document.getElementById('spPreviewPrice').textContent = onSale
    ? '€' + parseFloat(product.price) + ' → €' + parseFloat(product.effective_price)
    : '€' + parseFloat(product.price);
  preview.style.display = '';
}

async function openPostModal(id) {
  editingPostId = id || null;
  document.getElementById('spModalTitle').textContent = editingPostId ? 'Edit Post' : 'Add Post';
  document.getElementById('spHeadline').value = '';
  document.getElementById('spNote').value = '';

  var selectedSlug = null;
  if (editingPostId) {
    var posts = await getSalePostsAdmin();
    var post = posts.find(function (p) { return String(p.id) === String(editingPostId); });
    if (post) {
      document.getElementById('spHeadline').value = post.headline;
      document.getElementById('spNote').value = post.note || '';
      selectedSlug = post.product_slug;
    }
  }
  await populatePostProductSelect(selectedSlug);
  document.getElementById('postModal').classList.add('open');
}

function closePostModal() {
  document.getElementById('postModal').classList.remove('open');
  editingPostId = null;
}

async function savePostAdmin() {
  var slug     = document.getElementById('spProduct').value;
  var headline = document.getElementById('spHeadline').value.trim();
  var note     = document.getElementById('spNote').value.trim();
  if (!slug) { alert('Choose a product.'); return; }
  if (!headline) { alert('Headline is required.'); return; }

  try {
    await saveSalePost({ id: editingPostId, product_slug: slug, headline: headline, note: note });
    closePostModal();
    renderSalePostsAdmin();
  } catch (ex) {
    alert(ex.message || 'Save failed.');
  }
}

async function deletePostAdmin(id) {
  if (!confirm('Delete this post?')) return;
  await deleteSalePost(id);
  renderSalePostsAdmin();
}

document.getElementById('postModal').addEventListener('click', function (e) {
  if (e.target === this) closePostModal();
});

renderOverview();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'showPage', function (el, event) { showPage(el.dataset.page, el); });
snrOn('click', 'addProduct', function (el, event) { openModal(); });
snrOn('click', 'editProduct', function (el, event) { openModal(Number(el.dataset.id)); });
snrOn('click', 'deleteProduct', function (el, event) { deleteProduct(Number(el.dataset.id)); });
snrOn('change', 'addGalleryFiles', function (el, event) { addGalleryFiles(el); });
snrOn('click', 'saveProduct', function (el, event) { saveProduct(); });
snrOn('click', 'closeModal', function (el, event) { closeModal(); });
snrOn('change', 'updateOrderStatus', function (el, event) { updateOrderStatus(Number(el.dataset.orderId), el.value); });
snrOn('click', 'addMoodboardPhoto', function (el, event) { openMoodboardModal(); });
snrOn('click', 'editMoodboardPhoto', function (el, event) { event.stopPropagation(); openMoodboardModal(el.dataset.id); });
snrOn('click', 'deleteMoodboardPhoto', function (el, event) { event.stopPropagation(); deleteMoodboardPhotoAdmin(el.dataset.id); });
snrOn('click', 'setMoodboardSource', function (el, event) { setMoodboardSource(el.dataset.source); });
snrOn('change', 'previewMoodboardUpload', function (el, event) { previewMoodboardUpload(el); });
snrOn('change', 'previewMoodboardExisting', function (el, event) { previewMoodboardExisting(el.value); });
snrOn('click', 'saveMoodboardPhoto', function (el, event) { saveMoodboardPhotoAdmin(); });
snrOn('click', 'closeMoodboardModal', function (el, event) { closeMoodboardModal(); });
snrOn('click', 'addPost', function (el, event) { openPostModal(); });
snrOn('click', 'editPost', function (el, event) { event.stopPropagation(); openPostModal(el.dataset.id); });
snrOn('click', 'deletePost', function (el, event) { event.stopPropagation(); deletePostAdmin(el.dataset.id); });
snrOn('change', 'previewPostProduct', function (el, event) { previewPostProduct(); });
snrOn('click', 'savePost', function (el, event) { savePostAdmin(); });
snrOn('click', 'closePostModal', function (el, event) { closePostModal(); });
