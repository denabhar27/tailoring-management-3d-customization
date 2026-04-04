import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_COLORS = {
  primary: '#8b4513',
  primaryLight: '#a0522d',
  customization: '#9c27b0',
  drycleaning: '#2196f3',
  repair: '#ff9800',
  rental: '#4caf50',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  gray: '#636e72',
  lightGray: '#dfe6e9'
};

const SERVICE_COLORS = {
  'Customization': '#9c27b0',
  'Dry Cleaning': '#2196f3',
  'Repair': '#ff9800',
  'Rental': '#4caf50',
  'Other': '#607d8b'
};

export const RevenueTrendChart = ({ data, period = 'monthly' }) => {
  const chartData = {
    labels: data?.map(d => d.period) || [],
    datasets: [
      {
        label: 'Revenue (₱)',
        data: data?.map(d => d.revenue) || [],
        borderColor: CHART_COLORS.primary,
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: CHART_COLORS.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Revenue Trend (${period.charAt(0).toUpperCase() + period.slice(1)})`,
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      },
      tooltip: {
        backgroundColor: 'rgba(45, 52, 54, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        callbacks: {
          label: (context) => `Revenue: ₱${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₱${value.toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
};

export const ServiceRevenuePieChart = ({ data }) => {
  const serviceTypes = data?.map(d => d.serviceType) || [];
  const revenues = data?.map(d => d.revenue) || [];
  const colors = serviceTypes.map(type => SERVICE_COLORS[type] || CHART_COLORS.gray);

  const chartData = {
    labels: serviceTypes,
    datasets: [
      {
        data: revenues,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 15
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 15,
          font: {
            size: 12,
            family: 'Poppins, sans-serif'
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: true,
        text: 'Revenue by Service Type',
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      },
      tooltip: {
        backgroundColor: 'rgba(45, 52, 54, 0.9)',
        callbacks: {
          label: (context) => {
            const total = revenues.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
            return `${context.label}: ₱${context.parsed.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percentage}%)`;
          }
        }
      }
    }
  };

  return <Doughnut data={chartData} options={options} />;
};

export const TopServicesBarChart = ({ data }) => {
  const chartData = {
    labels: data?.map(d => d.serviceType) || [],
    datasets: [
      {
        label: 'Revenue (₱)',
        data: data?.map(d => d.totalRevenue) || [],
        backgroundColor: data?.map(d => SERVICE_COLORS[d.serviceType] || CHART_COLORS.gray) || [],
        borderRadius: 8,
        barThickness: 40
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Top Performing Services',
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      },
      tooltip: {
        backgroundColor: 'rgba(45, 52, 54, 0.9)',
        callbacks: {
          label: (context) => `Revenue: ₱${context.parsed.x.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₱${value.toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};

export const NetLossByServiceBarChart = ({ data }) => {
  const chartData = {
    labels: data?.map(d => d.serviceType) || [],
    datasets: [
      {
        label: 'Net Loss (₱)',
        data: data?.map(d => d.totalLoss) || [],
        backgroundColor: data?.map(() => CHART_COLORS.danger) || [],
        borderRadius: 8,
        barThickness: 40
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Net Loss from Compensation',
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      },
      tooltip: {
        backgroundColor: 'rgba(45, 52, 54, 0.9)',
        callbacks: {
          label: (context) => `Loss: ₱${context.parsed.x.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₱${value.toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};

export const RevenueComparisonChart = ({ data, periodLabel }) => {
  const chartData = {
    labels: data?.map(d => d.serviceType) || [],
    datasets: [
      {
        label: periodLabel?.current || 'Current Period',
        data: data?.map(d => d.currentRevenue) || [],
        backgroundColor: CHART_COLORS.primary,
        borderRadius: 8,
        barThickness: 30
      },
      {
        label: periodLabel?.previous || 'Previous Period',
        data: data?.map(d => d.previousRevenue) || [],
        backgroundColor: CHART_COLORS.lightGray,
        borderRadius: 8,
        barThickness: 30
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 15,
          font: {
            size: 12,
            family: 'Poppins, sans-serif'
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: true,
        text: 'Revenue Comparison',
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      },
      tooltip: {
        backgroundColor: 'rgba(45, 52, 54, 0.9)',
        callbacks: {
          label: (context) => `${context.dataset.label}: ₱${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₱${value.toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};

export const OrderVolumeChart = ({ data }) => {
  const chartData = {
    labels: data?.map(d => d.period) || [],
    datasets: [
      {
        label: 'Orders',
        data: data?.map(d => d.orderCount) || [],
        borderColor: CHART_COLORS.primaryLight,
        backgroundColor: 'rgba(160, 82, 45, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: CHART_COLORS.primaryLight,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Order Volume',
        font: {
          size: 16,
          weight: '600',
          family: 'Montserrat, Poppins, sans-serif'
        },
        color: '#2d3436'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
};

export default {
  RevenueTrendChart,
  ServiceRevenuePieChart,
  TopServicesBarChart,
  RevenueComparisonChart,
  OrderVolumeChart
};
