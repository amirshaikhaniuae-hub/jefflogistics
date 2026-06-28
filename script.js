(function(){
  var pages = ['home','about','services','sectors','compliance','shipping','jobs','contact'];

  function showPage(id){
    if(pages.indexOf(id) === -1){ id = 'home'; }
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    var target = document.getElementById('page-' + id);
    if(target){ target.classList.add('active'); }
    document.querySelectorAll('.nav-links a').forEach(function(a){
      a.classList.toggle('active', a.getAttribute('data-page') === id);
    });
    document.querySelector('.nav').classList.remove('nav-open');
    window.scrollTo({top:0, behavior:'instant'});
  }
document.querySelectorAll('.nav-links a').forEach(function(a){
  a.addEventListener('click', function(){
    document.querySelector('.nav').classList.remove('nav-open');
    document.querySelector('.nav-toggle').setAttribute('aria-expanded','false');
  });
});
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-page]');
    if(el){
      e.preventDefault();
      showPage(el.getAttribute('data-page'));
    }
  });

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      var isOpen = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  var form = document.querySelector('#contact-form');
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = form.querySelector('.btn-invert');
      if(btn){ btn.textContent = 'Request sent'; btn.disabled = true; }
    });
  }



  // ---- SWAP LOCATIONS ----
  window.shipSwapLocations = function(){
    var fi = document.getElementById('sh-from-input');
    var ti = document.getElementById('sh-to-input');
    if(!fi || !ti) return;
    var tmp = fi.value;
    fi.value = ti.value;
    ti.value = tmp;
    var tmpCoords = shipFromCoords;
    shipFromCoords = shipToCoords;
    shipToCoords = tmpCoords;
    var tmpMarker = shipMarkerFrom;
    shipMarkerFrom = shipMarkerTo;
    shipMarkerTo = tmpMarker;
    if(shipMarkerFrom){ shipGetIcons(); shipMarkerFrom.setIcon(iconFrom); }
    if(shipMarkerTo){ shipGetIcons(); shipMarkerTo.setIcon(iconTo); }
    shipDrawRoute();
  };

  // ---- AUTOCOMPLETE ----
  var acTimers = {};
  var acCache = {};

  window.shipAutocomplete = function(which, val){
    var dropId = which === 'from' ? 'sh-from-drop' : 'sh-to-drop';
    var drop = document.getElementById(dropId);
    if(!drop) return;
    if(!val || val.length < 2){ drop.classList.remove('open'); return; }
    clearTimeout(acTimers[which]);
    drop.innerHTML = '<div class="ship-ac-loading">Searching...</div>';
    drop.classList.add('open');
    acTimers[which] = setTimeout(function(){
      var cacheKey = val.toLowerCase();
      if(acCache[cacheKey]){
        shipRenderAcResults(drop, acCache[cacheKey], which); return;
      }
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(val) + '&limit=5&addressdetails=1')
        .then(function(r){ return r.json(); })
        .then(function(data){
          acCache[cacheKey] = data;
          shipRenderAcResults(drop, data, which);
        })
        .catch(function(){ drop.classList.remove('open'); });
    }, 350);
  };

  function shipRenderAcResults(drop, data, which){
    if(!data || !data.length){ drop.innerHTML = '<div class="ship-ac-loading">No results found</div>'; return; }
    drop.innerHTML = '';
    data.forEach(function(item){
      var parts = item.display_name.split(',');
      var main = parts[0].trim();
      var sub = parts.slice(1, 3).join(',').trim();
      var div = document.createElement('div');
      div.className = 'ship-ac-item';
      div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
        + '<div><div class="ship-ac-main">' + main + '</div><div class="ship-ac-sub">' + sub + '</div></div>';
      div.addEventListener('click', function(){
        var inputId = which === 'from' ? 'sh-from-input' : 'sh-to-input';
        document.getElementById(inputId).value = item.display_name.split(',').slice(0,3).join(',');
        drop.classList.remove('open');
        var lat = parseFloat(item.lat), lon = parseFloat(item.lon);
        var latlng = [lat, lon];
        shipGetIcons();
        if(!shipMap) shipInitMap();
        if(which === 'from'){
          shipFromCoords = latlng;
          if(shipMarkerFrom) shipMap.removeLayer(shipMarkerFrom);
          shipMarkerFrom = L.marker(latlng, {icon:iconFrom}).addTo(shipMap);
          shipMarkerFrom.bindPopup('<b>Pickup</b><br>' + main).openPopup();
        } else {
          shipToCoords = latlng;
          if(shipMarkerTo) shipMap.removeLayer(shipMarkerTo);
          shipMarkerTo = L.marker(latlng, {icon:iconTo}).addTo(shipMap);
          shipMarkerTo.bindPopup('<b>Delivery</b><br>' + main).openPopup();
        }
        shipDrawRoute();
        if(shipFromCoords && shipToCoords) document.getElementById('ship-distance-box').style.display = 'flex';
      });
      drop.appendChild(div);
    });
  }

  // Close autocomplete on outside click
  document.addEventListener('click', function(e){
    if(!e.target.closest('.ship-route-input-wrap')){
      document.querySelectorAll('.ship-autocomplete-drop').forEach(function(d){ d.classList.remove('open'); });
    }
  });
  var shipSelectedCat = '';
  var shipSelectedMult = 1.0;


