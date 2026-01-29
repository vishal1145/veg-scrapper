document.addEventListener('DOMContentLoaded', async () => {
    const vegSelect = document.getElementById('veg-select');
    const timeRangeSelect = document.getElementById('time-range');
    // const currentPriceEl = document.getElementById('current-price');
    // const avgPriceEl = document.getElementById('avg-price');
    // const priceTrendEl = document.getElementById('price-trend');
    const loadingSpinner = document.getElementById('loading-spinner');
    const seasonalityChart = document.getElementById('seasonalityChart');
    
    let allData = [];

    // Fetch data
    try {
        const res = await fetch('/prices');
        const data = await res.json();
        
        // Hide loader and show chart
        loadingSpinner.style.display = 'none';
        seasonalityChart.classList.remove('hidden');

        if (data.data && data.data.length > 0) {
            allData = data.data;
            populateDropdown(allData);
            
            // Select first vegetable by default
            const firstVeg = vegSelect.options[1].value;
            vegSelect.value = firstVeg;
            updateChart(firstVeg);
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        loadingSpinner.innerHTML = '<p style="color: #FF1744">Failed to load data. Please try again later.</p>';
    }

    vegSelect.addEventListener('change', (e) => {
        updateChart(e.target.value);
    });

    timeRangeSelect.addEventListener('change', () => {
        updateChart(vegSelect.value);
    });

    function populateDropdown(data) {
        const vegetables = [...new Set(data.map(item => item.vegetable))].sort();
        vegetables.forEach(veg => {
            const option = document.createElement('option');
            option.value = veg;
            option.textContent = veg;
            vegSelect.appendChild(option);
        });
    }

    function calculateMovingAverage(data, windowSize) {
        const ma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < windowSize - 1) {
                ma.push(null); // Not enough data points
                continue;
            }
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += data[i - j];
            }
            ma.push(sum / windowSize);
        }
        return ma;
    }

    function updateChart(vegetable) {
        if (!vegetable) return;

        // Filter data for the selected vegetable
        let vegData = allData
            .filter(item => item.vegetable === vegetable)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (vegData.length === 0) return;

        // Apply time range filter
        const timeRange = timeRangeSelect.value;
        let startDate, endDate;
        const now = dayjs();

        if (timeRange === 'last-week') {
            // Last week Monday to Sunday
            startDate = now.subtract(1, 'week').day(1).startOf('day');
            endDate = now.subtract(1, 'week').day(7).endOf('day');
        } else if (timeRange === 'last-month') {
            // Last month
            startDate = now.subtract(1, 'month').startOf('month');
            endDate = now.subtract(1, 'month').endOf('month');
        } else if (timeRange === 'last-year') {
            // Last year
            startDate = now.subtract(1, 'year').startOf('year');
            endDate = now.subtract(1, 'year').endOf('year');
        }

        if (startDate && endDate) {
            vegData = vegData.filter(item => {
                const d = dayjs(item.date);
                return (d.isSame(startDate) || d.isAfter(startDate)) && (d.isSame(endDate) || d.isBefore(endDate));
            });
        }

        // if (vegData.length === 0) {
        //     currentPriceEl.textContent = 'N/A';
        //     avgPriceEl.textContent = 'N/A';
        //     // Clear heatmap
        //     Highcharts.chart('seasonalityChart', {
        //         title: { text: 'No data for selected range' },
        //         credits: { enabled: false }
        //     });
        //     return;
        // }

        // Group by date to handle potential multiple cities
        const dateMap = new Map();
        vegData.forEach(item => {
            if (!dateMap.has(item.date)) {
                dateMap.set(item.date, []);
            }
            const price = item.wholesale_price ? parseFloat(item.wholesale_price) : 0;
            if (price > 0) dateMap.get(item.date).push(price);
        });

        const sortedDates = Array.from(dateMap.keys()).sort();
        
        const dailyPrices = sortedDates.map(date => {
            const prices = dateMap.get(date);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            return avg;
        });

        // Update Stats
        const currentPrice = dailyPrices[dailyPrices.length - 1] || 0;
        const avgPrice = dailyPrices.reduce((a, b) => a + b, 0) / dailyPrices.length;
        
        // currentPriceEl.textContent = `₹${currentPrice.toFixed(2)}`;
        // avgPriceEl.textContent = `₹${avgPrice.toFixed(2)}`;

        // Update Stat Label based on range
        const avgLabel = document.querySelector('.stat-card:nth-child(2) .stat-label');
        if (avgLabel) {
            if (timeRange === 'last-week') avgLabel.textContent = 'Last Week Average';
            else if (timeRange === 'last-month') avgLabel.textContent = 'Last Month Average';
            else if (timeRange === 'last-year') avgLabel.textContent = 'Last Year Average';
            else avgLabel.textContent = 'Overall Average';
        }

        const heatmapTitle = document.querySelector('.chart-container h3');
        if (heatmapTitle) {
            if (timeRange === 'last-week') heatmapTitle.textContent = 'Price Heatmap (Last Week)';
            else if (timeRange === 'last-month') heatmapTitle.textContent = 'Price Heatmap (Last Month)';
            else if (timeRange === 'last-year') heatmapTitle.textContent = 'Price Heatmap (Last Year)';
            else heatmapTitle.textContent = 'Monthly Price Heatmap (All Time)';
        }

        // --- Seasonality Heatmap Logic ---
        const monthYearMap = new Map(); 
        const yearsSet = new Set();

        vegData.forEach(item => {
            const price = parseFloat(item.wholesale_price || 0);
            if (price > 0) {
                const d = dayjs(item.date);
                const year = d.year();
                const month = d.month(); // 0-11
                
                yearsSet.add(year);
                const key = `${year}-${month}`;
                
                if (!monthYearMap.has(key)) {
                    monthYearMap.set(key, { total: 0, count: 0 });
                }
                const entry = monthYearMap.get(key);
                entry.total += price;
                entry.count++;
            }
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a); // Descending for Y-axis (Latest year at top)
        const heatmapData = [];

        sortedYears.forEach((year, yIndex) => {
            for (let month = 0; month < 12; month++) {
                const key = `${year}-${month}`;
                if (monthYearMap.has(key)) {
                    const entry = monthYearMap.get(key);
                    const avg = parseFloat((entry.total / entry.count).toFixed(2));
                    heatmapData.push([month, yIndex, avg]);
                }
            }
        });

        Highcharts.chart('seasonalityChart', {
            chart: {
                type: 'heatmap',
                backgroundColor: 'transparent',
                style: { fontFamily: 'Outfit' }
            },
            title: { text: '' },
            xAxis: {
                categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                labels: { style: { color: '#94A3B8' } }
            },
            yAxis: {
                categories: sortedYears,
                title: null,
                labels: { style: { color: '#94A3B8' } },
                reversed: true // Put latest year at top if we want, or bottom. Let's keep standard.
            },
            colorAxis: {
                minColor: '#00E5FF',
                maxColor: '#FF1744',
                labels: { style: { color: '#94A3B8' } }
            },
            legend: {
                align: 'right',
                layout: 'vertical',
                margin: 0,
                verticalAlign: 'top',
                y: 25,
                symbolHeight: 280,
                itemStyle: { color: '#94A3B8' }
            },
            tooltip: {
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                style: { color: '#F8FAFC' },
                borderWidth: 0,
                formatter: function () {
                    return `<b>${this.series.yAxis.categories[this.point.y]}</b><br>` +
                           `${this.series.xAxis.categories[this.point.x]}: <b>₹${this.point.value}</b>`;
                }
            },
            credits: { enabled: false },
            series: [{
                name: 'Avg Price',
                borderWidth: 1,
                borderColor: '#1e293b',
                data: heatmapData,
                dataLabels: {
                    enabled: true,
                    color: '#000000'
                }
            }]
        });
    }
});
