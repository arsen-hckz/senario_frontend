/* Sale posts — clickable promo cards that spotlight one product each,
   shown in the header nav (as "Sale", hidden until the first post exists)
   and on sale.html. A post never stores its own image/price — it just
   references a product by slug, and the current image/price/sale_price
   are pulled from that product at render time (see hydrateSalePosts).

   POSTS_API_ENABLED toggles the persistence backend, same pattern as
   moodboard-data.js:
   - false (default): posts live in localStorage. Works today with no
     backend changes, but only the browser that made the edit sees them.
   - true: calls a REST API on snr.arsenidis.dev, mirroring the public/admin
     split already used for products and the moodboard. That endpoint
     doesn't exist yet — see backend-posts-prompt.txt for the contract.
     Flip this flag once it does; no other code here needs to change.

   Backend contract (mirrors products/moodboard public/admin split):
     GET    /posts/                  -> [{ id, product_slug, headline, note, order }, ...]  (public, no auth)
     POST   /posts/admin/            <- JSON { product_slug, headline, note }                (staff only)
     PATCH  /posts/admin/:id/        <- JSON { product_slug?, headline?, note? }              (staff only)
     DELETE /posts/admin/:id/                                                                 (staff only)
     POST   /posts/admin/reorder/    <- JSON { order: [id, id, id, ...] }                     (staff only) */

var POSTS_API_ENABLED = false;
var POSTS_STORAGE_KEY = 'snr_sale_posts';

function spLoadLocal() {
  try {
    var raw = localStorage.getItem(POSTS_STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (ex) {
    return [];
  }
}

function spSaveLocal(posts) {
  localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
}

async function getSalePosts() {
  if (POSTS_API_ENABLED) {
    var res = await apiFetch('/posts/');
    return res && res.ok ? await res.json() : [];
  }
  return spLoadLocal();
}

/* post: { id (omit/null for new), product_slug, headline, note } */
async function saveSalePost(post) {
  if (POSTS_API_ENABLED) {
    var isNew = !post.id;
    var payload = JSON.stringify({ product_slug: post.product_slug, headline: post.headline, note: post.note });
    var res = isNew
      ? await apiFetch('/posts/admin/', { method: 'POST', body: payload })
      : await apiFetch('/posts/admin/' + post.id + '/', { method: 'PATCH', body: payload });
    if (!res || !res.ok) throw new Error('Save failed.');
    return await res.json();
  }

  var posts = spLoadLocal();
  if (post.id) {
    var idx = posts.findIndex(function (p) { return String(p.id) === String(post.id); });
    if (idx > -1) posts[idx] = Object.assign({}, posts[idx], post);
  } else {
    post.id = 'sp' + Date.now() + Math.random().toString(36).slice(2, 7);
    posts.push(post);
  }
  spSaveLocal(posts);
  return post;
}

async function deleteSalePost(id) {
  if (POSTS_API_ENABLED) {
    var res = await apiFetch('/posts/admin/' + id + '/', { method: 'DELETE' });
    return !!(res && (res.ok || res.status === 204));
  }
  spSaveLocal(spLoadLocal().filter(function (p) { return String(p.id) !== String(id); }));
  return true;
}

async function reorderSalePosts(orderedIds) {
  if (POSTS_API_ENABLED) {
    var res = await apiFetch('/posts/admin/reorder/', {
      method: 'POST',
      body: JSON.stringify({ order: orderedIds })
    });
    return !!(res && res.ok);
  }
  var byId = {};
  spLoadLocal().forEach(function (p) { byId[String(p.id)] = p; });
  spSaveLocal(orderedIds.map(function (id) { return byId[String(id)]; }).filter(Boolean));
  return true;
}

/* Merges each post with its live product (image, name, price, sale_price)
   by fetching the public product list once. Posts whose product no longer
   exists are dropped rather than shown broken. */
async function hydrateSalePosts(posts) {
  if (!posts.length) return [];
  var res = await fetch(API_BASE + '/products/');
  var products = res.ok ? await res.json() : [];
  var bySlug = {};
  products.forEach(function (p) { bySlug[p.slug] = p; });

  return posts
    .map(function (post) {
      var product = bySlug[post.product_slug];
      return product ? Object.assign({}, post, { product: product }) : null;
    })
    .filter(Boolean);
}
