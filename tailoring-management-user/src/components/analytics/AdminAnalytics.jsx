import React, { useState, useEffect } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  ServiceRevenuePieChart,
  TopServicesBarChart
} from './AnalyticsCharts';
import {
  getRevenueByService,
  getTopServices
} from '../../api/AnalyticsApi';
import './AnalyticsDashboard.css';

const AdminAnalytics = () => {
  
  const [serviceData, setServiceData] = useState([]);
  const [topServices, setTopServices] = useState([]);

  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState({
    service: false,
    top: false
  });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [serviceRes, topRes] = await Promise.all([
        getRevenueByService(dateRange.startDate, dateRange.endDate),
        getTopServices(dateRange.startDate, dateRange.endDate)
      ]);

      if (serviceRes.success) setServiceData(serviceRes.data);
      if (topRes.success) setTopServices(topRes.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const setQuickDateRange = (preset) => {
    const today = new Date();
    let start, end;
    
    switch (preset) {
      case 'today':
        start = end = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
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
        <h2>Service Analytics</h2>
        <p>Revenue breakdown by service type and top performing services</p>
      </div>
      <div className="analytics-filters">
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
            <option value="month">This Month</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
          </select>
        </div>

        <button className="apply-filters-btn" onClick={handleApplyFilters}>
          Apply Filters
        </button>
      </div>
      <div className="charts-grid">
        <div className="chart-container pie-chart">
          <div className="chart-body">
            <ServiceRevenuePieChart data={serviceData} />
          </div>
        </div>
        <div className="chart-container bar-chart">
          <div className="chart-body">
            <TopServicesBarChart data={topServices} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminAnalytics;
