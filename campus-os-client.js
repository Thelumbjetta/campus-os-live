// campus-os-client.js
(function() {
    // 1. Session Inactivity Timeout (30 minutes)
    const TIMEOUT_MS = 30 * 60 * 1000;
    
    function resetTimer() {
        sessionStorage.setItem('last_activity', Date.now());
    }

    function checkInactivity() {
        const last = sessionStorage.getItem('last_activity');
        if (last && Date.now() - parseInt(last) > TIMEOUT_MS) {
            sessionStorage.clear();
            alert('Session expired due to inactivity. Please log in again.');
            window.location.href = 'index.html';
        }
    }

    if (window.location.pathname.indexOf('dashboard') !== -1) {
        if (!sessionStorage.getItem('last_activity')) resetTimer();
        
        // Listeners to reset activity on user interaction
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
            window.addEventListener(evt, resetTimer, { passive: true });
        });
        
        // Check session validity every minute
        setInterval(checkInactivity, 60000);
        checkInactivity(); // Check immediately on load
        
        // 2. Real-time Notifications & Auto Refresh (SSE)
        const sessionStr = sessionStorage.getItem('user');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const evtSource = new EventSource(`/api/stream?role=${session.role}&user_id=${session.user_id}`);
            
            // Create Toast Container
            const toastContainer = document.createElement('div');
            toastContainer.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
            document.body.appendChild(toastContainer);

            function showToast(title, message, severity) {
                const toast = document.createElement('div');
                let bgColor = '#111'; // Default dark theme
                if (severity === 'critical') bgColor = '#FF4D4D';
                else if (severity === 'high') bgColor = '#FF8C00';
                else if (severity === 'medium') bgColor = '#FFB800';
                
                toast.style.cssText = `background:${bgColor}; color:white; padding:15px 20px; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.3); min-width:280px; transform:translateX(120%); transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); font-family:sans-serif; border:1px solid rgba(255,255,255,0.1); border-left: 4px solid var(--neon-green, #D2F97D);`;
                if(severity === 'critical' || severity === 'high') toast.style.borderLeftColor = '#fff';
                
                toast.innerHTML = `<strong style="display:block; margin-bottom:4px; font-size:0.95rem;">${title}</strong><span style="font-size:0.85rem; opacity:0.8;">${message}</span>`;
                toastContainer.appendChild(toast);
                
                // Animate in
                requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
                
                // Animate out after 5s
                setTimeout(() => {
                    toast.style.transform = 'translateX(120%)';
                    setTimeout(() => toast.remove(), 300);
                }, 5000);
            }

            evtSource.onmessage = function(e) {
                const data = JSON.parse(e.data);
                if (data.event === 'connected') return;
                
                // 1. Show notification toast
                if (data.title && data.message) {
                    showToast(data.title, data.message, data.severity);
                }
                
                // 2. Auto-refresh matching data views if they are currently active
                try {
                    if (data.action === 'refresh_notices' && typeof renderNotices === 'function') {
                        const isVisible = document.querySelector('[data-view="notices"]')?.classList.contains('active');
                        if(isVisible) renderNotices();
                    }
                    if (data.action === 'refresh_issues') {
                        if (typeof renderQueue === 'function' && document.querySelector('[data-view="queue"]')?.classList.contains('active')) renderQueue();
                        if (typeof renderIssues === 'function' && document.querySelector('[data-view="issues"]')?.classList.contains('active')) renderIssues();
                    }
                    if (data.action === 'refresh_alerts' && typeof renderAlerts === 'function') {
                        const isVisible = document.querySelector('[data-view="alerts"]')?.classList.contains('active');
                        if(isVisible) renderAlerts();
                    }
                } catch(err) {
                    console.error("Auto-refresh error:", err);
                }
            };
            
            evtSource.onerror = function() {
                // Silently try to reconnect; browser handles this natively but we can log it
                console.log("SSE disconnected, attempting to reconnect...");
            };
        }
    } else {
        // Reset timer when on the login screen
        resetTimer();
    }
})();
