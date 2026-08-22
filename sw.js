const CACHE_NAME = 'tfr-wiki-shell-1.0.10';
const HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const CORE = [
  HTML2CANVAS_URL,
  './',
  './index.html',
  './manifest.webmanifest',
  './css/editor.css',
  './css/tfr-theme.css',
  './js/app.bundle.js',
  './js/mobile-gestures.js',
  './js/app.js',
  './js/model.js',
  './js/render.js',
  './js/sanitize.js',
  './js/pwa.js',
  './assets/tfr-logo.gif',
  './assets/Cursor1.png',
  './assets/Pointer1.png',
  './assets/click_close.wav',
  './assets/click_window_open.wav',
  './assets/click_province_01.wav',
  './assets/Crossing_The_Styx.mp3',
  './assets/large_flag_frame.png',
  './assets/app-icon-180.png',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png',
  './assets/icon-library/manifest.json',
  './gfx-maker/',
  './gfx-maker/index.html',
  './gfx-maker/style.css',
  './gfx-maker/app.js',
  './gfx-maker/assets/placeholders/leader_unknown.png',
  './gfx-maker/assets/placeholders/flag_eu.png',
  './gfx-maker/assets/placeholders/focus_unknown.png',
  './gfx-maker/assets/placeholders/major_news.png',
  './gfx-maker/assets/placeholders/local_news.png',
  './gfx-maker/assets/placeholders/super_event.png',
  './gfx-maker/assets/icon-library/catalog.json',
  './gfx-maker/assets/icon-library/economy/USC_managed_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_america_first_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_american_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_ancap.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_bilderberg_system.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_capitalist_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_chaostic_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_collective_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_command_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_corporatism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_developed_socialism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_inclusive_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_kaiser_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_left_corporatism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_liberal_corporatism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_maga_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_military_controlled_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_minarchism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_mixed_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_oligopolistic_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_party_state_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_planned_economy.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_socialist_market.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_state_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_welfare_capitalism.png',
  './gfx-maker/assets/icon-library/economy/ZZZ_worker_controlled_economy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_absolute_monarchy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_ai_governance.png',
  './gfx-maker/assets/icon-library/government/ZZZ_american_peoples_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_american_presidential_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_annihilation_cult.png',
  './gfx-maker/assets/icon-library/government/ZZZ_chinese_political_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_communist_party_state.png',
  './gfx-maker/assets/icon-library/government/ZZZ_constitutional_monarchy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_corporate_council.png',
  './gfx-maker/assets/icon-library/government/ZZZ_counterintelligence_state.png',
  './gfx-maker/assets/icon-library/government/ZZZ_counterintelligence_state_SOV.png',
  './gfx-maker/assets/icon-library/government/ZZZ_crime_syndicate.png',
  './gfx-maker/assets/icon-library/government/ZZZ_deliberative_democracy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_directorial_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_eurasianist_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_fascist_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_islamic_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_military_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_nazi_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_neo_soviet_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_parliamentary_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_peoples_democracy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_personalistic_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_presidential_dictatorship.png',
  './gfx-maker/assets/icon-library/government/ZZZ_presidential_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_provisional_government.png',
  './gfx-maker/assets/icon-library/government/ZZZ_revolutionary_front.png',
  './gfx-maker/assets/icon-library/government/ZZZ_russian_political_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_semi_constitutional_monarchy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_semi_presidential_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_socialist_republic.png',
  './gfx-maker/assets/icon-library/government/ZZZ_taiwanese_semi_presidential_system.png',
  './gfx-maker/assets/icon-library/government/ZZZ_theocracy.png',
  './gfx-maker/assets/icon-library/government/ZZZ_ultranationalist_dictatorship.png',
  './gfx-maker/assets/country/pol_view_bg_new.png',
  './gfx-maker/assets/country/pol_leader_frame.png',
  './gfx-maker/assets/country/pol_goal_bg.png',
  './gfx-maker/assets/country/pol_goal_progress.png',
  './gfx-maker/assets/country/pol_goal_progress_bg.png',
  './gfx-maker/assets/country/pol_goal_progress_frame.png',
  './gfx-maker/assets/country/pol_piechart_overlay_63x63.png',
  './gfx-maker/assets/country/leading_pol_party_bg.png',
  './gfx-maker/assets/country/pol_party_colour_bg.png',
  './gfx-maker/assets/country/icon_occupied_territories.png',
  './gfx-maker/assets/country/icon_exiled_governments.png',
  './gfx-maker/assets/country/icon_manage_subjects.png',
  './gfx-maker/assets/template/diplo_upper_win_bg.png',
  './gfx-maker/assets/template/diplo_top_bg_diplo_tab.png',
  './gfx-maker/assets/template/diplo_leader_frame.png',
  './gfx-maker/assets/template/flag_overlay.png',
  './gfx-maker/assets/template/news/event_report_top_win.png',
  './gfx-maker/assets/template/news/event_report_tileable_midsection.png',
  './gfx-maker/assets/template/news/event_report_bottom_win.png',
  './gfx-maker/assets/template/news/event_news_bg.png',
  './gfx-maker/assets/template/super_frame.png',
  './gfx-maker/assets/template/Leader_Background.png',
  './gfx-maker/assets/template/bck_shadow.png',
  './gfx-maker/assets/template/button_123x34.png',
  './gfx-maker/assets/template/button_170x34.png',
  './gfx-maker/assets/template/button_211x20.png',
  './gfx-maker/assets/template/button_221x34.png',
  './gfx-maker/assets/template/button_261x34.png',
  './gfx-maker/assets/template/button_268_68.png',
  './gfx-maker/assets/template/button_359x34.png',
  './gfx-maker/assets/template/button_80x34.png',
  './gfx-maker/assets/template/closebutton_small.png',
  './gfx-maker/assets/template/diplo_econ_bg.png',
  './gfx-maker/assets/template/diplo_goal_button.png',
  './gfx-maker/assets/template/diplo_nat_spirits_bg.png',
  './gfx-maker/assets/template/diplo_nat_spirits_bg_bottom.png',
  './gfx-maker/assets/template/diplo_nat_spirits_bg_tileable.png',
  './gfx-maker/assets/template/diplo_nat_spirits_bg_top.png',
  './gfx-maker/assets/template/embark.png',
  './gfx-maker/assets/template/event_option_entry.png',
  './gfx-maker/assets/template/generic_checkbox_checked.png',
  './gfx-maker/assets/template/generic_checkbox_unchecked.png',
  './gfx-maker/assets/template/logo_tno.png',
  './gfx-maker/assets/template/news/event_button_minimize.png',
  './gfx-maker/assets/template/news/event_news_pic_overlay.png',
  './gfx-maker/assets/template/news/event_option_entry.png',
  './gfx-maker/assets/template/news/event_pic_overlay.png',
  './gfx-maker/assets/template/news/event_report_bottom_win_2.png',
  './gfx-maker/assets/template/pol_goal_progress.png',
  './gfx-maker/assets/template/pol_goal_progress_frame.png',
  './gfx-maker/assets/template/pol_piechart_overlay_63x63.png',
  './gfx-maker/assets/template/pol_piechart_overlay.png',
  './gfx-maker/assets/template/shadow.png',
  './gfx-maker/assets/template/spacebar.png',
  './gfx-maker/assets/template/super_border.png',
  './gfx-maker/assets/template/super_overlay.png',
  './gfx-maker/assets/template/superevent_text_underlay.png',
  './gfx-maker/assets/template/topbar_flag_overlay.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Skip missing optional files so one bad asset does not block the PWA install.
    await Promise.all(CORE.map(url => cache.add(url).catch(() => null)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('tfr-wiki-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (_) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw _;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.href === HTML2CANVAS_URL) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Let the browser handle partial audio requests. This keeps iPhone music requests from getting stuck in the app cache.
  if (request.headers.has('range')) return;

  const appShell = request.mode === 'navigate' || /\.(?:html?|js|css|webmanifest|json)$/i.test(url.pathname);
  event.respondWith(appShell ? networkFirst(request) : cacheFirst(request));
});