// ===== CATEGORY DETAIL FIELDS =====
var catFields = {
  'Cars': {
    icon: '🚗',
    desc: 'Please provide vehicle details for accurate transport planning',
    fields: [
      {id:'cat-car-make',    label:'Brand / Make',    type:'text',   placeholder:'e.g. BMW, Toyota, Ford', req:true},
      {id:'cat-car-model',   label:'Model',           type:'text',   placeholder:'e.g. 3 Series, Corolla', req:true},
      {id:'cat-car-year',    label:'Year of manufacture', type:'tel', placeholder:'e.g. 2019', req:true},
      {id:'cat-car-color',   label:'Color',           type:'text',   placeholder:'e.g. Black'},
      {id:'cat-car-plate',   label:'License plate',   type:'text',   placeholder:'e.g. AB-123-C'},
      {id:'cat-car-running', label:'Condition',       type:'select', options:['Running','Non-running (needs tow)','Partial – starts but cannot drive'], req:true},
    ]
  },
  'Motorcycles & Scooters': {
    icon: '🏍️',
    desc: 'Provide details so we can prepare the right securing equipment',
    fields: [
      {id:'cat-moto-make',   label:'Brand / Make',    type:'text',   placeholder:'e.g. Honda, Yamaha', req:true},
      {id:'cat-moto-model',  label:'Model',           type:'text',   placeholder:'e.g. CBR 600, MT-07', req:true},
      {id:'cat-moto-year',   label:'Year',            type:'tel', placeholder:'e.g. 2021', req:true},
      {id:'cat-moto-type',   label:'Type',            type:'select', options:['Motorcycle','Scooter / Moped','E-scooter','Quad / ATV'], req:true},
      {id:'cat-moto-cc',     label:'Engine (cc)',     type:'text',   placeholder:'e.g. 600 cc'},
      {id:'cat-moto-running',label:'Condition',       type:'select', options:['Running','Non-running'], req:true},
    ]
  },
  'Vehicles & Machinery': {
    icon: '🏗️',
    desc: 'Heavy & specialist equipment — we need dimensions and weight',
    fields: [
      {id:'cat-mach-type',   label:'Type of vehicle/machinery', type:'text', placeholder:'e.g. Forklift, Excavator, Generator', req:true},
      {id:'cat-mach-make',   label:'Brand / Make',   type:'text',   placeholder:'e.g. Caterpillar, JCB'},
      {id:'cat-mach-model',  label:'Model',          type:'text',   placeholder:'e.g. 320D, CAT 950M'},
      {id:'cat-mach-year',   label:'Year',           type:'tel', placeholder:'e.g. 2018'},
      {id:'cat-mach-weight', label:'Weight (kg)',    type:'tel', placeholder:'e.g. 8000', req:true},
      {id:'cat-mach-dims',   label:'Dimensions (L×W×H cm)', type:'text', placeholder:'e.g. 450×180×300'},
    ]
  },
  'Furniture': {
    icon: '🛋️',
    desc: 'Help us plan the right vehicle and crew size',
    fields: [
      {id:'cat-furn-items',  label:'Items to transport', type:'textarea', placeholder:'e.g. 1 sofa (3-seat), 1 wardrobe (200cm), 2 chairs', req:true},
      {id:'cat-furn-floors', label:'Pickup floor', type:'select', options:['Ground floor','1st floor','2nd floor','3rd floor','4th floor +','Top floor with elevator']},
      {id:'cat-furn-floorto',label:'Delivery floor', type:'select', options:['Ground floor','1st floor','2nd floor','3rd floor','4th floor +','Top floor with elevator']},
      {id:'cat-furn-assem',  label:'Assembly / disassembly needed?', type:'select', options:['No','Yes – disassembly at pickup','Yes – assembly at delivery','Yes – both']},
    ]
  },
  'Removals': {
    icon: '🏠',
    desc: 'Full move details to plan crew size and vehicle count',
    fields: [
      {id:'cat-rem-type',    label:'Property type', type:'select', options:['Studio','1-bedroom','2-bedroom','3-bedroom','4-bedroom','5+ bedroom','Office'], req:true},
      {id:'cat-rem-pickup-floor', label:'Pickup floor', type:'select', options:['Ground','1st','2nd','3rd','4th +']},
      {id:'cat-rem-deliv-floor',  label:'Delivery floor', type:'select', options:['Ground','1st','2nd','3rd','4th +']},
      {id:'cat-rem-packing', label:'Packing service needed?', type:'select', options:['No – already packed','Yes – pack at pickup','Yes – pack & unpack']},
      {id:'cat-rem-special', label:'Special items', type:'text', placeholder:'e.g. Piano, safe, antiques'},
    ]
  },
  'Pallets': {
    icon: '📦',
    desc: 'Pallet type and dimensions for transport planning',
    fields: [
      {id:'cat-pal-type',   label:'Pallet type', type:'select', options:['Euro pallet 120×80 cm','Standard pallet 120×100 cm','Half pallet','Custom size'], req:true},
      {id:'cat-pal-qty',    label:'Number of pallets', type:'tel', placeholder:'e.g. 4', req:true},
      {id:'cat-pal-height', label:'Stack height (cm)', type:'tel', placeholder:'e.g. 120'},
      {id:'cat-pal-weight', label:'Total weight (kg)', type:'tel', placeholder:'e.g. 800', req:true},
      {id:'cat-pal-forklift',label:'Forklift needed?', type:'select', options:['Yes','No – tail-lift OK']},
      {id:'cat-pal-fragile', label:'Fragile?', type:'select', options:['No','Yes – handle with care']},
    ]
  },
  'Parcels': {
    icon: '📮',
    desc: 'Package size and handling requirements',
    fields: [
      {id:'cat-par-qty',    label:'Number of parcels', type:'tel', placeholder:'e.g. 3', req:true},
      {id:'cat-par-weight', label:'Total weight (kg)', type:'tel', placeholder:'e.g. 15', req:true},
      {id:'cat-par-dims',   label:'Largest parcel size (cm)', type:'text', placeholder:'L×W×H, e.g. 60×40×30'},
      {id:'cat-par-fragile',label:'Fragile / special handling?', type:'select', options:['No','Yes – fragile','Yes – keep upright','Yes – temperature sensitive']},
      {id:'cat-par-sign',   label:'Signature on delivery', type:'select', options:['Yes','No']},
    ]
  },
  'Full Truckloads': {
    icon: '🚛',
    desc: 'Full load details for truck and crew planning',
    fields: [
      {id:'cat-ftl-cargo',  label:'Cargo description', type:'textarea', placeholder:'Describe the goods being transported', req:true},
      {id:'cat-ftl-weight', label:'Total weight (kg)', type:'tel', placeholder:'e.g. 12000', req:true},
      {id:'cat-ftl-volume', label:'Volume (m³)', type:'tel', placeholder:'e.g. 45'},
      {id:'cat-ftl-type',   label:'Cargo type', type:'select', options:['General goods','Palletised','Hazardous (ADR)','Temperature sensitive','Oversized'], req:true},
      {id:'cat-ftl-loading',label:'Loading equipment at pickup?', type:'select', options:['Yes – forklift available','Yes – dock leveller','No – tail-lift needed']},
    ]
  },
  'Pets': {
    icon: '🐾',
    desc: 'Pet details for safety and comfort planning',
    fields: [
      {id:'cat-pet-type',   label:'Animal type', type:'select', options:['Dog','Cat','Small animal (rabbit, bird, etc.)','Multiple animals'], req:true},
      {id:'cat-pet-breed',  label:'Breed', type:'text', placeholder:'e.g. Labrador, Persian cat'},
      {id:'cat-pet-count',  label:'Number of animals', type:'tel', placeholder:'e.g. 1', req:true},
      {id:'cat-pet-weight', label:'Animal weight (kg)', type:'tel', placeholder:'e.g. 25'},
      {id:'cat-pet-crate',  label:'Crate / carrier available?', type:'select', options:['Yes','No – please provide']},
      {id:'cat-pet-docs',   label:'Vet documentation ready?', type:'select', options:['Yes','No – need assistance']},
    ]
  },
  'Other': {
    icon: '📋',
    desc: 'Describe your item so we can find the right solution',
    fields: [
      {id:'cat-oth-desc',   label:'Item description', type:'textarea', placeholder:'Describe what you need transported in detail', req:true},
      {id:'cat-oth-weight', label:'Estimated weight (kg)', type:'tel', placeholder:'e.g. 50'},
      {id:'cat-oth-dims',   label:'Dimensions (cm)', type:'text', placeholder:'L×W×H, e.g. 200×80×100'},
      {id:'cat-oth-special',label:'Special requirements', type:'text', placeholder:'e.g. fragile, temperature sensitive, crane needed'},
    ]
  }
};

function shipRenderCatFields(cat){
  var cfg = catFields[cat];
  var panel = document.getElementById('ship-cat-details');
  var inner = document.getElementById('ship-cat-details-inner');
  if(!cfg){ panel.style.display='none'; return; }

  var header = '<div class="cat-detail-header">'
    + '<span style="font-size:22px;">' + cfg.icon + '</span>'
    + '<div><h3>' + cat + ' details</h3><p>' + cfg.desc + '</p></div>'
    + '</div>';

  var grid = '<div class="cat-detail-grid">';
  cfg.fields.forEach(function(f){
    var req = f.req ? '<span class="req">*</span>' : '';
    grid += '<div class="cat-detail-block"><div class="cat-detail-label">' + f.label + ' ' + req + '</div>';
    if(f.type === 'select'){
      grid += '<div class="field"><select id="' + f.id + '">';
      (f.options||[]).forEach(function(o){ grid += '<option>' + o + '</option>'; });
      grid += '</select></div>';
    } else if(f.type === 'tel'){
      grid += '<div class="field"><input id="' + f.id + '" type="text" inputmode="numeric" placeholder="' + (f.placeholder||'') + '" style="width:100%;"></div>';
    } else if(f.type === 'textarea'){
      grid += '<div class="field"><textarea id="' + f.id + '" rows="3" placeholder="' + (f.placeholder||'') + '"></textarea></div>';
    } else {
      grid += '<div class="field"><input id="' + f.id + '" type="' + f.type + '" placeholder="' + (f.placeholder||'') + '"></div>';
    }
    grid += '</div>';
  });
  grid += '</div>';

  inner.innerHTML = header + grid;
  panel.style.display = 'block';
  panel.scrollIntoView({behavior:'smooth', block:'start'});
}

