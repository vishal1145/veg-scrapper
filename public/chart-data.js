document.addEventListener('DOMContentLoaded', async () => {
    const vegSelect = document.getElementById('veg-select');
    const timeRangeSelect = document.getElementById('time-range');
    const currentPriceEl = document.getElementById('current-price');
    const avgPriceEl = document.getElementById('avg-price');
    // const priceTrendEl = document.getElementById('price-trend');
    
    let allData = [];

    // Fetch data
    try {
        const res = await fetch('/prices');
        const data = await res.json();
        
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

        // Calculate Moving Average on FULL history
        const ma7Full = calculateMovingAverage(dailyPrices, 7);

        // Apply time range filter to the calculated data
        const timeRange = timeRangeSelect.value;
        const now = dayjs();
        let startDate, endDate;

        if (timeRange === 'last-week') {
            startDate = now.subtract(1, 'week').day(1).startOf('day');
            endDate = now.subtract(1, 'week').day(7).endOf('day');
        } else if (timeRange === 'last-month') {
            startDate = now.subtract(1, 'month').startOf('month');
            endDate = now.subtract(1, 'month').endOf('month');
        } else if (timeRange === 'last-year') {
            startDate = now.subtract(1, 'year').startOf('year');
            endDate = now.subtract(1, 'year').endOf('year');
        }

        let filteredIndices = [];
        sortedDates.forEach((date, index) => {
            if (!startDate || !endDate) {
                filteredIndices.push(index);
                return;
            }
            const d = dayjs(date);
            if ((d.isSame(startDate) || d.isAfter(startDate)) && (d.isSame(endDate) || d.isBefore(endDate))) {
                filteredIndices.push(index);
            }
        });

        if (filteredIndices.length === 0) {
            currentPriceEl.textContent = 'N/A';
            avgPriceEl.textContent = 'N/A';
            Highcharts.chart('priceChart', {
                title: { text: 'No data for selected range' },
                credits: { enabled: false }
            });
            return;
        }

        const displayDates = filteredIndices.map(i => sortedDates[i]);
        const displayPrices = filteredIndices.map(i => dailyPrices[i]);
        const displayMA = filteredIndices.map(i => ma7Full[i]);

        // Update Stats
        const currentPrice = displayPrices[displayPrices.length - 1] || 0;
        const avgPrice = displayPrices.reduce((a, b) => a + b, 0) / displayPrices.length;
        
        currentPriceEl.textContent = `₹${currentPrice.toFixed(2)}`;
        avgPriceEl.textContent = `₹${avgPrice.toFixed(2)}`;

        // Update Stat Label based on range
        const avgLabel = document.querySelector('.stat-card:nth-child(2) .stat-label');
        if (avgLabel) {
            if (timeRange === 'last-week') avgLabel.textContent = 'Last Week Average';
            else if (timeRange === 'last-month') avgLabel.textContent = 'Last Month Average';
            else if (timeRange === 'last-year') avgLabel.textContent = 'Last Year Average';
            else avgLabel.textContent = 'Overall Average';
        }

        // Special handling for "Complete Data" (Year-over-Year comparison if multi-year) or "Last Year"
        const years = [...new Set(displayDates.map(d => dayjs(d).year()))];
        
        if ((timeRange === 'complete-data' && years.length > 1) || timeRange === 'last-year') {
            const seriesData = {};
            displayDates.forEach((dateStr, i) => {
                if (displayMA[i] === null) return;
                const date = dayjs(dateStr);
                const year = date.year();
                const normalizedDate = date.year(2000).startOf('day').valueOf();
                if (!seriesData[year]) seriesData[year] = [];
                seriesData[year].push([normalizedDate, displayMA[i]]);
            });

            const yearColors = {
                2021: '#FF1744', 2022: '#FFAB00', 2023: '#651FFF', 2024: '#00E5FF', 2025: '#2979FF', 2026: '#F8FAFC'
            };

            const series = Object.keys(seriesData).sort().map(year => ({
                name: year,
                data: seriesData[year],
                color: yearColors[year] || '#FFFFFF',
                type: 'spline',
                marker: { enabled: false, states: { hover: { enabled: true } } }
            }));

            Highcharts.chart('priceChart', {
                chart: { type: 'spline', backgroundColor: 'transparent', style: { fontFamily: 'Outfit' } },
                time: { useUTC: false },
                title: { text: '' },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: { month: '%b' },
                    labels: { style: { color: '#94A3B8' } },
                    lineColor: 'rgba(255, 255, 255, 0.1)',
                    tickColor: 'rgba(255, 255, 255, 0.1)',
                    min: dayjs('2000-01-01').valueOf(),
                    max: dayjs('2000-12-31').valueOf()
                },
                yAxis: {
                    title: { text: 'Price (₹)', style: { color: '#94A3B8' } },
                    gridLineColor: 'rgba(255, 255, 255, 0.05)',
                    labels: { style: { color: '#94A3B8' } }
                },
                legend: { itemStyle: { color: '#94A3B8' }, itemHoverStyle: { color: '#F8FAFC' } },
                tooltip: {
                    shared: true,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    style: { color: '#F8FAFC' },
                    borderWidth: 0,
                    xDateFormat: '%B %e',
                    valueDecimals: 2,
                    valuePrefix: '₹'
                },
                credits: { enabled: false },
                series: series
            });
        } else {
            const categories = displayDates.map(date => {
                const d = dayjs(date);
                if (timeRange === 'last-week' || timeRange === 'last-month') {
                    return d.format('MMM D');
                }
                return d.format('MMM DD, YYYY');
            });
            
            Highcharts.chart('priceChart', {
                chart: { type: 'areaspline', backgroundColor: 'transparent', style: { fontFamily: 'Outfit' } },
                time: { useUTC: false },
                title: { text: '' },
                legend: { itemStyle: { color: '#94A3B8' }, itemHoverStyle: { color: '#F8FAFC' } },
                xAxis: {
                    categories: categories,
                    lineColor: 'rgba(255, 255, 255, 0.1)',
                    tickColor: 'rgba(255, 255, 255, 0.1)',
                    labels: { style: { color: '#94A3B8' } }
                },
                yAxis: {
                    title: { text: 'Price (₹)', style: { color: '#94A3B8' } },
                    gridLineColor: 'rgba(255, 255, 255, 0.05)',
                    labels: { style: { color: '#94A3B8' } }
                },
                tooltip: {
                    shared: true,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    style: { color: '#F8FAFC' },
                    borderWidth: 0
                },
                credits: { enabled: false },
                plotOptions: { areaspline: { fillOpacity: 0.5 } },
                series: [{
                    name: '7-Day MA',
                    type: 'spline',
                    data: displayMA,
                    color: '#FFAB00',
                    dashStyle: 'Solid',
                    marker: { enabled: true, fillColor: '#FFAB00', lineWidth: 2, lineColor: '#FFFFFF' }
                }]
            });
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

      
    }
});
