// === Azure Logic App endpoints & storage account ===
const RAA =
  "https://prod-17.francecentral.logic.azure.com/workflows/a6ec590b87304d599279ea833a22d654/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/mods?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=9sbFtK4YYaKK89WRevE1xOydgJhwRLy0IJ1L6RoRi2o";
const DIA1 =
  "https://prod-31.francecentral.logic.azure.com/workflows/83e57c75f2d8461ab15793e6c1da0aae/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/mods/";

  const DIA2 =
  "api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=VmOgTk5yUoZGFXw7rLhxT5VVWmLFtvAvBDShwxk0FOo";
const BLOB_ACCOUNT = "https://moddomedia.blob.core.windows.net";

// === jQuery handlers ===
$(document).ready(function () {
  $("#retImages").click(getImages);
});

// === Retrieve and render media list (grid + numbered video links) ===
function getImages() {
  const $list = $("#ImageList");
  $list
    .addClass("media-grid")
    .html('<div class="spinner-border" role="status"><span>Loading...</span></div>');

  $.ajax({
    url: RAA,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received:", data);
      if (!Array.isArray(data)) {
        $list.html("<p>No media found or invalid data format.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      $.each(data, function (_, val) {
        try {
          // Extract fields (case-insensitive) + unwrap base64 if needed
          let fileName = unwrapMaybeBase64(val.modName || val.ModName || "");
          let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
          let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
          let Author = unwrapMaybeBase64(val.author   || val.Author   || "");
          let id = unwrapMaybeBase64(val.id   || val.Id   || "");
          const contentType = val.contentType || val.ContentType || "";

          const fullUrl = buildBlobUrl(filePath);
          const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

          // Build a card for the grid
          if (isVideo) {
            videoCounter += 1;
            const label = `video${videoCounter}`;

            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <!-- Simple poster area for video -->
                  <a class="video-link" href="${fullUrl}" target="_blank" download="${fileName || label}">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                  <div>Uploaded by: ${escapeHtml(Author || "(unknown)")}</div>
                </div>
              </div>
            `);
          } else {
            // Try as image; if it fails, we’ll swap to a link
            const safeLabel = escapeHtml(fileName || fullUrl);
            cards.push(`
  <div class="media-card" style="height:445px;">
    <div class="media-thumb">
      <img src="${fullUrl}"
           alt="${safeLabel}"
           onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
    </div>

    <div class="media-body">
      <span class="media-title">${safeLabel}</span>
      <div>Uploaded by: ${escapeHtml(userName || "(unknown)")}</div>
      <div class="image-error"></div>

      <div class="media-actions">
        <button class="btn btn-warning btn-sm" onclick="editMod('${id}', '${safeLabel}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMod('${id}', '${safeLabel}')">Delete</button>
      </div>
    </div>
  </div>
`);

          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    },
  });
}

// === Helpers ===
function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try { return atob(value.$content); } catch { return value.$content || ""; }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed; // already absolute
  const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

// Only detect videos; everything else is attempted as an image
function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

// Fallback: if an <img> fails to load, replace it with a link in-place
function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

// Minimal HTML-escaper for labels
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function editMod(name) {
  alert("Edit clicked for: " + name);

  // TODO:
  //  - open modal
  //  - load mod data
  //  - allow save
}

function deleteMod(id,name) {
  if (!confirm("Are you sure you want to delete " + name + "?")) return;

  alert("Delete triggered for: " + name);

  $.ajax({
    url: RAA +id + DIA2,
    type: "DELETE",
    dataType: "json",
    success: function (data) {
      window.location.reload();
      }}
    );
}