window.shipOpenForm = function(){
  var wrap = document.getElementById('ship-form-wrap');
  if(wrap){
    wrap.style.display = 'block';
    document.getElementById('ship-step-1').style.display = 'block';
    document.getElementById('ship-step-2').style.display = 'none';
    wrap.scrollIntoView({behavior:'smooth', block:'start'});
    shipInitMap();
    setTimeout(function(){ if(shipMap) shipMap.invalidateSize(); }, 80);
  }
};

  window.shipPickCat = function(el){
    document.querySelectorAll('.ship-row').forEach(function(c){ c.classList.remove('active'); });
    el.classList.add('active');
    shipSelectedCat = el.dataset.cat;
    shipSelectedMult = parseFloat(el.dataset.mult) || 1.0;
    shipRenderCatFields(shipSelectedCat);
    var badge = document.getElementById('ship-selected-badge');
    if(badge) badge.textContent = shipSelectedCat;
    var wrap = document.getElementById('ship-form-wrap');
    if(wrap){ wrap.style.display = 'none'; }
    document.getElementById('ship-success') && (document.getElementById('ship-success').style.display = 'none');
  };

  window.shipGoStep2 = function(){
    var from = document.getElementById('sh-from-input').value.trim();
    var to = document.getElementById('sh-to-input').value.trim();
    if(!from || !to){ alert('Please enter both pickup and delivery addresses.'); return; }
    document.getElementById('ship-step-1').style.display = 'none';
    document.getElementById('ship-step-2').style.display = 'block';
    document.getElementById('ship-step-2').scrollIntoView({behavior:'smooth', block:'start'});
    shipSetProgress(3);
    setTimeout(function(){ if(window.sdpInit) window.sdpInit(); }, 100);
  };

  window.shipGoStep1 = function(){ shipSetProgress(1);
    document.getElementById('ship-step-2').style.display = 'none';
    document.getElementById('ship-step-1').style.display = 'block';
  };

  // Leaflet map
  var shipMap = null;
  var shipMarkerFrom = null;
  var shipMarkerTo = null;
  var shipRouteLine = null;
  var shipFromCoords = null;
  var shipToCoords = null;
  var shipGeoTimers = {};

  var shipPinMode = false;
  var shipPinNext = 'from'; // 'from' or 'to'

  window.shipSetMode = function(mode){
    document.getElementById('ship-mode-type').classList.toggle('active', mode === 'type');
    document.getElementById('ship-mode-pin').classList.toggle('active', mode === 'pin');
    var hint = document.getElementById('ship-pin-hint');
    var routeBox = document.getElementById('ship-route-box');
    var mapSide = document.querySelector('.ship-map-side');
    if(mode === 'pin'){
      shipPinMode = true;
      shipPinNext = shipFromCoords ? 'to' : 'from';
      hint.style.display = 'flex';
      routeBox.style.display = 'none';
      if(mapSide) mapSide.classList.add('pin-mode');
      shipUpdatePinHint();
    } else {
      shipPinMode = false;
      hint.style.display = 'none';
      routeBox.style.display = 'block';
      if(mapSide) mapSide.classList.remove('pin-mode');
    }
  };

  window.shipClearPin = function(which){
    if(which === 'from'){
      if(shipMarkerFrom){ shipMap.removeLayer(shipMarkerFrom); shipMarkerFrom = null; }
      shipFromCoords = null;
      var fi = document.getElementById('sh-from-input');
      if(fi) fi.value = '';
      var fromVal = document.getElementById('ship-pin-from-val');
      if(fromVal) fromVal.textContent = 'Click anywhere on the map';
      var fromChk = document.getElementById('ship-pin-from-check');
      if(fromChk) fromChk.style.display = 'none';
      var fromClr = document.getElementById('ship-pin-clear-from');
      if(fromClr) fromClr.style.display = 'none';
      var fromCard = document.getElementById('ship-pin-step-from');
      if(fromCard){ fromCard.classList.remove('done'); }
      shipPinNext = 'from';
    } else {
      if(shipMarkerTo){ shipMap.removeLayer(shipMarkerTo); shipMarkerTo = null; }
      shipToCoords = null;
      var ti = document.getElementById('sh-to-input');
      if(ti) ti.value = '';
      var toVal = document.getElementById('ship-pin-to-val');
      if(toVal) toVal.textContent = shipFromCoords ? 'Now click delivery on the map' : 'Set pickup first';
      var toChk = document.getElementById('ship-pin-to-check');
      if(toChk) toChk.style.display = 'none';
      var toClr = document.getElementById('ship-pin-clear-to');
      if(toClr) toClr.style.display = 'none';
      var toCard = document.getElementById('ship-pin-step-to');
      if(toCard){ toCard.classList.remove('done'); if(!shipFromCoords) toCard.classList.add('muted'); }
      shipPinNext = 'to';
    }
    if(shipRouteLine){ shipMap.removeLayer(shipRouteLine); shipRouteLine = null; }
    document.getElementById('ship-distance-box').style.display = 'none';
  };

  function shipUpdatePinHint(){
    var fromCard = document.getElementById('ship-pin-step-from');
    var toCard   = document.getElementById('ship-pin-step-to');
    var fromVal  = document.getElementById('ship-pin-from-val');
    var toVal    = document.getElementById('ship-pin-to-val');
    var fromChk  = document.getElementById('ship-pin-from-check');
    var toChk    = document.getElementById('ship-pin-to-check');
    var fromClr  = document.getElementById('ship-pin-clear-from');
    var toClr    = document.getElementById('ship-pin-clear-to');
    if(!fromCard) return;
    if(shipFromCoords){
      fromCard.classList.add('done'); fromCard.classList.remove('muted');
      if(fromChk) fromChk.style.display = 'flex';
      if(fromClr) fromClr.style.display = 'flex';
      if(toCard)  toCard.classList.remove('muted');
      if(toVal && !shipToCoords) toVal.textContent = 'Now click delivery on the map';
    }
    if(shipToCoords){
      toCard.classList.add('done'); toCard.classList.remove('muted');
      if(toChk) toChk.style.display = 'flex';
      if(toClr) toClr.style.display = 'flex';
    }
  }

  function shipReverseGeocode(lat, lon, which){
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(!data) return;
        var parts = data.display_name ? data.display_name.split(',') : [];
        var short = parts.slice(0,2).join(', ').trim();
        var inputId = which === 'from' ? 'sh-from-input' : 'sh-to-input';
        var subId   = which === 'from' ? 'ship-pin-from-val' : 'ship-pin-to-val';
        var el = document.getElementById(inputId);
        var sub = document.getElementById(subId);
        if(el) el.value = parts.slice(0,3).join(', ');
        if(sub) sub.textContent = short || 'Location set';
      });
  }

  function shipInitMap(){
    if(shipMap) return;
    shipMap = L.map('ship-leaflet-map', {zoomControl:true}).setView([52.37, 4.90], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(shipMap);

    shipMap.on('click', function(e){
      if(!shipPinMode) return;
      var lat = e.latlng.lat, lon = e.latlng.lng;
      var latlng = [lat, lon];
      shipGetIcons();
      if(shipPinNext === 'from'){
        shipFromCoords = latlng;
        if(shipMarkerFrom) shipMap.removeLayer(shipMarkerFrom);
        shipMarkerFrom = L.marker(latlng, {icon:iconFrom}).addTo(shipMap);
        shipMarkerFrom.bindPopup('<b>Pickup</b>').openPopup();
        shipReverseGeocode(lat, lon, 'from');
        shipPinNext = 'to';
      } else {
        shipToCoords = latlng;
        if(shipMarkerTo) shipMap.removeLayer(shipMarkerTo);
        shipMarkerTo = L.marker(latlng, {icon:iconTo}).addTo(shipMap);
        shipMarkerTo.bindPopup('<b>Delivery</b>').openPopup();
        shipReverseGeocode(lat, lon, 'to');
        shipPinNext = 'from';
      }
      shipUpdatePinHint();
      shipDrawRoute();
      // force show distance box when both pins set
      if(shipFromCoords && shipToCoords){
        document.getElementById('ship-distance-box').style.display = 'flex';
      }
    });
  }

  var iconFrom = null;
  var iconTo = null;

  function shipGetIcons(){
    if(!iconFrom){
      iconFrom = L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:50%;background:#2A7D4F;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      iconTo = L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:50%;background:#B03A2E;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
    }
  }

  function shipDrawRoute(){
    if(!shipMap) return;
    shipGetIcons();
    if(shipRouteLine){ shipMap.removeLayer(shipRouteLine); shipRouteLine=null; }
    if(shipFromCoords && shipToCoords){
      shipRouteLine = L.polyline([shipFromCoords, shipToCoords],{color:'#9C7C3F',weight:2.5,dashArray:'8 6',opacity:0.85}).addTo(shipMap);
      var bounds = L.latLngBounds([shipFromCoords, shipToCoords]);
      shipMap.fitBounds(bounds, {padding:[60,60]});
      // Calculate distance
      var R = 6371;
      var lat1 = shipFromCoords[0]*Math.PI/180, lat2 = shipToCoords[0]*Math.PI/180;
      var dLat = lat2-lat1, dLon = (shipToCoords[1]-shipFromCoords[1])*Math.PI/180;
      var a = Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
      var dist = Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
      document.getElementById('ship-distance-km').textContent = dist.toLocaleString() + ' km';
      document.getElementById('ship-distance-route').textContent = 'Straight-line distance';
      document.getElementById('ship-distance-box').style.display = 'flex';
    } else if(shipFromCoords){
      shipMap.setView(shipFromCoords, 10);
    } else if(shipToCoords){
      shipMap.setView(shipToCoords, 10);
    }
  }

  window.shipGeocode = function(which){
    var inputId = which === 'from' ? 'sh-from-input' : 'sh-to-input';
    var val = document.getElementById(inputId).value.trim();
    clearTimeout(shipGeoTimers[which]);
    if(val.length < 3) return;
    shipGeoTimers[which] = setTimeout(function(){
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(val) + '&limit=1')
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(!data || !data.length) return;
          var lat = parseFloat(data[0].lat);
          var lon = parseFloat(data[0].lon);
          var latlng = [lat, lon];
          if(which === 'from'){
            shipFromCoords = latlng;
            if(shipMarkerFrom) shipMap.removeLayer(shipMarkerFrom);
            shipMarkerFrom = L.marker(latlng, {icon: iconFrom || (shipGetIcons(), iconFrom)}).addTo(shipMap);
            shipMarkerFrom.bindPopup('<b>Pickup</b><br>' + data[0].display_name.split(',').slice(0,2).join(',')).openPopup();
          } else {
            shipToCoords = latlng;
            if(shipMarkerTo) shipMap.removeLayer(shipMarkerTo);
            shipMarkerTo = L.marker(latlng, {icon: iconTo || (shipGetIcons(), iconTo)}).addTo(shipMap);
            shipMarkerTo.bindPopup('<b>Delivery</b><br>' + data[0].display_name.split(',').slice(0,2).join(',')).openPopup();
          }
          shipDrawRoute();
        });
    }, 600);
  };

  // init map when shipping page is shown
  var _origShowPage = null;
  setTimeout(function(){
    var origClick = document.onclick;
    document.addEventListener('click', function(e){
      var el = e.target.closest('[data-page]');
      if(el && el.getAttribute('data-page') === 'shipping'){
        setTimeout(function(){
          shipInitMap();
          if(shipMap) shipMap.invalidateSize();
        }, 80);
      }
    });
  }, 200);

  function shipValidateField(id, errId){
    var el = document.getElementById(id);
    var parent = el ? (el.closest('.detail-field') || el.closest('.field')) : null;
    if(!parent) return true;
    var val = el.value.trim();
    if(!val){
      parent.classList.add('has-error');
      parent.classList.remove('ok');
      return false;
    } else {
      parent.classList.remove('has-error');
      parent.classList.add('ok');
      if(el.classList) el.classList.add('ok');
      return true;
    }
  }

  // Live clear on input
  setTimeout(function(){
    ['sh-sender','sh-phone','sh-recv','sh-date'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.addEventListener('input', function(){ shipValidateField(id); });
    });
  }, 300);

  window.shipSubmit = function(){
    var from = document.getElementById('sh-from-input').value.trim();
    var to = document.getElementById('sh-to-input').value.trim();
    var v1 = shipValidateField('sh-sender');
    var v2 = shipValidateField('sh-phone');
    var v3 = shipValidateField('sh-recv');
    var v4 = shipValidateField('sh-date');
    if(!from || !to){
      alert('Please go back and enter both pickup and delivery addresses.');
      return;
    }
    if(!shipSelectedCat){
      alert('Please select a shipment type.');
      return;
    }
    if(!v1 || !v2 || !v3 || !v4){ 
      // scroll to first error
      var firstErr = document.querySelector('.field.has-error');
      if(firstErr) firstErr.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
    var time = document.getElementById('sh-time').value;
    var date = document.getElementById('sh-date').value;
    document.getElementById('ship-success-detail').textContent = shipSelectedCat + ' from ' + from + ' to ' + to + ' on ' + date + ', ' + time + '. We will confirm within 1 business day.';
    document.getElementById('ship-success').style.display = 'block';
    document.getElementById('ship-success').scrollIntoView({behavior:'smooth'});
  };

  showPage('home');
})();

