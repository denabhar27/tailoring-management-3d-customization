import React from 'react';
import './ClerkTable.css';

const ClerkTable = ({ clerks, onDeactivate, onEdit }) => {
  return (
    <div className="clerk-table-wrapper">
      <div className="clerk-table-header">
        <h3>Clerk Accounts Management</h3>
        <p className="clerk-subtitle">Manage access for operational staff. Clerks cannot access billing or analytics.</p>
      </div>
      <div className="clerk-table-scroll">
        <table className="clerk-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clerks.length === 0 ? (
              <tr>
                <td colSpan="7" className="clerk-empty">No clerk accounts yet.</td>
              </tr>
            ) : (
              clerks.map((clerk) => (
                <tr key={clerk.user_id || clerk.id}>
                  <td>{clerk.user_id || clerk.id}</td>
                  <td>{[clerk.first_name, clerk.middle_name, clerk.last_name].filter(Boolean).join(' ')}</td>
                  <td>{clerk.email}</td>
                  <td>{clerk.phone_number}</td>
                  <td>
                    <span className={`clerk-status ${clerk.status === 'active' ? 'active' : 'inactive'}`}>
                      {clerk.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{clerk.created_at ? new Date(clerk.created_at).toLocaleDateString() : '—'}</td>
                  <td className="clerk-actions">
                    <button className="btn-link" onClick={() => onEdit(clerk)} title="Edit clerk">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => onDeactivate(clerk)}
                      disabled={clerk.status === 'inactive'}
                      title={clerk.status === 'inactive' ? 'Already inactive' : 'Deactivate clerk'}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClerkTable;
