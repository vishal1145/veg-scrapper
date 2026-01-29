document.addEventListener('DOMContentLoaded', () => {
    // Elements (might be null if commented out)
    const resultsContent = document.getElementById('results-content');
    const statusBadge = document.getElementById('status-badge');
    const tableWrapper = document.getElementById('veg-table-wrapper');
    const tbody = document.getElementById('veg-table-body');

    // Helper
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Toaster
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toaster-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // Loading
    const setLoading = (btnId, isLoading) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    };

    // Render Table
    const renderVegTable = (data) => {
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date}</td>
                <td><img src="${item.image}" alt="${item.vegetable}" class="veg-img"></td>
                <td>${item.vegetable}</td>
                <td>${item.city}</td>
                <td class="price-val">₹${item.wholesale_price || 'N/A'}</td>
                <td class="price-range">₹${item.retail_min_price || '-'}-${item.retail_max_price || '-'}</td>
                <td class="price-range">₹${item.shopmall_min_price || '-'}-${item.shopmall_max_price || '-'}</td>
                <td>${item.unit || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Check Data Availability
    const checkDataAvailability = async () => {
        const btnViewData = document.getElementById('btn-view-data');
        if (!btnViewData) return;

        try {
            const res = await fetch('/prices');
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                btnViewData.classList.remove('hidden');
            } else {
                btnViewData.classList.add('hidden');
            }
        } catch (err) {
            console.error('Error checking data availability:', err);
            btnViewData.classList.add('hidden');
        }
    };

    // Generic Scrape Handler
    const handleScrape = async (btnId, url) => {
        setLoading(btnId, true);
        if (resultsContent) {
             resultsContent.textContent = 'Scraping...';
             resultsContent.classList.remove('hidden');
        }
        if (tableWrapper) tableWrapper.classList.add('hidden');
        if (statusBadge) statusBadge.classList.add('hidden');

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.vegData && data.vegData.length > 0) {
                renderVegTable(data.vegData);
                if (resultsContent) resultsContent.classList.add('hidden');
                if (tableWrapper) tableWrapper.classList.remove('hidden');
            } else {
                if (resultsContent) resultsContent.textContent = JSON.stringify(data, null, 2);
            }

            showToast('Success!');
            if (statusBadge) {
                statusBadge.textContent = 'Success';
                statusBadge.classList.remove('hidden', 'error');
            }
            
            // Re-check data availability after scrape
            checkDataAvailability();

        } catch (err) {
            if (resultsContent) resultsContent.textContent = 'Error: ' + err.message;
            showToast('Error: ' + err.message, 'error');
            if (statusBadge) {
                statusBadge.textContent = 'Error';
                statusBadge.classList.remove('hidden');
                statusBadge.classList.add('error');
            }
        } finally {
            setLoading(btnId, false);
        }
    };

    // Check for m=1 query parameter to show/hide scrape buttons
    const urlParams = new URLSearchParams(window.location.search);
    const showScrapeButtons = urlParams.get('m') === '1';

    // Button Listeners
    const btnToday = document.getElementById('btn-today');
    if (btnToday) {
        if (!showScrapeButtons) btnToday.style.display = 'none';
        btnToday.addEventListener('click', () => {
            const today = formatDate(new Date());
            handleScrape('btn-today', `/scrape?date=${today}`);
        });
    }

    const btnScrape2025 = document.getElementById('btn-scrape-2025');
    if (btnScrape2025) {
        if (!showScrapeButtons) btnScrape2025.style.display = 'none';
        btnScrape2025.addEventListener('click', () => {
            const today = formatDate(new Date());
            handleScrape('btn-scrape-2025', `/scrape?startDate=2025-01-01&endDate=${today}`);
        });
    }

    const btnMailQueue = document.getElementById('btn-mail-queue');
    if (btnMailQueue) {
        btnMailQueue.addEventListener('click', async () => {
            setLoading('btn-mail-queue', true);
            try {
                const res = await fetch('/send-mail-queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                console.log('data', data);
                
                if (data.success && data.data && data.data.ids && data.data.ids.length > 0) {
                    const ids = data.data.ids;
                    showToast(`${ids.length} alerts generated. Opening tabs...`);
                    
                    // Open tabs with a small delay to be friendlier to browsers
                    ids.forEach((id, index) => {
                         window.open(`/view-email/${id}`, '_blank');
                    });
                } else {
                    showToast(data.message || 'No alerts generated.', 'error');
                }
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                setLoading('btn-mail-queue', false);
            }
        });
    }

    const btnWeeklyReport = document.getElementById('btn-weekly-report');
    if (btnWeeklyReport) {
        btnWeeklyReport.addEventListener('click', async () => {
            setLoading('btn-weekly-report', true);
            try {
                const res = await fetch('/send-weekly-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                
                if (data.success && data.data && data.data.ids && data.data.ids.length > 0) {
                    const ids = data.data.ids;
                    showToast('Weekly report generated. Opening tab...');
                    
                    ids.forEach((id, index) => {
                        setTimeout(() => {
                            window.open(`/view-email/${id}`, '_blank');
                        }, index * 300);
                    });
                } else {
                    showToast(data.message || 'No data for weekly report.', 'error');
                }
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                setLoading('btn-weekly-report', false);
            }
        });
    }

    const btnViewData = document.getElementById('btn-view-data');
    if (btnViewData) {
        btnViewData.addEventListener('click', () => {
            window.open('view.html', '_blank');
        });
    }
    
    // Initial Load (if elements exist)
    async function loadInitialData() {
        checkDataAvailability(); // Check button visibility
        
        if (!resultsContent) return; // Don't try to load if UI is hidden
        resultsContent.textContent = 'Loading...';
        try {
            const res = await fetch('/prices');
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                renderVegTable(data.data);
                resultsContent.classList.add('hidden');
                if (tableWrapper) tableWrapper.classList.remove('hidden');
            } else {
                resultsContent.textContent = 'No data found.';
            }
        } catch (err) {
            console.error(err);
            resultsContent.textContent = 'Error loading data.';
        }
    }
    
    loadInitialData();
});
