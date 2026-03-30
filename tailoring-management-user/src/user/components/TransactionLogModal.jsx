import React, { useState, useEffect } from 'react';
import { getTransactionLogsByOrderItem } from '../../api/TransactionLogApi';
import './TransactionLogModal.css';

const TransactionLogModal = ({ isOpen, onClose, orderItemId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && orderItemId) {
      fetchTransactionLogs();
    }
  }, [isOpen, orderItemId]);

  const fetchTransactionLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getTransactionLogsByOrderItem(orderItemId);
      if (result.success) {
        setLogs(result.logs || []);
      } else {
        setError(result.message || 'Failed to load transaction logs');
      }
    } catch (err) {
      setError('Failed to load transaction logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTransactionType = (type) => {
    const typeMap = {
      'payment': 'Payment',
      'down_payment': 'Down Payment',
      'downpayment': 'Down Payment',
      'final_payment': 'Final Payment',
      'partial_payment': 'Partial Payment',
      'refund': 'Refund',
      'adjustment': 'Adjustment',
      'price_change': 'Price Change'
    };
    return typeMap[type] || type;
  };

  const formatPaymentStatus = (status) => {
    const statusMap = {
      'unpaid': 'Unpaid',
      'paid': 'Paid',
      'down-payment': 'Down-payment',
      'fully_paid': 'Fully Paid',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  if (!isOpen) return null;

  return (
    <div className="transaction-log-modal-overlay" onClick={onClose}>
      <div className="transaction-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transaction-log-modal-header">
          <h3>Transaction Log</h3>
          <button className="transaction-log-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="transaction-log-modal-content">
          {loading ? (
            <div className="transaction-log-loading">Loading transaction logs...</div>
          ) : error ? (
            <div className="transaction-log-error">{error}</div>
          ) : logs.length === 0 ? (
            <div className="transaction-log-empty">No transaction logs found</div>
          ) : (
            <div className="transaction-log-list">
              {logs.map((log) => (
                <div key={log.log_id} className="transaction-log-item">
                  <div className="transaction-log-header">
                    <div className="transaction-log-type">
                      <span className={`transaction-type-badge ${log.transaction_type}`}>
                        {formatTransactionType(log.transaction_type)}
                      </span>
                    </div>
                    <div className="transaction-log-amount">
                      <span className="amount-value">₱{parseFloat(log.amount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="transaction-log-details">
                    <div className="transaction-detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{formatDate(log.created_at)}</span>
                    </div>
                    {log.notes && (
                      <div className="transaction-detail-row">
                        <span className="detail-label">Details:</span>
                        <span className="detail-value">{log.notes}</span>
                      </div>
                    )}
                    {log.created_by && (
                      <div className="transaction-detail-row">
                        <span className="detail-label">Handled By:</span>
                        <span className="detail-value">{log.created_by}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="transaction-log-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionLogModal;

