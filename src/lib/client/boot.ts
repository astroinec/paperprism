/** Shared between server layout and client prefs (no "use client" so it is a plain string on the server). */
export const PREFS_KEY = "pp-prefs";

/** Applies saved prefs before first paint to avoid theme/glass flashes. */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');var d=document.documentElement;var t=p.theme||'system';var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(dark)d.classList.add('dark');d.style.setProperty('--glass-strength',String(p.glass==null?0.6:p.glass));d.dataset.skin=p.skin||'aurora';if(p.reduceTransparency)d.dataset.reduceTransparency='true';if(p.reduceMotion)d.dataset.reduceMotion='true';d.lang=p.lang==='en'?'en':'zh-CN';}catch(e){}})();`;
