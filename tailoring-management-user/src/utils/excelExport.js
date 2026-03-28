import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const getFormattedDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return '₱0.00';
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getColumnWidths = (data, headers) => {
  const widths = headers.map(header => {
    const maxLength = Math.max(
      header.length,
      ...data.map(row => {
        const value = row[header];
        return value ? String(value).length : 0;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  return widths;
};

export const exportToExcel = async ({
  data,
  filename,
  sheetName = 'Data',
  headers = null,
  columnFormatters = {},
  receiptInfo = null
}) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const excelData = [];

    // Add receipt header if receiptInfo is provided
    if (receiptInfo) {
      excelData.push(['REPORT RECEIPT']);
      excelData.push([`Exported by: ${receiptInfo.clerkName || 'Unknown'}`]);
      excelData.push([`Export Date: ${receiptInfo.exportDate || new Date().toLocaleDateString()}`]);
      excelData.push([`Report Type: ${receiptInfo.reportType || 'General Report'}`]);
      excelData.push([`Total Records: ${data.length}`]);
      excelData.push([]); // Empty row for spacing
    }

    // Calculate summary statistics
    const serviceStats = {};
    const statusStats = {};
    let grandTotal = 0;

    data.forEach(item => {
      const service = item['Service/Category'] || 'Unknown';
      const status = item['Status'] || 'Unknown';
      const amount = parseFloat(item['Amount/Price']) || 0;

      // Service statistics
      if (!serviceStats[service]) {
        serviceStats[service] = { count: 0, total: 0 };
      }
      serviceStats[service].count++;
      serviceStats[service].total += amount;

      // Status statistics
      if (!statusStats[status]) {
        statusStats[status] = { count: 0, total: 0 };
      }
      statusStats[status].count++;
      statusStats[status].total += amount;

      grandTotal += amount;
    });

    // Add summary section
    excelData.push(['SUMMARY STATISTICS']);
    excelData.push([]); // Empty row

    // Create side-by-side summary
    const maxRows = Math.max(Object.keys(serviceStats).length, Object.keys(statusStats).length) + 2; // +2 for headers and totals

    for (let i = 0; i < maxRows; i++) {
      const row = ['', '', '', '']; // 4 columns: Service Stats | | Status Stats

      if (i === 0) {
        // Headers
        row[0] = 'SERVICE TYPE';
        row[1] = 'ITEMS';
        row[2] = 'TOTAL AMOUNT';
        row[3] = '';
        row[4] = '';
        row[5] = 'STATUS';
        row[6] = 'ITEMS';
        row[7] = 'TOTAL AMOUNT';
      } else if (i === 1) {
        // Separator
        row[0] = '============';
        row[1] = '=====';
        row[2] = '============';
        row[3] = '';
        row[4] = '';
        row[5] = '======';
        row[6] = '=====';
        row[7] = '============';
      } else {
        // Service stats
        const serviceIndex = i - 2;
        const services = Object.entries(serviceStats);
        if (serviceIndex < services.length) {
          const [service, stats] = services[serviceIndex];
          row[0] = service;
          row[1] = stats.count;
          row[2] = formatCurrency(stats.total);
        }

        // Status stats
        const statusIndex = i - 2;
        const statuses = Object.entries(statusStats);
        if (statusIndex < statuses.length) {
          const [status, stats] = statuses[statusIndex];
          row[5] = status;
          row[6] = stats.count;
          row[7] = formatCurrency(stats.total);
        }

        // Grand total row
        if (serviceIndex === services.length && statusIndex === statuses.length) {
          row[0] = 'GRAND TOTAL';
          row[1] = data.length;
          row[2] = formatCurrency(grandTotal);
          row[5] = 'GRAND TOTAL';
          row[6] = data.length;
          row[7] = formatCurrency(grandTotal);
        }
      }

      excelData.push(row);
    }

    excelData.push([]); // Empty row
    excelData.push(['DETAILED REPORT']);
    excelData.push([]); // Empty row

    // Add column headers
    const keys = headers || Object.keys(data[0]);
    excelData.push(keys);

    // Add data rows
    const formattedData = data.map(row => {
      const formattedRow = {};

      keys.forEach(key => {
        let value = row[key];

        if (columnFormatters[key]) {
          value = columnFormatters[key](value);
        } else if (typeof value === 'number' && key.toLowerCase().includes('price') ||
                   key.toLowerCase().includes('amount') ||
                   key.toLowerCase().includes('revenue') ||
                   key.toLowerCase().includes('total')) {
          value = formatCurrency(value);
        } else if (key.toLowerCase().includes('date')) {
          value = formatDate(value);
        }

        formattedRow[key] = value;
      });

      return formattedRow;
    });

    // Add formatted data rows
    formattedData.forEach(row => {
      const dataRow = keys.map(key => row[key]);
      excelData.push(dataRow);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    const allKeys = keys.length > 0 ? [...keys] : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    worksheet['!cols'] = allKeys.map((_, index) => {
      if (index < 3 || index >= 5) { // Service and Status columns
        return { wch: 20 };
      } else { // Separator columns
        return { wch: 5 };
      }
    });

    // Add merges for receipt header if present
    const merges = [];
    if (receiptInfo) {
      merges.push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: allKeys.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: allKeys.length - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: allKeys.length - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: allKeys.length - 1 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: allKeys.length - 1 } }
      );
    }

    // Add merge for summary statistics header
    const summaryStartRow = receiptInfo ? 7 : 0;
    merges.push({ s: { r: summaryStartRow, c: 0 }, e: { r: summaryStartRow, c: allKeys.length - 1 } });

    // Add merge for detailed report header
    const detailedStartRow = summaryStartRow + maxRows + 2;
    merges.push({ s: { r: detailedStartRow, c: 0 }, e: { r: detailedStartRow, c: allKeys.length - 1 } });

    worksheet['!merges'] = merges;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fullFilename = `${filename}_${getFormattedDate()}.xlsx`;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fullFilename);

    return true;
  } catch (error) {
    console.error('Excel export error:', error);
    throw error;
  }
};

export const exportRevenueTrend = async (data, period = 'daily') => {
  if (!data || data.length === 0) {
    throw new Error('No revenue trend data to export');
  }

  const formattedData = data.map(item => ({
    'Period': item.label || item.date || item.period,
    'Revenue': item.revenue || item.value || 0,
    'Orders': item.orders || item.count || 0,
    'Average Order Value': item.revenue && item.orders ? (item.revenue / item.orders) : 0
  }));

  return exportToExcel({
    data: formattedData,
    filename: `revenue_trend_${period}`,
    sheetName: `Revenue Trend (${period})`,
    columnFormatters: {
      'Revenue': formatCurrency,
      'Average Order Value': formatCurrency
    }
  });
};

export const exportServiceRevenue = async (data) => {
  if (!data || data.length === 0) {
    throw new Error('No service revenue data to export');
  }

  const total = data.reduce((sum, item) => sum + (item.revenue || item.value || 0), 0);

  const formattedData = data.map(item => ({
    'Service': item.service || item.label || item.name,
    'Revenue': item.revenue || item.value || 0,
    'Percentage': total > 0 ? `${((item.revenue || item.value || 0) / total * 100).toFixed(2)}%` : '0%',
    'Orders': item.orders || item.count || 0
  }));

  formattedData.push({
    'Service': 'TOTAL',
    'Revenue': total,
    'Percentage': '100%',
    'Orders': data.reduce((sum, item) => sum + (item.orders || item.count || 0), 0)
  });

  return exportToExcel({
    data: formattedData,
    filename: 'service_revenue_breakdown',
    sheetName: 'Service Revenue',
    columnFormatters: {
      'Revenue': formatCurrency
    }
  });
};

export const exportTopServices = async (data) => {
  if (!data || data.length === 0) {
    throw new Error('No top services data to export');
  }

  const formattedData = data.map((item, index) => ({
    'Rank': index + 1,
    'Service': item.service || item.name || item.label,
    'Revenue': item.revenue || item.value || 0,
    'Orders': item.orders || item.count || 0,
    'Average Price': item.revenue && item.orders ? (item.revenue / item.orders) : 0
  }));

  return exportToExcel({
    data: formattedData,
    filename: 'top_services',
    sheetName: 'Top Services',
    columnFormatters: {
      'Revenue': formatCurrency,
      'Average Price': formatCurrency
    }
  });
};

export const exportRevenueComparison = async (data, periodLabel = '') => {
  if (!data) {
    throw new Error('No comparison data to export');
  }

  const formattedData = [];

  if (Array.isArray(data)) {
    data.forEach(item => {
      formattedData.push({
        'Category': item.label || item.category,
        'Current Period': item.current || 0,
        'Previous Period': item.previous || 0,
        'Change': item.current && item.previous ? item.current - item.previous : 0,
        'Change %': item.previous > 0 ? `${(((item.current - item.previous) / item.previous) * 100).toFixed(2)}%` : 'N/A'
      });
    });
  } else {
    formattedData.push({
      'Metric': 'Total Revenue',
      'Current Period': data.currentRevenue || data.current || 0,
      'Previous Period': data.previousRevenue || data.previous || 0,
      'Change': (data.currentRevenue || data.current || 0) - (data.previousRevenue || data.previous || 0),
      'Change %': data.previousRevenue > 0 ?
        `${(((data.currentRevenue - data.previousRevenue) / data.previousRevenue) * 100).toFixed(2)}%` : 'N/A'
    });
  }

  return exportToExcel({
    data: formattedData,
    filename: `revenue_comparison_${periodLabel.replace(/\s+/g, '_').toLowerCase()}`,
    sheetName: 'Revenue Comparison',
    columnFormatters: {
      'Current Period': formatCurrency,
      'Previous Period': formatCurrency,
      'Change': formatCurrency
    }
  });
};

export const exportBillingData = async (data) => {
  if (!data || data.length === 0) {
    throw new Error('No billing data to export');
  }

  const formattedData = data.map(item => ({
    'Transaction ID': item.transaction_id || item.id,
    'Date': item.date || item.created_at || item.transaction_date,
    'Customer': item.customer_name || item.customer || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
    'Service Type': item.service_type || item.type,
    'Description': item.description || item.service_name || '',
    'Amount': item.amount || item.total || item.price || 0,
    'Payment Status': item.payment_status || item.status,
    'Payment Method': item.payment_method || 'N/A'
  }));

  return exportToExcel({
    data: formattedData,
    filename: 'billing_transactions',
    sheetName: 'Transactions',
    columnFormatters: {
      'Amount': formatCurrency
    }
  });
};

export const exportFullAnalytics = async (analyticsData) => {
  try {
    const workbook = XLSX.utils.book_new();

    const serviceData = analyticsData.serviceData || [];

    if (serviceData.length === 0) {
      throw new Error('No analytics data to export');
    }

    const totalRevenue = serviceData.reduce((sum, item) => {
      return sum + (parseFloat(item.revenue) || 0);
    }, 0);

    const totalOrders = serviceData.reduce((sum, item) => {
      return sum + (parseInt(item.orderCount) || parseInt(item.order_count) || 0);
    }, 0);

    const sortedData = [...serviceData].sort((a, b) => {
      const revenueA = parseFloat(a.revenue) || 0;
      const revenueB = parseFloat(b.revenue) || 0;
      return revenueB - revenueA;
    });

    const excelData = [];

    excelData.push(['REVENUE BY SERVICE TYPE & TOP PERFORMING SERVICES']);
    excelData.push([`Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`]);
    excelData.push([`Period: ${analyticsData.summary?.period || 'All Time'}`]);
    excelData.push([]);

    excelData.push(['Rank', 'Service Name', 'Percentage (%)', 'Revenue', 'Number of Orders']);

    sortedData.forEach((item, index) => {
      const revenue = parseFloat(item.revenue) || 0;
      const orders = parseInt(item.orderCount) || parseInt(item.order_count) || parseInt(item.orders) || 0;

      const serviceName = item.serviceType || item.service_type || item.service || item.label || item.name || 'Unknown';
      const percentage = item.percentage || (totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(2) : '0.00');

      excelData.push([
        index + 1,
        serviceName,
        `${percentage}%`,
        formatCurrency(revenue),
        orders
      ]);
    });

    excelData.push([]);

    excelData.push([
      '',
      'TOTAL',
      '100%',
      formatCurrency(totalRevenue),
      totalOrders
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 }
    ];

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Service Analytics');

    const fullFilename = `Service_Analytics_Report_${getFormattedDate()}.xlsx`;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fullFilename);

    return true;
  } catch (error) {
    console.error('Full analytics export error:', error);
    throw error;
  }
};

export default {
  exportToExcel,
  exportRevenueTrend,
  exportServiceRevenue,
  exportTopServices,
  exportRevenueComparison,
  exportBillingData,
  exportFullAnalytics
};
