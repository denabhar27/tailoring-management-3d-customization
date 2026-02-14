import React, { useState, useEffect } from 'react';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  ServiceRevenuePieChart,
  TopServicesBarChart
} from './AnalyticsCharts';
import {
  getRevenueByService,
  getTopServices
} from '../../api/AnalyticsApi';
import {
  exportFullAnalytics
} from '../../utils/excelExport';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  
  const [serviceData, setServiceData] = useState([]);
  const [topServices, setTopServices] = useState([]);

  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedServices, setSelectedServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState({
    service: false,
    top: false
  });

  
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  
  const handleExportAll = async () => {
    setExportLoading(true);
    setExportSuccess(null);
    
    try {
      await exportFullAnalytics({
        summary: {
          totalRevenue: serviceData.reduce((sum, s) => sum + (s.revenue || 0), 0),
          totalOrders: serviceData.reduce((sum, s) => sum + (s.orders || 0), 0),
          period: `${dateRange.startDate} to ${dateRange.endDate}`
        },
        serviceData,
        topServices
      });
      setExportSuccess('Analytics report exported successfully!');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export analytics: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [serviceRes, topRes] = await Promise.all([
        getRevenueByService(dateRange.startDate, dateRange.endDate, 'paid', selectedServices),
        getTopServices(dateRange.startDate, dateRange.endDate, 10, selectedServices)
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
          <p>Comprehensive insights into your business performance</p>
        </div>
        <button 
          className={`export-all-btn ${exportLoading ? 'loading' : ''}`}
          onClick={handleExportAll}
          disabled={exportLoading || loading || (serviceData.length === 0 && topServices.length === 0)}
        >
          {exportLoading ? (
            <>
              <span className="export-spinner"></span>
              Exporting...
            </>
          ) : (
            <>
              Download Excel Report
            </>
          )}
        </button>
      </div>
      {exportSuccess && (
        <div className="export-success-notification">
          {exportSuccess}
        </div>
      )}
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
          <div className="quick-date-buttons">
            <button onClick={() => setQuickDateRange('today')}>Today</button>
            <button onClick={() => setQuickDateRange('week')}>This Week</button>
            <button onClick={() => setQuickDateRange('month')}>This Month</button>
            <button onClick={() => setQuickDateRange('last30')}>Last 30 Days</button>
            <button onClick={() => setQuickDateRange('last90')}>Last 90 Days</button>
          </div>
        </div>

        <div className="filter-group">
          <label>Service Type</label>
          <div className="service-filter-buttons">
            {['Customization', 'Dry Cleaning', 'Repair', 'Rental'].map(service => (
              <button
                key={service}
                className={selectedServices.includes(service) ? 'active' : ''}
                onClick={() => toggleServiceFilter(service)}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        <button className="apply-filters-btn" onClick={handleApplyFilters}>
          Apply Filters
        </button>
      </div>
      <div className="charts-grid">
        <div className="chart-container pie-chart">
          <div className="chart-header">
            <h3>Service Revenue Distribution</h3>
          </div>
          <div className="chart-body">
            <ServiceRevenuePieChart data={serviceData} />
          </div>
        </div>
        <div className="chart-container bar-chart">
          <div className="chart-header">
            <h3>Top Services</h3>
          </div>
          <div className="chart-body">
            <TopServicesBarChart data={topServices} />
          </div>
        </div>

      </div>

    </div>
  );
};

export default AnalyticsDashboard;
