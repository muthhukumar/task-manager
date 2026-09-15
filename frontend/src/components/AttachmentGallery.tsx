import React, { useRef, useState } from 'react';
import type { Attachment } from '../types';
import { getMediaUrl } from '../api/client';
import { Paperclip, Trash2, Film, X, Upload } from 'lucide-react';

interface Props {
  taskId: number;
  attachments: Attachment[];
  onUpload: (taskId: number, file: File) => Promise<void>;
  onDelete: (attachmentId: number) => Promise<void>;
}

export const AttachmentGallery: React.FC<Props> = ({
  taskId,
  attachments = [],
  onUpload,
  onDelete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Attachment | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      await onUpload(taskId, file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--muted-foreground)', fontSize: '0.8125rem', fontWeight: 500 }}>
          <Paperclip size={14} />
          <span>Attachments ({attachments.length})</span>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={12} />
            <span>{isUploading ? 'Uploading...' : 'Attach File'}</span>
          </button>
        </div>
      </div>

      {attachments.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {attachments.map((att) => {
            const mediaUrl = getMediaUrl(att.file_path);
            const isImage = att.file_type === 'image';

            return (
              <div
                key={att.id}
                style={{
                  position: 'relative',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  overflow: 'hidden',
                  backgroundColor: '#09090b',
                  aspectRatio: '1',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedMedia(att)}
              >
                {isImage ? (
                  <img
                    src={mediaUrl}
                    alt={att.original_filename}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a1a1aa',
                      backgroundColor: '#18181b',
                    }}
                  >
                    <Film size={22} />
                    <span
                      style={{
                        fontSize: '0.625rem',
                        marginTop: '0.25rem',
                        padding: '0 0.25rem',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '90%',
                      }}
                    >
                      {att.original_filename}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${att.original_filename}?`)) {
                      onDelete(att.id);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#fafafa',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', fontStyle: 'italic' }}>
          No attachments.
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div className="dialog-overlay" onClick={() => setSelectedMedia(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: '#09090b',
              borderRadius: '0.75rem',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fafafa',
                marginBottom: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              <span>{selectedMedia.original_filename}</span>
              <button
                type="button"
                className="btn-ghost btn-icon-sm"
                onClick={() => setSelectedMedia(null)}
                style={{ color: '#fafafa', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {selectedMedia.file_type === 'image' ? (
              <img
                src={getMediaUrl(selectedMedia.file_path)}
                alt={selectedMedia.original_filename}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  borderRadius: '0.375rem',
                }}
              />
            ) : (
              <video
                src={getMediaUrl(selectedMedia.file_path)}
                controls
                autoPlay
                style={{
                  maxWidth: '85vw',
                  maxHeight: '80vh',
                  borderRadius: '0.375rem',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
