// Builds a Leaflet map for every section.gpx[data-tracks] made by the gpx
// shortcode. Loaded with defer after Leaflet and leaflet-gpx, so the DOM
// and the libraries are ready when this runs. Site settings (track colours,
// map layers) come from window.gpxConfig, set by partials/gpx-scripts.html.
(function () {
  if (typeof L === "undefined" || !L.GPX) return;

  var config = window.gpxConfig || {};
  var colors = config.colors || ["blue", "darkblue", "purple"];
  var layerDefs = config.layers || [];
  var iconBase = config.iconBase || "/gpx-shortcode/";

  document.querySelectorAll("section.gpx[data-tracks]").forEach(initMap);

  function initMap(container) {
    var urls = JSON.parse(container.dataset.tracks);
    var infos = buildInfoLists(container.querySelector("footer"), urls);
    var map = L.map(container.querySelector(".map"), { scrollWheelZoom: false });
    addFullscreenControl(map);

    layerDefs.forEach(function (def) {
      createLayer(def.url, def.attribution || "", def.minZoom || 1, def.maxZoom || 20,
        def.bounds, def.inverseBounds).addTo(map);
    });

    var control = L.control.layers(null, null).addTo(map);
    var bounds = null;
    urls.forEach(function (url, index) {
      addTrack(url, index);
    });

    // (Optional) markers are read from the DOM, e.g.
    // <span class="location" lat="23.50847" lon="120.80161" name="" link="">Alishan Transport Station</span>
    Array.from(document.getElementsByClassName("location")).forEach(addMarker);

    // Add a track to the map
    function addTrack(url, index) {
      new L.GPX(url, {
        gpx_options: {
          joinTrackSegments: false
        },
        async: true,
        marker_options: {
          startIconUrl: iconBase + "pin-icon-start.png",
          endIconUrl: iconBase + "pin-icon-end.png",
          shadowUrl: iconBase + "pin-shadow.png",
          // Half of leaflet-gpx defaults (icon 33x45, shadow 50x50)
          iconSize: [16.5, 22.5],
          iconAnchor: [8, 22.5],
          shadowSize: [25, 25],
          shadowAnchor: [8, 23.5]
        },
        // looping through all specified colours
        polyline_options: { color: colors[index % colors.length], distanceMarkers: false, smoothFactor: 1, opacity: 0.8, weight: 2 }
      }).on("loaded", function (e) {
        var gpx = e.target;
        if (bounds === null) {
          bounds = gpx.getBounds();
        } else {
          bounds.extend(gpx.getBounds());
        }
        map.fitBounds(bounds);
        control.addOverlay(gpx, gpx.get_name());
        addMetadata(gpx, infos[index]);
      }).addTo(map);
    }

    // Add a marker to the map
    function addMarker(link) {
      var lat = link.getAttribute("lat");
      var lon = link.getAttribute("lon");
      var name = link.getAttribute("name");
      var title = name ? name : link.textContent;
      var url = link.getAttribute("link");
      if (url) {
        title = "<a target=\"_blank\" href=\"" + url + "\">" + title + "</a>";
      }
      L.marker([lat, lon]).addTo(map).bindPopup(title).openPopup();
    }

    // Fill in a track's info list once the GPX file has loaded
    function addMetadata(gpx, info) {
      info.distance.textContent = "Lengde: " + (gpx.get_distance() / 1000).toFixed(2) + " km";
      var duration = gpx.get_moving_time();
      info.duration.textContent = (duration > 0) ? "Tid: " + gpx.get_duration_string(duration) : "";
      info.elevation.textContent = "Høydeforskjell: " + gpx.get_elevation_gain().toFixed(0) + " m, -" +
        gpx.get_elevation_loss().toFixed(0) + " m, sum:  " +
        (gpx.get_elevation_gain() - gpx.get_elevation_loss()).toFixed(0) + "  m";
    }
  }

  // One <ul class="info"> per track in the map's footer: colour swatch,
  // label (only with several tracks) and empty distance/duration/elevation
  // items that addMetadata fills in. Returns those items per track.
  function buildInfoLists(footer, urls) {
    return urls.map(function (url, index) {
      var ul = document.createElement("ul");
      ul.className = "info";
      var swatch = item(ul, "■");
      swatch.style.color = colors[index % colors.length];
      item(ul, urls.length > 1 ? "Track " + (index + 1) + ": " : "");
      var info = { distance: item(ul, ""), duration: item(ul, ""), elevation: item(ul, "") };
      footer.appendChild(ul);
      return info;
    });

    function item(ul, text) {
      var li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
      return li;
    }
  }

  // Create a map layer
  function createLayer(url, attribution, minZoom, maxZoom, bounds, inverseBounds) {
    var layer = L.tileLayer(url, { attribution: attribution, minZoom: minZoom, maxZoom: maxZoom });
    if (bounds != null) {
      // TODO For now, we only support LatLngBounds
      layer.options.bounds = new L.LatLngBounds(
        new L.LatLng(bounds[0], bounds[1]),
        new L.LatLng(bounds[2], bounds[3]));
    }
    if (inverseBounds != null) {
      layer.options.inverseBounds = new L.LatLngBounds(
        new L.LatLng(inverseBounds[0], inverseBounds[1]),
        new L.LatLng(inverseBounds[2], inverseBounds[3]));
    }
    return layer;
  }

  // Fullscreen toggle button. Uses the Fullscreen API where available and
  // falls back to a CSS "fill the window" mode (e.g. iPhone Safari).
  function addFullscreenControl(map) {
    var el = map.getContainer();
    var enterIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5z"/></svg>';
    var exitIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 3h2v7H3V8h5zm6 0h2v5h5v2h-7zM3 14h7v7H8v-5H3zm11 0h7v2h-5v5h-2z"/></svg>';
    var button;

    function nativeElement() {
      return document.fullscreenElement || document.webkitFullscreenElement;
    }
    function isFullscreen() {
      return nativeElement() === el || el.classList.contains("gpx-fullscreen-fallback");
    }
    function update() {
      var on = isFullscreen();
      el.classList.toggle("gpx-is-fullscreen", on);
      button.innerHTML = on ? exitIcon : enterIcon;
      button.title = on ? "Avslutt fullskjerm" : "Fullskjerm";
      button.setAttribute("aria-label", button.title);
      // Scroll-wheel zoom is handy in fullscreen, but annoying when scrolling the page
      if (on) { map.scrollWheelZoom.enable(); } else { map.scrollWheelZoom.disable(); }
      map.invalidateSize();
    }
    function toggle() {
      if (isFullscreen()) {
        if (nativeElement() === el) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          el.classList.remove("gpx-fullscreen-fallback");
          document.documentElement.classList.remove("gpx-no-scroll");
          update();
        }
      } else {
        var request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (request) {
          var p = request.call(el);
          if (p && p.catch) p.catch(fallback);
        } else {
          fallback();
        }
      }
    }
    function fallback() {
      el.classList.add("gpx-fullscreen-fallback");
      document.documentElement.classList.add("gpx-no-scroll");
      update();
    }

    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && el.classList.contains("gpx-fullscreen-fallback")) toggle();
    });

    var Control = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var div = L.DomUtil.create("div", "leaflet-bar leaflet-control gpx-fullscreen-control");
        button = L.DomUtil.create("a", "", div);
        button.href = "#";
        button.setAttribute("role", "button");
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(button, "click", function (e) {
          L.DomEvent.preventDefault(e);
          toggle();
        });
        update();
        return div;
      }
    });
    map.addControl(new Control());
  }
})();
