Vue.use(VueMaterial);

var app = new Vue({
  el: "#app",
  template: `
      <md-layout md-column>
        <md-layout>
          <md-list class="md-dense">
            <md-list-item key="bugzillaIssueId" md-expand-multiple
                          v-for="(tabs, bugzillaIssueId) in tabGroups">
              <md-icon class="item-icon">whatshot</md-icon>
              <span class="item-text">Bug {{ bugzillaIssueId }}</span>

              <md-list-expand>
                <md-list class="md-dense">
                  <md-list-item key="index" v-for="(tab, index) in tabs"
                                v-on:click="activateTab(tab)">
                    <md-avatar>
                      <img :src="tab.favIconUrl" alt="" class="item-icon">
                    </md-avatar>
                    <span class="item-text">{{ tab.title ? tab.title.slice(0, 46) : "(null)" }}</span>
                  </md-list-item>
                </md-list>
              </md-list-expand>
            </md-list-item>
          </md-list>
        </md-layout>

        <md-layout md-flex="5">
          <md-bottom-bar>
            <md-bottom-bar-item md-icon="history" v-on:click="refresh">
              Refresh
            </md-bottom-bar-item>
          </md-bottom-bar>
        </md-layout>

      </md-layout>
  `,
  data: {
    tabGroups: {},
    tabSet: new Set(),
  },
  methods: {
    async activateTab(tab) {
      await browser.tabs.update(tab.id, {active: true});
    },

    async refresh() {
      // bugzilla-issue-id -> [tab]
      const tabGroups = {};

      await refreshMozReviewTabs(tabGroups, app.tabSet);
      await refreshBugzillaTabs(tabGroups, app.tabSet);

      app.tabGroups = tabGroups;
    }
  }
});

async function refreshMozReviewTabs(tabGroups, tabSet) {
  const reviewTabs = await browser.tabs.query({
    url: "*://reviewboard.mozilla.org/r/*",
    currentWindow: true,
  });

  for (tab of reviewTabs) {
    tabSet.add(tab.id);

    const {
      success,
      error,
      bugzillaIssueId,
    } = await browser.tabs.sendMessage(tab.id, "tab-mozreview-bugzilla-issue:get");

    if (!success || !bugzillaIssueId) {
      console.error(error);
      if (!tabGroups["Unknown"]) {
        tabGroups["Unknown"] = [tab];
      } else {
        tabGroups["Unknown"].push(tab);
      }
      continue;
    }

    if (!tabGroups[bugzillaIssueId]) {
      tabGroups[bugzillaIssueId] = [tab];
    } else {
      tabGroups[bugzillaIssueId].push(tab);
    }
  }
}

async function refreshBugzillaTabs(tabGroups, tabSet) {
  const bugsTabs = await browser.tabs.query({
    url: "*://bugzilla.mozilla.org/show_bug.cgi?id=*",
    currentWindow: true,
  });

  for (tab of bugsTabs) {
    tabSet.add(tab.id);

    const url = new URL(tab.url);
    const params = new URLSearchParams(url.search);

    if (!params.has("id")) {
      console.error(error);
      if (!tabGroups["Unknown"]) {
        tabGroups["Unknown"] = [tab];
      } else {
        tabGroups["Unknown"].push(tab);
      }
      continue;
    }

    const bugzillaIssueId = params.get("id");

    if (!tabGroups[bugzillaIssueId]) {
      tabGroups[bugzillaIssueId] = [tab];
    } else {
      tabGroups[bugzillaIssueId].push(tab);
    }
  }
}

let timeoutId;

function scheduleAppRefresh() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => app.refresh(), 200);
}

browser.tabs.onCreated.addListener(scheduleAppRefresh);
browser.tabs.onUpdated.addListener((tabId, {status}) => {
  if (status === "complete") {
    scheduleAppRefresh();
  }
});
browser.tabs.onRemoved.addListener((tabId) => {
  if (!app.tabSet.has(tabId)) {
    return;
  }

  app.tabSet.delete(tabId);

  scheduleAppRefresh();
});

app.refresh();
