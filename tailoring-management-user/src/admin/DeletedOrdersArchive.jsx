import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import { getDeletedOrdersArchive } from '../api/DeletedOrdersArchiveApi';
import '../adminStyle/deletedOrdersArchive.css';

const SERVICE_FILTERS = [
  { value: '', label: 'All Services' },
  { value: 'dry_cleaning', label: 'Dry Clean' },
  { value: 'rental', label: 'Rental' },
  { value: 'customization', label: 'Customization' },
  { value: 'repair', label: 'Repair' }
];

const serviceLabel = (serviceType) => {
  const key = String(serviceType || '').toLowerCase();
  if (key === 'dry_cleaning') return 'Dry Clean';
  if (key === 'customization') return 'Customization';
  if (key === 'repair') return 'Repair';
  if (key === 'rental') return 'Rental';
  return serviceType || 'N/A';
};

function DeletedOrdersArchive() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchArchive = async () => {
      setLoading(true);
      const result = await getDeletedOrdersArchive();
      setOrders(result?.orders || []);
      setLoading(false);
    };

    fetchArchive();
  }, []);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((row) => {
      const normalizedService = String(row.service_type || '').toLowerCase();
      const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
      const rowDate = row.deleted_at ? new Date(row.deleted_at) : null;

      const matchesService = !serviceTypeFilter || normalizedService === serviceTypeFilter;

      const matchesSearch =
        !normalizedSearch
        || String(row.order_id || '').toLowerCase().includes(normalizedSearch)
        || String(row.item_id || '').toLowerCase().includes(normalizedSearch)
        || String(row.customer_name || '').toLowerCase().includes(normalizedSearch);

      const matchesStartDate = !startDate || (rowDate && rowDate >= new Date(`${startDate}T00:00:00`));
      const matchesEndDate = !endDate || (rowDate && rowDate <= new Date(`${endDate}T23:59:59`));

      return matchesService && matchesSearch && matchesStartDate && matchesEndDate;
    });
  }, [orders, serviceTypeFilter, searchTerm, startDate, endDate]);

  return (
    <div className="deleted-orders-archive-page">
      <Sidebar />
      <AdminHeader />

      <div className="archive-content">
        <div className="archive-header">
          <h2>Deleted Orders Archive</h2>
          <p>All deleted orders are listed here.</p>
        </div>

        <div className="archive-filters">
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
          >
            {SERVICE_FILTERS.map((service) => (
              <option key={service.value || 'all'} value={service.value}>
                {service.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search Order ID, Item ID, or Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start Date"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End Date"
          />
        </div>

        <div className="archive-table-wrap">
          {loading ? (
            <div className="archive-loading">Loading deleted orders...</div>
          ) : (
            <table className="archive-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Item ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Approval Status</th>
                  <th>Payment Status</th>
                  <th>Amount</th>
                  <th>Deleted At</th>
                  <th>Deleted By</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="archive-empty">No deleted orders found for selected filters.</td>
                  </tr>
                ) : (
                  filteredOrders.map((row) => (
                    <tr key={row.archive_id}>
                      <td>#{row.order_id || 'N/A'}</td>
                      <td>{row.item_id || 'N/A'}</td>
                      <td>{row.customer_name || 'N/A'}</td>
                      <td>{serviceLabel(row.service_type)}</td>
                      <td>{row.approval_status || 'N/A'}</td>
                      <td>{row.payment_status || 'N/A'}</td>
                      <td>
                        ₱{parseFloat(row.final_price || row.price || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td>{row.deleted_at ? new Date(row.deleted_at).toLocaleString() : 'N/A'}</td>
                      <td>{row.deleted_by_name || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeletedOrdersArchive;
