document.addEventListener('DOMContentLoaded', async () => {
    const loadingSpinner = document.getElementById('loading-spinner');
    const chartsGrid = document.getElementById('charts-grid');

    try {
        const res = await fetch('/prices');
        const data = await res.json();
        
        // Hide loader and show charts
        loadingSpinner.style.display = 'none';
        chartsGrid.classList.remove('hidden');

        if (data.data && data.data.length > 0) {
            processAndRender(data.data);
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        loadingSpinner.innerHTML = '<p style="color: #FF1744">Failed to load data. Please try again later.</p>';
    }
});

function processAndRender(data) {
    // Helper: Parse float safely
    const parse = (val) => val ? parseFloat(val) : 0;

    // 1. Profit Margin Analysis
    // Calculate average margin per vegetable
    // const marginMap = new Map();
    // data.forEach(item => {
    //     const wholesale = parse(item.wholesale_price);
    //     const retailMax = parse(item.retail_max_price);
        
    //     if (wholesale > 0 && retailMax > 0) {
    //         if (!marginMap.has(item.vegetable)) {
    //             marginMap.set(item.vegetable, { totalMargin: 0, count: 0 });
    //         }
    //         const entry = marginMap.get(item.vegetable);
    //         entry.totalMargin += (retailMax - wholesale);
    //         entry.count++;
    //     }
    // });

    // const marginData = Array.from(marginMap.entries())
    //     .map(([name, val]) => ({ name, y: val.totalMargin / val.count }))
    //     .sort((a, b) => b.y - a.y)
    //     .slice(0, 10); // Top 10

    // renderBarChart('profitChart', marginData, 'Average Margin (₹)', '#00E5FF');


    // 2. Volatility Analysis (Standard Deviation of Wholesale Price)
    // Filter last 30 days
    const thirtyDaysAgo = dayjs().subtract(30, 'day');
    const recentData = data.filter(item => dayjs(item.date).isAfter(thirtyDaysAgo));
    
    const volatilityMap = new Map();
    recentData.forEach(item => {
        const price = parse(item.wholesale_price);
        if (price > 0) {
            if (!volatilityMap.has(item.vegetable)) {
                volatilityMap.set(item.vegetable, []);
            }
            volatilityMap.get(item.vegetable).push(price);
        }
    });

    const volatilityData = [];
    volatilityMap.forEach((prices, name) => {
        if (prices.length > 5) { // Need some data points
            const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
            const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
            const stdDev = Math.sqrt(variance);
            volatilityData.push({ name, y: stdDev });
        }
    });

    renderBarChart('volatilityChart', volatilityData.sort((a, b) => b.y - a.y).slice(0, 10), 'Std Dev (₹)', '#FF1744');


    // 3. Day of Week Trends
    // const dowMap = new Map(); // 0=Sun, 1=Mon...
    // data.forEach(item => {
    //     const price = parse(item.wholesale_price);
    //     if (price > 0) {
    //         const day = dayjs(item.date).day();
    //         if (!dowMap.has(day)) {
    //             dowMap.set(day, { total: 0, count: 0 });
    //         }
    //         const entry = dowMap.get(day);
    //         entry.total += price;
    //         entry.count++;
    //     }
    // });

    // const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // const dowData = days.map((dayName, index) => {
    //     const entry = dowMap.get(index);
    //     return {
    //         name: dayName,
    //         y: entry ? entry.total / entry.count : 0
    //     };
    // });

    // renderBarChart('dayOfWeekChart', dowData, 'Avg Wholesale Price (₹)', '#FFAB00');


    // 4. Market Channel Premium (Mall vs Retail)
    // const premiumMap = new Map();
    // data.forEach(item => {
    //     const retail = parse(item.retail_max_price);
    //     const mall = parse(item.shopmall_max_price);
        
    //     if (retail > 0 && mall > 0) {
    //         if (!premiumMap.has(item.vegetable)) {
    //             premiumMap.set(item.vegetable, { totalPremium: 0, count: 0 });
    //         }
    //         const entry = premiumMap.get(item.vegetable);
    //         entry.totalPremium += (mall - retail);
    //         entry.count++;
    //     }
    // });

    // const premiumData = Array.from(premiumMap.entries())
    //     .map(([name, val]) => ({ name, y: val.totalPremium / val.count }))
    //     .sort((a, b) => b.y - a.y)
    //     .slice(0, 10);

    // renderBarChart('channelChart', premiumData, 'Mall Premium (₹)', '#651FFF');

    // 5. Seasonality Analysis (Heatmap)
    const seasonalityMap = new Map();
    const vegetables = Array.from(new Set(data.map(d => d.vegetable))).sort();
    
    // Initialize map
    vegetables.forEach(veg => {
        seasonalityMap.set(veg, new Array(12).fill({ total: 0, count: 0 }));
    });

    data.forEach(item => {
        const price = parse(item.wholesale_price);
        if (price > 0 && seasonalityMap.has(item.vegetable)) {
            const month = dayjs(item.date).month(); // 0-11
            const entry = seasonalityMap.get(item.vegetable)[month];
            // We need to create a new object to avoid reference issues if I initialized wrongly, 
            // but here I initialized with fill, so all indices point to SAME object. 
            // Wait, new Array(12).fill({...}) creates references to the SAME object.
            // I must fix initialization.
        }
    });
    
    // Re-initialize correctly
    vegetables.forEach(veg => {
        const months = [];
        for(let i=0; i<12; i++) months.push({ total: 0, count: 0 });
        seasonalityMap.set(veg, months);
    });

    data.forEach(item => {
        const price = parse(item.wholesale_price);
        if (price > 0 && seasonalityMap.has(item.vegetable)) {
            const month = dayjs(item.date).month(); // 0-11
            const entry = seasonalityMap.get(item.vegetable)[month];
            entry.total += price;
            entry.count++;
        }
    });

    const heatmapData = [];
    vegetables.forEach((veg, yIndex) => {
        const months = seasonalityMap.get(veg);
        months.forEach((m, xIndex) => {
            if (m.count > 0) {
                const avg = parseFloat((m.total / m.count).toFixed(2));
                heatmapData.push([xIndex, yIndex, avg]);
            }
        });
    });

    // Calculate dynamic height: 30px per vegetable + 100px padding
    const chartHeight = Math.max(600, vegetables.length * 30 + 100);
    document.getElementById('seasonalityChart').style.height = `${chartHeight}px`;

    Highcharts.chart('seasonalityChart', {
        chart: {
            type: 'heatmap',
            backgroundColor: 'transparent',
            style: { fontFamily: 'Outfit' },
            height: chartHeight // Set explicit height
        },
        title: { text: '' },
        xAxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            labels: { style: { color: '#94A3B8' } }
        },
        yAxis: {
            categories: vegetables,
            title: null,
            labels: { 
                style: { 
                    color: '#94A3B8',
                    fontSize: '12px'
                },
                step: 1 // Force show all labels
            },
            reversed: true
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
                return '<b>' + this.series.yAxis.categories[this.point.y] + '</b><br>' +
                    this.series.xAxis.categories[this.point.x] + ': <br><b>₹' + this.point.value + '</b>';
            }
        },
        credits: { enabled: false },
        series: [{
            name: 'Avg Price',
            borderWidth: 1,
            borderColor: '#1e293b',
            data: heatmapData,
            dataLabels: {
                enabled: false,
                color: '#000000'
            }
        }]
    });
}

function renderBarChart(containerId, data, yAxisTitle, color) {
    Highcharts.chart(containerId, {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            style: { fontFamily: 'Outfit' }
        },
        title: { text: '' },
        xAxis: {
            categories: data.map(d => d.name),
            lineColor: 'rgba(255, 255, 255, 0.1)',
            tickColor: 'rgba(255, 255, 255, 0.1)',
            labels: { style: { color: '#94A3B8' } }
        },
        yAxis: {
            title: { text: yAxisTitle, style: { color: '#94A3B8' } },
            gridLineColor: 'rgba(255, 255, 255, 0.05)',
            labels: { style: { color: '#94A3B8' } }
        },
        legend: { enabled: false },
        tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            style: { color: '#F8FAFC' },
            borderWidth: 0,
            valueDecimals: 2,
            pointFormat: '<b>{point.y}</b>'
        },
        credits: { enabled: false },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0
            }
        },
        series: [{
            data: data,
            color: color
        }]
    });
}
