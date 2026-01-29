document.addEventListener('DOMContentLoaded', async () => {
    const currentCostEl = document.getElementById('current-cost');
    const maCostEl = document.getElementById('ma-cost');
    const marginValEl = document.getElementById('margin-val');

    const MRP = 220;
    const USAGE_FACTOR = 0.9; // 900g

    try {
        const res = await fetch('/prices');
        const data = await res.json();

        if (data.data && data.data.length > 0) {
            processAndRender(data.data);
        } else {
            console.error('No data found');
        }
    } catch (err) {
        console.error('Error fetching data:', err);
    }

    function calculateMovingAverage(data, windowSize) {
        const ma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < windowSize - 1) {
                ma.push(null); 
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

    function processAndRender(allData) {
        // Filter for Coconut
        // Note: We use 'includes' to be safer if it's "Coconut (Large)" etc, 
        // but ideally we want the main Coconut price. 
        // Let's try exact match first, if empty, try includes.
        let coconutData = allData.filter(item => item.vegetable === 'Coconut');
        
        if (coconutData.length === 0) {
            // Fallback to partial match if exact match fails
            coconutData = allData.filter(item => item.vegetable.toLowerCase().includes('coconut'));
        }

        if (coconutData.length === 0) {
            console.error('No coconut data found');
            return;
        }

        // Sort by date
        coconutData.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Group by date (take average if multiple entries per day)
        const dateMap = new Map();
        coconutData.forEach(item => {
            if (!dateMap.has(item.date)) {
                dateMap.set(item.date, []);
            }
            const price = item.wholesale_price ? parseFloat(item.wholesale_price) : 0;
            if (price > 0) dateMap.get(item.date).push(price);
        });

        const sortedDates = Array.from(dateMap.keys()).sort();
        
        // Calculate Daily Cost per Packet
        const dailyCosts = sortedDates.map(date => {
            const prices = dateMap.get(date);
            const avgPricePerKg = prices.reduce((a, b) => a + b, 0) / prices.length;
            return avgPricePerKg * USAGE_FACTOR;
        });

        // Calculate 7-Day Moving Average
        const ma7 = calculateMovingAverage(dailyCosts, 7);

        // Prepare Series Data
        // We need to align data with dates.
        // Highcharts datetime axis needs timestamps.
        
        const dailyCostSeries = [];
        const maSeries = [];
        const mrpSeries = [];

        sortedDates.forEach((dateStr, i) => {
            const timestamp = new Date(dateStr).getTime();
            
            dailyCostSeries.push([timestamp, parseFloat(dailyCosts[i].toFixed(2))]);
            
            if (ma7[i] !== null) {
                maSeries.push([timestamp, parseFloat(ma7[i].toFixed(2))]);
            }

            // MRP is constant, but for a line graph we can just use plotLines or a series.
            // A series allows for a legend item which is requested.
            mrpSeries.push([timestamp, MRP]);
        });

        // Update Stats
        const latestCost = dailyCosts[dailyCosts.length - 1] || 0;
        const latestMA = ma7[ma7.length - 1] || 0;
        const margin = MRP - latestCost;

        currentCostEl.textContent = `₹${latestCost.toFixed(2)}`;
        maCostEl.textContent = `₹${latestMA.toFixed(2)}`;
        marginValEl.textContent = `₹${margin.toFixed(2)}`;
        
        if (margin < 0) {
            marginValEl.style.color = '#FF1744'; // Loss
        } else {
            marginValEl.style.color = '#00E676'; // Profit
        }

        // Render Chart
        Highcharts.chart('trendChart', {
            chart: {
                backgroundColor: 'transparent',
                style: { fontFamily: 'Outfit' },
                zoomType: 'x'
            },
            title: { text: '' },
            xAxis: {
                type: 'datetime',
                lineColor: 'rgba(255, 255, 255, 0.1)',
                tickColor: 'rgba(255, 255, 255, 0.1)',
                labels: { style: { color: '#94A3B8' } }
            },
            yAxis: {
                title: { text: 'Cost (₹)', style: { color: '#94A3B8' } },
                gridLineColor: 'rgba(255, 255, 255, 0.05)',
                labels: { style: { color: '#94A3B8' } },
                plotLines: [{
                    value: MRP,
                    color: '#00E676',
                    dashStyle: 'ShortDash',
                    width: 2,
                    label: {
                        text: `MRP ₹${MRP}`,
                        align: 'right',
                        style: { color: '#00E676' }
                    }
                }]
            },
            legend: {
                itemStyle: { color: '#94A3B8' },
                itemHoverStyle: { color: '#F8FAFC' }
            },
            tooltip: {
                shared: true,
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                style: { color: '#F8FAFC' },
                borderWidth: 0,
                xDateFormat: '%B %e, %Y',
                valueDecimals: 2,
                valuePrefix: '₹'
            },
            credits: { enabled: false },
            series: [
                {
                    name: 'Daily Cost / Packet',
                    type: 'line',
                    data: dailyCostSeries,
                    color: 'rgba(41, 121, 255, 0.5)', // Thin/Faint line
                    lineWidth: 1,
                    marker: { enabled: false }
                },
                {
                    name: '7-Day MA Cost',
                    type: 'spline',
                    data: maSeries,
                    color: '#FFAB00', // Bold line
                    lineWidth: 3,
                    marker: { enabled: false }
                },
                {
                    name: 'Selling Price (MRP)',
                    type: 'line',
                    data: mrpSeries,
                    color: '#00E676',
                    lineWidth: 2,
                    dashStyle: 'LongDash',
                    marker: { enabled: false },
                    enableMouseTracking: false // Static line
                }
            ]
        });
    }
});
