import React, { useState, useEffect } from 'react';
import { getOrderItemPriceHistory } from '../../api/OrderApi';
import '../../adminStyle/PriceHistoryModal.css';

const PriceHistoryModal = ({ itemId, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPriceHistory();
  }, [itemId]);

  const fetchPriceHistory = async () => {
    try {
      setLoading(true);
      const response = await getOrderItemPriceHistory(itemId);
      if (response.success) {
        setHistory(response.history || []);
      } else {
        setError('Failed to load price history');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const parseDetails = (details) => {
    const lines = details.split('\n');
    const parsed = {};
    lines.forEach(line => {
      if (line.includes('Price Change:')) {
        const match = line.match(/₱([\d,]+\.\d{2})\s*→\s*₱([\d,]+\.\d{2})/);
        if (match) {
          parsed.oldPrice = match[1];
          parsed.newPrice = match[2];
        }
      } else if (line.includes('Changed by:')) {
        parsed.changedBy = line.split('Changed by:')[1]?.trim();
      } else if (line.includes('Reason:')) {
        parsed.reason = line.split('Reason:')[1]?.trim();
      } else if (line.includes('Customer:')) {
        parsed.customer = line.split('Customer:')[1]?.trim();
      }
    });
    return parsed;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content price-history-modal">
        <div className="modal-header">
          <h2>Price Change History</h2>
          <span className="close-modal" onClick={onClose}>×</span>
        </div>
        
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">Loading price history...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : history.length === 0 ? (
            <div className="empty-state">No price changes recorded for this order.</div>
          ) : (
            <div className="history-timeline">
              {history.map((entry, index) => {
                const details = parseDetails(entry.details);
                const oldPrice = parseFloat(details.oldPrice?.replace(/,/g, '') || 0);
                const newPrice = parseFloat(details.newPrice?.replace(/,/g, '') || 0);
                const difference = newPrice - oldPrice;
                
                return (
                  <div key={entry.id} className="history-entry">
                    <div className="entry-marker"></div>
                    <div className="entry-content">
                      <div className="entry-header">
                        <span className="entry-date">{formatDate(entry.created_at)}</span>
                        <span className={`entry-badge ${difference > 0 ? 'increase' : 'decrease'}`}>
                          {difference > 0 ? '+' : ''}₱{Math.abs(difference).toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="price-change">
                        <span className="old-price">₱{details.oldPrice}</span>
                        <span className="arrow">→</span>
                        <span className="new-price">₱{details.newPrice}</span>
                      </div>
                      
                      {details.reason && (
                        <div className="entry-reason">
                          <strong>Reason:</strong> {details.reason}
                        </div>
                      )}
                      
                      <div className="entry-meta">
                        {details.changedBy && (
                          <span className="changed-by">Changed by: {details.changedBy}</span>
                        )}
                        {details.customer && (
                          <span className="customer">Customer: {details.customer}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default PriceHistoryModal;