// ===== TRANSLATIONS =====
var i18n = {
  en: {
    nav_services:'Services', nav_sectors:'Sectors', nav_compliance:'Compliance', nav_shipping:'Shipping', nav_contact:'Contact',
    hero_eyebrow:'Workforce solutions for Dutch logistics',
    hero_h1_1:'The ', hero_h1_em:'people', hero_h1_2:' behind every shift.',
    hero_lede:"We're an Amstelveen-based staffing partner, right in the Amsterdam region, who finds, vets, and looks after the workforce that keeps Dutch warehouses moving.",
    cta_request:'Request workforce', cta_services:'See our services',
    home_why_h:'Why we exist',
    home_why_p:"Dutch logistics is the engine room of European trade — but the warehouses and depots that keep it running operate on a labor market that can't keep pace. Jeff Logistics closes that gap with a careful, people-first vetting process.",
    home_quote:'"We don\'t recruit for everyone. We recruit for the floor — and the people who keep it running."',
    home_explore_h:'Find what you need', home_explore_desc:'A quick map of the site — services, sectors, paperwork, and how to reach us.',
    card_services_h:'Services', card_services_p:'What we offer — warehouse personnel, support teams, and flexible cover.', card_services_go:'View services →',
    card_sectors_h:'Sectors', card_sectors_p:'Who we work with — warehouses, e-commerce, ports, and cold chain.', card_sectors_go:'View sectors →',
    card_compliance_h:'Compliance', card_compliance_p:'The paperwork that holds up — BV, SNA, and Wtta alignment.', card_compliance_go:'View compliance →',
    card_contact_h:'Contact', card_contact_p:"Tell us the shift you need covered — we'll get back within a day.", card_contact_go:'Get in touch →',
    services_h:'What we offer.', services_lede:'Three ways we put people on your floor, scaled to whatever the week needs.',
    s1_h:'On-demand warehouse personnel', s1_p:'Warehouse staffing for sorting, picking and packing operations.',
    s2_h:'Logistics support teams', s2_p:'Loading, unloading and inventory support tailored to your workflow.',
    s3_h:'Flexible operational support', s3_p:'Extra workforce for seasonal peaks and temporary logistics projects.',
    process_h:'From shift gap to staffed floor',
    p1_h:'Tell us the gap', p1_p:"Share your shift schedule and the skills you're short on — sorting, picking, loading, or cold chain handling.",
    p2_h:'We match & vet', p2_p:"People are sourced and checked against our standards for reliability, safety, and efficiency before they're offered.",
    p3_h:'One contact, ongoing', p3_p:'A dedicated account manager keeps the schedule current and the floor staffed — even as volume shifts.',
    cta_shift_h:'Need a shift covered this week?', cta_shift_p:"Tell us what you're short on — we'll come back with vetted people and a placement timeline.",
    sectors_h:'Built for the floor you run.', sectors_lede:'Four kinds of operations we know well — and staff accordingly.',
    why_h:'Not a generalist agency', why_desc:'Four reasons logistics operators choose to keep us on speed-dial.',
    why1_h:'Logistics only', why2_h:'Faster placement', why3_h:'One point of contact', why4_h:'Compliance-first',
    cta_sector_h:'Recognize your floor here?',
    compliance_h:'Paperwork that holds up.', compliance_lede:'The three checks enterprise clients ask for first — already in place.',
    stamp1_h:'Registered Dutch BV', stamp2_h:'SNA certification path', stamp3_h:'Wtta-aligned',
    cta_compliance_h:'Questions about our paperwork?',
    contact_h:"Let's talk about your floor.", contact_lede:"Tell us the shift you need covered. We'll come back with vetted people and a placement timeline.",
    shipping_h:'Ship anything, anywhere.', shipping_lede:'Select your shipment type, enter pickup and delivery — we handle the rest across Europe.',
    footer_tagline:'Workforce solutions for Dutch logistics, based in Amstelveen.'
  },
  nl: {
    nav_services:'Diensten', nav_sectors:'Sectoren', nav_compliance:'Compliance', nav_shipping:'Verzending', nav_contact:'Contact',
    hero_eyebrow:'Personeelsoplossingen voor de Nederlandse logistiek',
    hero_h1_1:'De ', hero_h1_em:'mensen', hero_h1_2:' achter elke dienst.',
    hero_lede:'Wij zijn een personeelspartner uit Amstelveen die de juiste mensen vindt, screent en begeleidt voor de Nederlandse logistiek — zodat uw magazijn blijft draaien.',
    cta_request:'Personeel aanvragen', cta_services:'Bekijk onze diensten',
    home_why_h:'Waarom wij bestaan',
    home_why_p:'De Nederlandse logistiek is de motor van de Europese handel. Jeff Logistics overbrugt het personeelstekort met een zorgvuldig, mensgericht selectieproces.',
    home_quote:'"Wij werven niet voor iedereen. Wij werven voor de werkvloer."',
    home_explore_h:'Vind wat u zoekt', home_explore_desc:'Een snel overzicht van de site — diensten, sectoren, papierwerk en contact.',
    card_services_h:'Diensten', card_services_p:'Wat wij bieden — magazijnpersoneel, ondersteuningsteams en flexibele inzet.', card_services_go:'Bekijk diensten →',
    card_sectors_h:'Sectoren', card_sectors_p:'Met wie wij werken — magazijnen, e-commerce, havens en koelketen.', card_sectors_go:'Bekijk sectoren →',
    card_compliance_h:'Compliance', card_compliance_p:'Het papierwerk dat standhoudt — BV, SNA en Wtta.', card_compliance_go:'Bekijk compliance →',
    card_contact_h:'Contact', card_contact_p:'Vertel ons welke dienst u nodig heeft — we reageren binnen een dag.', card_contact_go:'Neem contact op →',
    services_h:'Wat wij bieden.', services_lede:'Drie manieren waarop wij mensen op uw werkvloer plaatsen.',
    s1_h:'Magazijnpersoneel op aanvraag', s1_p:'Personeel voor sorteren, picken en inpakken.',
    s2_h:'Logistieke ondersteuningsteams', s2_p:'Laden, lossen en voorraadbeheer op maat.',
    s3_h:'Flexibele operationele ondersteuning', s3_p:'Extra personeel voor seizoenspieken en tijdelijke projecten.',
    process_h:'Van personeelstekort naar bezette werkvloer',
    p1_h:'Vertel ons het tekort', p1_p:'Deel uw dienstrooster en de vaardigheden die u mist.',
    p2_h:'Wij matchen en screenen', p2_p:'Mensen worden gezocht en gecontroleerd op betrouwbaarheid en veiligheid.',
    p3_h:'Één contact, doorlopend', p3_p:'Een vaste accountmanager houdt het rooster actueel.',
    cta_shift_h:'Heeft u deze week een dienst te vullen?', cta_shift_p:"Vertel ons wat u mist — we komen terug met gescreend personeel.",
    sectors_h:'Gebouwd voor uw werkvloer.', sectors_lede:'Vier soorten operaties die wij goed kennen.',
    why_h:'Geen generalist', why_desc:'Vier redenen waarom logistieke operators voor ons kiezen.',
    why1_h:'Alleen logistiek', why2_h:'Snellere plaatsing', why3_h:'Één aanspreekpunt', why4_h:'Compliance-eerste',
    cta_sector_h:'Herkent u uw werkvloer hier?',
    compliance_h:'Papierwerk dat standhoudt.', compliance_lede:'De drie checks die enterprise-klanten als eerste vragen.',
    stamp1_h:'Geregistreerde Nederlandse BV', stamp2_h:'SNA-certificeringspad', stamp3_h:'Wtta-conform',
    cta_compliance_h:'Vragen over ons papierwerk?',
    contact_h:'Laten we praten over uw werkvloer.', contact_lede:'Vertel ons welke dienst u nodig heeft. We komen terug met mensen en een plaatsingstijdlijn.',
    shipping_h:'Verzend alles, overal.', shipping_lede:'Kies uw zendingtype, voer ophaal- en bezorgadres in — wij regelen de rest.',
    footer_tagline:'Personeelsoplossingen voor de Nederlandse logistiek, gevestigd in Amstelveen.'
  },
  de: {
    nav_services:'Leistungen', nav_sectors:'Branchen', nav_compliance:'Compliance', nav_shipping:'Versand', nav_contact:'Kontakt',
    hero_eyebrow:'Personallösungen für die niederländische Logistik',
    hero_h1_1:'Die ', hero_h1_em:'Menschen', hero_h1_2:' hinter jeder Schicht.',
    hero_lede:'Wir sind ein Personalpartner aus Amstelveen, der die richtigen Mitarbeiter für die niederländische Logistik findet, prüft und betreut.',
    cta_request:'Personal anfordern', cta_services:'Unsere Leistungen',
    home_why_h:'Warum wir existieren',
    home_why_p:'Die niederländische Logistik ist die Triebkraft des europäischen Handels. Jeff Logistics schließt die Lücke mit einem sorgfältigen Auswahlprozess.',
    home_quote:'"Wir rekrutieren nicht für jeden. Wir rekrutieren für die Arbeitsfläche."',
    home_explore_h:'Finden Sie, was Sie brauchen', home_explore_desc:'Ein schneller Überblick über die Website.',
    card_services_h:'Leistungen', card_services_p:'Was wir anbieten — Lagerpersonal, Support-Teams und flexible Abdeckung.', card_services_go:'Leistungen ansehen →',
    card_sectors_h:'Branchen', card_sectors_p:'Mit wem wir arbeiten — Lager, E-Commerce, Häfen und Kühlkette.', card_sectors_go:'Branchen ansehen →',
    card_compliance_h:'Compliance', card_compliance_p:'Das Papierkram, der hält — BV, SNA und Wtta.', card_compliance_go:'Compliance ansehen →',
    card_contact_h:'Kontakt', card_contact_p:'Sagen Sie uns, welche Schicht Sie brauchen — wir melden uns innerhalb eines Tages.', card_contact_go:'Kontakt aufnehmen →',
    services_h:'Was wir anbieten.', services_lede:'Drei Wege, wie wir Menschen auf Ihre Arbeitsfläche bringen.',
    s1_h:'Lagerpersonal auf Abruf', s1_p:'Personalbesetzung für Sortier-, Pick- und Packoperationen.',
    s2_h:'Logistik-Supportteams', s2_p:'Lade-, Entlade- und Lagerunterstützung nach Maß.',
    s3_h:'Flexible operative Unterstützung', s3_p:'Zusätzliches Personal für Saisonspitzen und temporäre Projekte.',
    process_h:'Von der Personallücke zur besetzten Arbeitsfläche',
    p1_h:'Sagen Sie uns die Lücke', p1_p:'Teilen Sie Ihren Schichtplan und die fehlenden Fähigkeiten mit.',
    p2_h:'Wir matchen & prüfen', p2_p:'Menschen werden gesucht und auf Zuverlässigkeit geprüft.',
    p3_h:'Ein Kontakt, fortlaufend', p3_p:'Ein dedizierter Account-Manager hält den Zeitplan aktuell.',
    cta_shift_h:'Müssen Sie diese Woche eine Schicht besetzen?', cta_shift_p:'Sagen Sie uns, was fehlt — wir kommen mit geprüftem Personal zurück.',
    sectors_h:'Für Ihre Arbeitsfläche gebaut.', sectors_lede:'Vier Betriebsarten, die wir gut kennen.',
    why_h:'Kein Generalist', why_desc:'Vier Gründe, warum Logistikbetreiber uns wählen.',
    why1_h:'Nur Logistik', why2_h:'Schnellere Vermittlung', why3_h:'Ein Ansprechpartner', why4_h:'Compliance zuerst',
    cta_sector_h:'Erkennen Sie Ihre Arbeitsfläche hier?',
    compliance_h:'Papierkram, der hält.', compliance_lede:'Die drei Checks, die Enterprise-Kunden zuerst fragen.',
    stamp1_h:'Eingetragene niederländische BV', stamp2_h:'SNA-Zertifizierungspfad', stamp3_h:'Wtta-konform',
    cta_compliance_h:'Fragen zu unserem Papierkram?',
    contact_h:"Reden wir über Ihre Arbeitsfläche.", contact_lede:'Sagen Sie uns, welche Schicht Sie brauchen. Wir kommen mit Personal und einem Vermittlungszeitplan zurück.',
    shipping_h:'Versenden Sie alles, überall.', shipping_lede:'Wählen Sie Ihren Sendungstyp, geben Sie Abhol- und Lieferadresse ein.',
    footer_tagline:'Personallösungen für die niederländische Logistik, mit Sitz in Amstelveen.'
  },
  fr: {
    nav_services:'Services', nav_sectors:'Secteurs', nav_compliance:'Conformité', nav_shipping:'Expédition', nav_contact:'Contact',
    hero_eyebrow:'Solutions RH pour la logistique néerlandaise',
    hero_h1_1:'Les ', hero_h1_em:'personnes', hero_h1_2:' derrière chaque shift.',
    hero_lede:"Nous sommes un partenaire RH basé à Amstelveen qui trouve, vérifie et accompagne les travailleurs pour la logistique néerlandaise.",
    cta_request:'Demander du personnel', cta_services:'Voir nos services',
    home_why_h:'Pourquoi nous existons',
    home_why_p:"La logistique néerlandaise est le moteur du commerce européen. Jeff Logistics comble le manque avec un processus de sélection rigoureux.",
    home_quote:'"Nous ne recrutons pas pour tout le monde. Nous recrutons pour le terrain."',
    home_explore_h:'Trouvez ce dont vous avez besoin', home_explore_desc:'Un aperçu rapide du site.',
    card_services_h:'Services', card_services_p:'Ce que nous offrons — personnel, équipes de support et couverture flexible.', card_services_go:'Voir les services →',
    card_sectors_h:'Secteurs', card_sectors_p:'Avec qui nous travaillons — entrepôts, e-commerce, ports et chaîne du froid.', card_sectors_go:'Voir les secteurs →',
    card_compliance_h:'Conformité', card_compliance_p:'La paperasse qui tient — BV, SNA et Wtta.', card_compliance_go:'Voir la conformité →',
    card_contact_h:'Contact', card_contact_p:"Dites-nous le shift dont vous avez besoin — nous répondons dans la journée.", card_contact_go:'Prendre contact →',
    services_h:'Ce que nous offrons.', services_lede:'Trois façons de mettre des personnes sur votre site.',
    s1_h:'Personnel entrepôt à la demande', s1_p:'Dotation en personnel pour le tri, le picking et le conditionnement.',
    s2_h:"Équipes de support logistique", s2_p:'Chargement, déchargement et gestion des stocks sur mesure.',
    s3_h:'Support opérationnel flexible', s3_p:'Personnel supplémentaire pour les pics saisonniers.',
    process_h:"Du manque de personnel au site pourvu",
    p1_h:'Dites-nous le manque', p1_p:'Partagez votre planning et les compétences manquantes.',
    p2_h:'Nous matchons & vérifions', p2_p:'Les personnes sont sourcées et vérifiées avant proposition.',
    p3_h:'Un contact, en continu', p3_p:'Un account manager dédié garde le planning à jour.',
    cta_shift_h:'Un shift à couvrir cette semaine?', cta_shift_p:"Dites-nous ce qui manque — nous revenons avec du personnel vérifié.",
    sectors_h:'Conçu pour votre terrain.', sectors_lede:'Quatre types d\'opérations que nous connaissons bien.',
    why_h:'Pas un généraliste', why_desc:'Quatre raisons pour lesquelles les opérateurs logistiques nous choisissent.',
    why1_h:'Logistique uniquement', why2_h:'Placement plus rapide', why3_h:'Un seul interlocuteur', why4_h:'Conformité en premier',
    cta_sector_h:'Reconnaissez-vous votre terrain ici?',
    compliance_h:'La paperasse qui tient.', compliance_lede:'Les trois vérifications que les clients enterprise demandent en premier.',
    stamp1_h:'BV néerlandaise enregistrée', stamp2_h:'Parcours de certification SNA', stamp3_h:'Conforme Wtta',
    cta_compliance_h:'Questions sur notre documentation?',
    contact_h:'Parlons de votre terrain.', contact_lede:"Dites-nous le shift dont vous avez besoin. Nous revenons avec du personnel et un calendrier.",
    shipping_h:'Expédiez tout, partout.', shipping_lede:'Choisissez votre type d\'envoi, entrez les adresses — nous nous occupons du reste.',
    footer_tagline:'Solutions RH pour la logistique néerlandaise, basées à Amstelveen.'
  },
  es: {
    nav_services:'Servicios', nav_sectors:'Sectores', nav_compliance:'Cumplimiento', nav_shipping:'Envíos', nav_contact:'Contacto',
    hero_eyebrow:'Soluciones de personal para la logística neerlandesa',
    hero_h1_1:'Las ', hero_h1_em:'personas', hero_h1_2:' detrás de cada turno.',
    hero_lede:'Somos un socio de personal con sede en Amstelveen que encuentra, verifica y cuida a los trabajadores para la logística neerlandesa.',
    cta_request:'Solicitar personal', cta_services:'Ver nuestros servicios',
    home_why_h:'Por qué existimos',
    home_why_p:'La logística neerlandesa es el motor del comercio europeo. Jeff Logistics cierra la brecha con un proceso de selección riguroso.',
    home_quote:'"No reclutamos para todos. Reclutamos para el suelo de trabajo."',
    home_explore_h:'Encuentra lo que necesitas', home_explore_desc:'Un mapa rápido del sitio.',
    card_services_h:'Servicios', card_services_p:'Lo que ofrecemos — personal de almacén, equipos de soporte y cobertura flexible.', card_services_go:'Ver servicios →',
    card_sectors_h:'Sectores', card_sectors_p:'Con quién trabajamos — almacenes, e-commerce, puertos y cadena de frío.', card_sectors_go:'Ver sectores →',
    card_compliance_h:'Cumplimiento', card_compliance_p:'El papeleo que aguanta — BV, SNA y Wtta.', card_compliance_go:'Ver cumplimiento →',
    card_contact_h:'Contacto', card_contact_p:'Díganos el turno que necesita — respondemos en un día.', card_contact_go:'Ponerse en contacto →',
    services_h:'Lo que ofrecemos.', services_lede:'Tres formas de poner personas en su planta.',
    s1_h:'Personal de almacén bajo demanda', s1_p:'Personal para clasificación, picking y embalaje.',
    s2_h:'Equipos de apoyo logístico', s2_p:'Carga, descarga y soporte de inventario a medida.',
    s3_h:'Soporte operativo flexible', s3_p:'Personal extra para picos estacionales y proyectos temporales.',
    process_h:'De la brecha de personal a la planta cubierta',
    p1_h:'Díganos la brecha', p1_p:'Comparta su horario de turnos y las habilidades que le faltan.',
    p2_h:'Emparejamos y verificamos', p2_p:'Las personas son seleccionadas y verificadas antes de ser ofrecidas.',
    p3_h:'Un contacto, continuo', p3_p:'Un gestor de cuentas dedicado mantiene el horario actualizado.',
    cta_shift_h:'¿Necesita cubrir un turno esta semana?', cta_shift_p:'Díganos qué le falta — volvemos con personal verificado.',
    sectors_h:'Construido para su planta.', sectors_lede:'Cuatro tipos de operaciones que conocemos bien.',
    why_h:'No somos generalistas', why_desc:'Cuatro razones por las que los operadores logísticos nos eligen.',
    why1_h:'Solo logística', why2_h:'Colocación más rápida', why3_h:'Un solo punto de contacto', why4_h:'Cumplimiento primero',
    cta_sector_h:'¿Reconoce su planta aquí?',
    compliance_h:'Papeleo que aguanta.', compliance_lede:'Las tres comprobaciones que los clientes empresariales solicitan primero.',
    stamp1_h:'BV neerlandesa registrada', stamp2_h:'Ruta de certificación SNA', stamp3_h:'Conforme con Wtta',
    cta_compliance_h:'¿Preguntas sobre nuestra documentación?',
    contact_h:'Hablemos de su planta.', contact_lede:'Díganos el turno que necesita. Volvemos con personal y un calendario.',
    shipping_h:'Envíe cualquier cosa, a cualquier lugar.', shipping_lede:'Seleccione el tipo de envío, ingrese las direcciones — nosotros nos encargamos del resto.',
    footer_tagline:'Soluciones de personal para la logística neerlandesa, con sede en Amstelveen.'
  },
  it: {
    nav_services:'Servizi', nav_sectors:'Settori', nav_compliance:'Conformità', nav_shipping:'Spedizione', nav_contact:'Contatto',
    hero_eyebrow:'Soluzioni per il personale logistico olandese',
    hero_h1_1:'Le ', hero_h1_em:'persone', hero_h1_2:' dietro ogni turno.',
    hero_lede:"Siamo un partner per il personale con sede ad Amstelveen che trova, valuta e si prende cura dei lavoratori per la logistica olandese.",
    cta_request:'Richiedi personale', cta_services:'Vedi i nostri servizi',
    home_why_h:'Perché esistiamo',
    home_why_p:"La logistica olandese è il motore del commercio europeo. Jeff Logistics colma il divario con un processo di selezione attento.",
    home_quote:'"Non reclutamo per tutti. Reclutamo per il pavimento di lavoro."',
    home_explore_h:'Trova quello di cui hai bisogno', home_explore_desc:'Una mappa rapida del sito.',
    card_services_h:'Servizi', card_services_p:'Cosa offriamo — personale di magazzino, team di supporto e copertura flessibile.', card_services_go:'Vedi servizi →',
    card_sectors_h:'Settori', card_sectors_p:'Con chi lavoriamo — magazzini, e-commerce, porti e catena del freddo.', card_sectors_go:'Vedi settori →',
    card_compliance_h:'Conformità', card_compliance_p:'La documentazione che regge — BV, SNA e Wtta.', card_compliance_go:'Vedi conformità →',
    card_contact_h:'Contatto', card_contact_p:'Dicci il turno di cui hai bisogno — rispondiamo entro un giorno.', card_contact_go:'Mettiti in contatto →',
    services_h:'Cosa offriamo.', services_lede:'Tre modi per mettere persone sul tuo pavimento.',
    s1_h:'Personale di magazzino su richiesta', s1_p:'Personale per smistamento, picking e confezionamento.',
    s2_h:'Team di supporto logistico', s2_p:'Carico, scarico e supporto inventario su misura.',
    s3_h:'Supporto operativo flessibile', s3_p:'Personale extra per picchi stagionali e progetti temporanei.',
    process_h:'Dal gap di personale al pavimento coperto',
    p1_h:'Dicci il gap', p1_p:"Condividi il tuo programma di turni e le competenze che ti mancano.",
    p2_h:'Abbiniamo e verifichiamo', p2_p:'Le persone vengono selezionate e verificate prima di essere proposte.',
    p3_h:'Un contatto, continuativo', p3_p:'Un account manager dedicato mantiene il programma aggiornato.',
    cta_shift_h:'Hai un turno da coprire questa settimana?', cta_shift_p:'Dicci cosa manca — torniamo con personale verificato.',
    sectors_h:'Costruito per il tuo pavimento.', sectors_lede:'Quattro tipi di operazioni che conosciamo bene.',
    why_h:'Non siamo generalisti', why_desc:'Quattro motivi per cui gli operatori logistici ci scelgono.',
    why1_h:'Solo logistica', why2_h:'Collocamento più rapido', why3_h:'Un solo punto di contatto', why4_h:'Conformità prima di tutto',
    cta_sector_h:'Riconosci il tuo pavimento qui?',
    compliance_h:'Documentazione che regge.', compliance_lede:'I tre controlli che i clienti enterprise chiedono per primi.',
    stamp1_h:'BV olandese registrata', stamp2_h:'Percorso di certificazione SNA', stamp3_h:'Conforme a Wtta',
    cta_compliance_h:'Domande sulla nostra documentazione?',
    contact_h:'Parliamo del tuo pavimento.', contact_lede:'Dicci il turno di cui hai bisogno. Torniamo con personale e una timeline.',
    shipping_h:'Spedisci qualsiasi cosa, ovunque.', shipping_lede:'Seleziona il tipo di spedizione, inserisci gli indirizzi — pensiamo noi al resto.',
    footer_tagline:'Soluzioni per il personale logistico olandese, con sede ad Amstelveen.'
  },
  pl: {
    nav_services:'Usługi', nav_sectors:'Sektory', nav_compliance:'Zgodność', nav_shipping:'Wysyłka', nav_contact:'Kontakt',
    hero_eyebrow:'Rozwiązania kadrowe dla holenderskiej logistyki',
    hero_h1_1:'Ludzie ', hero_h1_em:'za każdą zmianą', hero_h1_2:'.',
    hero_lede:'Jesteśmy partnerem kadrowym z Amstelveen, który znajduje, weryfikuje i dba o pracowników dla holenderskiej logistyki.',
    cta_request:'Poproś o pracowników', cta_services:'Zobacz nasze usługi',
    home_why_h:'Dlaczego istniejemy',
    home_why_p:'Holenderska logistyka jest silnikiem europejskiego handlu. Jeff Logistics wypełnia lukę dzięki starannemu procesowi rekrutacji.',
    home_quote:'"Nie rekrutujemy dla wszystkich. Rekrutujemy dla hali produkcyjnej."',
    home_explore_h:'Znajdź to, czego szukasz', home_explore_desc:'Szybka mapa strony.',
    card_services_h:'Usługi', card_services_p:'Co oferujemy — personel magazynowy, zespoły wsparcia i elastyczne pokrycie.', card_services_go:'Zobacz usługi →',
    card_sectors_h:'Sektory', card_sectors_p:'Z kim pracujemy — magazyny, e-commerce, porty i łańcuch chłodniczy.', card_sectors_go:'Zobacz sektory →',
    card_compliance_h:'Zgodność', card_compliance_p:'Dokumentacja, która wytrzymuje — BV, SNA i Wtta.', card_compliance_go:'Zobacz zgodność →',
    card_contact_h:'Kontakt', card_contact_p:'Powiedz nam, jaką zmianę potrzebujesz obsadzić — odpiszemy w ciągu dnia.', card_contact_go:'Skontaktuj się →',
    services_h:'Co oferujemy.', services_lede:'Trzy sposoby na obsadzenie Twojego magazynu.',
    s1_h:'Personel magazynowy na żądanie', s1_p:'Obsada do sortowania, kompletowania i pakowania.',
    s2_h:'Zespoły wsparcia logistycznego', s2_p:'Załadunek, rozładunek i wsparcie inwentaryzacyjne na miarę.',
    s3_h:'Elastyczne wsparcie operacyjne', s3_p:'Dodatkowy personel na szczyty sezonowe i projekty tymczasowe.',
    process_h:'Od luki kadrowej do obsadzonej hali',
    p1_h:'Powiedz nam o luce', p1_p:'Podziel się harmonogramem zmian i brakującymi umiejętnościami.',
    p2_h:'Dobieramy i weryfikujemy', p2_p:'Pracownicy są pozyskiwani i sprawdzani przed zaproponowaniem.',
    p3_h:'Jeden kontakt, stale', p3_p:'Dedykowany opiekun konta utrzymuje harmonogram na bieżąco.',
    cta_shift_h:'Musisz obsadzić zmianę w tym tygodniu?', cta_shift_p:'Powiedz nam, czego brakuje — wrócimy ze zweryfikowanym personelem.',
    sectors_h:'Zbudowane dla Twojej hali.', sectors_lede:'Cztery typy operacji, które znamy dobrze.',
    why_h:'Nie jesteśmy generalistami', why_desc:'Cztery powody, dla których operatorzy logistyczni nas wybierają.',
    why1_h:'Tylko logistyka', why2_h:'Szybsze umieszczenie', why3_h:'Jeden punkt kontaktu', why4_h:'Zgodność przede wszystkim',
    cta_sector_h:'Rozpoznajesz swoją halę tutaj?',
    compliance_h:'Dokumentacja, która wytrzymuje.', compliance_lede:'Trzy kontrole, o które klienci enterprise pytają jako pierwsze.',
    stamp1_h:'Zarejestrowana holenderska BV', stamp2_h:'Ścieżka certyfikacji SNA', stamp3_h:'Zgodny z Wtta',
    cta_compliance_h:'Pytania dotyczące naszej dokumentacji?',
    contact_h:'Porozmawiajmy o Twojej hali.', contact_lede:'Powiedz nam, jaką zmianę potrzebujesz. Wrócimy z personelem i harmonogramem.',
    shipping_h:'Wyślij cokolwiek, gdziekolwiek.', shipping_lede:'Wybierz rodzaj przesyłki, podaj adresy — resztą zajmiemy się my.',
    footer_tagline:'Rozwiązania kadrowe dla holenderskiej logistyki, z siedzibą w Amstelveen.'
  }
};

