document.addEventListener('DOMContentLoaded', async () => {
    const vegSelect = document.getElementById('veg-select');
    const currentPriceEl = document.getElementById('current-price');
    const avgPriceEl = document.getElementById('avg-price');
    
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
        // Filter data for the selected vegetable
        const vegData = allData
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
        
        // Prepare data for Highcharts: [value] (categories will be dates)
        const dailyPrices = sortedDates.map(date => {
            const prices = dateMap.get(date);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            return avg;
        });

        // Calculate Moving Average manually since we are using basic Highcharts
        const ma7 = calculateMovingAverage(dailyPrices, 7);

        // Slice last 5 years (approx 1825 days) for display
        const sliceCount = 1825;
        const startIndex = Math.max(0, sortedDates.length - sliceCount);
        
        const categories = sortedDates.slice(startIndex).map(date => dayjs(date).format('MMM DD, YYYY'));
        const displayPrices = dailyPrices.slice(startIndex);
        const displayMA = ma7.slice(startIndex);

        // Update Stats
        const currentPrice = displayPrices[displayPrices.length - 1] || 0;
        
        currentPriceEl.textContent = `₹${currentPrice.toFixed(2)}`;
        
        const avgPrice = displayPrices.reduce((a, b) => a + b, 0) / displayPrices.length;
        avgPriceEl.textContent = `₹${avgPrice.toFixed(2)}`;

        // Render Highcharts Basic AreaSpline
        Highcharts.chart('priceChart', {
            chart: {
                type: 'areaspline',
                backgroundColor: 'transparent',
                style: {
                    fontFamily: 'Outfit'
                },
                zoomType: 'x' // Enable zooming
            },
            title: {
                text: ''
            },
            legend: {
                itemStyle: {
                    color: '#94A3B8'
                },
                itemHoverStyle: {
                    color: '#F8FAFC'
                }
            },
            xAxis: {
                categories: categories,
                lineColor: 'rgba(255, 255, 255, 0.1)',
                tickColor: 'rgba(255, 255, 255, 0.1)',
                labels: {
                    style: {
                        color: '#94A3B8'
                    },
                    // For 5 years of data, we need to reduce label density
                    step: Math.floor(categories.length / 10) 
                }
            },
            yAxis: {
                title: {
                    text: 'Price (₹)',
                    style: {
                        color: '#94A3B8'
                    }
                },
                gridLineColor: 'rgba(255, 255, 255, 0.05)',
                labels: {
                    style: {
                        color: '#94A3B8'
                    }
                }
            },
            tooltip: {
                shared: true,
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                style: {
                    color: '#F8FAFC'
                },
                borderWidth: 0
            },
            credits: {
                enabled: false
            },
            plotOptions: {
                areaspline: {
                    fillOpacity: 0.5
                }
            },
            series: [{
                name: '7-Day MA',
                type: 'spline',
                data: displayMA,
                color: '#FFAB00',
                dashStyle: 'Solid',
                marker: {
                    enabled: false, // Disable markers for 5-year view to avoid clutter
                    states: {
                        hover: {
                            enabled: true
                        }
                    }
                }
            }]
        });
    }
});
