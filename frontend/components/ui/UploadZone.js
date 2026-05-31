export default function UploadZone({ onSelectFiles }) {
  return (
    <label className="upload-zone glass-panel">
      <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={onSelectFiles} />
      <div>
        <h2>Drop Images Here</h2>
        <p>Upload JPG, PNG, or WEBP files for map extraction.</p>
      </div>
    </label>
  );
}
