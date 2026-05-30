const PATCH_SCRIPT = `
<script>
(function () {
  function patchEmptyIframeSrc() {
    document.querySelectorAll("iframe").forEach(function (iframe) {
      if (!iframe.getAttribute("src")) {
        iframe.setAttribute("src", "about:blank");
      }
    });
  }

  function startIframePatch() {
    patchEmptyIframeSrc();

    if (window.__vlsIframeSrcPatchObserver) return;

    window.__vlsIframeSrcPatchObserver = new MutationObserver(function () {
      patchEmptyIframeSrc();
    });

    window.__vlsIframeSrcPatchObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startIframePatch);
  } else {
    startIframePatch();
  }

  window.addEventListener("load", startIframePatch);
})();
</script>
`;

class HeadInjector {
  element(element) {
    element.append(PATCH_SCRIPT, { html: true });
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    const shouldPatch =
      url.hostname === "vls-online.com" &&
      (
        url.pathname.includes("/courses/") ||
        url.pathname.includes("/course_player/") ||
        url.pathname.includes("/lessons/") ||
        url.pathname.includes("/programs/") ||
        url.pathname.includes("/products/")
      );

    const response = await fetch(request);

    if (!shouldPatch) {
      return response;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return response;
    }

    return new HTMLRewriter()
      .on("head", new HeadInjector())
      .transform(response);
  }
};