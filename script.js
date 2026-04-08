document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE = 'http://localhost:3000/api';

    // 1. Initialise Session Button (POST to Backend)
    const initBtn = document.getElementById('init-btn');
    const geoStatus = document.getElementById('geo-status');

    if (initBtn && geoStatus) {
        initBtn.addEventListener('click', async () => {
            initBtn.textContent = 'CONNECTING...';
            initBtn.style.opacity = '0.5';

            // Randomise coordinates slightly
            const lat = (20.71 + Math.random() * 0.01).toFixed(4);
            const lng = (70.98 + Math.random() * 0.01).toFixed(4);

            try {
                const response = await fetch(`${API_BASE}/geofence`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng, status: "AUTHORIZED" })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    initBtn.style.display = 'none';
                    geoStatus.style.display = 'block';
                    geoStatus.innerHTML = `
                        <div style="font-weight: 800; color: var(--color-accent-dark); margin-bottom: 5px;">SESSION ACTIVE <span class="tag tag-resolved ml-2" style="font-size: 0.7rem; color: #1a1e24;">#LOG-${data.id}</span></div>
                        <div style="font-family: 'VT323'; font-size: 1.1rem; opacity: 0.8;">LAT: ${lat} // LNG: ${lng}</div>
                    `;
                }
            } catch (err) {
                console.error(err);
                initBtn.textContent = 'LOG COORDINATES';
                initBtn.style.opacity = '1';
                alert('Database connection failed. Is the API server running?');
            }
        });
    }

    // 2. Fetch Queries
    const queriesList = document.getElementById('queries-list');
    if (queriesList) {
        fetch(`${API_BASE}/queries`)
            .then(res => res.json())
            .then(data => {
                queriesList.innerHTML = '';
                data.forEach(q => {
                    const tagClass = q.status === 'OPEN' ? 'tag-open' : 'tag-resolved';
                    const actionBtn = q.status === 'OPEN' 
                        ? `<button class="btn-mini">REPLY</button>`
                        : `<button class="btn-mini" style="opacity:0.5; cursor:default;" disabled>VIEW</button>`;

                    queriesList.innerHTML += `
                        <div class="liquid-list-item">
                            <div style="display:flex; align-items:center; gap: 20px;">
                                <div class="vt323-text" style="font-size: 1.3rem; opacity: 0.6;">${q.ticket_id}</div>
                                <div>
                                    <div style="font-weight: 800; font-size: 1rem;">${q.student_name}</div>
                                    <div style="font-size: 0.85rem; opacity: 0.8;">${q.query_text}</div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap: 15px;">
                                <span class="tag ${tagClass}">${q.status}</span>
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                });
            })
            .catch(err => console.error('Failed to load queries', err));
    }

    // 3. Fetch Notices
    const noticesList = document.getElementById('notices-list');
    if (noticesList) {
        fetch(`${API_BASE}/notices`)
            .then(res => res.json())
            .then(data => {
                noticesList.innerHTML = '';
                data.forEach(n => {
                    noticesList.innerHTML += `
                        <div class="col-md-6">
                            <div class="liquid-list-item" style="flex-direction: column; align-items: flex-start; height: 100%;">
                                <div class="vt323-text" style="font-size: 1rem; color: var(--color-accent-dark); margin-bottom: 5px;">${n.meta}</div>
                                <div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 5px;">${n.title}</div>
                                <div style="font-size: 0.9rem; opacity: 0.8; line-height: 1.5;">${n.content}</div>
                            </div>
                        </div>
                    `;
                });
            })
            .catch(err => console.error('Failed to load notices', err));
    }
});
