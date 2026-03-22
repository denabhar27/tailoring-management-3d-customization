import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import ClerkModal from './ClerkModal';
import ClerkTable from './ClerkTable';
import './ClerkTable.css';
import { getClerks, createClerk, deactivateClerk, updateClerk } from '../api/ClerkApi';
import { getUserRole } from '../api/AuthApi';

function ClerkManagement() {
  const navigate = useNavigate();
  const [clerks, setClerks] = useState([]);
  const [clerkLoading, setClerkLoading] = useState(false);
  const [showClerkModal, setShowClerkModal] = useState(false);
  const [creatingClerk, setCreatingClerk] = useState(false);
  const [editingClerk, setEditingClerk] = useState(null);

  useEffect(() => {
    const role = getUserRole();
    if (role !== 'admin') {
      navigate('/customize', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchClerks = async () => {
      try {
        setClerkLoading(true);
        const res = await getClerks();
        if (res.success) {
          setClerks(res.clerks || []);
        }
      } catch (err) {
        console.error('Error loading clerks:', err);
      } finally {
        setClerkLoading(false);
      }
    };

    fetchClerks();
  }, []);

  return (
    <div className="admin-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <h2>Clerk Accounts Management</h2>
        </div>

        <div className="clerk-management">
          <div className="clerk-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>Clerk Accounts Management</h2>
              <p className="clerk-subtitle" style={{ margin: 0 }}>Clerks have operational access only. Billing and analytics are hidden.</p>
            </div>
            <button className="btn-primary-shared" onClick={() => setShowClerkModal(true)}>Create New Clerk</button>
          </div>

          <ClerkTable
            clerks={clerks}
            onDeactivate={async (clerk) => {
              const res = await deactivateClerk(clerk.user_id || clerk.id);
              if (res.success) {
                setClerks((prev) => prev.map((c) => (c.user_id === (clerk.user_id || clerk.id) ? { ...c, status: 'inactive' } : c)));
              } else {
                window.alert(res.message || 'Failed to update clerk');
              }
            }}
            onEdit={(clerk) => {
              setEditingClerk(clerk);
              setShowClerkModal(true);
            }}
          />

          {clerkLoading && <p style={{ padding: '12px 16px' }}>Loading clerks...</p>}
        </div>
      </div>

      <ClerkModal
        isOpen={showClerkModal}
        onClose={() => {
          setShowClerkModal(false);
          setEditingClerk(null);
        }}
        submitting={creatingClerk}
        initialData={editingClerk}
        mode={editingClerk ? 'edit' : 'create'}
        onSubmit={async (payload) => {
          setCreatingClerk(true);
          if (editingClerk) {
            const res = await updateClerk(editingClerk.user_id || editingClerk.id, payload);
            setCreatingClerk(false);
            if (res.success) {
              setClerks((prev) => prev.map((c) => (c.user_id === (editingClerk.user_id || editingClerk.id) ? { ...c, ...payload, status: c.status } : c)));
              setShowClerkModal(false);
              setEditingClerk(null);
            } else {
              window.alert(res.message || 'Failed to update clerk');
            }
          } else {
            const res = await createClerk(payload);
            setCreatingClerk(false);
            if (res.success) {
              setClerks((prev) => [res.clerk, ...prev]);
              setShowClerkModal(false);
            } else {
              window.alert(res.message || 'Failed to create clerk');
            }
          }
        }}
      />
    </div>
  );
}

export default ClerkManagement;
