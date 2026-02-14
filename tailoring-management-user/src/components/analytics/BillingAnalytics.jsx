import React, { useState, useEffect } from 'react';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  RevenueTrendChart,
  RevenueComparisonChart
} from './AnalyticsCharts';
import {
  getRevenueTrend,
  getRevenueComparison
} from '../../api/AnalyticsApi';
import { exportRevenueTrend, exportRevenueComparison, exportBillingData } from '../../utils/excelExport';
import './AnalyticsDashboard.css';

const BillingAnalytics = () => {
  
  const [trendData, setTrendData] = useState([]);
  const [comparisonData, setComparisonData] = useState({ data: [], periodLabel: {} });

  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [comparisonPeriod, setComparisonPeriod] = useState('monthly');
  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedServices, setSelectedServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState({
    trend: false,
    comparison: false
  });

  
  const [exportLoading, setExportLoading] = useState({
    trend: false,
    comparison: false,
    full: false
  });
  const [exportSuccess, setExportSuccess] = useState('');

  
  const handleExport = async (type, exportFn, data, period = null) => {
    setExportLoading(prev => ({ ...prev, [type]: true }));
    try {
      if (period) {
        await exportFn(data, period);
      } else {
        await exportFn(data);
      }
      setExportSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`);
      setTimeout(() => setExportSuccess(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  
  const handleExportAll = async () => {
    setExportLoading(prev => ({ ...prev, full: true }));
    try {
      await exportBillingData(trendData, comparisonData, trendPeriod, comparisonPeriod);
      setExportSuccess('All billing data exported successfully!');
      setTimeout(() => setExportSuccess(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(prev => ({ ...prev, full: false }));
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [trendRes, comparisonRes] = await Promise.all([
        getRevenueTrend(trendPeriod, dateRange.startDate, dateRange.endDate, selectedServices),
        getRevenueComparison(comparisonPeriod)
      ]);

      if (trendRes.success) setTrendData(trendRes.data);
      if (comparisonRes.success) setComparisonData({ data: comparisonRes.data, periodLabel: comparisonRes.periodLabel });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    setChartLoading(prev => ({ ...prev, trend: true }));
    try {
      const res = await getRevenueTrend(trendPeriod, dateRange.startDate, dateRange.endDate, selectedServices);
      if (res.success) setTrendData(res.data);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    } finally {
      setChartLoading(prev => ({ ...prev, trend: false }));
    }
  };

  const fetchComparisonData = async () => {
    setChartLoading(prev => ({ ...prev, comparison: true }));
    try {
      const res = await getRevenueComparison(comparisonPeriod);
      if (res.success) setComparisonData({ data: res.data, periodLabel: res.periodLabel });
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setChartLoading(prev => ({ ...prev, comparison: false }));
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!loading) fetchTrendData();
  }, [trendPeriod]);

  useEffect(() => {
    if (!loading) fetchComparisonData();
  }, [comparisonPeriod]);

  const setQuickDateRange = (preset) => {
    const today = new Date();
    let start, end;
    
    switch (preset) {
      case 'today':
        start = end = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'month':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'last30':
        start = format(subDays(today, 30), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'last90':
        start = format(subDays(today, 90), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      default:
        return;
    }
    
    setDateRange({ startDate: start, endDate: end });
  };

  const handleApplyFilters = () => {
    fetchAllData();
  };

  const toggleServiceFilter = (service) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="header-content">
          <h2>Revenue Analytics</h2>
          <p>Revenue trends and performance comparisons</p>
        </div>
        <button 
          className={`export-all-btn ${exportLoading.full ? 'loading' : ''}`}
          onClick={handleExportAll}
          disabled={exportLoading.full || loading}
        >
          {exportLoading.full ? (
            <>
              <span className="export-spinner"></span>
              Exporting...
            </>
          ) : (
            <>
              Export All to Excel
            </>
          )}
        </button>
      </div>
      {exportSuccess && (
        <div className="export-success-notification">
          {exportSuccess}
        </div>
      )}
      <div className="analytics-filters billing-filters">
        <div className="filter-group">
          <label>Date Range</label>
          <div className="date-inputs">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Quick Select</label>
          <select 
            value="" 
            onChange={(e) => {
              if (e.target.value) {
                setQuickDateRange(e.target.value);
                e.target.value = ''; 
              }
            }}
            className="analytics-filter-select"
          >
            <option value="">Select preset...</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Service Type</label>
          <select 
            value={selectedServices.length === 1 ? selectedServices[0] : ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                setSelectedServices([]);
              } else {
                setSelectedServices([value]);
              }
            }}
            className="analytics-filter-select"
          >
            <option value="">All Services</option>
            {['Customization', 'Dry Cleaning', 'Repair', 'Rental'].map(service => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <button className="apply-filters-btn" onClick={handleApplyFilters}>
          Apply Filters
        </button>
      </div>
      <div className="charts-grid">
        <div className="chart-container trend-chart">
          <div className="chart-header">
            <h3>Revenue Trend</h3>
            <div className="chart-controls">
              <div className="period-selector">
                <label>View by:</label>
                <select value={trendPeriod} onChange={(e) => setTrendPeriod(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <button 
                className={`export-btn ${exportLoading.trend ? 'loading' : ''}`}
                onClick={() => handleExport('trend', exportRevenueTrend, trendData, trendPeriod)}
                disabled={exportLoading.trend || trendData.length === 0}
                title="Export to Excel"
              >
                {exportLoading.trend ? '...' : 'Export'}
              </button>
            </div>
          </div>
          <div className="chart-body">
            {chartLoading.trend ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <RevenueTrendChart data={trendData} period={trendPeriod} />
            )}
          </div>
        </div>
        <div className="chart-container comparison-chart">
          <div className="chart-header">
            <h3>Revenue Comparison</h3>
            <div className="chart-controls">
              <div className="period-selector">
                <label>Compare:</label>
                <select value={comparisonPeriod} onChange={(e) => setComparisonPeriod(e.target.value)}>
                  <option value="daily">Today vs Yesterday</option>
                  <option value="weekly">This Week vs Last Week</option>
                  <option value="monthly">This Month vs Last Month</option>
                  <option value="yearly">This Year vs Last Year</option>
                </select>
              </div>
              <button 
                className={`export-btn ${exportLoading.comparison ? 'loading' : ''}`}
                onClick={() => handleExport('comparison', exportRevenueComparison, comparisonData.data, comparisonPeriod)}
                disabled={exportLoading.comparison || !comparisonData.data}
                title="Export to Excel"
              >
                {exportLoading.comparison ? '...' : 'Export'}
              </button>
            </div>
          </div>
          <div className="chart-body">
            {chartLoading.comparison ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <RevenueComparisonChart 
                data={comparisonData.data} 
                periodLabel={comparisonData.periodLabel} 
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default BillingAnalytics;
