document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('veg-table-body');
    const recordCount = document.getElementById('record-count');
    const searchInput = document.getElementById('search-input');
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    const loadingSpinner = document.getElementById('loading-spinner');
    const vegTableWrapper = document.getElementById('veg-table-wrapper');
    const paginationControls = document.getElementById('pagination-controls');

    // Initial state handled by CSS class

    let allData = [];
    let filteredData = [];
    let currentPage = 1;
    const itemsPerPage = 20;

    try {
        const res = await fetch('/prices');
        const data = await res.json();
        
        // Hide loader and show content
        loadingSpinner.style.display = 'none';
        vegTableWrapper.classList.remove('hidden');
        paginationControls.classList.remove('hidden');

        if (data.data && data.data.length > 0) {
            // Sort by date descending initially
            allData = data.data.sort((a, b) => new Date(b.date) - new Date(a.date));
            populateVegetableDropdown();
            filteredData = [...allData];
            updateUI();
        } else {
            recordCount.textContent = '0 Records';
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No data found</td></tr>';
        }
    } catch (err) {
        console.error(err);
        recordCount.textContent = 'Error';
        recordCount.classList.add('error');
        loadingSpinner.innerHTML = '<p style="color: #f87171">Failed to load data. Please try again later.</p>';
    }


    function populateVegetableDropdown() {
        const uniqueVegetables = [...new Set(allData.map(item => item.vegetable))].sort();
        uniqueVegetables.forEach(veg => {
            const option = document.createElement('option');
            option.value = veg;
            option.textContent = veg;
            option.style.color = '#000';
            searchInput.appendChild(option);
        });
    }

    function filterData() {
        const searchTerm = searchInput.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        filteredData = allData.filter(item => {
            const matchesSearch = searchTerm === "" || item.vegetable === searchTerm;
            let matchesDate = true;

            if (startDate && endDate) {
                matchesDate = item.date >= startDate && item.date <= endDate;
            } else if (startDate) {
                matchesDate = item.date >= startDate;
            } else if (endDate) {
                matchesDate = item.date <= endDate;
            }

            return matchesSearch && matchesDate;
        });

        currentPage = 1;
        updateUI();
    }

    function updateUI() {
        recordCount.textContent = `${filteredData.length} Records`;
        renderTable();
        renderPagination();
    }

    function renderTable() {
        tbody.innerHTML = '';
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No matching records found</td></tr>';
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = filteredData.slice(startIndex, endIndex);
        
        pageData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date}</td>
                <td>${item.vegetable}</td>
                <td>${item.unit || 'N/A'}</td>

                <td class="price-val">₹${item.wholesale_price || 'N/A'}</td>
                <td class="price-range">₹${item.retail_min_price || '-'}-${item.retail_max_price || '-'}</td>
                <td class="price-range">₹${item.shopmall_min_price || '-'}-${item.shopmall_max_price || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Date Validation Logic
    const today = new Date().toISOString().split('T')[0];
    startDateInput.max = today;
    endDateInput.max = today;
    endDateInput.disabled = true;

    // Event Listeners
    searchInput.addEventListener('change', filterData);
    
    startDateInput.addEventListener('change', () => {
        if (startDateInput.value) {
            endDateInput.disabled = false;
            endDateInput.min = startDateInput.value;
            
            // If end date is selected and is less than start date, clear it
            if (endDateInput.value && endDateInput.value < startDateInput.value) {
                endDateInput.value = '';
            }
        } else {
            endDateInput.disabled = true;
            endDateInput.value = '';
        }
        filterData();
    });

    endDateInput.addEventListener('change', filterData);

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateUI();
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateUI();
        }
    });
});
