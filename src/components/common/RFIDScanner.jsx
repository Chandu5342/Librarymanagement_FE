export function RFIDScanner({
  label,
  value,
  onChange,
  onScan,
  onSimulate,
  simulateLabel = 'Simulate scan',
  placeholder,
  disabled = false,
  status,
}) {
  const handleScan = () => {
    if (value.trim()) onScan(value.trim().toUpperCase())
  }

  return (
    <div className="rfid-station-input">
      <label className="workspace-field">
        {label}
        <input
          className="rfid-input"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleScan()
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          disabled={disabled}
          aria-label={label}
        />
      </label>
      <div className="button-group">
        <button type="button" className="primary-button" onClick={handleScan} disabled={disabled || !value.trim()}>Scan / lookup</button>
        {onSimulate && <button type="button" className="ghost-button" onClick={onSimulate} disabled={disabled}>{simulateLabel}</button>}
        <button type="button" className="ghost-button" onClick={() => onChange('')} disabled={disabled || !value}>Clear</button>
      </div>
      {status && <div className="rfid-scanner-status" role="status">{status}</div>}
    </div>
  )
}
