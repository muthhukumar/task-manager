import React, { useRef, useState } from 'react';
import { getBackupDownloadUrl, restoreBackup } from '../api/client';
import { Download, Upload, AlertTriangle, CheckCircle2, ShieldCheck, FileArchive } from 'lucide-react';

export const BackupRestore: React.FC = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    window.location.href = getBackupDownloadUrl();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('Please select a valid .zip backup file.');
      return;
    }

    if (!confirm('Are you sure you want to restore this backup? Current database and media files will be replaced with the contents of the archive (a temporary safety backup is automatically taken on the server).')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreStatus(null);
      const res = await restoreBackup(file);
      setRestoreStatus({ success: true, message: res.message || 'Database and media successfully restored!' });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setRestoreStatus({ success: false, message: err.message || 'Failed to restore backup.' });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
          Backup & Disaster Recovery
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          Safeguard your task history, comments, and media attachments with one-click full archives
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Backup Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--secondary)',
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Download size={20} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Create Full Archive Backup
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              Generates a timestamped <code style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.8125rem', border: '1px solid var(--border)' }}>.zip</code> containing your complete SQLite database (<code style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.8125rem', border: '1px solid var(--border)' }}>app.db</code>) and all uploaded image and video attachments.
            </p>

            <div
              style={{
                backgroundColor: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.8125rem',
                color: 'var(--muted-foreground)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                marginBottom: '1.5rem',
              }}
            >
              <ShieldCheck size={17} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
              <span>Uses safe transactional database snapshots so you can backup without stopping work.</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadBackup}
            style={{ width: '100%', padding: '0.625rem 1rem' }}
          >
            <Download size={16} />
            <span>Download Backup (.zip)</span>
          </button>
        </div>

        {/* Restore Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Upload size={20} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Restore from Backup Archive
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              Upload a previously generated backup <code style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.8125rem', border: '1px solid var(--border)' }}>.zip</code> file to restore all tasks, comments, and media assets.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.8125rem',
                color: '#ca8a04',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                marginBottom: '1.5rem',
              }}
            >
              <AlertTriangle size={17} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
              <span>Existing database records and attachments will be replaced. The app will reload automatically once restored.</span>
            </div>

            {restoreStatus && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: restoreStatus.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${restoreStatus.success ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  color: restoreStatus.success ? '#22c55e' : '#ef4444',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {restoreStatus.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{restoreStatus.message}</span>
              </div>
            )}
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isRestoring}
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', padding: '0.625rem 1rem' }}
            >
              <FileArchive size={16} />
              <span>{isRestoring ? 'Restoring Archive...' : 'Select .zip File & Restore'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
