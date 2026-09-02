/* Moodboard content — shared between index.html (renders it) and admin.html
   (manages it).

   MOODBOARD_API_ENABLED toggles the persistence backend:
   - false (default): photos live in localStorage. Works today with no
     backend changes, but only the browser that made the edit sees it —
     other visitors still see whatever was last synced/seeded.
   - true: calls a REST API on snr.arsenidis.dev, mirroring the public/admin
     split already used for products (GET /products/ is public, writes go
     through /products/admin/). That endpoint doesn't exist yet — see the
     contract below for what the backend needs to implement. Flip this
     flag once it does; no other code here needs to change.

   Backend contract (mirrors the products public/admin split):
     GET    /moodboard/                  -> [{ id, src, title, body, order }, ...]  (public, no auth)
     POST   /moodboard/admin/            <- FormData(title, body, image?, src?)     (staff only)
     PATCH  /moodboard/admin/:id/        <- FormData(title?, body?, image?)         (staff only)
     DELETE /moodboard/admin/:id/                                                   (staff only)
     POST   /moodboard/admin/reorder/    <- JSON { order: [id, id, id, ...] }        (staff only)
   `body` may contain \n for line breaks; render layers convert to <br>. */

var MOODBOARD_API_ENABLED = false;
var MOODBOARD_STORAGE_KEY = 'snr_moodboard_photos';

var MOODBOARD_DEFAULTS = [
  { id: 'd1',  src: 'extracted_images/page8_img1.jpeg', title: 'Contrast', body: 'Dark minimal tones dominate.\nOrange as controlled energy.' },
  { id: 'd2',  src: 'extracted_images/page2_img1.jpeg', title: 'Brand Philosophy', body: 'Luxury defined by awareness,\npresence, and identity.' },
  { id: 'd3',  src: 'extracted_images/page3_img1.jpeg', title: 'Raw Reality', body: 'Trash, rust, industrial textures.\nEvidence of life.' },
  { id: 'd4',  src: 'extracted_images/page4_img1.jpeg', title: 'The Observer', body: 'Minimal compositions.\nSilent dominance.' },
  { id: 'd5',  src: 'extracted_images/page5_img1.jpeg', title: 'Structure & Precision', body: 'The Σ symbol reflects\nlogic and identity.' },
  { id: 'd6',  src: 'extracted_images/page6_img1.jpeg', title: 'Human Truth', body: 'Real people replace models.\nAuthenticity over perfection.' },
  { id: 'd7',  src: 'extracted_images/page7_img1.jpeg', title: 'Movement', body: 'Streets, cars, environments.\nIdentity remains constant.' },
  { id: 'd8',  src: 'new_img1.png', title: 'The Scene', body: 'Urban spaces become\nthe canvas.' },
  { id: 'd9',  src: '678951775_1541941244170275_8788756879565237981_n.jpg', title: 'The Fit', body: 'Every piece worn\nwith intention.' },
  { id: 'd10', src: 'new_img2.png', title: 'The Stance', body: 'Presence over performance.' },
  { id: 'd11', src: '686153898_1459679375625397_5430363690105946194_n.jpg', title: 'The Look', body: 'Quiet power.\nLoud impact.' }
];

function mbLoadLocal() {
  try {
    var raw = localStorage.getItem(MOODBOARD_STORAGE_KEY);
    if (!raw) return MOODBOARD_DEFAULTS.slice();
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : MOODBOARD_DEFAULTS.slice();
  } catch (ex) {
    return MOODBOARD_DEFAULTS.slice();
  }
}

function mbSaveLocal(photos) {
  try {
    localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(photos));
  } catch (ex) {
    throw new Error('Could not save — the browser\'s local storage is full. Try a smaller image.');
  }
}

function mbFileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getMoodboardPhotos() {
  if (MOODBOARD_API_ENABLED) {
    var res = await apiFetch('/moodboard/');
    return res && res.ok ? await res.json() : [];
  }
  return mbLoadLocal();
}

/* photo: { id (omit/null for new), src?, file?, title, body } */
async function saveMoodboardPhoto(photo) {
  if (MOODBOARD_API_ENABLED) {
    var isNew = !photo.id;
    var payload = new FormData();
    payload.append('title', photo.title);
    payload.append('body', photo.body);
    if (photo.file) payload.append('image', photo.file);
    else if (photo.src) payload.append('src', photo.src);
    var res = isNew
      ? await apiFetch('/moodboard/admin/', { method: 'POST', body: payload })
      : await apiFetch('/moodboard/admin/' + photo.id + '/', { method: 'PATCH', body: payload });
    if (!res || !res.ok) throw new Error('Save failed.');
    return await res.json();
  }

  if (photo.file) {
    photo.src = await mbFileToDataUrl(photo.file);
    delete photo.file;
  }

  var photos = mbLoadLocal();
  if (photo.id) {
    var idx = photos.findIndex(function (p) { return p.id === photo.id; });
    if (idx > -1) photos[idx] = Object.assign({}, photos[idx], photo);
  } else {
    photo.id = 'p' + Date.now() + Math.random().toString(36).slice(2, 7);
    photos.push(photo);
  }
  mbSaveLocal(photos);
  return photo;
}

async function deleteMoodboardPhoto(id) {
  if (MOODBOARD_API_ENABLED) {
    var res = await apiFetch('/moodboard/admin/' + id + '/', { method: 'DELETE' });
    return !!(res && (res.ok || res.status === 204));
  }
  mbSaveLocal(mbLoadLocal().filter(function (p) { return p.id !== id; }));
  return true;
}

async function reorderMoodboardPhotos(orderedIds) {
  if (MOODBOARD_API_ENABLED) {
    var res = await apiFetch('/moodboard/admin/reorder/', {
      method: 'POST',
      body: JSON.stringify({ order: orderedIds })
    });
    return !!(res && res.ok);
  }
  var byId = {};
  mbLoadLocal().forEach(function (p) { byId[p.id] = p; });
  mbSaveLocal(orderedIds.map(function (id) { return byId[id]; }).filter(Boolean));
  return true;
}