var langFlags = {en:'🇬🇧',nl:'🇳🇱',de:'🇩🇪',fr:'🇫🇷',es:'🇪🇸',it:'🇮🇹',pl:'🇵🇱'};
var currentLang = 'en';

function langApplyTranslations(lang){
  var t = i18n[lang] || i18n['en'];
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key = el.getAttribute('data-i18n');
    if(t[key] !== undefined) el.textContent = t[key];
  });
  // update switcher display
  var flag = langFlags[lang] || '🌐';
  var code = lang.toUpperCase();
  var fc = document.getElementById('lang-flag-current');
  var cc = document.getElementById('lang-code-current');
  if(fc) fc.textContent = flag;
  if(cc) cc.textContent = code;
  currentLang = lang;
  localStorage.setItem('jeff_lang', lang);
  document.documentElement.lang = lang;
}

window.langApply = function(lang, flag){
  langApplyTranslations(lang);
  var menu = document.getElementById('lang-switch-menu');
  if(menu) menu.style.display = 'none';
};

window.langToggleMenu = function(){
  var menu = document.getElementById('lang-switch-menu');
  if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

// Close menu on outside click
document.addEventListener('click', function(e){
  if(!e.target.closest('#lang-switcher')){
    var menu = document.getElementById('lang-switch-menu');
    if(menu) menu.style.display = 'none';
  }
});

window.langSelect = function(btn){
  document.querySelectorAll('.lang-country-btn').forEach(function(b){ b.classList.remove('selected'); });
  btn.classList.add('selected');
  var lang = btn.dataset.lang || 'en';
  // small delay for visual feedback
  setTimeout(function(){
    var overlay = document.getElementById('lang-overlay');
    if(overlay) overlay.style.display = 'none';
    var sw = document.getElementById('lang-switcher');
    var slot = document.getElementById('lang-nav-slot');
    if(sw && slot){ slot.appendChild(sw); sw.style.display = 'flex'; }
    langApplyTranslations(lang);
  }, 180);
};

// On load — check localStorage
(function(){
  var saved = localStorage.getItem('jeff_lang');
  if(saved && i18n[saved]){
    var overlay = document.getElementById('lang-overlay');
    if(overlay) overlay.style.display = 'none';
    var sw = document.getElementById('lang-switcher');
    var slot = document.getElementById('lang-nav-slot');
    if(sw && slot){ slot.appendChild(sw); sw.style.display = 'flex'; }
    langApplyTranslations(saved);
  }
})();


// ===== COOKIE BANNER =====
(function(){
  if(!localStorage.getItem('jeff_cookie')){
    setTimeout(function(){
      var b = document.getElementById('cookie-banner');
      if(b) b.style.display = 'block';
    }, 1200);
  }
})();

window.cookieAccept = function(){
  localStorage.setItem('jeff_cookie','accepted');
  var b = document.getElementById('cookie-banner');
  if(b) b.style.display = 'none';
};
window.cookieDecline = function(){
  localStorage.setItem('jeff_cookie','declined');
  var b = document.getElementById('cookie-banner');
  if(b) b.style.display = 'none';
};

// ===== PROGRESS BAR =====
window.shipSetProgress = function(step){
  var fill = document.getElementById('ship-progress-fill');
  if(!fill) return;
  var pct = {1:33, 2:66, 3:100};
  fill.style.width = (pct[step] || 33) + '%';
};

// ===== LOADING SCREEN =====
(function(){
  var prog = document.getElementById('loader-progress');
  var loader = document.getElementById('site-loader');
  if(!loader) return;
  // Animate progress bar
  var w = 0;
  var iv = setInterval(function(){
    w += Math.random() * 18 + 8;
    if(w >= 90){ w = 90; clearInterval(iv); }
    if(prog) prog.style.width = w + '%';
  }, 80);
  // Hide when page is ready
  function hideLoader(){
    if(prog) prog.style.width = '100%';
    clearInterval(iv);
    setTimeout(function(){
      loader.style.transition = 'opacity 0.5s ease';
      loader.style.opacity = '0';
      setTimeout(function(){ loader.style.display = 'none'; }, 500);
    }, 200);
  }
  if(document.readyState === 'complete'){
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
    // Fallback — hide after 3s max
    setTimeout(hideLoader, 3000);
  }
})();

// ===== SEARCH =====
var searchIndex = [
  {page:'home',       title:'Home',                        desc:'Amstelveen-based staffing partner for Dutch logistics'},
  {page:'services',   title:'On-demand warehouse personnel',desc:'Sorting, picking and packing staffing'},
  {page:'services',   title:'Logistics support teams',     desc:'Loading, unloading and inventory support'},
  {page:'services',   title:'Flexible operational support',desc:'Seasonal peaks and temporary projects'},
  {page:'sectors',    title:'E-commerce & fulfilment',     desc:'Pick & pack, last-mile, returns handling'},
  {page:'sectors',    title:'Port & freight forwarding',   desc:'Container handling, customs, drayage'},
  {page:'sectors',    title:'Cold chain & food logistics', desc:'Temperature-controlled warehousing'},
  {page:'sectors',    title:'General warehousing',         desc:'B2B distribution and warehouse operations'},
  {page:'compliance', title:'Registered Dutch BV',         desc:'Legally compliant employer of record'},
  {page:'compliance', title:'SNA certification',           desc:'NEN 4400-1 inspection ready'},
  {page:'compliance', title:'Wtta-aligned',                desc:'Wage and tax administration compliance'},
  {page:'shipping',   title:'Ship furniture',              desc:'Sofas, beds, wardrobes, assembly available'},
  {page:'shipping',   title:'Ship cars',                   desc:'Passenger cars, flatbed or enclosed trailer'},
  {page:'shipping',   title:'Ship pallets',                desc:'Euro & standard pallets, tail-lift trucks'},
  {page:'shipping',   title:'Ship parcels',                desc:'Boxes up to 30 kg, same-day or next-day'},
  {page:'shipping',   title:'Full truckloads',             desc:'20–90 m³ bulk freight across Europe'},
  {page:'shipping',   title:'Vehicles & machinery',        desc:'Forklifts, excavators, generators'},
  {page:'shipping',   title:'Motorcycles & scooters',      desc:'Bikes, mopeds, e-scooters, quads'},
  {page:'shipping',   title:'Home & office removals',      desc:'Full relocation, studio to 5-bedroom'},
  {page:'shipping',   title:'Pet transport',               desc:'Climate-controlled, stress-free'},
  {page:'contact',    title:'Contact Jeff Logistics',      desc:'Request workforce or get a shipping quote'},
];

var pageIcons = {
  home:      '<path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/><path d="M9 21V12h6v9"/>',
  services:  '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  sectors:   '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
  compliance:'<path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  shipping:  '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  contact:   '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.68 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/>',
};

var activeSearchIdx = -1;

window.searchOpen = function(){
  var overlay = document.getElementById('search-overlay');
  if(overlay) overlay.style.display = 'flex';
  setTimeout(function(){
    var inp = document.getElementById('search-input');
    if(inp) inp.focus();
  }, 80);
};

window.searchClose = function(){
  var overlay = document.getElementById('search-overlay');
  if(overlay) overlay.style.display = 'none';
  var inp = document.getElementById('search-input');
  if(inp) inp.value = '';
  var res = document.getElementById('search-results');
  if(res) res.innerHTML = '<p class="search-hint">Type to search across the site…</p>';
  activeSearchIdx = -1;
};

window.searchQuery = function(q){
  q = (q||'').trim().toLowerCase();
  var res = document.getElementById('search-results');
  if(!res) return;
  if(!q){ res.innerHTML = '<p class="search-hint">Type to search across the site…</p>'; return; }
  var matches = searchIndex.filter(function(item){
    return (item.title + ' ' + item.desc + ' ' + item.page).toLowerCase().indexOf(q) !== -1;
  }).slice(0, 7);
  if(!matches.length){
    res.innerHTML = '<div class="search-empty">No results for "<strong>' + q + '</strong>"</div>';
    return;
  }
  res.innerHTML = matches.map(function(m, i){
    var icon = pageIcons[m.page] || '';
    return '<div class="search-result-item" onclick="searchGo(\'' + m.page + '\')">'
      + '<div class="search-result-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></div>'
      + '<div class="search-result-body">'
      + '<div class="search-result-page">' + m.page + '</div>'
      + '<div class="search-result-title">' + m.title + '</div>'
      + '<div class="search-result-desc">' + m.desc + '</div>'
      + '</div></div>';
  }).join('') + '<div class="search-result-kbd"><kbd>↑</kbd><kbd>↓</kbd> navigate &nbsp;·&nbsp; <kbd>↵</kbd> open &nbsp;·&nbsp; <kbd>Esc</kbd> close</div>';
  activeSearchIdx = -1;
};

window.searchKeydown = function(e){
  var items = document.querySelectorAll('.search-result-item');
  if(e.key === 'Escape'){ searchClose(); return; }
  if(e.key === 'ArrowDown'){ e.preventDefault(); activeSearchIdx = Math.min(activeSearchIdx + 1, items.length - 1); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); activeSearchIdx = Math.max(activeSearchIdx - 1, 0); }
  else if(e.key === 'Enter' && activeSearchIdx >= 0){ searchGo(items[activeSearchIdx].dataset.page || items[activeSearchIdx].getAttribute('onclick').match(/'([^']+)'/)[1]); return; }
  items.forEach(function(el, i){ el.classList.toggle('active', i === activeSearchIdx); });
};

window.searchGo = function(page){
  searchClose();
  var el = document.querySelector('.nav-links a[data-page="' + page + '"]');
  if(el) el.click();
  else document.dispatchEvent(new CustomEvent('navigate', {detail: page}));
};

// Close search on backdrop click
(function(){
  var overlay = document.getElementById('search-overlay');
  if(overlay) overlay.addEventListener('click', function(e){
    if(e.target === overlay) searchClose();
  });
})();

// Keyboard shortcut Cmd/Ctrl+K
document.addEventListener('keydown', function(e){
  if((e.metaKey || e.ctrlKey) && e.key === 'k'){
    e.preventDefault();
    searchOpen();
  }
});

// ===== SIMPLE DATE PICKER =====
(function(){
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var dows   = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  var sdpYear, sdpMonth, sdpSelected;

  function sdpRender(){
    var el = document.getElementById('simple-datepicker');
    if(!el) return;
    var now = new Date(); now.setHours(0,0,0,0);
    var tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
    var firstDay = new Date(sdpYear, sdpMonth, 1);
    var lastDay  = new Date(sdpYear, sdpMonth+1, 0);
    var startDow = (firstDay.getDay()+6)%7;

    var html = '<div class="sdp-month-nav">'
      + '<button onclick="sdpPrev()" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px;"><path d="m15 18-6-6 6-6"/></svg></button>'
      + '<span class="sdp-month-label">' + months[sdpMonth] + ' ' + sdpYear + '</span>'
      + '<button onclick="sdpNext()" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px;"><path d="m9 18 6-6-6-6"/></svg></button>'
      + '</div><div class="sdp-grid">';

    dows.forEach(function(d){ html += '<div class="sdp-dow">'+d+'</div>'; });
    for(var i=0;i<startDow;i++) html += '<div class="sdp-empty"></div>';
    for(var d=1; d<=lastDay.getDate(); d++){
      var date = new Date(sdpYear, sdpMonth, d);
      var dow = date.getDay();
      var disabled = date < tomorrow || dow===0 || dow===6;
      var isToday  = date.toDateString() === now.toDateString();
      var dateStr  = sdpYear+'-'+String(sdpMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      var isSel    = sdpSelected === dateStr;
      var cls = 'sdp-day'+(disabled?' sdp-disabled':'')+(isToday?' sdp-today':'')+(isSel?' sdp-selected':'');
      html += '<div class="'+cls+'"'+(disabled?'':' onclick="sdpPick(\''+dateStr+'\')">'+d+'</div>');
      if(!disabled) html = html.slice(0,-('</div>'.length))+''; // already closed above
      // fix: just build cleanly
    }
    html += '</div>';

    // rebuild cleanly
    html = '<div class="sdp-month-nav">'
      + '<button onclick="sdpPrev()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px;"><path d="m15 18-6-6 6-6"/></svg></button>'
      + '<span class="sdp-month-label">' + months[sdpMonth] + ' ' + sdpYear + '</span>'
      + '<button onclick="sdpNext()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px;"><path d="m9 18 6-6-6-6"/></svg></button>'
      + '</div><div class="sdp-grid">';
    dows.forEach(function(d){ html += '<div class="sdp-dow">'+d+'</div>'; });
    for(var i=0; i<startDow; i++) html += '<div class="sdp-empty"></div>';
    for(var day=1; day<=lastDay.getDate(); day++){
      var dt  = new Date(sdpYear, sdpMonth, day);
      var dow = dt.getDay();
      var dis = dt < tomorrow || dow===0 || dow===6;
      var ds  = sdpYear+'-'+String(sdpMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      var sel = sdpSelected === ds;
      var tod = dt.toDateString() === now.toDateString();
      var cls = 'sdp-day'+(dis?' sdp-disabled':'')+(tod?' sdp-today':'')+(sel?' sdp-selected':'');
      html += '<div class="'+cls+'"'+(dis?'':' onclick="sdpPick(\''+ds+'\')"')+'>'+day+'</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  window.sdpInit = function(){
    if(!sdpYear){ var n=new Date(); sdpYear=n.getFullYear(); sdpMonth=n.getMonth(); }
    sdpRender();
  };
  window.sdpPrev = function(){ sdpMonth--; if(sdpMonth<0){sdpMonth=11;sdpYear--;} sdpRender(); };
  window.sdpNext = function(){ sdpMonth++; if(sdpMonth>11){sdpMonth=0;sdpYear++;} sdpRender(); };
  window.sdpPick = function(ds){
    sdpSelected = ds;
    var inp = document.getElementById('sh-date');
    if(inp){ inp.value = ds; var f=inp.closest('.field')||inp.closest('.detail-field'); if(f) f.classList.remove('has-error'); }
    sdpRender();
  };
})();


// ===== JOBS FORM =====
window.jobsSubmit = function(){
  var name  = document.getElementById('job-name').value.trim();
  var email = document.getElementById('job-email').value.trim();
  var phone = document.getElementById('job-phone').value.trim();
  var role  = document.getElementById('job-role').value;
  if(!name || !email || !phone){
    alert('Please fill in your name, email, and phone number.');
    return;
  }
  var detail = document.getElementById('jobs-success-detail');
  detail.textContent = 'Thanks ' + name + '! We received your application' + (role ? ' for ' + role : '') + '. We will be in touch within 2 working days.';
  document.getElementById('jobs-success').style.display = 'block';
  document.getElementById('jobs-success').scrollIntoView({behavior:'smooth'});
};
