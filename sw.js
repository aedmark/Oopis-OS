const CACHE_NAME = 'oopis-os-cache-v3.2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './scripts/marked.min.js',
    './scripts/main.js',
    './scripts/utils.js',
    './scripts/config.js',
    './scripts/storage.js',
    './scripts/output_manager.js',
    './scripts/user_manager.js',
    './scripts/fs_manager.js',
    './scripts/session_manager.js',
    './scripts/terminal_ui.js',
    './scripts/apps/editor.js',
    './scripts/apps/oopis_paint.js',
    './scripts/apps/chidi_app.js',
    './scripts/apps/text_adventure.js',
    './scripts/lexpar.js',
    './scripts/commexec.js',
    './scripts/commands/registry.js',
    './scripts/commands/adventure.js',
    './scripts/commands/alias.js',
    './scripts/commands/backup.js',
    './scripts/commands/cat.js',
    './scripts/commands/cd.js',
    './scripts/commands/check_fail.js',
    './scripts/commands/chgrp.js',
    './scripts/commands/chidi.js',
    './scripts/commands/chmod.js',
    './scripts/commands/chown.js',
    './scripts/commands/clear.js',
    './scripts/commands/clearfs.js',
    './scripts/commands/cp.js',
    './scripts/commands/curl.js',
    './scripts/commands/date.js',
    './scripts/commands/delay.js',
    './scripts/commands/diff.js',
    './scripts/commands/echo.js',
    './scripts/commands/edit.js',
    './scripts/commands/export.js',
    './scripts/commands/find.js',
    './scripts/commands/gemini.js',
    './scripts/commands/grep.js',
    './scripts/commands/groupadd.js',
    './scripts/commands/groupdel.js',
    './scripts/commands/groups.js',
    './scripts/commands/help.js',
    './scripts/commands/history.js',
    './scripts/commands/kill.js',
    './scripts/commands/listusers.js',
    './scripts/commands/loadstate.js',
    './scripts/commands/login.js',
    './scripts/commands/logout.js',
    './scripts/commands/ls.js',
    './scripts/commands/man.js',
    './scripts/commands/mkdir.js',
    './scripts/commands/mv.js',
    './scripts/commands/paint.js',
    './scripts/commands/printscreen.js',
    './scripts/commands/ps.js',
    './scripts/commands/pwd.js',
    './scripts/commands/reboot.js',
    './scripts/commands/removeuser.js',
    './scripts/commands/reset.js',
    './scripts/commands/restore.js',
    './scripts/commands/rm.js',
    './scripts/commands/run.js',
    './scripts/commands/savefs.js',
    './scripts/commands/savestate.js',
    './scripts/commands/set.js',
    './scripts/commands/shuf.js',
    './scripts/commands/su.js',
    './scripts/commands/sudo.js',
    './scripts/commands/touch.js',
    './scripts/commands/tree.js',
    './scripts/commands/unalias.js',
    './scripts/commands/unset.js',
    './scripts/commands/unzip.js',
    './scripts/commands/upload.js',
    './scripts/commands/useradd.js',
    './scripts/commands/usermod.js',
    './scripts/commands/visudo.js',
    './scripts/commands/wget.js',
    './scripts/commands/whoami.js',
    './scripts/commands/zip.js',
    './docs/guide.html',
    './LICENSE.txt',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            }),
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});