function getWindowMozReviewId() {
  return window.location.pathname.split("/")[2];
}

async function fetchMozReviewData() {
  const reqHeaders = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
  });

  const reqInit = {
    method: "GET",
    headers: reqHeaders,
    mode: "cors",
    cache: "default"
  };

  const mozReviewId = getWindowMozReviewId();

  const baseAPIURL = `${window.origin}/api/review-requests/${mozReviewId}/`;

  let data = await fetch(baseAPIURL, reqInit).then(res => res.json());

  if (data.stat !== "ok") {
    return {success: false, error: `Error fetching mozreview request ${mozReviewId}`};
  }

  const {review_request} = data;

  data = await fetch(review_request.links.reviews.href, reqInit).then(res => res.json());

  if (data.stat !== "ok") {
    return {success: false, error: `Error fetching reviews for ${mozReviewId}`};
  }

  delete review_request.links;

  const {reviews} = data;

  const diff_comments = {};

  for (const review of reviews) {
    data = await fetch(review.links.diff_comments.href, reqInit).then(res => res.json());

    if (data.stat !== "ok") {
      return {success: false, error: `Error fetching diff comments for ${mozReviewId}`};
    }

    delete review.links;
    diff_comments[review.id] = data.diff_comments.map(comments => {
      delete comments.links
      return comments;
    });
  }

  return {success: true, review_request, reviews, diff_comments};
}

function getBugzillaIssue() {
  const link = document.querySelector("#mozreview-review-header > a:nth-child(2)");
  const url = new URL(link.getAttribute("href"));
  const params = new URLSearchParams(url.search);

  if (!params.has("id")) {
    return {
      success: false,
      error: `Error fetching bugzilla issue for mozreview ${getWindowMozReviewId()}`,
    };
  }

  return {
    success: true,
    bugzillaIssueId: params.get("id"),
  };
}

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg) {
    case "tab-mozreview-bugzilla-issue:get":
      return  getBugzillaIssue();
    case "tab-mozreview-data:get":
      return fetchMozReviewData();
    default:
      return {success: false, error: `Error processing unknown message: ${msg}`};
  }
});
