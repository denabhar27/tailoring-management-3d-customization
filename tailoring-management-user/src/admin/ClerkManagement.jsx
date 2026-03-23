import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import ClerkModal from './ClerkModal';
import ClerkTable from './ClerkTable';
import './ClerkTable.css';
import { getClerks, createClerk, deactivateClerk, activateClerk, updateClerk } from '../api/ClerkApi';
import { getUserRole } from '../api/AuthApi';
import { useAlert } from '../context/AlertContext';

function ClerkManagement() {
  const navigate = useNavigate();
  const { alert, confirm } = useAlert();
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

  const isClerkActive = (status) => {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === '1') return true;
    if (normalizedStatus === '0') return false;
    if (normalizedStatus === 'active' || normalizedStatus === 'activated') return true;
    if (normalizedStatus === 'inactive' || normalizedStatus === 'deactivated') return false;
    return false;
  };

  return (
    <div className="admin-page clerk-management-page">
      <Sidebar />
      <AdminHeader />

      <div className="content">
        <div className="dashboard-title">
          <div>
            <h2>Clerk Account Management</h2>
            <p className="clerk-subtitle">Clerks have operational access only. Billing and analytics are hidden.</p>
          </div>
          <button className="btn-primary-shared clerk-create-btn" onClick={() => setShowClerkModal(true)}>Create New Clerk</button>
        </div>

        <div className="clerk-management">
          <ClerkTable
            clerks={clerks}
            onToggleStatus={async (clerk) => {
              const isActive = isClerkActive(clerk.status);
              const confirmMessage = isActive
                ? 'Are you sure this staff account should be deactivated?'
                : 'Are you sure this staff account should be activated?';
              const confirmed = await confirm(
                confirmMessage,
                isActive ? 'Confirm Deactivation' : 'Confirm Activation',
                'warning',
                { confirmText: isActive ? 'Deactivate' : 'Activate', cancelText: 'Cancel' }
              );

              if (!confirmed) {
                return;
              }

              const res = isActive
                ? await deactivateClerk(clerk.user_id || clerk.id)
                : await activateClerk(clerk.user_id || clerk.id);

              if (res.success) {
                setClerks((prev) => prev.map((c) => {
                  const currentId = c.user_id || c.id;
                  return currentId === (clerk.user_id || clerk.id)
                    ? { ...c, status: isActive ? 'inactive' : 'active' }
                    : c;
                }));
                await alert(
                  isActive ? 'Staff account deactivated successfully.' : 'Staff account activated successfully.',
                  isActive ? 'Deactivated' : 'Activated',
                  'success'
                );
              } else {
                await alert(res.message || 'Failed to update clerk status', 'Error', 'error');
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
              await alert('Clerk updated successfully.', 'Success', 'success');
            } else {
              await alert(res.message || 'Failed to update clerk', 'Error', 'error');
            }
          } else {
            const res = await createClerk(payload);
            setCreatingClerk(false);
            if (res.success) {
              setClerks((prev) => [res.clerk, ...prev]);
              setShowClerkModal(false);
              await alert('Clerk created successfully.', 'Success', 'success');
            } else {
              await alert(res.message || 'Failed to create clerk', 'Error', 'error');
            }
          }
        }}
      />
    </div>
  );
}

export default ClerkManagement;
